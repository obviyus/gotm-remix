import { createContext, redirect, type RouterContextProvider } from "react-router";
import { db } from "~/server/database.server";
import { uniqueNameGenerator } from "~/server/nameGenerator";
import { getSession } from "~/sessions";

export type RequestUser = {
	discordId: string;
	discordAvatarUrl: string;
	pseudoHandle: string;
	isAdmin: boolean;
};

export const requestUserContext = createContext<RequestUser | null>(null);
export const authenticatedUserContext = createContext<RequestUser>();

function getDefaultDiscordAvatarUrl(discordId: string): string {
	const defaultAvatarIndex = Number((BigInt(discordId) >> 22n) % 6n);
	return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
}

async function getRequestUser(request: Request): Promise<RequestUser | null> {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return null;
	}

	const adminResult = await db.execute({
		sql: "SELECT 1 FROM jury_members WHERE discord_id = ? AND is_admin = 1",
		args: [discordId],
	});

	return {
		discordId,
		discordAvatarUrl: session.get("discordAvatarUrl") ?? getDefaultDiscordAvatarUrl(discordId),
		pseudoHandle: uniqueNameGenerator(discordId),
		isAdmin: adminResult.rows.length > 0,
	};
}

type WritableRouteContext = Pick<RouterContextProvider, "get" | "set">;

export async function loadRequestUser({
	request,
	context,
}: {
	request: Request;
	context: WritableRouteContext;
}) {
	context.set(requestUserContext, await getRequestUser(request));
}

export function requireAuthenticatedUser({ context }: { context: WritableRouteContext }) {
	const user = context.get(requestUserContext);

	if (!user) {
		throw redirect("/auth/discord");
	}

	context.set(authenticatedUserContext, user);
}

export function requireAdmin({ context }: { context: Pick<RouterContextProvider, "get"> }) {
	const user = context.get(authenticatedUserContext);

	if (!user.isAdmin) {
		throw new Response("Unauthorized", { status: 403 });
	}
}
