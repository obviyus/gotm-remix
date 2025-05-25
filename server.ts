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

function getDaysInMonth(month: number, year: number): number {
	// The 0 gets the last day of the previous month, effectively giving us
	// the number of days in the specified month. For example:
	// new Date(2024, 3, 0) returns March 31st (last day of March)
	// new Date(2024, 2, 0) returns Feb 29th (last day of Feb in leap year)
	return new Date(year, month, 0).getDate();
}

function getMonthDates(month: number, year: number) {
	const daysInMonth = getDaysInMonth(month, year);

	// Working backwards from 1st of next month (voting closes):
	// 1st: Voting ends, new month begins
	// 2 days before voting ends: Voting starts (2-day voting period)
	// 3 days before voting: Jury starts
	// 2 days before jury: Nominations start

	const votingStarts = daysInMonth - 1; // 2 days before month end (includes last day)
	const juryStarts = votingStarts - 3;
	const nominationsStart = juryStarts - 2;

	return {
		nominationsStart,
		juryStarts,
		votingStarts,
	};
}

for (let month = 1; month <= 12; month++) {
	const currentYear = new Date().getFullYear();
	const dates = getMonthDates(month, currentYear);

	// Nominations start
	new Cron(
		`0 0 0 ${dates.nominationsStart} ${month} *`,
		{ timezone: "America/New_York" },
		async () => {
			console.log(`Nominations starting for month ${month}...`);
			await sendDiscordWebhook("Nominations phase starting soon!", {
				title: "🚨 Nomination Phase Alert",
			});
		},
	);

	// Jury phase (nominations close)
	new Cron(
		`0 0 0 ${dates.juryStarts} ${month} *`,
		{ timezone: "America/New_York" },
		async () => {
			console.log(`Jury phase starting for month ${month}...`);
			await sendDiscordWebhook("Nominations closing soon!", {
				title: "📋 Nominations Deadline",
			});
		},
	);

	// Voting starts
	new Cron(
		`0 0 0 ${dates.votingStarts} ${month} *`,
		{ timezone: "America/New_York" },
		async () => {
			console.log(`Voting starting for month ${month}...`);
			await sendDiscordWebhook("Voting phase starting soon!", {
				title: "🗳️ Voting Opens",
			});
		},
	);
}

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
