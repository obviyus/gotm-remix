import { db } from "~/server/database.server";
import type { Nomination, Ranking, Vote } from "~/types";
import globalCache from "~/utils/cache.server";

export type Result = {
	source: string;
	target: string;
	weight: string;
};

// Cache TTL - 1 hour
const CACHE_TTL = 1000 * 60 * 60;

export const getNominationsAndVotes = async (
	monthId: number,
	short: boolean,
): Promise<{ nominations: Nomination[]; votes: Vote[] }> => {
	const [nominationsResult, votesResult] = await Promise.all([
		db.execute({
			sql: `SELECT id,
                    game_id,
                    discord_id,
                    short,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    jury_selected
             FROM nominations
             WHERE month_id = ?1
               AND jury_selected = 1
               AND short = ?2
             ORDER BY game_name;`,
			args: [monthId, short ? 1 : 0],
		}),
		db.execute({
			sql: `SELECT v.id, v.month_id, v.short
             FROM votes v
             WHERE v.month_id = ?1
               AND v.short = ?2
               AND EXISTS (SELECT 1
                           FROM rankings r
                           WHERE r.vote_id = v.id)`,
			args: [monthId, short ? 1 : 0],
		}),
	]);

	return {
		nominations: nominationsResult.rows.map(
			(row): Nomination => ({
				id: Number(row.id),
				gameId: String(row.game_id),
				short: Boolean(row.short),
				jurySelected: Boolean(row.jury_selected),
				monthId: monthId,
				gameName: String(row.game_name),
				gameYear: String(row.game_year),
				gameCover: String(row.game_cover),
				gameUrl: String(row.game_url),
				discordId: String(row.discord_id),
				pitches: [],
			}),
		),
		votes: votesResult.rows.map(
			(row): Vote => ({
				id: Number(row.id),
				monthId: Number(row.month_id),
				short: Boolean(row.short),
				discordId: "",
			}),
		),
	};
};

export const getRankingsForVotes = async (
	voteIds: number[],
): Promise<Map<number, Ranking[]>> => {
	if (voteIds.length === 0) return new Map();

	// Create a properly formatted args array for Turso
	const placeholders = `?${",?".repeat(voteIds.length - 1)}`;
	const args = voteIds;

	const rankings = await db.execute({
		sql: `SELECT vote_id, nomination_id, \`rank\`
         FROM rankings
         WHERE vote_id IN (${placeholders})
         ORDER BY vote_id, \`rank\``,
		args,
	});

	const rankingsMap = new Map<number, Ranking[]>();
	for (const row of rankings.rows) {
		const voteId = Number(row.vote_id);
		if (!rankingsMap.has(voteId)) {
			rankingsMap.set(voteId, []);
		}
		rankingsMap.get(voteId)?.push({
			voteId: Number(row.vote_id),
			nominationId: Number(row.nomination_id),
			rank: Number(row.rank),
		});
	}
	return rankingsMap;
};

export const buildInMemoryRankings = async (
	votes: Vote[],
): Promise<Map<number, Ranking[]>> => {
	if (votes.length === 0) return new Map();

	// Use the existing getRankingsForVotes function instead
	return await getRankingsForVotes(votes.map((v) => v.id));
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
			const topNomId = rankings[0].nominationId;
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
		let filtered = rankings.filter((r) => r.nominationId !== loserId);
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

		if (rankings[0].nominationId === loserId) {
			if (rankings.length > 1 && remainingIds.has(rankings[1].nominationId)) {
				const nextTopId = rankings[1].nominationId;
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
			const found = ranks.find((r) => r.nominationId === nom.id);
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

	for (const nomination of nominations) {
		const vertexId = `${nomination.gameName}_${round}`;
		graph.set(vertexId, {
			votes: currentVoteCount[nomination.id],
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

		for (const nomination of remaining) {
			const winnerId = nomination.id;
			const winnerName = nomination.gameName;
			const votesTransferred = transferred.get(winnerId) || 0;

			const nextRoundVertexId = `${winnerName}_${round + 1}`;
			const nextRoundVertex = graph.get(nextRoundVertexId) || {
				votes: 0,
				edges: new Map(),
			};
			nextRoundVertex.votes =
				(currentVoteCount[winnerId] || 0) + votesTransferred;

			const loserVertexId = `${loser.gameName}_${round}`;
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

		const finalVertexId = `${finalNom.gameName}_${round + 1}`;
		const finalVertex = graph.get(finalVertexId) || {
			votes: 0,
			edges: new Map(),
		};
		finalVertex.votes = finalCount;

		const prevVertexId = `${finalNom.gameName}_${round}`;
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
		const cacheKey = `voting-results-${monthId}-${short}`;
		const cached = globalCache.get<Result[]>(cacheKey);

		if (cached) {
			return cached;
		}

		const { nominations, votes } = await getNominationsAndVotes(monthId, short);
		console.log(
			`[Voting] Found ${votes.length} votes for ${short ? "short" : "long"} games`,
		);

		if (votes.length === 0) {
			const emptyResults: Result[] = [];
			globalCache.set(cacheKey, emptyResults, CACHE_TTL);
			return emptyResults;
		}

		const voteRankingsMap = await getRankingsForVotes(votes.map((v) => v.id));
		const initialCounts = getCurrentVoteCount(nominations, voteRankingsMap);
		const viable = nominations.filter((n) => initialCounts[n.id] > 0);

		if (viable.length === 0) {
			const emptyResults: Result[] = [];
			globalCache.set(cacheKey, emptyResults, CACHE_TTL);
			return emptyResults;
		}

		const results = await runRounds(viable, votes);
		globalCache.set(cacheKey, results, CACHE_TTL);
		return results;
	} catch (error) {
		console.error("[Voting] Error calculating results:", error);
		return [];
	}
};

// Function to invalidate cache when votes change
export const invalidateVotingCache = (monthId: number, short: boolean) => {
	const cacheKey = `voting-results-${monthId}-${short}`;
	globalCache.delete(cacheKey);
};

export const getGameUrls = async (
	monthId: number,
): Promise<Record<string, string>> => {
	const nominations = await db.execute({
		sql: "SELECT game_name, game_url FROM nominations WHERE month_id = ?1 AND jury_selected = 1",
		args: [monthId],
	});

	return nominations.rows.reduce((acc: Record<string, string>, nom) => {
		if (nom.game_url) {
			acc[String(nom.game_name)] = String(nom.game_url);
		}
		return acc;
	}, {});
};
