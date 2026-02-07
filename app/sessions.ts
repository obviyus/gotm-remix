import { createCookieSessionStorage } from "react-router";

type SessionData = {
	discordId: string;
	accessToken: string;
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
		secrets: [Bun.env.COOKIE_SECRET ?? "secret"],
		secure: Bun.env.NODE_ENV === "production",
	},
});

export { getSession, commitSession, destroySession };
