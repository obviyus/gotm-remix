import type { Nomination } from "~/types";
import { db } from "~/server/database.server";
import { getPitchesForNomination } from "~/server/pitches.server";

export async function getNominationsForMonth(
	monthId: number,
): Promise<Nomination[]> {
	const result = await db.execute({
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
         WHERE month_id = ?`,
		args: [monthId],
	});

	return Promise.all(
		result.rows.map(async (row) => ({
			id: Number(row.id),
			monthId: monthId,
			gameId: String(row.game_id),
			discordId: String(row.discord_id),
			short: Boolean(row.short),
			gameName: String(row.game_name),
			gameYear: String(row.game_year),
			gameCover: String(row.game_cover),
			gameUrl: String(row.game_url),
			jurySelected: Boolean(row.jury_selected),
			pitches: await getPitchesForNomination(Number(row.id)),
		})),
	);
}

export async function getNominationById(
	nominationId: number,
): Promise<Nomination> {
	const result = await db.execute({
		sql: `SELECT id,
                month_id,
                game_id,
                discord_id,
                short,
                game_name,
                game_year,
                game_cover,
                game_url,
                jury_selected
         FROM nominations
         WHERE id = ?`,
		args: [nominationId],
	});

	if (result.rows.length === 0) {
		throw new Error(`Nomination with ID ${nominationId} not found`);
	}

	const row = result.rows[0];
	return {
		id: Number(row.id),
		monthId: Number(row.month_id),
		gameId: String(row.game_id),
		discordId: String(row.discord_id),
		short: Boolean(row.short),
		gameName: String(row.game_name),
		gameYear: String(row.game_year),
		gameCover: String(row.game_cover),
		gameUrl: String(row.game_url),
		jurySelected: Boolean(row.jury_selected),
		pitches: await getPitchesForNomination(Number(row.id)),
	};
}
