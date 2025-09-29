import { db } from "~/server/database.server";
import { invalidateVotingCache } from "~/server/voting.server";
import type { Route } from "./+types/api.votes";

export async function action({ request }: Route.ActionArgs) {
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
		return Response.json(
			{ success: false, error: "Missing monthId or userId" },
			{ status: 400 },
		);
	}

	if (request.method === "DELETE") {
		// Delete vote and associated rankings
		await db.execute({
			sql: "DELETE FROM rankings WHERE vote_id IN (SELECT id FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?)",
			args: [monthId, userId, short ? 1 : 0],
		});

		await db.execute({
			sql: "DELETE FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?",
			args: [monthId, userId, short ? 1 : 0],
		});

		// Invalidate cache after deleting vote
		invalidateVotingCache(Number(monthId), short);
		return Response.json({ success: true });
	}

	try {
		// First check if a vote already exists
		const existingVote = await db.execute({
			sql: "SELECT id FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?",
			args: [monthId, userId, short ? 1 : 0],
		});

		let voteId: number;
		const existingVoteId = existingVote.rows[0]?.id;

		if (existingVoteId !== undefined && existingVoteId !== null) {
			voteId = Number(existingVoteId);
			// Delete existing rankings
			await db.execute({
				sql: "DELETE FROM rankings WHERE vote_id = ?",
				args: [voteId],
			});
		} else {
			// Insert new vote
			const insertResult = await db.execute({
				sql: "INSERT INTO votes (month_id, discord_id, short, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
				args: [monthId, userId, short ? 1 : 0],
			});

			if (!insertResult.lastInsertRowid) {
				throw new Error("Failed to create vote - no insert ID returned");
			}
			voteId = Number(insertResult.lastInsertRowid);
		}

		// Insert new rankings if provided
		if (data.order && data.order.length > 0) {
			const rankingInsertPromises = data.order.map((nominationId, index) =>
				db.execute({
					sql: "INSERT INTO rankings (vote_id, nomination_id, rank, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [voteId, nominationId, index + 1],
				}),
			);

			await Promise.all(rankingInsertPromises);
		}

		// Invalidate cache after successful vote
		invalidateVotingCache(Number(monthId), short);

		return Response.json({ success: true, voteId });
	} catch (error) {
		console.error("Error processing vote:", error);
		return Response.json(
			{ success: false, error: "Failed to process vote" },
			{ status: 500 },
		);
	}
}
