import type { Pitch } from "~/types";
import { db } from "~/server/database.server";

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
	}));
}
