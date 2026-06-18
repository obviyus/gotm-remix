import { describe, expect, test } from "bun:test";
import { getDatabaseConfig } from "~/server/database-config.server";

describe("getDatabaseConfig", () => {
	test("does not require an auth token for local file databases", () => {
		expect(getDatabaseConfig({ TURSO_DATABASE_URL: "file:local.db" })).toEqual({
			url: "file:local.db",
			authToken: undefined,
		});
	});

	test("requires an auth token for remote databases", () => {
		expect(() => getDatabaseConfig({ TURSO_DATABASE_URL: "libsql://gotm.turso.io" })).toThrow(
			"TURSO_AUTH_TOKEN must be defined",
		);
	});
});
