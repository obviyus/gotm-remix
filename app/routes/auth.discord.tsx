import { type LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async () => {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
        throw new Error("Discord client ID and redirect URI must be defined");
    }

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify",
    });

    return redirect(`https://discord.com/api/oauth2/authorize?${params}`);
};
