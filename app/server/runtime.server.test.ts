import { describe, expect, test } from "bun:test";
import { shouldScheduleProductionJobs } from "./runtime.server";

describe("server runtime jobs", () => {
	test("only production schedules external notification jobs", () => {
		expect(shouldScheduleProductionJobs("development")).toBe(false);
		expect(shouldScheduleProductionJobs("production")).toBe(true);
	});
});
