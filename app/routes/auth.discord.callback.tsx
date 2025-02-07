import { type LoaderFunction, redirect } from "@remix-run/node";
import { getSession, commitSession } from "~/sessions";

export const loader: LoaderFunction = async ({ request }) => {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");

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

	const response = await fetch("https://discord.com/api/oauth2/token", {
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

	const { access_token } = await response.json();

	const userResponse = await fetch("https://discord.com/api/users/@me", {
		headers: { Authorization: `Bearer ${access_token}` },
	});

	const user = await userResponse.json();

	const session = await getSession(request.headers.get("Cookie"));
	session.set("discordId", user.id);
	session.set("accessToken", access_token);
	session.set("username", user.username);
	session.set("avatar", user.avatar);

	return redirect("/voting", {
		headers: {
			"Set-Cookie": await commitSession(session),
		},
	});
};
