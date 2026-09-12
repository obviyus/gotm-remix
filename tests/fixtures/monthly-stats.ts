import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mock, spyOn } from "bun:test";

const schema = await Bun.file(new URL("../../db/schema.sql", import.meta.url)).text();
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(schema);
let monthlySql = "";
await mock.module("~/server/database.server", () => ({
	db: {
		execute: async (sql: string) => {
			if (sql.includes("AS monthYear")) monthlySql = sql;
			return { rows: sqlite.prepare(sql).all() };
		},
	},
}));
const fetchMock = spyOn(globalThis, "fetch").mockImplementation(
	Object.assign(
		() => {
			throw new Error("Unexpected network request");
		},
		{ preconnect() {} },
	),
);
const { loader } = await import("~/routes/stats");

try {
	sqlite.exec(`
		INSERT INTO month_status (id, status) VALUES (1, 'over');
		INSERT INTO theme_categories (id, name) VALUES (1, 'Test');
		INSERT INTO themes (id, theme_category_id, name) VALUES (1, 1, 'Theme');
		INSERT INTO months (id, year, month, theme_id) VALUES
			(60, 2026, 6, NULL), (10, 2026, 1, 1), (30, 2026, 3, 1),
			(20, 2026, 2, NULL), (50, 2026, 5, NULL), (40, 2026, 4, NULL);
		INSERT INTO nominations (id, month_id, game_id, discord_id, game_name, jury_selected) VALUES
			(1, 30, 101, '100', 'First', 1), (2, 30, 102, '100', 'Second', 0),
			(3, 30, 103, '200', 'Third', 1), (4, 50, 104, '', 'Fourth', 0),
			(5, NULL, 105, '300', 'Unassigned', 1);
		INSERT INTO votes (month_id, discord_id, short) VALUES
			(20, '100', 0), (20, '100', 1), (30, '100', 0),
			(30, '100', 1), (30, '200', 0), (NULL, '300', 0);
	`);
	const result = await loader();
	assert.deepEqual(result.monthlyStats, [
		{ monthYear: "2026-02", themeShort: null, nominators: 0, voters: 1, total: 0 },
		{ monthYear: "2026-03", themeShort: "Theme", nominators: 2, voters: 2, total: 3 },
		{ monthYear: "2026-04", themeShort: null, nominators: 0, voters: 0, total: 0 },
		{ monthYear: "2026-05", themeShort: null, nominators: 1, voters: 0, total: 1 },
		{ monthYear: "2026-06", themeShort: null, nominators: 0, voters: 0, total: 0 },
	]);
	assert.deepEqual(result.jurySelectionStats, [
		{ monthYear: "2026-03", themeShort: "Theme", selected: 2, total: 3, selectPercentage: 67 },
		{ monthYear: "2026-04", themeShort: null, selected: 0, total: 0, selectPercentage: 0 },
		{ monthYear: "2026-05", themeShort: null, selected: 0, total: 1, selectPercentage: 0 },
		{ monthYear: "2026-06", themeShort: null, selected: 0, total: 0, selectPercentage: 0 },
	]);
	assert.deepEqual(result.monthlyNominationCounts, [
		{ monthYear: "2026-03", themeShort: "Theme", count: 3 },
		{ monthYear: "2026-04", themeShort: null, count: 0 },
		{ monthYear: "2026-05", themeShort: null, count: 1 },
		{ monthYear: "2026-06", themeShort: null, count: 0 },
	]);
	sqlite.exec("DELETE FROM nominations; DELETE FROM votes;");
	const empty = await loader();
	assert.equal(empty.monthlyStats.length, 6);
	assert.equal(empty.jurySelectionStats.length, 6);
	assert.equal(empty.monthlyNominationCounts.length, 6);
	assert.ok(
		empty.monthlyStats.every(
			(month) => month.nominators === 0 && month.voters === 0 && month.total === 0,
		),
	);
	sqlite.exec("DELETE FROM months;");
	assert.deepEqual((await loader()).monthlyStats, []);

	const measured = new DatabaseSync(":memory:");
	try {
		measured.exec(schema);
		measured.exec(`
			INSERT INTO month_status (id, status) VALUES (1, 'over');
			INSERT INTO months (id, year, month) VALUES (1, 2026, 1);
		`);
		const nomination = measured.prepare(
			"INSERT INTO nominations (month_id, game_id, discord_id, game_name, jury_selected) VALUES (1, ?, ?, 'Game', ?)",
		);
		for (let index = 0; index < 200; index++)
			nomination.run(index, `member${index % 20}`, index % 2);
		const vote = measured.prepare(
			"INSERT INTO votes (month_id, discord_id, short) VALUES (1, ?, 0)",
		);
		for (let index = 0; index < 300; index++) vote.run(`voter${index}`);
		let sourceEvaluations = 0;
		measured.function("read_member", (value) => {
			sourceEvaluations += 1;
			return value;
		});
		// Views leave the loader's SQL unchanged and count source-value evaluation in its real joins.
		for (const table of ["nominations", "votes"]) {
			const columns = measured
				.prepare(`PRAGMA table_info(${table})`)
				.all()
				.map((row) =>
					row.name === "discord_id" ? "read_member(discord_id) AS discord_id" : String(row.name),
				);
			measured.exec(`ALTER TABLE ${table} RENAME TO source_${table}`);
			measured.exec(`CREATE VIEW ${table} AS SELECT ${columns.join(", ")} FROM source_${table}`);
		}
		const rows = measured.prepare(monthlySql).all();
		assert.deepEqual(
			rows.map((row) => ({ ...row })),
			[
				{
					monthYear: "2026-01",
					themeShort: null,
					nominators: 20,
					voters: 300,
					total: 200,
					selected: 100,
				},
			],
		);
		console.log(JSON.stringify({ nominations: 200, votes: 300, sourceEvaluations }));
		assert.ok(
			sourceEvaluations <= 4 * (200 + 300),
			"Monthly statistics must scale with source rows, not their product",
		);
	} finally {
		measured.close();
	}
	console.log("Monthly statistics regressions passed");
} finally {
	fetchMock.mockRestore();
	sqlite.close();
}
