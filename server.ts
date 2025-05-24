import { createRequestHandler } from "react-router";
import type { ServerBuild } from "react-router";
import * as build from "./build/server/index.js";
// biome-ignore lint/style/useNodejsImportProtocol: using bun
import { join } from "path";
import { Cron } from "croner";
import { recalculateAllWinners } from "~/server/winner.server";
import { sendDiscordWebhook } from "~/server/discord.server";

const remix_build = build as unknown as ServerBuild;
const handler = createRequestHandler(remix_build, process.env.NODE_ENV);
const port = process.env.PORT || 3000;

console.log(`🚀 Server starting on port ${port}`);

console.info("Re-calculating winners...");
await recalculateAllWinners();

// Setup monthly cron job for 25th at 12AM EST
new Cron("0 0 0 25 * *", { timezone: "America/New_York" }, async () => {
	console.log("Running monthly Discord notification...");
	await sendDiscordWebhook("Nominations phase starting soon!", {
		title: "🚨 Nomination Phase Alert",
	});
});

// 30-day months: 24th nominations open (April, June, September, November)
new Cron("0 0 0 24 4,6,9,11 *", { timezone: "America/New_York" }, async () => {
	console.log("Running monthly Discord notification (30-day month)...");
	await sendDiscordWebhook("Nominations phase starting soon!", {
		title: "🚨 Nomination Phase Alert",
	});
});

// 27th: Close nominations, send to jury
new Cron("0 0 0 27 * *", { timezone: "America/New_York" }, async () => {
	await sendDiscordWebhook("Nominations closing soon!", {
		title: "📋 Nominations Deadline",
	});
});

// 30-day months: 26th nominations close (April, June, September, November)
new Cron("0 0 0 26 4,6,9,11 *", { timezone: "America/New_York" }, async () => {
	await sendDiscordWebhook("Nominations closing soon!", {
		title: "📋 Nominations Deadline",
	});
});

// 30th: Voting Starts
new Cron("0 0 0 30 * *", { timezone: "America/New_York" }, async () => {
	await sendDiscordWebhook("Voting phase starting soon!", {
		title: "🗳️ Voting Opens",
	});
});

// 30-day months: 29th voting starts (April, June, September, November)
new Cron("0 0 0 29 4,6,9,11 *", { timezone: "America/New_York" }, async () => {
	await sendDiscordWebhook("Voting phase starting soon!", {
		title: "🗳️ Voting Opens",
	});
});

// 1st: Voting Ends, new GotM begins (same for all months)
new Cron("0 0 0 1 * *", { timezone: "America/New_York" }, async () => {
	await sendDiscordWebhook("Voting ends soon!", {
		title: "🏆 New Month Begins",
	});
});

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
