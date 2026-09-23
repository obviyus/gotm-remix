import { expect, mock, test } from "bun:test";
import { DatabaseSync } from "node:sqlite";

const schema = await Bun.file(new URL("../../db/schema.sql", import.meta.url)).text();
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(schema);
const database = {
	execute: async ({ sql, args }: { sql: string; args: [] }) => ({
		rows: sqlite.prepare(sql).all(...args),
	}),
};

void mock.module("~/server/database.server", () => ({ db: database }));

const { getCurrentMonth } = await import("~/server/month.server");

test("getCurrentMonth prefers the latest active month and falls back to the latest month", async () => {
	sqlite.exec(`
		INSERT INTO month_status (id, status) VALUES (1, 'over'), (2, 'nominating'), (3, 'voting');
		INSERT INTO theme_categories (id, name) VALUES (1, 'Test');
		INSERT INTO themes (id, theme_category_id, name) VALUES (1, 1, 'Theme');
		INSERT INTO months (id, year, month, theme_id, status_id) VALUES
			(1, 2025, 12, 1, 1), (2, 2026, 1, 1, 1), (3, 2026, 2, 1, 1), (4, 2026, 3, NULL, 1);
	`);
	const currentId = async () => (await getCurrentMonth()).id;

	// No active month: latest month with a theme.
	expect(await currentId()).toBe(3);

	// An active month wins over a newer finished month.
	sqlite.exec("UPDATE months SET status_id = 3 WHERE id = 1");
	expect(await currentId()).toBe(1);

	// Two active months: the newer one wins.
	sqlite.exec("UPDATE months SET status_id = 2 WHERE id = 2");
	expect(await currentId()).toBe(2);

	sqlite.exec("DELETE FROM months");
	const error = await getCurrentMonth().catch((cause: unknown) => cause);
	expect(error).toBeInstanceOf(Response);
});
