import React from "react";
import { redirect } from "react-router";

export async function loader() {
	if (!Bun.env.DISCORD_CLIENT_ID || !Bun.env.DISCORD_REDIRECT_URI) {
		throw new Error("Discord client ID and redirect URI must be defined");
	}

	const params = new URLSearchParams({
		client_id: Bun.env.DISCORD_CLIENT_ID,
		redirect_uri: Bun.env.DISCORD_REDIRECT_URI,
		response_type: "code",
		scope: "identify",
	});

	return redirect(`https://discord.com/api/oauth2/authorize?${params}`);
}
