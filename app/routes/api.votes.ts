import { json } from "@remix-run/node";
import { pool } from "~/utils/database.server";

export async function action({ request }: { request: Request }) {
	if (request.method === "DELETE") {
		const { monthId, userId, short } = await request.json();

		await pool.execute(
			`DELETE v, r 
			 FROM votes v 
			 LEFT JOIN rankings r ON r.vote_id = v.id 
			 WHERE v.month_id = ? AND v.discord_id = ? AND v.short = ?`,
			[monthId, userId, short],
		);

		return json({ success: true });
	}

	const { monthId, userId, short, order } = await request.json();

	await pool.execute(
		`INSERT INTO votes (month_id, discord_id, short) 
     VALUES (?, ?, ?) 
     ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
		[monthId, userId, short],
	);

	const [result] = await pool.execute("SELECT LAST_INSERT_ID() as id");
	const voteId = result[0].id;

	// Delete existing rankings
	await pool.execute("DELETE FROM rankings WHERE vote_id = ?", [voteId]);

	// Insert new rankings
	for (let i = 0; i < order.length; i++) {
		if (order[i] === "divider") break;

		await pool.execute(
			`INSERT INTO rankings (vote_id, nomination_id, rank) 
       VALUES (?, ?, ?)`,
			[voteId, order[i], i + 1],
		);
	}

	return json({ success: true });
}
