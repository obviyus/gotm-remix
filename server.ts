import type { ServerBuild } from "react-router";
import {
	captureServerError,
	createAppHandler,
	getServerHost,
	getServerMode,
	getServerPort,
	startServerRuntime,
} from "~/server/runtime.server";

const mode = getServerMode();
const loadBuild = (): Promise<ServerBuild> =>
	// @ts-expect-error React Router's generated server build is JS-only.
	import("./build/server/index.js");
const handler = createAppHandler(loadBuild, mode);
const port = getServerPort(mode);
const hostname = getServerHost(mode);

console.log(`Server starting on ${hostname ?? "0.0.0.0"}:${port}`);
startServerRuntime(mode);

Bun.serve({
	hostname,
	port,
	async fetch(request) {
		return handler(request);
	},
	error(error) {
		captureServerError(error, "Server error:");
		return new Response("Server Error", { status: 500 });
	},
});
