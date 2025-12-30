import { db } from "~/server/database.server";
import { calculateIRV } from "~/server/voting-logic";
import type { Nomination, Ranking, Vote } from "~/types";
import globalCache from "~/utils/cache.server";

export type Result = {
	source: string;
	target: string;
	weight: string;
};

// Cache TTL - 1 hour
const CACHE_TTL = 1000 * 60 * 60;

const getNominationsAndVotes = async (
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

const getRankingsForVotes = async (
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

		// Single-pass: build votesWithRankings and collect nomination IDs simultaneously
		const nominationsWithRankings = new Set<number>();
		const votesWithRankings: Array<{ id: number; rankings: Ranking[] }> = [];

		for (const v of votes) {
			const rankings = voteRankingsMap.get(v.id);
			if (rankings && rankings.length > 0) {
				votesWithRankings.push({ id: v.id, rankings });
				for (const r of rankings) {
					nominationsWithRankings.add(r.nominationId);
				}
			}
		}

		const viable = nominations.filter((n) =>
			nominationsWithRankings.has(n.id),
		);

		if (viable.length === 0) {
			const emptyResults: Result[] = [];
			globalCache.set(cacheKey, emptyResults, CACHE_TTL);
			return emptyResults;
		}

		const results = calculateIRV(viable, votesWithRankings);
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

	const urls: Record<string, string> = {};
	for (const nom of nominations.rows) {
		if (nom.game_url) {
			urls[String(nom.game_name)] = String(nom.game_url);
		}
	}
	return urls;
};

export const getTotalVotesForMonth = async (
	monthId: number,
): Promise<number> => {
	const result = await db.execute({
		sql: `SELECT COUNT(*) AS total_votes
         FROM votes v
         WHERE v.month_id = ?1
           AND EXISTS (SELECT 1
                       FROM rankings r
                       WHERE r.vote_id = v.id)`,
		args: [monthId],
	});

	return Number(
		(result.rows[0] as { total_votes?: number | string }).total_votes ?? 0,
	);
};
