import { type LoaderFunction, redirect } from "@remix-run/node";
import { getSession, commitSession } from "~/sessions";

export const loader: LoaderFunction = async ({ request }) => {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	if (error === "access_denied") {
		return redirect("/?error=user_denied");
	}

	if (!code) {
		return redirect("/");
	}

	if (
		!process.env.DISCORD_CLIENT_ID ||
		!process.env.DISCORD_CLIENT_SECRET ||
		!process.env.DISCORD_REDIRECT_URI
	) {
		throw new Error("Discord environment variables must be defined");
	}

	try {
		const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: process.env.DISCORD_CLIENT_ID,
				client_secret: process.env.DISCORD_CLIENT_SECRET,
				grant_type: "authorization_code",
				code,
				redirect_uri: process.env.DISCORD_REDIRECT_URI,
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
		const session = await getSession(request.headers.get("Cookie"));
		session.set("discordId", user.id);
		session.set("accessToken", access_token);

		return redirect("/voting", {
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		});
	} catch (error) {
		console.error("Discord authentication error:", error);
		return redirect("/?error=auth_failed");
	}
};
