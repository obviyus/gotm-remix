import { authenticatedUserContext, requireAuthenticatedUser } from "~/route-context.server";
import { db } from "~/server/database.server";
import { getCurrentMonth } from "~/server/month.server";
import { invalidateVotingCache, invalidateVotingTimelapseCache } from "~/server/voting.server";
import type { Route } from "./+types/api.votes";

export const middleware: Route.MiddlewareFunction[] = [requireAuthenticatedUser];

export async function action({ request, context }: Route.ActionArgs) {
	if (request.method !== "POST" && request.method !== "DELETE") {
		return new Response(null, {
			status: 405,
			headers: { Allow: "POST, DELETE" },
		});
	}

	const { discordId } = context.get(authenticatedUserContext);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
	}

	if (
		typeof body !== "object" ||
		body === null ||
		Array.isArray(body) ||
		!("short" in body) ||
		typeof body.short !== "boolean"
	) {
		return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
	}

	const short = body.short;

	if (request.method === "DELETE") {
		const month = await getCurrentMonth();
		if (month.status !== "voting") {
			return Response.json({ success: false, error: "Voting is not open" }, { status: 409 });
		}

		await db.execute({
			sql: "DELETE FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?",
			args: [month.id, discordId, short ? 1 : 0],
		});

		invalidateVotingCache(month.id, short);
		invalidateVotingTimelapseCache(month.id, short);
		return Response.json({ success: true });
	}

	if (!("order" in body) || !Array.isArray(body.order) || body.order.length === 0) {
		return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
	}

	const order: number[] = [];
	const seen = new Set<number>();
	for (const item of body.order) {
		if (typeof item !== "number" || !Number.isInteger(item) || item <= 0 || seen.has(item)) {
			return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
		}
		seen.add(item);
		order.push(item);
	}

	const month = await getCurrentMonth();
	if (month.status !== "voting") {
		return Response.json({ success: false, error: "Voting is not open" }, { status: 409 });
	}

	const eligibleResult = await db.execute({
		sql: `SELECT id
		      FROM nominations
		      WHERE month_id = ?
		        AND jury_selected = 1
		        AND short = ?`,
		args: [month.id, short ? 1 : 0],
	});

	const eligibleIds = new Set(eligibleResult.rows.map((row) => Number(row.id)));
	for (const nominationId of order) {
		if (!eligibleIds.has(nominationId)) {
			return Response.json({ success: false, error: "Invalid nominations" }, { status: 400 });
		}
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
				args: [month.id, discordId, short ? 1 : 0],
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

			for (const [index, nominationId] of order.entries()) {
				await transaction.execute({
					sql: "INSERT INTO rankings (vote_id, nomination_id, rank, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [voteId, nominationId, index + 1],
				});
			}

			await transaction.commit();
		} catch (error) {
			await transaction.rollback();
			throw error;
		} finally {
			transaction.close();
		}

		invalidateVotingCache(month.id, short);
		invalidateVotingTimelapseCache(month.id, short);

		return Response.json({ success: true, voteId });
	} catch (error) {
		console.error("Error processing vote:", error);
		return Response.json({ success: false, error: "Failed to process vote" }, { status: 500 });
	}
}
