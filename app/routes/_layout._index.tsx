import { json, useLoaderData } from "@remix-run/react";
import { pool, getCurrentMonth } from "~/utils/database.server";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import type { RowDataPacket } from "mysql2";
import { calculateVotingResults, type Result } from "~/utils/voting.server";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { Nomination } from "~/types";

interface Month {
	id: number;
	month: string;
	year: number;
	status: string;
}

type LoaderData = {
	month: Month;
	results?: {
		long: Result[];
		short: Result[];
	};
	nominations?: {
		long: Nomination[];
		short: Nomination[];
	};
	pitches?: Record<number, Array<{ discord_id: string; pitch: string }>>;
};

export const loader = async () => {
	const month = (await getCurrentMonth()) as Month;

	if (month.status === "nominating") {
		// Fetch nominations
		const [nominations] = await pool.execute<RowDataPacket[]>(
			`SELECT id, game_id, game_name as title, game_year, game_cover, game_url, game_platform_ids, short, jury_selected, month_id
			 FROM nominations 
			 WHERE month_id = ?
			 ORDER BY game_name`,
			[month.id],
		);

		// Only fetch pitches if we have nominations
		let pitchesByNomination = {};
		if (nominations.length > 0) {
			const placeholders = Array(nominations.length).fill("?").join(",");
			const [pitchRows] = await pool.execute<RowDataPacket[]>(
				`SELECT nomination_id, discord_id, pitch 
                 FROM pitches 
                 WHERE nomination_id IN (${placeholders})`,
				nominations.map((n: RowDataPacket) => n.id),
			);

			// Group pitches by nomination_id
			pitchesByNomination = pitchRows.reduce(
				(acc, row) => {
					if (!acc[row.nomination_id]) {
						acc[row.nomination_id] = [];
					}
					acc[row.nomination_id].push({
						discord_id: row.discord_id,
						pitch: row.pitch,
					});
					return acc;
				},
				{} as Record<number, Array<{ discord_id: string; pitch: string }>>,
			);
		}

		// Group nominations by type
		const nominationsByType = nominations.reduce(
			(acc, nom) => {
				const nomination = nom as unknown as Nomination;
				if (nomination.short) {
					acc.short.push(nomination);
				} else {
					acc.long.push(nomination);
				}
				return acc;
			},
			{ short: [] as Nomination[], long: [] as Nomination[] },
		);

		return json<LoaderData>({
			month,
			nominations: nominationsByType,
			pitches: pitchesByNomination,
		});
	}

	if (
		month.status === "voting" ||
		month.status === "over" ||
		month.status === "playing"
	) {
		// Calculate both results in parallel
		const [longResults, shortResults] = await Promise.all([
			calculateVotingResults(month.id, false),
			calculateVotingResults(month.id, true),
		]);

		return json<LoaderData>({
			month,
			results: {
				long: longResults,
				short: shortResults,
			},
		});
	}

	// Default case: just return the month info
	return json<LoaderData>({ month });
};

export default function Index() {
	const { month, results, nominations, pitches } = useLoaderData<LoaderData>();
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);

	const longGamesCanvasId = useMemo(
		() => `longGamesChart-${month.month}-${month.year}`,
		[month],
	);
	const shortGamesCanvasId = useMemo(
		() => `shortGamesChart-${month.month}-${month.year}`,
		[month],
	);

	const renderNominationsList = (games: Nomination[]) => (
		<div className="space-y-4">
			{games.map((game) => (
				<div
					key={game.id}
					className="bg-white rounded-lg p-4 shadow-sm space-y-2"
				>
					<div className="flex items-start space-x-3">
						{game.game_cover && (
							<img
								src={game.game_cover}
								alt=""
								className="h-16 w-16 object-cover rounded-sm flex-shrink-0"
							/>
						)}
						<div>
							<h3 className="font-medium">{game.title}</h3>
							{game.game_year && (
								<p className="text-sm text-gray-500">{game.game_year}</p>
							)}
						</div>
					</div>
					<button
						type="button"
						onClick={() => setSelectedNomination(game)}
						className="w-full px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
					>
						View Pitches ({pitches?.[game.id]?.length || 0})
					</button>
				</div>
			))}
		</div>
	);

	return (
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				<h1 className="text-3xl font-bold">
					{new Date(`${month.year}-${month.month}-01`).toLocaleString("en-US", {
						month: "long",
						year: "numeric",
					})}
				</h1>
			</div>

			{month.status === "nominating" && nominations ? (
				<div className="grid md:grid-cols-2 gap-6">
					{/* Long Games Column */}
					<div className="bg-white rounded-lg shadow p-4 space-y-4">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold">Long Games</h2>
							<div className="text-sm text-gray-500">
								{nominations.long.length} nominations
							</div>
						</div>
						{renderNominationsList(nominations.long)}
					</div>

					{/* Short Games Column */}
					<div className="bg-white rounded-lg shadow p-4 space-y-4">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold">Short Games</h2>
							<div className="text-sm text-gray-500">
								{nominations.short.length} nominations
							</div>
						</div>
						{renderNominationsList(nominations.short)}
					</div>
				</div>
			) : (
				<div className="space-y-6">
					<VotingResultsChart
						canvasId={longGamesCanvasId}
						results={results?.long || []}
					/>
					<div>
						<VotingResultsChart
							canvasId={shortGamesCanvasId}
							results={results?.short || []}
						/>
					</div>
				</div>
			)}

			{/* Pitches Dialog */}
			<Dialog
				open={selectedNomination !== null}
				onClose={() => setSelectedNomination(null)}
				className="relative z-50"
			>
				<div className="fixed inset-0 bg-black/30" aria-hidden="true" />
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="mx-auto max-w-2xl w-full rounded-xl bg-white p-6">
						<DialogTitle className="text-lg font-medium mb-4">
							Pitches for {selectedNomination?.title}
						</DialogTitle>
						<div className="space-y-4 max-h-[60vh] overflow-y-auto">
							{selectedNomination &&
								pitches?.[selectedNomination.id]?.map((pitch) => (
									<div
										key={`${selectedNomination.id}-${pitch.discord_id}`}
										className="border rounded-lg p-4"
									>
										<div className="flex items-center justify-between mb-2">
											<div className="text-sm text-gray-500">
												From: {pitch.discord_id}
											</div>
										</div>
										<div className="text-gray-700 whitespace-pre-wrap">
											{pitch.pitch}
										</div>
									</div>
								))}
							{selectedNomination &&
								(!pitches?.[selectedNomination.id] ||
									pitches[selectedNomination.id].length === 0) && (
									<p className="text-gray-500 text-center py-4">
										No pitches available
									</p>
								)}
						</div>
						<div className="mt-6 flex justify-end">
							<button
								type="button"
								className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
								onClick={() => setSelectedNomination(null)}
							>
								Close
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</div>
	);
}
