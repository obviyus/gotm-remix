import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	async prerender() {
		// If DB env is not available at build time, skip dynamic paths to avoid failing CI builds
		if (!process.env.TURSO_DATABASE_URL) {
			console.warn("TURSO_DATABASE_URL is not set, skipping prerender");
			return [];
		}

		const { db } = await import("./app/server/database.server");
		const result = await db.execute(
			`SELECT id FROM months WHERE status_id NOT IN (
				SELECT id FROM month_status WHERE status = 'nominating'
			);`,
		);

		console.log(`Found ${result.rows.length} months to prerender`);

		const historyPaths = [
			"/history",
			...result.rows.map((row) => `/history/${row.id}`),
		];

		return historyPaths;
	},
} satisfies Config;
