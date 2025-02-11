import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo } from "react";
import type { Month, Result } from "~/utils/voting.server";
import {
	getMonth,
	calculateVotingResults,
	getGameUrls,
} from "~/utils/voting.server";

type LoaderData = {
	month: Month;
	results: {
		long: Result[];
		short: Result[];
	};
	gameUrls: Record<string, string>;
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
	const monthId = Number(params.monthId);
	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	const [month, results, gameUrls] = await Promise.all([
		getMonth(monthId),
		Promise.all([
			calculateVotingResults(monthId, false),
			calculateVotingResults(monthId, true),
		]).then(([long, short]) => ({ long, short })),
		getGameUrls(monthId),
	]);

	return Response.json({ month, results, gameUrls });
};

export default function HistoryMonth() {
	const { month, results, gameUrls } = useLoaderData<LoaderData>();

	const longGamesCanvasId = useMemo(
		() => `longGamesChart-${month.month}-${month.year}`,
		[month],
	);
	const shortGamesCanvasId = useMemo(
		() => `shortGamesChart-${month.month}-${month.year}`,
		[month],
	);

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<header className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
					{new Date(`${month.year}-${month.month}-01`).toLocaleString("en-US", {
						month: "long",
						year: "numeric",
					})}
				</h1>
			</header>

			<div className="space-y-6">
				<VotingResultsChart
					canvasId={longGamesCanvasId}
					results={results.long}
					gameUrls={gameUrls}
				/>
				<VotingResultsChart
					canvasId={shortGamesCanvasId}
					results={results.short}
					gameUrls={gameUrls}
				/>
			</div>
		</div>
	);
}
