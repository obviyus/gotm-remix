import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import type { NominationFormData } from "~/types";
import type { Route } from "./+types/api.nominations";

export async function action({ request }: Route.ActionArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Check for previous GOTM winners
	const winners = await db.execute("SELECT DISTINCT game_id FROM winners");
	const previousWinners = winners.rows.map((w) => (w.game_id ?? "").toString());

	if (request.method === "DELETE") {
		const formData = await request.formData();
		const nominationId = formData.get("nominationId")?.toString();

		if (!nominationId) {
			return Response.json({ error: "Missing nomination ID" }, { status: 400 });
		}

		// Verify the nomination belongs to the user
		const nomination = await db.execute({
			sql: "SELECT id FROM nominations WHERE id = ? AND discord_id = ?",
			args: [nominationId, discordId],
		});

		if (nomination.rows.length === 0) {
			return Response.json(
				{ error: "Nomination not found or unauthorized" },
				{ status: 404 },
			);
		}

		// Delete the nomination (pitches will be cascade deleted)
		await db.execute({
			sql: "DELETE FROM nominations WHERE id = ?",
			args: [nominationId],
		});

		return Response.json({ success: true });
	}

	if (request.method === "PATCH") {
		try {
			const contentType = request.headers.get("Content-Type");
			const data = contentType?.includes("application/json")
				? await request.json()
				: Object.fromEntries(await request.formData());

			const nominationId =
				typeof data.nominationId === "string"
					? Number.parseInt(data.nominationId, 10)
					: typeof data.nominationId === "number"
						? data.nominationId
						: null;

			if (!nominationId || Number.isNaN(nominationId)) {
				return Response.json(
					{ error: "Invalid nomination ID" },
					{ status: 400 },
				);
			}

			const pitch = data.pitch?.toString() || null;

			// Check if the game is a previous winner
			const nomination = await db.execute({
				sql: `SELECT n.*, p.discord_id as pitch_discord_id
					FROM nominations n
					LEFT JOIN pitches p ON n.id = p.nomination_id
					WHERE n.id = ?`,
				args: [nominationId],
			});

			if (nomination.rows.length === 0) {
				return Response.json(
					{ error: "Nomination not found" },
					{ status: 404 },
				);
			}

			// Check if the game is a previous winner
			const gameId = nomination.rows[0].game_id?.toString() ?? "";
			if (previousWinners.includes(gameId)) {
				return Response.json(
					{ error: "Cannot modify nominations for previous GOTM winners" },
					{ status: 400 },
				);
			}

			// Check if the user owns the nomination or is adding a new pitch
			const isOwner = nomination.rows[0].discord_id === discordId;
			const hasExistingPitch =
				nomination.rows[0].pitch_discord_id === discordId;

			if (!isOwner && hasExistingPitch) {
				return Response.json(
					{ error: "You have already added a pitch to this nomination" },
					{ status: 400 },
				);
			}

			if (hasExistingPitch) {
				// Update existing pitch
				await db.execute({
					sql: "UPDATE pitches SET pitch = ?, updated_at = unixepoch() WHERE nomination_id = ? AND discord_id = ?",
					args: [pitch, nominationId, discordId],
				});
			} else {
				// Add new pitch
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nominationId, discordId, pitch],
				});
			}

			return Response.json({ success: true });
		} catch (error) {
			console.error("Error processing edit:", error);
			return Response.json(
				{ error: "Failed to process edit. Please try again." },
				{ status: 500 },
			);
		}
	}

	try {
		let data: NominationFormData;
		const contentType = request.headers.get("Content-Type");

		if (contentType?.includes("application/json")) {
			const body = await request.json();
			data =
				typeof body === "string"
					? JSON.parse(body)
					: body.json
						? JSON.parse(body.json)
						: body;
		} else {
			const formData = await request.formData();
			const jsonStr = formData.get("json")?.toString();
			data = jsonStr
				? JSON.parse(jsonStr)
				: {
						game: JSON.parse(formData.get("game")?.toString() || "{}"),
						monthId: formData.get("monthId")?.toString() || "",
						short: formData.get("short") === "true",
						pitch: formData.get("pitch")?.toString() || null,
					};
		}

		const { game, monthId, short, pitch } = data;

		if (!game || !monthId) {
			return Response.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Check if the game is a previous winner
		if (previousWinners.includes(game.id.toString())) {
			return Response.json(
				{ error: "This game has already won GOTM in a previous month" },
				{ status: 400 },
			);
		}

		// Check if game is already nominated for this month
		const existing = await db.execute({
			sql: "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.month_id = ? AND n.game_id = ? AND p.discord_id = ?",
			args: [monthId, game.id, discordId],
		});

		// If the user has already pitched this game, prevent them from nominating it again
		if (existing.rows.length > 0) {
			return Response.json(
				{
					error:
						"You have already nominated or pitched this game for this month",
				},
				{ status: 400 },
			);
		}

		// Insert the nomination
		const nomination = await db.execute({
			sql: "INSERT INTO nominations (month_id, game_id, discord_id, short, game_name, game_year, game_cover, game_url, jury_selected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())",
			args: [
				monthId,
				game.id,
				discordId,
				short ? 1 : 0,
				game.name,
				game.gameYear || null,
				game.cover?.replace("t_thumb", "t_cover_big") || null,
				game.url || null,
				0, // Not jury selected by default
			],
		});

		// If there's a pitch, insert it
		if (pitch && nomination.lastInsertRowid) {
			await db.execute({
				sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
				args: [nomination.lastInsertRowid, discordId, pitch],
			});
		}

		return Response.json({
			success: true,
			nominationId: nomination.lastInsertRowid
				? Number(nomination.lastInsertRowid)
				: null,
		});
	} catch (error) {
		console.error("Error processing nomination:", error);
		return Response.json(
			{
				error:
					"Failed to process nomination. Please make sure all required fields are provided.",
			},
			{ status: 500 },
		);
	}
}
