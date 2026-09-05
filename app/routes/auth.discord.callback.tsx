import { redirect } from "react-router";
import { getEnv } from "~/env.server";
import { getCurrentMonth } from "~/server/month.server";
import { commitSession, getSession } from "~/sessions";
import type { Route } from "./+types/auth.discord.callback";

function getDiscordAvatarUrl(userId: string, avatarHash: string | null): string {
	if (avatarHash) {
		const ext = avatarHash.startsWith("a_") ? "gif" : "png";
		return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`;
	}

	const defaultAvatarIndex = Number((BigInt(userId) >> 22n) % 6n);
	return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
}

export async function loader({ request, url }: Route.LoaderArgs) {
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");
	const state = url.searchParams.get("state");
	const session = await getSession(request.headers.get("Cookie"));
	const expectedState = session.get("discordOAuthState");
	session.unset("discordOAuthState");
	const clearedSessionHeaders = { "Set-Cookie": await commitSession(session) };

	if (
		!state ||
		!expectedState ||
		state !== expectedState.value ||
		expectedState.expiresAt <= Date.now()
	) {
		return redirect("/?error=auth_failed", { headers: clearedSessionHeaders });
	}

	if (error === "access_denied") {
		return redirect("/?error=user_denied", { headers: clearedSessionHeaders });
	}

	if (!code) {
		return redirect("/", { headers: clearedSessionHeaders });
	}

	const clientId = getEnv("DISCORD_CLIENT_ID");
	const clientSecret = getEnv("DISCORD_CLIENT_SECRET");
	const redirectUri = getEnv("DISCORD_REDIRECT_URI");

	try {
		const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
			}),
		});

		if (!tokenResponse.ok) {
			throw new Error("Failed to fetch access token");
		}

		const { access_token } = await tokenResponse.json();

		const userResponse = await fetch("https://discord.com/api/users/@me", {
			headers: { Authorization: `Bearer ${access_token}` },
		});

		if (!userResponse.ok) {
			throw new Error("Failed to fetch user data");
		}

		const user = await userResponse.json();
		const currentMonth = await getCurrentMonth();
		session.set("discordId", user.id);
		session.set("discordAvatarUrl", getDiscordAvatarUrl(user.id, user.avatar ?? null));

		// Get current month status and determine redirect path
		const status = currentMonth.status;

		// Only redirect to specific pages for nominating and voting phases
		const redirectPath =
			status === "nominating" ? "/nominate" : status === "voting" ? "/voting" : "/"; // Default to home page for all other statuses

		return redirect(redirectPath, {
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		});
	} catch (error) {
		console.error("Discord authentication error:", error);
		return redirect("/?error=auth_failed", { headers: clearedSessionHeaders });
	}
}
