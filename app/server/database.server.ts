import { createClient, type Client } from "@libsql/client";
import { config } from "dotenv";

config();

let cachedClient: Client | null = null;

function getClient(): Client {
	if (cachedClient) return cachedClient;
	const url = process.env.TURSO_DATABASE_URL;
	if (!url) {
		throw new Error("TURSO_DATABASE_URL is required to access the database");
	}
	cachedClient = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
	return cachedClient;
}

export const db: Client = new Proxy({} as Client, {
	get(_target, prop: keyof Client) {
		const client = getClient();
		// @ts-expect-error dynamic proxy access
		return client[prop];
	},
});
