import { redirect, type LoaderFunction } from "@remix-run/node";
import { pool } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { RowDataPacket } from "mysql2";

export const loader: LoaderFunction = async ({ request }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Check if user is a jury member
	const [juryRows] = await pool.execute<RowDataPacket[]>(
		"SELECT id FROM jury_members WHERE discord_id = ? AND active = 1",
		[discordId],
	);

	if (juryRows.length === 0) {
		throw new Response("Unauthorized", { status: 403 });
	}

	// Get latest month ID
	const [monthRows] = await pool.execute<RowDataPacket[]>(
		"SELECT id FROM months ORDER BY year DESC, month DESC LIMIT 1",
	);

	if (monthRows.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	return redirect(`/admin/${monthRows[0].id}`);
};
