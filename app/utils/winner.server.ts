import { pool } from "./database.server";
import type { RowDataPacket } from "mysql2";
import { calculateVotingResults } from "~/utils/voting.server";

interface Winner {
    game_id: string;
    month_id: number;
    nomination_id: number;
    short: boolean;
    game_name: string;
    game_year: string | null;
    game_cover: string | null;
    game_url: string | null;
    game_platform_ids: string | null;
    created_at: Date;
    updated_at: Date;
}

export async function calculateAndStoreWinner(monthId: number, short: boolean): Promise<Winner | null> {
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
            'SELECT game_id, id as nomination_id, game_name, game_year, game_cover, game_url, game_platform_ids FROM nominations WHERE month_id = ? AND short = ? AND game_name = ? AND jury_selected = 1 LIMIT 1',
            [monthId, short, winnerName]
        );

        if (!nominations.length) {
            return null;
        }

        const nomination = nominations[0];
        const now = new Date();

        const winner: Winner = {
            game_id: nomination.game_id,
            month_id: monthId,
            nomination_id: nomination.nomination_id,
            short: short,
            game_name: nomination.game_name,
            game_year: nomination.game_year,
            game_cover: nomination.game_cover,
            game_url: nomination.game_url,
            game_platform_ids: nomination.game_platform_ids,
            created_at: now,
            updated_at: now,
        };

        // Update or insert the winner
        await pool.execute(
            'INSERT INTO winners (game_id, month_id, nomination_id, short, game_name, game_year, game_cover, game_url, game_platform_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nomination_id = VALUES(nomination_id), game_name = VALUES(game_name), game_year = VALUES(game_year), game_cover = VALUES(game_cover), game_url = VALUES(game_url), game_platform_ids = VALUES(game_platform_ids), updated_at = VALUES(updated_at)',
            [
                winner.game_id,
                winner.month_id,
                winner.nomination_id,
                winner.short,
                winner.game_name,
                winner.game_year,
                winner.game_cover,
                winner.game_url,
                winner.game_platform_ids,
                winner.created_at,
                winner.updated_at,
            ]
        );

        return winner;
    } catch (error) {
        console.error('[Winner] Error calculating and storing winner:', error);
        return null;
    }
}

export async function getWinner(monthId: number, short: boolean): Promise<Winner | null> {
    try {
        const [winners] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM winners WHERE month_id = ? AND short = ?',
            [monthId, short]
        );

        if (!winners.length) {
            return calculateAndStoreWinner(monthId, short);
        }

        return winners[0] as Winner;
    } catch (error) {
        console.error('[Winner] Error getting winner:', error);
        return null;
    }
}

export async function recalculateAllWinners(): Promise<void> {
    try {
        // Get all months
        const [months] = await pool.execute<RowDataPacket[]>(
            'SELECT id FROM months ORDER BY year DESC, month DESC'
        );

        for (const month of months) {
            // Calculate and store winners for both short and long games
            await calculateAndStoreWinner(month.id, true);
            await calculateAndStoreWinner(month.id, false);
        }
    } catch (error) {
        console.error('[Winner] Error recalculating all winners:', error);
    }
}