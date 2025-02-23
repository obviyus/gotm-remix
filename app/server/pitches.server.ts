import type { RowDataPacket } from "mysql2";
import type { Pitch } from "~/types";
import { pool } from "~/server/database.server";

export async function getPitchesForNomination(
	nominationId: number,
): Promise<Pitch[]> {
	const [rows] = await pool.query<RowDataPacket[]>(
		`SELECT id, discord_id, pitch
         FROM pitches
         WHERE nomination_id = ?`,
		[nominationId],
	);

	return rows.map((row) => ({
		id: row.id,
		nominationId: nominationId,
		discordId: row.discord_id,
		pitch: row.pitch,
	}));
}
