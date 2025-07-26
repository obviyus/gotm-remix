import { db } from "~/server/database.server";
import { uniqueNameGenerator } from "~/server/nameGenerator";
import type { Pitch } from "~/types";

export async function getPitchesForNomination(
	nominationId: number,
): Promise<Pitch[]> {
	const result = await db.execute({
		sql: `SELECT id, discord_id, pitch
         FROM pitches
         WHERE nomination_id = ?`,
		args: [nominationId],
	});

	return result.rows.map((row) => ({
		id: Number(row.id),
		nominationId: nominationId,
		discordId: String(row.discord_id),
		pitch: String(row.pitch),
		generatedName: uniqueNameGenerator(String(row.discord_id)),
	}));
}

export async function getPitchesForNominations(
	nominationIds: number[],
): Promise<Record<number, Pitch[]>> {
	if (nominationIds.length === 0) {
		return {};
	}

	const placeholders = nominationIds.map(() => "?").join(",");
	const result = await db.execute({
		sql: `SELECT id, nomination_id, discord_id, pitch
         FROM pitches
         WHERE nomination_id IN (${placeholders})`,
		args: nominationIds,
	});

	// Group pitches by nomination ID
	const pitchesByNomination: Record<number, Pitch[]> = {};

	for (const row of result.rows) {
		const nominationId = Number(row.nomination_id);
		if (!pitchesByNomination[nominationId]) {
			pitchesByNomination[nominationId] = [];
		}

		pitchesByNomination[nominationId].push({
			id: Number(row.id),
			nominationId: nominationId,
			discordId: String(row.discord_id),
			pitch: String(row.pitch),
			generatedName: uniqueNameGenerator(String(row.discord_id)),
		});
	}

	return pitchesByNomination;
}
