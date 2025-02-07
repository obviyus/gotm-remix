import { useLoaderData } from "@remix-run/react";
import { pool } from "~/utils/database.server";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo } from "react";
import type { RowDataPacket } from "mysql2";
import { calculateVotingResults, type Result } from "~/utils/voting.server";

interface Month {
	id: number;
	month: string;
	year: number;
}

type LoaderData = {
	month: Month;
	results: {
		long: Result[];
		short: Result[];
	};
};

export const loader = async () => {
	// Get the latest month
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, month, year 
         FROM months 
         ORDER BY id DESC 
         LIMIT 1;`,
	);

	if (rows.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	const month = rows[0] as Month;
	const results = {
		long: await calculateVotingResults(month.id, false),
		short: await calculateVotingResults(month.id, true),
	};

	return { month, results };
};

export default function Index() {
	const { month, results } = useLoaderData<LoaderData>();

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
				<h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
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
				/>
				<VotingResultsChart
					canvasId={shortGamesCanvasId}
					results={results.short}
				/>
			</div>
		</div>
	);
}
