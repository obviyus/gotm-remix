import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { pool } from "~/utils/database.server";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo } from "react";
import type { RowDataPacket } from "mysql2";

interface Month {
	id: number;
	month: string;
	year: number;
}

type Result = {
	source: string;
	target: string;
	weight: string;
};

type Nomination = {
	id: number;
	game_name: string;
	month_id: number;
	short: boolean;
};

type Vote = {
	id: number;
	month_id: number;
	short: boolean;
};

type Ranking = {
	nomination_id: number;
	rank: number;
};

type LoaderData = {
	month: Month;
	results: {
		long: Result[];
		short: Result[];
	};
};

const getMonth = async (monthId: number): Promise<Month> => {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, month, year
         FROM months
         WHERE id = ?;`,
		[monthId],
	);
	const month = rows[0] as Month;
	if (!month) {
		throw new Response("Month not found", { status: 404 });
	}
	return month;
};

const getNominations = async (
	monthId: number,
	short: boolean,
): Promise<Nomination[]> => {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, game_name, month_id, short
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = ?;`,
		[monthId, short],
	);
	return rows as Nomination[];
};

const getVotes = async (monthId: number, short: boolean): Promise<Vote[]> => {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, month_id, short
         FROM votes
         WHERE month_id = ?
           AND short = ?;`,
		[monthId, short],
	);
	return rows as Vote[];
};

/** Get all rankings for a given vote ID, sorted by ascending rank. */
const getRankingsForVote = async (voteId: number): Promise<Ranking[]> => {
	const [rankings] = await pool.execute<RowDataPacket[]>(
		`SELECT nomination_id, \`rank\`
         FROM rankings
         WHERE vote_id = ?
         ORDER BY \`rank\`;`,
		[voteId],
	);
	return rankings as Ranking[];
};

/**
 * Build an in-memory map of each vote's ranking array so we can
 * update it each round (removing eliminated nominations).
 */
const buildInMemoryRankings = async (
	votes: Vote[],
): Promise<Map<number, Ranking[]>> => {
	const map = new Map<number, Ranking[]>();
	for (const vote of votes) {
		const rankings = await getRankingsForVote(vote.id);
		map.set(vote.id, [...rankings]);
	}
	return map;
};

/**
 * Get each nomination's current top-choice count from the in-memory
 * map, ignoring nominations that are no longer at rank 1 (for each vote).
 */
const getCurrentVoteCount = (
	nominations: Nomination[],
	voteRankingsMap: Map<number, Ranking[]>,
): Record<number, number> => {
	const voteCount: Record<number, number> = {};
	for (const nom of nominations) {
		voteCount[nom.id] = 0;
	}

	for (const [, rankings] of voteRankingsMap) {
		if (rankings.length > 0) {
			const topNomId = rankings[0].nomination_id;
			if (topNomId in voteCount) {
				voteCount[topNomId]++;
			}
		}
	}

	return voteCount;
};

/**
 * Remove `loserId` from every vote's rankings. After removal, re-label
 * ranks so that the new top choice is rank=1, etc.
 */
const eliminateNominationFromRankings = (
	loserId: number,
	voteRankingsMap: Map<number, Ranking[]>,
) => {
	for (const [voteId, rankings] of voteRankingsMap.entries()) {
		let filtered = rankings.filter((r) => r.nomination_id !== loserId);
		filtered = filtered.map((r, idx) => ({ ...r, rank: idx + 1 }));
		voteRankingsMap.set(voteId, filtered);
	}
};

/**
 * Tally how many votes get transferred from `loserId` to a new top choice
 * for each vote (for graph edges). This does not modify the in-memory
 * arrays; it just calculates how many votes the loser was holding
 * that now move to someone else.
 *
 * Note: We assume `eliminateNominationFromRankings(loserId, ...)` will be
 * called either right before or right after we do this, so that the next
 * top choice is accurate.
 */
const transferVotes = (
	loserId: number,
	remainingNoms: Nomination[],
	votes: Vote[],
	voteRankingsMap: Map<number, Ranking[]>,
): Map<number, number> => {
	const transferred = new Map<number, number>();
	const remainingIds = new Set(remainingNoms.map((n) => n.id));

	for (const vote of votes) {
		const rankings = voteRankingsMap.get(vote.id) ?? [];
		if (rankings.length === 0) continue;

		// If the current top is loserId, then rank[0] must be the loser.
		// The next top choice is rank[1], if it exists in remainingIds.
		if (rankings[0].nomination_id === loserId) {
			// After elimination, rank[0] will be gone, so the new top is rank[1].
			if (rankings.length > 1 && remainingIds.has(rankings[1].nomination_id)) {
				const nextTopId = rankings[1].nomination_id;
				transferred.set(nextTopId, (transferred.get(nextTopId) || 0) + 1);
			}
		}
	}

	return transferred;
};

/**
 * Weighted score tie-break. The array is reversed so rank=1 is biggest weight.
 * If rank=1 => weight=numberOfNoms, rank=2 => weight=numberOfNoms-1, etc.
 */
const calculateWeightedScores = async (
	nominations: Nomination[],
	votes: Vote[],
	voteRankingsMap: Map<number, Ranking[]>,
): Promise<Map<number, number>> => {
	const maxRank = nominations.length;
	const rankWeights = Array.from({ length: maxRank }, (_, i) => maxRank - i);

	const weighted = new Map<number, number>();
	for (const nom of nominations) {
		let sum = 0;
		for (const vote of votes) {
			const ranks = voteRankingsMap.get(vote.id) ?? [];
			const found = ranks.find((r) => r.nomination_id === nom.id);
			if (found) {
				sum += rankWeights[found.rank - 1] || 0;
			}
		}
		weighted.set(nom.id, sum);
	}
	return weighted;
};

const runRounds = async (
	initialNominations: Nomination[],
	votes: Vote[],
): Promise<Result[]> => {
	// Graph in memory, keyed by vertex string => { votes, edges }
	const graph = new Map<
		string,
		{ votes: number; edges: Map<string, number> }
	>();
	const results: Result[] = [];

	// In-memory copy of each vote's rankings
	const voteRankingsMap = await buildInMemoryRankings(votes);

	let nominations = [...initialNominations];
	let round = 1;

	// Count at the start
	let currentVoteCount = getCurrentVoteCount(nominations, voteRankingsMap);
	let nominationWeightedScores = await calculateWeightedScores(
		nominations,
		votes,
		voteRankingsMap,
	);

	// Create initial round vertices
	for (const nom of nominations) {
		const vertexId = `${nom.game_name}_${round}`;
		graph.set(vertexId, {
			votes: currentVoteCount[nom.id],
			edges: new Map(),
		});
	}

	while (nominations.length > 1) {
		// Sort ascending by (top-choice votes, weightedScore).
		// The first item is the loser, so shift() removes it.
		nominations.sort((a, b) => {
			const aScore = currentVoteCount[a.id];
			const bScore = currentVoteCount[b.id];
			if (aScore !== bScore) {
				return aScore - bScore; // ascending
			}
			// tie-break by weighted score
			return (
				(nominationWeightedScores.get(a.id) ?? 0) -
				(nominationWeightedScores.get(b.id) ?? 0)
			);
		});

		const loser = nominations.shift(); // lowest is loser
		if (!loser) break;

		const remaining = [...nominations];

		// Transfer the “loser’s” votes for edge-building
		const transferred = transferVotes(
			loser.id,
			remaining,
			votes,
			voteRankingsMap,
		);

		// Now remove the loser from the in-memory rankings
		eliminateNominationFromRankings(loser.id, voteRankingsMap);

		// Build next-round vertices and edges
		for (const nom of remaining) {
			const winnerId = nom.id;
			const winnerName = nom.game_name;
			const votesTransferred = transferred.get(winnerId) || 0;

			// Next round's vertex
			const nextRoundVertexId = `${winnerName}_${round + 1}`;
			const nextRoundVertex = graph.get(nextRoundVertexId) || {
				votes: 0,
				edges: new Map(),
			};
			// Add old votes + newly transferred votes
			nextRoundVertex.votes =
				(currentVoteCount[winnerId] || 0) + votesTransferred;

			// Connect edges from loser and winner’s current round
			const loserVertexId = `${loser.game_name}_${round}`;
			const loserVertex = graph.get(loserVertexId) || {
				votes: 0,
				edges: new Map(),
			};
			loserVertex.edges.set(nextRoundVertexId, votesTransferred);

			const currentRoundWinnerId = `${winnerName}_${round}`;
			const currentRoundWinnerVertex = graph.get(currentRoundWinnerId) || {
				votes: 0,
				edges: new Map(),
			};
			currentRoundWinnerVertex.edges.set(
				nextRoundVertexId,
				currentVoteCount[winnerId],
			);

			graph.set(nextRoundVertexId, nextRoundVertex);
			graph.set(loserVertexId, loserVertex);
			graph.set(currentRoundWinnerId, currentRoundWinnerVertex);
		}

		// Recount with the updated in-memory arrays
		currentVoteCount = getCurrentVoteCount(remaining, voteRankingsMap);
		nominationWeightedScores = await calculateWeightedScores(
			remaining,
			votes,
			voteRankingsMap,
		);
		round++;
		nominations = remaining;
	}

	// If there is exactly 1 nomination left, do a final round vertex for it
	if (nominations.length === 1) {
		const finalNom = nominations[0];
		const finalCount =
			getCurrentVoteCount([finalNom], voteRankingsMap)[finalNom.id] || 0;

		const finalVertexId = `${finalNom.game_name}_${round + 1}`;
		const finalVertex = graph.get(finalVertexId) || {
			votes: 0,
			edges: new Map(),
		};
		finalVertex.votes = finalCount;

		// Connect from the previous round's vertex to this final round vertex
		const prevVertexId = `${finalNom.game_name}_${round}`;
		const prevVertex = graph.get(prevVertexId) || {
			votes: 0,
			edges: new Map(),
		};
		prevVertex.edges.set(finalVertexId, finalCount);

		graph.set(finalVertexId, finalVertex);
		graph.set(prevVertexId, prevVertex);
	}

	// Build the results array from the graph
	for (const [source, sourceData] of graph) {
		const [sourceName, sourceRound] = source.split("_");
		for (const [target, weight] of sourceData.edges) {
			const [targetName, targetRound] = target.split("_");
			const t = graph.get(target);

			results.push({
				source: `${sourceName} (${sourceData.votes})${" ".repeat(Number.parseInt(sourceRound, 10))}`,
				target: `${targetName} (${t?.votes})${" ".repeat(Number.parseInt(targetRound, 10))}`,
				weight: String(weight),
			});
		}
	}

	return results;
};

const calculateVotingResults = async (
	monthId: number,
	short: boolean,
): Promise<Result[]> => {
	const nominations = await getNominations(monthId, short);
	const votes = await getVotes(monthId, short);

	// If no votes at all, no graph
	if (votes.length === 0) {
		return [];
	}

	// Identify which nominations have at least 1 first-choice vote
	const voteRankingsMap = await buildInMemoryRankings(votes);
	const initialCounts = getCurrentVoteCount(nominations, voteRankingsMap);
	const viable = nominations.filter((n) => initialCounts[n.id] > 0);

	if (viable.length === 0) {
		return [];
	}

	return runRounds(viable, votes);
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
	const monthId = Number(params.monthId);
	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	const month = await getMonth(monthId);
	const results = {
		long: await calculateVotingResults(monthId, false),
		short: await calculateVotingResults(monthId, true),
	};

	return Response.json({ month, results });
};

export default function HistoryMonth() {
	const { month, results } = useLoaderData<LoaderData>();

	const longGamesCanvasId = useMemo(
		() => `longGamesChart-${month.month}-${month.year}`,
		[month],
	);
	const shortGamesCanvasId = useMemo(
		() => `shortGamesChart-${month.month}-${month.year}`,
		[month],
	);

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<header className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
					Voting Results - {month.month}/{month.year}
				</h1>
			</header>

			<div className="space-y-6">
				<VotingResultsChart
					canvasId={longGamesCanvasId}
					results={results.long}
				/>
				<VotingResultsChart
					canvasId={shortGamesCanvasId}
					results={results.short}
				/>
			</div>
		</div>
	);
}
