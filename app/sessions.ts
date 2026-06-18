import { createCookieSessionStorage } from "react-router";
import { getEnv } from "~/env.server";

type SessionData = {
	discordId: string;
	discordAvatarUrl: string;
};

type SessionFlashData = {
	error: string;
};

const { getSession, commitSession, destroySession } = createCookieSessionStorage<
	SessionData,
	SessionFlashData
>({
	cookie: {
		name: "__session",
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		secrets: [getEnv("COOKIE_SECRET")],
		secure: process.env.NODE_ENV === "production",
	},
});

export { getSession, commitSession, destroySession };
