import { join, normalize } from "node:path";
import { RouterContextProvider, createRequestHandler, type ServerBuild } from "react-router";
import { sendDiscordWebhook } from "~/server/discord.server";

const defaultPortByMode = {
	development: 5173,
	production: 3000,
} as const;
const newYorkDateFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	year: "numeric",
	month: "numeric",
	day: "numeric",
});
const staticDirectories = [
	{
		path: join(process.cwd(), "build", "client"),
		cacheControl: (relativePath: string) =>
			relativePath.startsWith("assets/")
				? "public, max-age=31536000, immutable"
				: "public, max-age=3600",
	},
	{
		path: join(process.cwd(), "public"),
		cacheControl: () => "public, max-age=31536000, immutable",
	},
];

let runtimeStarted = false;

export type ServerMode = keyof typeof defaultPortByMode;
type ServerBuildLoader = ServerBuild | (() => ServerBuild | Promise<ServerBuild>);
type AppResponder = (request: Request) => Response | null | Promise<Response | null>;

export function createLoadContext() {
	return new RouterContextProvider();
}

export function getServerMode() {
	return Bun.env.NODE_ENV === "development" ? "development" : "production";
}

export function getServerPort(mode: ServerMode = getServerMode()) {
	const rawPort = Bun.env.PORT ?? String(defaultPortByMode[mode]);
	const port = Number(rawPort);

	if (!Number.isInteger(port) || port <= 0) {
		throw new Error(`Invalid PORT: ${rawPort}`);
	}

	return port;
}

export function getServerHost(mode: ServerMode = getServerMode()) {
	return Bun.env.HOST ?? (mode === "development" ? "127.0.0.1" : undefined);
}

export function createAppHandler(build: ServerBuildLoader, mode: ServerMode) {
	const handler = createRequestHandler(build, mode);
	const responders: AppResponder[] = [
		handlePingRequest,
		...(mode === "production" ? [handleStaticAssetRequest] : []),
	];

	return async (request: Request) => {
		for (const respond of responders) {
			const response = await respond(request);

			if (response) {
				return response;
			}
		}

		return handler(request, createLoadContext());
	};
}

export function startServerRuntime(mode: ServerMode = getServerMode()) {
	if (runtimeStarted) {
		return;
	}

	runtimeStarted = true;
	if (shouldScheduleProductionJobs(mode)) {
		initializeCronJobs();
	}
}

export function shouldScheduleProductionJobs(mode: ServerMode) {
	return mode === "production";
}

export function handlePingRequest(request: Request) {
	if (new URL(request.url).pathname !== "/ping") {
		return null;
	}

	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", {
			status: 405,
			headers: {
				Allow: "GET, HEAD",
			},
		});
	}

	return new Response(request.method === "HEAD" ? null : "ok", {
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}

export async function handleStaticAssetRequest(request: Request) {
	const relativePath = getStaticAssetPath(new URL(request.url).pathname);

	if (!relativePath) {
		return null;
	}

	for (const directory of staticDirectories) {
		const file = Bun.file(join(directory.path, relativePath));

		if (await file.exists()) {
			return new Response(request.method === "HEAD" ? null : file, {
				headers: {
					"Cache-Control": directory.cacheControl(relativePath),
				},
			});
		}
	}

	return null;
}

export function captureServerError(error: unknown, label: string) {
	console.error(label, error);
}

function initializeCronJobs() {
	Bun.cron("0 5 * * *", async () => {
		const {
			month: currentMonth,
			year: currentYear,
			day: currentDay,
		} = getNewYorkDateParts(new Date());
		const dates = getMonthDates(currentMonth, currentYear);

		if (currentDay === dates.nominationsStart) {
			console.log(`Nominations starting for month ${currentMonth}...`);
			await sendDiscordWebhook("Nominations phase starting soon!", {
				title: "Nomination Phase Alert",
			});
		} else if (currentDay === dates.juryStarts) {
			console.log(`Jury phase starting for month ${currentMonth}...`);
			await sendDiscordWebhook("Nominations closing soon!", {
				title: "Nominations Deadline",
			});
		} else if (currentDay === dates.votingStarts) {
			console.log(`Voting starting for month ${currentMonth}...`);
			await sendDiscordWebhook("Voting phase starting soon!", {
				title: "Voting Opens",
			});
		}
	});

	Bun.cron("0 5 1 * *", async () => {
		await sendDiscordWebhook("Voting ends soon!", {
			title: "New Month Begins",
		});
	});
}

function getMonthDates(month: number, year: number) {
	const daysInMonth = new Date(year, month, 0).getDate();
	const votingStarts = daysInMonth - 1;
	const juryStarts = votingStarts - 3;
	const nominationsStart = juryStarts - 3;

	return {
		nominationsStart,
		juryStarts,
		votingStarts,
	};
}

function getNewYorkDateParts(date: Date) {
	const values = new Map(
		newYorkDateFormatter.formatToParts(date).map((part) => [part.type, Number(part.value)]),
	);

	return {
		month: values.get("month")!,
		year: values.get("year")!,
		day: values.get("day")!,
	};
}

function getStaticAssetPath(pathname: string) {
	const relativePath = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");

	if (!relativePath || relativePath.startsWith("..")) {
		return null;
	}

	return relativePath;
}
