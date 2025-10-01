import { db } from "~/server/database.server";
import { calculateVotingResults } from "~/server/voting.server";
import type { Nomination } from "~/types";
import { getWinnerName } from "~/utils/votingResults";

const normalizeGameName = (value: string): string =>
	value
		.normalize("NFKC")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();

export async function calculateAndStoreWinner(
	monthId: number,
	short: boolean,
): Promise<Nomination | null> {
	try {
		// Get voting results
		const results = await calculateVotingResults(monthId, short);
		if (results.length === 0) {
			return null;
		}

		// Find the winner from the results
		const winnerName = getWinnerName(results);
		if (!winnerName) {
			return null;
		}
		// Get nomination details for the winner
		const nominations = await db.execute({
			sql: `SELECT game_id,
                    id as nomination_id,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    discord_id
             FROM nominations
             WHERE month_id = ?1
               AND short = ?2
               AND jury_selected = 1;`,
			args: [monthId, short ? 1 : 0],
		});

		if (!nominations.rows.length) {
			return null;
		}

		const normalizedWinner = normalizeGameName(winnerName);
		const nomination = nominations.rows.find(
			(row) => normalizeGameName(String(row.game_name)) === normalizedWinner,
		);

		if (!nomination) {
			return null;
		}
		const winner: Nomination = {
			id: Number(nomination.nomination_id),
			gameId: String(nomination.game_id),
			monthId: monthId,
			short: short,
			gameName: String(nomination.game_name),
			gameYear: String(nomination.game_year),
			gameCover: String(nomination.game_cover),
			gameUrl: String(nomination.game_url),
			jurySelected: true,
			discordId: String(nomination.discord_id),
			pitches: [],
		};

		// Replace any previously stored winner for this month/ballot length
		await db.execute({
			sql: `DELETE FROM winners
			      WHERE month_id = ?1
			        AND short = ?2;`,
			args: [winner.monthId, winner.short ? 1 : 0],
		});

		// Update or insert the winner using SQLite's UPSERT syntax
		await db.execute({
			sql: `INSERT INTO winners (
					game_id, 
					month_id, 
					nomination_id, 
					short, 
					game_name, 
					game_year, 
					game_cover, 
					game_url,
					created_at, 
					updated_at
				)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, unixepoch(), unixepoch())
				ON CONFLICT(game_id) DO UPDATE SET 
					nomination_id = ?3,
					game_name = ?5,
					game_year = ?6,
					game_cover = ?7,
					game_url = ?8,
					updated_at = unixepoch();`,
			args: [
				winner.gameId || "",
				winner.monthId,
				winner.id,
				winner.short ? 1 : 0,
				winner.gameName || "",
				winner.gameYear || "",
				winner.gameCover || "",
				winner.gameUrl || "",
			],
		});

		return winner;
	} catch (error) {
		console.error("[Winner] Error calculating and storing winner:", error);
		return null;
	}
}

export async function getWinner(
	monthId: number,
	short: boolean,
): Promise<Nomination | null> {
	try {
		const winners = await db.execute({
			sql: `SELECT game_id,
                    month_id,
                    nomination_id,
                    short,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    updated_at
             FROM winners
             WHERE month_id = ?1
               AND short = ?2
             ORDER BY updated_at DESC
             LIMIT 1;`,
			args: [monthId, short ? 1 : 0],
		});

		if (!winners.rows.length) {
			try {
				return await calculateAndStoreWinner(monthId, short);
			} catch (calcError) {
				console.error(
					`[Winner] Error calculating winner for month ${monthId} (short: ${short}):`,
					calcError,
				);
				return null;
			}
		}

		const winner = winners.rows[0];
		return {
			id: Number(winner.nomination_id),
			gameId: String(winner.game_id),
			monthId: Number(winner.month_id),
			short: Boolean(winner.short),
			gameName: String(winner.game_name),
			gameYear: String(winner.game_year),
			gameCover: String(winner.game_cover),
			gameUrl: String(winner.game_url),
			jurySelected: true,
			discordId: "",
			pitches: [],
		};
	} catch (error) {
		console.error("[Winner] Error getting winner:", error);
		return null;
	}
}

export async function recalculateAllWinners(): Promise<void> {
	try {
		// Get all months
		const months = await db.execute({
			sql: `SELECT id
             FROM months
             ORDER BY year DESC, month DESC;`,
			args: [],
		});

		const recalculationTasks = months.rows.flatMap((month) => [
			calculateAndStoreWinner(Number(month.id), true),
			calculateAndStoreWinner(Number(month.id), false),
		]);

		await Promise.all(recalculationTasks);
	} catch (error) {
		console.error("[Winner] Error recalculating all winners:", error);
	}
}
