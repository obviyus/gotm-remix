import type { Month, ThemeCategory } from "~/types";
import { db } from "~/server/database.server";

interface MonthRow {
	month_id: number;
	month: number;
	year: number;
	theme_id: number;
	name: string;
	description: string | null;
	status:
		| "nominating"
		| "jury"
		| "voting"
		| "complete"
		| "playing"
		| "over"
		| "ready";
}

export async function getMonth(monthId: number): Promise<Month> {
	const result = await db.execute({
		sql: `SELECT m.id AS month_id, m.month, m.year, 
                t.id AS theme_id, t.name, t.description,
                ms.status as status
         FROM months m
         JOIN themes t ON m.theme_id = t.id
         JOIN month_status ms ON m.status_id = ms.id
         WHERE m.id = ?`,
		args: [monthId],
	});

	if (result.rows.length === 0) {
		throw new Response("Month not found", { status: 404 });
	}

	const month = result.rows[0] as unknown as MonthRow;
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
	const activeResult = await db.execute({
		sql: `SELECT m.id
         FROM months m
         JOIN month_status ms ON m.status_id = ms.id
         WHERE ms.status IN ('nominating', 'jury', 'voting')
         LIMIT 1`,
		args: [],
	});

	if (activeResult.rows.length > 0) {
		const activeRow = activeResult.rows[0] as unknown as { id: number };
		return getMonth(activeRow.id);
	}

	// If no active month, fall back to latest month
	const latestResult = await db.execute({
		sql: `SELECT id, year, month
         FROM months
         ORDER BY year DESC, month DESC
         LIMIT 1`,
		args: [],
	});

	if (latestResult.rows.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	const latestRow = latestResult.rows[0] as unknown as { id: number };
	return getMonth(latestRow.id);
}

export async function getThemeCategories(): Promise<ThemeCategory[]> {
	const result = await db.execute({
		sql: `SELECT id, name
         FROM theme_categories`,
		args: [],
	});

	return result.rows.map((row) => ({
		id: (row as unknown as { id: number }).id,
		name: (row as unknown as { name: string }).name,
	}));
}
