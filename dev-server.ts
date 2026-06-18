import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { ServerBuild } from "react-router";
import { createServer as createViteServer } from "vite";
import { createNodeRequest, writeNodeResponse } from "~/server/nodeBridge.server";
import {
	captureServerError,
	createAppHandler,
	getServerHost,
	getServerPort,
	startServerRuntime,
} from "~/server/runtime.server";

const port = getServerPort("development");
const host = getServerHost("development");
const httpServer = createServer();
const vite = await createViteServer({
	server: {
		middlewareMode: true,
		hmr: {
			server: httpServer,
		},
	},
	appType: "custom",
});
const loadBuild = () =>
	vite.ssrLoadModule("virtual:react-router/server-build") as Promise<ServerBuild>;
const handler = createAppHandler(loadBuild, "development");

console.log(`Dev server starting on ${host}:${port}`);
startServerRuntime("development");

httpServer.on("request", (req, res) => {
	vite.middlewares(req, res, (error: unknown) => {
		if (error) {
			handleRequestError(error, res);
			return;
		}

		void handleNodeRequest(req, res);
	});
});

httpServer.listen(port, host);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, async () => {
		await vite.close();
		httpServer.close(() => process.exit(0));
	});
}

async function handleNodeRequest(req: IncomingMessage, res: ServerResponse) {
	try {
		const request = createNodeRequest(req, `${host}:${port}`);
		const response = await handler(request);
		await writeNodeResponse(res, response, req.method);
	} catch (error) {
		handleRequestError(error, res);
	}
}

function handleRequestError(error: unknown, res: ServerResponse) {
	const err =
		error instanceof Error
			? error
			: new Error(typeof error === "string" ? error : "Non-Error thrown");
	vite.ssrFixStacktrace(err);
	captureServerError(err, "Dev server request error:");
	if (!res.headersSent) {
		res.statusCode = 500;
	}
	res.end("Internal Server Error");
}
