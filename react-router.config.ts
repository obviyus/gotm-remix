import type { Config } from "@react-router/dev/config";
import { db } from "./app/server/database.server";

export default {
	ssr: true,
	async prerender() {
		// Get all month IDs that have completed phases (not in nominating status)
		const result = await db.execute(
			`SELECT id FROM months WHERE status_id NOT IN (
				SELECT id FROM month_status WHERE status = 'nominating'
			);`,
		);

		const historyPaths = [
			"/history", // Main history page
			...result.rows.map((row) => `/history/${row.id}`), // Individual month pages
		];

		return historyPaths;
	},
} satisfies Config;
