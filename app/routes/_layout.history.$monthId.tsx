import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo } from "react";
import type { Month, Result } from "~/utils/voting.server";
import {
	getMonth,
	calculateVotingResults,
	getGameUrls,
} from "~/utils/voting.server";
import { pool } from "~/utils/database.server";
import type { RowDataPacket } from "mysql2";
import ThemeCard from "~/components/ThemeCard";

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

	// Get theme information along with other data
	const [month, results, gameUrls, themeData] = await Promise.all([
		getMonth(monthId),
		Promise.all([
			calculateVotingResults(monthId, false),
			calculateVotingResults(monthId, true),
		]).then(([long, short]) => ({ long, short })),
		getGameUrls(monthId),
		pool.execute<RowDataPacket[]>(
			`SELECT t.name, t.description
			 FROM months m
			 LEFT JOIN themes t ON m.theme_id = t.id
			 WHERE m.id = ?`,
			[monthId],
		),
	]);

	// Add theme to month if it exists
	if (themeData[0].length > 0) {
		(month as Month).theme = {
			name: themeData[0][0].name,
			description: themeData[0][0].description,
		};
	}

	return json({ month, results, gameUrls });
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
			<div className="text-center space-y-2 mb-8">
				{month.theme && <ThemeCard theme={month.theme} month={{ year: month.year, month: month.month }} />}
			</div>

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
