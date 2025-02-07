import { createCookieSessionStorage } from "@remix-run/node";

type SessionData = {
	discordId: string;
	accessToken: string;
};

type SessionFlashData = {
	error: string;
};

const { getSession, commitSession, destroySession } =
	createCookieSessionStorage<SessionData, SessionFlashData>({
		cookie: {
			name: "__session",
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secrets: [process.env.COOKIE_SECRET ?? "secret"],
			secure: process.env.NODE_ENV === "production",
		},
	});

export { getSession, commitSession, destroySession };
