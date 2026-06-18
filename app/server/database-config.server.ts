import { getEnv } from "~/env.server";

export function getDatabaseConfig(env: Record<string, string | undefined> = process.env) {
	const url = getEnv("TURSO_DATABASE_URL", env);

	return {
		url,
		authToken: url.startsWith("file:") ? undefined : getEnv("TURSO_AUTH_TOKEN", env),
	};
}
