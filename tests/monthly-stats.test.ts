import { expect, test } from "bun:test";

test("monthly statistics preserve counts without multiplying source rows", async () => {
	const child = Bun.spawn([process.execPath, "run", "tests/fixtures/monthly-stats.ts"], {
		cwd: new URL("..", import.meta.url).pathname,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	console.log(stdout.trim());
	expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
	expect(stdout).toContain("Monthly statistics regressions passed");
});
