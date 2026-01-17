import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { Await, Link, useNavigation } from "react-router";
import GameCard from "~/components/GameCard";
import {
	getReleasesForDate,
	isValidDate,
	type Release,
} from "~/server/releases.server";
import type { Route } from "./+types/patience.$date.ts";

// Convert a "patience date" (today) to the release date (1 year ago)
function getReleaseDateFromPatienceDate(patienceDate: string): string {
	const date = new Date(`${patienceDate}T00:00:00Z`);
	date.setFullYear(date.getFullYear() - 1);
	return date.toISOString().split("T")[0];
}

export function loader({ params }: Route.LoaderArgs) {
	const patienceDate = params.date;

	if (!isValidDate(patienceDate)) {
		throw new Response("Invalid date format. Use YYYY-MM-DD", { status: 400 });
	}

	const releaseDate = getReleaseDateFromPatienceDate(patienceDate);
	const patienceDateObj = new Date(`${patienceDate}T00:00:00Z`);

	// Calculate prev/next patience dates
	const prevPatienceDate = new Date(patienceDateObj);
	prevPatienceDate.setDate(prevPatienceDate.getDate() - 1);
	const nextPatienceDate = new Date(patienceDateObj);
	nextPatienceDate.setDate(nextPatienceDate.getDate() + 1);

	const today = new Date().toISOString().split("T")[0];

	return {
		patienceDate,
		releaseDate,
		// Show the patience date (matches URL)
		displayPatienceDate: patienceDateObj.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		}),
		releases: getReleasesForDate(releaseDate),
		prevDate: prevPatienceDate.toISOString().split("T")[0],
		nextDate: nextPatienceDate.toISOString().split("T")[0],
		isToday: patienceDate === today,
	};
}

function PatienceLoading() {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-zinc-400">
			<Loader2 className="h-8 w-8 animate-spin mb-4 motion-reduce:animate-none" />
			<p>Fetching games from IGDB...</p>
		</div>
	);
}

function GamesList({ releases }: { releases: Release[] }) {
	if (releases.length === 0) {
		return (
			<div className="text-center py-12 text-zinc-400">
				No games became patient on this date.
			</div>
		);
	}

	return (
		<>
			{releases.map((release) => (
				<GameCard key={release.gameId} game={release} />
			))}
		</>
	);
}

export default function PatienceDate({ loaderData }: Route.ComponentProps) {
	const { displayPatienceDate, releases, prevDate, nextDate, isToday } = loaderData;
	const navigation = useNavigation();
	const isNavigating = navigation.state === "loading";

	return (
		<div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="flex items-center justify-between mb-6">
				<Link
					to={`/patience/${prevDate}`}
					prefetch="intent"
					className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
				>
					<ChevronLeft className="h-4 w-4" />
					Prev
				</Link>

				<div className="text-center">
					<div className="flex items-center gap-2 justify-center text-zinc-400 text-sm mb-1">
						<Calendar className="h-4 w-4" />
						{isToday && <span className="text-blue-400">(Today)</span>}
					</div>
					<h1 className="text-xl font-bold text-white">{displayPatienceDate}</h1>
					<Suspense fallback={<p className="text-sm text-zinc-400 mt-1">Loading...</p>}>
						<Await resolve={releases}>
							{(resolvedReleases) => (
								<p className="text-sm text-zinc-400 mt-1">
									{resolvedReleases.length} game{resolvedReleases.length !== 1 ? "s" : ""} became patient
								</p>
							)}
						</Await>
					</Suspense>
				</div>

				<Link
					to={`/patience/${nextDate}`}
					prefetch="intent"
					className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
				>
					Next
					<ChevronRight className="h-4 w-4" />
				</Link>
			</div>

			{!isToday && (
				<div className="mb-6 text-center">
					<Link
						to="/patience"
						className="text-sm text-blue-400 hover:text-blue-300"
					>
						Jump to today
					</Link>
				</div>
			)}

			<div className="space-y-4">
				{isNavigating ? (
					<PatienceLoading />
				) : (
					<Suspense fallback={<PatienceLoading />}>
						<Await resolve={releases}>
							{(resolvedReleases) => <GamesList releases={resolvedReleases} />}
						</Await>
					</Suspense>
				)}
			</div>
		</div>
	);
}
