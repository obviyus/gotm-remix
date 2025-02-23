import { pool } from "./database.server";
import type { RowDataPacket } from "mysql2";
import { calculateVotingResults } from "~/server/voting.server";
import type { Nomination } from "~/types";

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
		// The winner is the target of the last edge in the results array
		const lastResult = results[results.length - 1];
		const winnerNameWithVotes = lastResult.target;
		const winnerName = winnerNameWithVotes.split(" (")[0];

		// Get nomination details for the winner
		const [nominations] = await pool.execute<RowDataPacket[]>(
			`SELECT game_id,
                    id as nomination_id,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    game_platform_ids,
                    discord_id
             FROM nominations
             WHERE month_id = ?
               AND short = ?
               AND game_name = ?
               AND jury_selected = 1
             LIMIT 1;`,
			[monthId, short, winnerName],
		);

		if (!nominations.length) {
			return null;
		}

		const nomination = nominations[0];
		const winner: Nomination = {
			id: nomination.nomination_id,
			gameId: nomination.game_id,
			monthId: monthId,
			short: short,
			gameName: nomination.game_name,
			gameYear: nomination.game_year,
			gameCover: nomination.game_cover,
			gameUrl: nomination.game_url,
			gamePlatformIds: nomination.game_platform_ids,
			jurySelected: true,
			discordId: nomination.discord_id,
			pitches: [],
		};

		// Update or insert the winner
		await pool.execute(
			`INSERT INTO winners (game_id, month_id, nomination_id, short, game_name, game_year, game_cover, game_url,
                                  game_platform_ids, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE nomination_id     = VALUES(nomination_id),
                                     game_name         = VALUES(game_name),
                                     game_year         = VALUES(game_year),
                                     game_cover        = VALUES(game_cover),
                                     game_url          = VALUES(game_url),
                                     game_platform_ids = VALUES(game_platform_ids),
                                     updated_at        = NOW();`,
			[
				winner.gameId,
				winner.monthId,
				winner.id,
				winner.short,
				winner.gameName,
				winner.gameYear,
				winner.gameCover,
				winner.gameUrl,
				winner.gamePlatformIds,
			],
		);

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
		const [winners] = await pool.execute<RowDataPacket[]>(
			`SELECT game_id,
                    month_id,
                    nomination_id,
                    short,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    game_platform_ids
             FROM winners
             WHERE month_id = ?
               AND short = ?;`,
			[monthId, short],
		);

		if (!winners.length) {
			return calculateAndStoreWinner(monthId, short);
		}

		return {
			id: winners[0].nomination_id,
			gameId: winners[0].game_id,
			monthId: winners[0].month_id,
			short: winners[0].short,
			gameName: winners[0].game_name,
			gameYear: winners[0].game_year,
			gameCover: winners[0].game_cover,
			gameUrl: winners[0].game_url,
			gamePlatformIds: winners[0].game_platform_ids,
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
		const [months] = await pool.execute<RowDataPacket[]>(
			`SELECT id
             FROM months
             ORDER BY year DESC, month DESC;`,
		);

		for (const month of months) {
			// Calculate and store winners for both short and long games
			await calculateAndStoreWinner(month.id, true);
			await calculateAndStoreWinner(month.id, false);
		}
	} catch (error) {
		console.error("[Winner] Error recalculating all winners:", error);
	}
}
