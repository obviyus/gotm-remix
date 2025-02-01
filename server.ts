import { createRequestHandler, logDevReady } from "@remix-run/server-runtime";
import { broadcastDevReady, type ServerBuild } from "@remix-run/node";
import * as build from "./build/server/index.js";
// biome-ignore lint/style/useNodejsImportProtocol: using bun
import { join } from "path";

const remix_build = build as unknown as ServerBuild;
const handler = createRequestHandler(remix_build, process.env.NODE_ENV);
const port = process.env.PORT || 3000;

console.log(`🚀 Server starting on port ${port}`);

if (process.env.NODE_ENV === "development") {
	broadcastDevReady(remix_build);
	logDevReady(remix_build);
}

Bun.serve({
	port: port,
	async fetch(request: Request) {
		try {
			const url = new URL(request.url);

			// Try serving static files from public directory
			let file = Bun.file(join("public", url.pathname));
			if (await file.exists()) {
				const headers = new Headers();
				headers.set("Cache-Control", "public, max-age=31536000, immutable");

				if (url.pathname.endsWith(".js")) {
					headers.set("Content-Type", "application/javascript");
				} else if (url.pathname.endsWith(".css")) {
					headers.set("Content-Type", "text/css");
				} else if (url.pathname.endsWith(".html")) {
					headers.set("Content-Type", "text/html");
				}
				return new Response(file, { headers });
			}

			// Handle Vite's build output assets
			if (url.pathname.startsWith("/assets/")) {
				// Try client build directory
				file = Bun.file(join("build/client", url.pathname));
				if (await file.exists()) {
					const headers = new Headers();
					if (url.pathname.endsWith(".js")) {
						headers.set("Content-Type", "application/javascript");
					} else if (url.pathname.endsWith(".css")) {
						headers.set("Content-Type", "text/css");
					}
					return new Response(file, { headers });
				}
			}

			// Handle Remix routes
			const loadContext = {};
			return handler(request, loadContext);
		} catch (error) {
			console.error("Error processing request:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	},
	error(error) {
		console.error("Server error:", error);
		return new Response("Server Error", { status: 500 });
	},
});
