import { type LoaderFunction, redirect } from "@remix-run/node";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import { getCurrentMonth } from "~/server/month.server";

export const loader: LoaderFunction = async ({ request }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Check if user is a jury member
	const result = await db.execute({
		sql: "SELECT 1 FROM jury_members WHERE discord_id = ? AND is_admin = 1",
		args: [discordId],
	});

	if (result.rows.length === 0) {
		throw new Response("Unauthorized", { status: 403 });
	}

	const month = await getCurrentMonth();
	return redirect(`/admin/${month.id}`);
};
