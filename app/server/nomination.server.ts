import { db } from "~/server/database.server";
import { getPitchesForNominations } from "~/server/pitches.server";
import type { Nomination } from "~/types";

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

	if (result.rows.length === 0) {
		return [];
	}

	// Fetch all pitches in a single query
	const nominationIds = result.rows.map((row) => Number(row.id));
	const pitchesByNomination = await getPitchesForNominations(nominationIds);

	// Map nominations with their pitches
	return result.rows.map((row) => {
		const id = Number(row.id);
		return {
			id,
			monthId,
			gameId: String(row.game_id),
			discordId: String(row.discord_id),
			short: Boolean(row.short),
			gameName: String(row.game_name),
			gameYear: String(row.game_year),
			gameCover: String(row.game_cover),
			gameUrl: String(row.game_url),
			jurySelected: Boolean(row.jury_selected),
			pitches: pitchesByNomination[id] || [],
		};
	});
}

export async function getNominationById(
	nominationId: number,
): Promise<Nomination> {
	// For a single nomination, we can just use the batch function
	const nominations = await getNominationsByIds([nominationId]);

	if (nominations.length === 0) {
		throw new Error(`Nomination with ID ${nominationId} not found`);
	}

	return nominations[0];
}

export async function getNominationsByIds(
	nominationIds: number[],
): Promise<Nomination[]> {
	if (nominationIds.length === 0) {
		return [];
	}

	const placeholders = nominationIds.map(() => "?").join(",");
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
         WHERE id IN (${placeholders})`,
		args: nominationIds,
	});

	// Fetch all pitches for these nominations in a single query
	const pitchesByNomination = await getPitchesForNominations(
		result.rows.map((row) => Number(row.id)),
	);

	return result.rows.map((row) => {
		const id = Number(row.id);
		return {
			id,
			monthId: Number(row.month_id),
			gameId: String(row.game_id),
			discordId: String(row.discord_id),
			short: Boolean(row.short),
			gameName: String(row.game_name),
			gameYear: String(row.game_year),
			gameCover: String(row.game_cover),
			gameUrl: String(row.game_url),
			jurySelected: Boolean(row.jury_selected),
			pitches: pitchesByNomination[id] || [],
		};
	});
}
