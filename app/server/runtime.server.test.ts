import { describe, expect, test } from "bun:test";
import { applyResponseDefaults, shouldScheduleProductionJobs } from "./runtime.server";

describe("server runtime jobs", () => {
	test("only production schedules external notification jobs", () => {
		expect(shouldScheduleProductionJobs("development")).toBe(false);
		expect(shouldScheduleProductionJobs("production")).toBe(true);
	});
});

describe("applyResponseDefaults", () => {
	test("sets security headers on every response", () => {
		const { headers } = applyResponseDefaults(new Response("hi"));

		expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(headers.get("X-Frame-Options")).toBe("DENY");
		expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
		expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
	});

	test("keeps pages out of shared caches", () => {
		const response = applyResponseDefaults(
			new Response("<html></html>", { headers: { "Content-Type": "text/html" } }),
		);

		expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
	});

	test("leaves a route's own caching policy alone", () => {
		const response = applyResponseDefaults(
			new Response("png", { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }),
		);

		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600, s-maxage=86400");
	});

	test("does not disturb the body or status", async () => {
		const response = applyResponseDefaults(new Response("ok", { status: 404 }));

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("ok");
	});
});
