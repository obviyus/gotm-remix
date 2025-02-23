import type { Nomination } from "~/types";
import { pool } from "~/server/database.server";
import type { RowDataPacket } from "mysql2";
import { getPitchesForNomination } from "~/server/pitches.server";

export async function getNominationsForMonth(
	monthId: number,
): Promise<Nomination[]> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT id,
                game_id,
                discord_id,
                short,
                game_name,
                game_year,
                game_cover,
                game_url,
                game_platform_ids,
                jury_selected
         FROM nominations
         WHERE month_id = ?`,
		[monthId],
	);

	return Promise.all(
		rows.map(
			async (row) =>
				({
					id: row.id,
					monthId: monthId,
					gameId: row.game_id,
					discordId: row.discord_id,
					short: row.short,
					gameName: row.game_name,
					gameYear: row.game_year,
					gameCover: row.game_cover,
					gameUrl: row.game_url,
					gamePlatformIds: row.game_platform_ids,
					jurySelected: row.jury_selected,
					pitches: await getPitchesForNomination(row.id),
				}) as Nomination,
		),
	);
}

export async function getNominationById(
	nominationId: number,
): Promise<Nomination> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT id,
                month_id,
                game_id,
                discord_id,
                short,
                game_name,
                game_year,
                game_cover,
                game_url,
                game_platform_ids,
                jury_selected
         FROM nominations
         WHERE id = ?`,
		[nominationId],
	);

	if (rows.length === 0) {
		throw new Error(`Nomination with ID ${nominationId} not found`);
	}

	const row = rows[0];
	return {
		id: row.id,
		monthId: row.month_id,
		gameId: row.game_id,
		discordId: row.discord_id,
		short: row.short,
		gameName: row.game_name,
		gameYear: row.game_year,
		gameCover: row.game_cover,
		gameUrl: row.game_url,
		gamePlatformIds: row.game_platform_ids,
		jurySelected: row.jury_selected,
		pitches: await getPitchesForNomination(row.id),
	} as Nomination;
}
