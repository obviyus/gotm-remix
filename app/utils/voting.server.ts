import type { RowDataPacket } from "mysql2";
import { pool } from "./database.server";

// Cache structure to store voting results
const resultsCache = new Map<string, { results: Result[], timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export interface Month {
	id: number;
	month: number;
	year: number;
	theme?: {
		name: string;
		description: string | null;
	};
}

export type Result = {
	source: string;
	target: string;
	weight: string;
};

export type Nomination = {
	id: number;
	game_name: string;
	month_id: number;
	short: boolean;
};

export type Vote = {
	id: number;
	month_id: number;
	short: boolean;
};

export type Ranking = {
	nomination_id: number;
	rank: number;
};

export const getMonth = async (monthId: number): Promise<Month> => {
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

export const getNominationsAndVotes = async (
	monthId: number,
	short: boolean,
): Promise<{ nominations: Nomination[], votes: Vote[] }> => {
	const [nominationsResult, votesResult] = await Promise.all([
		pool.execute<RowDataPacket[]>(
			`SELECT id, game_name, month_id, short
             FROM nominations
             WHERE month_id = ?
               AND jury_selected = 1
               AND short = ?
             ORDER BY game_name;`,
			[monthId, short],
		),
		pool.execute<RowDataPacket[]>(
			`SELECT v.id, v.month_id, v.short
             FROM votes v
             WHERE v.month_id = ?
               AND v.short = ?
               AND EXISTS (
                 SELECT 1 FROM rankings r 
                 WHERE r.vote_id = v.id
               )`,
			[monthId, short],
		),
	]);

	return {
		nominations: nominationsResult[0] as Nomination[],
		votes: votesResult[0] as Vote[],
	};
};

export const getRankingsForVotes = async (
	voteIds: number[],
): Promise<Map<number, Ranking[]>> => {
	if (voteIds.length === 0) return new Map();

	// Handle empty array case for MySQL
	const placeholders = Array(voteIds.length).fill('?').join(',');
	const [rankings] = await pool.execute<RowDataPacket[]>(
		`SELECT vote_id, nomination_id, \`rank\`
         FROM rankings
         WHERE vote_id IN (${placeholders})
         ORDER BY vote_id, \`rank\``,
		[...voteIds], // Spread the array to prevent nested array issues
	);

	const rankingsMap = new Map<number, Ranking[]>();
	for (const row of rankings as RowDataPacket[]) {
		const voteId = row.vote_id;
		if (!rankingsMap.has(voteId)) {
			rankingsMap.set(voteId, []);
		}
		rankingsMap.get(voteId)?.push({
			nomination_id: row.nomination_id,
			rank: row.rank,
		});
	}
	return rankingsMap;
};

export const buildInMemoryRankings = async (
	votes: Vote[],
): Promise<Map<number, Ranking[]>> => {
    if (votes.length === 0) return new Map();
    
    // Use the existing getRankingsForVotes function instead
    const rankingsMap = await getRankingsForVotes(votes.map(v => v.id));
    return rankingsMap;
};

export const getCurrentVoteCount = (
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

export const eliminateNominationFromRankings = (
	loserId: number,
	voteRankingsMap: Map<number, Ranking[]>,
) => {
	for (const [voteId, rankings] of voteRankingsMap.entries()) {
		let filtered = rankings.filter((r) => r.nomination_id !== loserId);
		filtered = filtered.map((r, idx) => ({ ...r, rank: idx + 1 }));
		voteRankingsMap.set(voteId, filtered);
	}
};

export const transferVotes = (
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

		if (rankings[0].nomination_id === loserId) {
			if (rankings.length > 1 && remainingIds.has(rankings[1].nomination_id)) {
				const nextTopId = rankings[1].nomination_id;
				transferred.set(nextTopId, (transferred.get(nextTopId) || 0) + 1);
			}
		}
	}

	return transferred;
};

export const calculateWeightedScores = async (
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

export const runRounds = async (
	initialNominations: Nomination[],
	votes: Vote[],
): Promise<Result[]> => {
	const graph = new Map<
		string,
		{ votes: number; edges: Map<string, number> }
	>();
	const results: Result[] = [];

	const voteRankingsMap = await buildInMemoryRankings(votes);

	let nominations = [...initialNominations];
	let round = 1;

	let currentVoteCount = getCurrentVoteCount(nominations, voteRankingsMap);
	let nominationWeightedScores = await calculateWeightedScores(
		nominations,
		votes,
		voteRankingsMap,
	);

	for (const nom of nominations) {
		const vertexId = `${nom.game_name}_${round}`;
		graph.set(vertexId, {
			votes: currentVoteCount[nom.id],
			edges: new Map(),
		});
	}

	while (nominations.length > 1) {
		nominations.sort((a, b) => {
			const aScore = currentVoteCount[a.id];
			const bScore = currentVoteCount[b.id];
			if (aScore !== bScore) {
				return aScore - bScore;
			}
			return (
				(nominationWeightedScores.get(a.id) ?? 0) -
				(nominationWeightedScores.get(b.id) ?? 0)
			);
		});

		const loser = nominations.shift();
		if (!loser) break;

		const remaining = [...nominations];

		const transferred = transferVotes(
			loser.id,
			remaining,
			votes,
			voteRankingsMap,
		);

		eliminateNominationFromRankings(loser.id, voteRankingsMap);

		for (const nom of remaining) {
			const winnerId = nom.id;
			const winnerName = nom.game_name;
			const votesTransferred = transferred.get(winnerId) || 0;

			const nextRoundVertexId = `${winnerName}_${round + 1}`;
			const nextRoundVertex = graph.get(nextRoundVertexId) || {
				votes: 0,
				edges: new Map(),
			};
			nextRoundVertex.votes =
				(currentVoteCount[winnerId] || 0) + votesTransferred;

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

		currentVoteCount = getCurrentVoteCount(remaining, voteRankingsMap);
		nominationWeightedScores = await calculateWeightedScores(
			remaining,
			votes,
			voteRankingsMap,
		);
		round++;
		nominations = remaining;
	}

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

		const prevVertexId = `${finalNom.game_name}_${round}`;
		const prevVertex = graph.get(prevVertexId) || {
			votes: 0,
			edges: new Map(),
		};
		prevVertex.edges.set(finalVertexId, finalCount);

		graph.set(finalVertexId, finalVertex);
		graph.set(prevVertexId, prevVertex);
	}

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

export const calculateVotingResults = async (
	monthId: number,
	short: boolean,
): Promise<Result[]> => {
	try {
		const cacheKey = `${monthId}-${short}`;
		const cached = resultsCache.get(cacheKey);
		
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.results;
		}

		const { nominations, votes } = await getNominationsAndVotes(monthId, short);
		console.log(`[Voting] Found ${votes.length} votes for ${short ? 'short' : 'long'} games`);

		if (votes.length === 0) {
			const emptyResults: Result[] = [];
			resultsCache.set(cacheKey, { results: emptyResults, timestamp: Date.now() });
			return emptyResults;
		}

		const voteRankingsMap = await getRankingsForVotes(votes.map(v => v.id));		
		const initialCounts = getCurrentVoteCount(nominations, voteRankingsMap);
		const viable = nominations.filter((n) => initialCounts[n.id] > 0);

		if (viable.length === 0) {
			const emptyResults: Result[] = [];
			resultsCache.set(cacheKey, { results: emptyResults, timestamp: Date.now() });
			return emptyResults;
		}

		const results = await runRounds(viable, votes);
		resultsCache.set(cacheKey, { results, timestamp: Date.now() });
		return results;
	} catch (error) {
		console.error('[Voting] Error calculating results:', error);
		return [];
	}
};

// Function to invalidate cache when votes change
export const invalidateVotingCache = (monthId: number, short: boolean) => {
	const cacheKey = `${monthId}-${short}`;
	resultsCache.delete(cacheKey);
};

export const getGameUrls = async (monthId: number): Promise<Record<string, string>> => {
	const [nominations] = await pool.execute<RowDataPacket[]>(
		'SELECT game_name, game_url FROM nominations WHERE month_id = ? AND jury_selected = 1',
		[monthId],
	);

	return nominations.reduce(
		(acc, nom) => {
			if (nom.game_url) {
				acc[nom.game_name] = nom.game_url;
			}
			return acc;
		},
		{} as Record<string, string>,
	);
};
