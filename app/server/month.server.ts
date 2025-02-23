import type { Month, ThemeCategory } from "~/types";
import { pool } from "~/server/database.server";
import type { RowDataPacket } from "mysql2";

export async function getMonth(monthId: number): Promise<Month> {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT months.id AS month_id, months.month, year, themes.id AS theme_id, name, description, status
         FROM months
                  JOIN themes ON months.theme_id = themes.id
         WHERE months.id = ?;`,
		[monthId],
	);

	if (rows.length === 0) {
		throw new Response("Month not found", { status: 404 });
	}

	const month = rows[0];
	return {
		id: month.month_id,
		month: month.month,
		year: month.year,
		status: month.status,
		theme: {
			id: month.theme_id,
			name: month.name,
			description: month.description,
		},
		winners: [],
	};
}

export async function getCurrentMonth(): Promise<Month> {
	// Get the current active month (nominating / jury / voting)
	const [activeRows] = await pool.execute<RowDataPacket[]>(
		`SELECT id
         FROM months
         WHERE status IN ('nominating', 'jury', 'voting')
         LIMIT 1`,
	);

	if (activeRows && activeRows.length > 0) {
		return getMonth(activeRows[0].id);
	}

	// If no active month, fall back to latest month
	const [latestRows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, year, month, status
         FROM months
         ORDER BY year DESC, month DESC
         LIMIT 1`,
	);

	if (!latestRows || latestRows.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	return getMonth(latestRows[0].id);
}

export async function getThemeCategories(): Promise<ThemeCategory[]> {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, name
         FROM theme_categories`,
	);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
	}));
}
