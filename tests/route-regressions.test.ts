import { expect, test } from "bun:test";

test("nomination and Discord login boundaries", async () => {
	// Keep database and network mocks out of the other route test modules.
	const child = Bun.spawn([process.execPath, "run", "tests/fixtures/route-regressions.ts"], {
		cwd: new URL("..", import.meta.url).pathname,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	expect({ exitCode, stderr, stdout }).toEqual({
		exitCode: 0,
		stderr: "",
		stdout: "Route regressions passed\n",
	});
});
