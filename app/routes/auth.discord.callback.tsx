import React from "react";
import { redirect } from "react-router";
import { getEnv } from "~/env.server";
import { getCurrentMonth } from "~/server/month.server";
import { commitSession, getSession } from "~/sessions";
import type { Route } from "./+types/auth.discord.callback";

type MonthStatus = "ready" | "nominating" | "jury" | "voting" | "playing" | "over";

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

	if (error === "access_denied") {
		return redirect("/?error=user_denied");
	}

	if (!code) {
		return redirect("/");
	}

	const clientId = getEnv("DISCORD_CLIENT_ID");
	const clientSecret = getEnv("DISCORD_CLIENT_SECRET");
	const redirectUri = getEnv("DISCORD_REDIRECT_URI");

	try {
		const sessionPromise = getSession(request.headers.get("Cookie"));
		const currentMonthPromise = getCurrentMonth();

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
		const session = await sessionPromise;
		session.set("discordId", user.id);
		session.set("discordAvatarUrl", getDiscordAvatarUrl(user.id, user.avatar ?? null));

		// Get current month status and determine redirect path
		const currentMonth = await currentMonthPromise;
		const status = currentMonth.status as MonthStatus;

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
		return redirect("/?error=auth_failed");
	}
}
