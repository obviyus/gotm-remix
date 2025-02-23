import { type ActionFunctionArgs, json } from "@remix-run/node";
import { pool } from "~/server/database.server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { invalidateVotingCache } from "~/server/voting.server";

export async function action({ request }: ActionFunctionArgs) {
	const isJson = request.headers
		.get("Content-Type")
		?.includes("application/json");
	let data: {
		monthId: string | null;
		userId: string | null;
		short: boolean;
		order?: number[] | undefined;
	};

	if (isJson) {
		data = await request.json();
	} else {
		const formData = await request.formData();
		data = {
			monthId: formData.get("monthId") as string | null,
			userId: formData.get("userId") as string | null,
			short: formData.get("short") === "true",
			order: formData.get("order")
				? JSON.parse(formData.get("order") as string)
				: undefined,
		};
	}

	const { monthId, userId, short } = data;

	if (!monthId || !userId) {
		return json(
			{ success: false, error: "Missing monthId or userId" },
			{ status: 400 },
		);
	}

	if (request.method === "DELETE") {
		await pool.execute(
			`DELETE v, r
             FROM votes v
                      LEFT JOIN rankings r ON r.vote_id = v.id
             WHERE v.month_id = ?
               AND v.discord_id = ?
               AND v.short = ?;`,
			[monthId, userId, short],
		);

		// Invalidate cache after deleting vote
		invalidateVotingCache(Number(monthId), short);
		return json({ success: true });
	}

	try {
		// Begin transaction to ensure data consistency
		const connection = await pool.getConnection();
		await connection.beginTransaction();

		try {
			// First check if a vote already exists
			const [existingVote] = await connection.execute<RowDataPacket[]>(
				`SELECT id
                 FROM votes
                 WHERE month_id = ?
                   AND discord_id = ?
                   AND short = ?;`,
				[monthId, userId, short],
			);

			let voteId: number;

			if (existingVote[0]?.id) {
				voteId = existingVote[0].id;
				await connection.execute(
					`DELETE
                     FROM rankings
                     WHERE vote_id = ?;`,
					[voteId],
				);
			} else {
				const [insertResult] = await connection.execute<ResultSetHeader>(
					`INSERT INTO votes (month_id, discord_id, short)
                     VALUES (?, ?, ?);`,
					[monthId, userId, short],
				);

				if (insertResult.insertId) {
					voteId = insertResult.insertId;
				} else {
					throw new Error("Failed to create vote - no insert ID returned");
				}
			}

			// Insert new rankings if provided
			if (data.order && data.order.length > 0) {
				const values = data.order.map((nominationId: number, index: number) => [
					voteId,
					nominationId,
					index + 1,
				]);

				const placeholders = values.map(() => "(?, ?, ?)").join(", ");
				await connection.execute(
					`INSERT INTO rankings (vote_id, nomination_id, \`rank\`)
                     VALUES ${placeholders}`,
					values.flat(),
				);
			}

			await connection.commit();
			connection.release();

			// Invalidate cache after successful vote
			invalidateVotingCache(Number(monthId), short);

			return json({ success: true, voteId });
		} catch (error) {
			await connection.rollback();
			connection.release();
			throw error;
		}
	} catch (error) {
		console.error("Error processing vote:", error);
		return json(
			{ success: false, error: "Failed to process vote" },
			{ status: 500 },
		);
	}
}
