import { db } from "~/server/database.server";
import { invalidateVotingCache, invalidateVotingTimelapseCache } from "~/server/voting.server";
import type { Route } from "./+types/api.votes";

export async function action({ request }: Route.ActionArgs) {
	const isJson = request.headers.get("Content-Type")?.includes("application/json");
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
			order: formData.get("order") ? JSON.parse(formData.get("order") as string) : undefined,
		};
	}

	const { monthId, userId, short } = data;

	if (!monthId || !userId) {
		return Response.json({ success: false, error: "Missing monthId or userId" }, { status: 400 });
	}

	if (request.method === "DELETE") {
		await db.execute({
			sql: "DELETE FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?",
			args: [monthId, userId, short ? 1 : 0],
		});

		// Invalidate cache after deleting vote
		invalidateVotingCache(Number(monthId), short);
		invalidateVotingTimelapseCache(Number(monthId), short);
		return Response.json({ success: true });
	}

	try {
		const transaction = await db.transaction("write");
		let voteId: number;

		try {
			const voteResult = await transaction.execute({
				sql: `INSERT INTO votes (month_id, discord_id, short, created_at, updated_at)
				      VALUES (?, ?, ?, unixepoch(), unixepoch())
				      ON CONFLICT(month_id, discord_id, short) DO UPDATE
				      SET updated_at = unixepoch()
				      RETURNING id`,
				args: [monthId, userId, short ? 1 : 0],
			});

			const returnedVoteId = voteResult.rows[0]?.id;
			if (returnedVoteId === undefined || returnedVoteId === null) {
				throw new Error("Failed to resolve vote ID");
			}
			voteId = Number(returnedVoteId);

			await transaction.execute({
				sql: "DELETE FROM rankings WHERE vote_id = ?",
				args: [voteId],
			});

			if (data.order && data.order.length > 0) {
				for (const [index, nominationId] of data.order.entries()) {
					await transaction.execute({
						sql: "INSERT INTO rankings (vote_id, nomination_id, rank, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
						args: [voteId, nominationId, index + 1],
					});
				}
			}

			await transaction.commit();
		} catch (error) {
			await transaction.rollback();
			throw error;
		} finally {
			transaction.close();
		}

		// Invalidate cache after successful vote
		invalidateVotingCache(Number(monthId), short);
		invalidateVotingTimelapseCache(Number(monthId), short);

		return Response.json({ success: true, voteId });
	} catch (error) {
		console.error("Error processing vote:", error);
		return Response.json({ success: false, error: "Failed to process vote" }, { status: 500 });
	}
}
