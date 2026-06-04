import { createRequestHandler } from "react-router";
import type { ServerBuild } from "react-router";
import { sendDiscordWebhook } from "~/server/discord.server";

const serverBuildPath = "./build/server/index.js";
const build: ServerBuild = await import(serverBuildPath);
const handler = createRequestHandler(build, Bun.env.NODE_ENV);
const port = Bun.env.PORT || 3000;

console.log(`🚀 Server starting on port ${port}`);

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
	// 3 days before jury: Nominations start

	const votingStarts = daysInMonth - 1; // 2 days before month end (includes last day)
	const juryStarts = votingStarts - 3;
	const nominationsStart = juryStarts - 3;

	return {
		nominationsStart,
		juryStarts,
		votingStarts,
	};
}

function getNewYorkDateParts(date: Date) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(date);

	const values = new Map(parts.map((part) => [part.type, Number(part.value)]));

	return {
		month: values.get("month")!,
		year: values.get("year")!,
		day: values.get("day")!,
	};
}

Bun.cron("0 5 * * *", async () => {
	const {
		month: currentMonth,
		year: currentYear,
		day: currentDay,
	} = getNewYorkDateParts(new Date());
	const dates = getMonthDates(currentMonth, currentYear);

	// Check if today is a phase transition day
	if (currentDay === dates.nominationsStart) {
		console.log(`Nominations starting for month ${currentMonth}...`);
		await sendDiscordWebhook("Nominations phase starting soon!", {
			title: "🚨 Nomination Phase Alert",
		});
	} else if (currentDay === dates.juryStarts) {
		console.log(`Jury phase starting for month ${currentMonth}...`);
		await sendDiscordWebhook("Nominations closing soon!", {
			title: "📋 Nominations Deadline",
		});
	} else if (currentDay === dates.votingStarts) {
		console.log(`Voting starting for month ${currentMonth}...`);
		await sendDiscordWebhook("Voting phase starting soon!", {
			title: "🗳️ Voting Opens",
		});
	}
});

Bun.cron("0 5 1 * *", async () => {
	await sendDiscordWebhook("Voting ends soon!", {
		title: "🏆 New Month Begins",
	});
});

Bun.serve({
	port: port,
	async fetch(request: Request) {
		try {
			const url = new URL(request.url);

			if (url.pathname.includes("..")) {
				return handler(request, {});
			}

			const sanitizedPath = url.pathname.replace(/^\//, "");

			// Try serving static files from public directory
			let file = Bun.file(`public/${sanitizedPath}`);
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
				file = Bun.file(`build/client/${sanitizedPath}`);
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
