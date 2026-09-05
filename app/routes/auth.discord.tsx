import { redirect } from "react-router";
import { getEnv } from "~/env.server";
import { commitSession, getSession } from "~/sessions";
import type { Route } from "./+types/auth.discord";

export async function loader({ request }: Route.LoaderArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	const state = crypto.randomUUID();
	session.set("discordOAuthState", { value: state, expiresAt: Date.now() + 10 * 60 * 1000 });
	const params = new URLSearchParams({
		client_id: getEnv("DISCORD_CLIENT_ID"),
		redirect_uri: getEnv("DISCORD_REDIRECT_URI"),
		response_type: "code",
		scope: "identify",
		state,
	});

	return redirect(`https://discord.com/api/oauth2/authorize?${params}`, {
		headers: { "Set-Cookie": await commitSession(session) },
	});
}
