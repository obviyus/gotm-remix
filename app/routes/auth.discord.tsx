import React from "react";
import { redirect } from "react-router";
import { getEnv } from "~/env.server";

export async function loader() {
	const params = new URLSearchParams({
		client_id: getEnv("DISCORD_CLIENT_ID"),
		redirect_uri: getEnv("DISCORD_REDIRECT_URI"),
		response_type: "code",
		scope: "identify",
	});

	return redirect(`https://discord.com/api/oauth2/authorize?${params}`);
}
