import { json, useLoaderData } from "@remix-run/react";
import { pool, getCurrentMonth } from "~/utils/database.server";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import type { RowDataPacket } from "mysql2";
import { calculateVotingResults, type Result } from "~/utils/voting.server";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { Nomination } from "~/types";
import SplitLayout, { Column } from "~/components/SplitLayout";
import GameCard from "~/components/GameCard";

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
				<GameCard
					key={game.id}
					game={{
						id: game.id,
						name: game.title,
						cover: game.game_cover ? { url: game.game_cover } : undefined,
						first_release_date: game.game_year
							? new Date(game.game_year).getTime() / 1000
							: undefined,
					}}
					onViewPitches={() => setSelectedNomination(game)}
					pitchCount={pitches?.[game.id]?.length || 0}
				/>
			))}
		</div>
	);

	const monthName = new Date(`${month.year}-${month.month}-01`).toLocaleString(
		"en-US",
		{
			month: "long",
			year: "numeric",
		},
	);

	return (
		<>
			{month.status === "nominating" && nominations ? (
				<SplitLayout
					title={monthName}
					description="These games have been nominated for this month's Game of the Month."
				>
					<Column
						title="Long Games"
						statusBadge={{
							text: `${nominations.long.length} nominations`,
							isSuccess: nominations.long.length > 0,
						}}
					>
						{renderNominationsList(nominations.long)}
					</Column>

					<Column
						title="Short Games"
						statusBadge={{
							text: `${nominations.short.length} nominations`,
							isSuccess: nominations.short.length > 0,
						}}
					>
						{renderNominationsList(nominations.short)}
					</Column>
				</SplitLayout>
			) : (
				<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
					<div className="text-center space-y-2 mb-8">
						<h1 className="text-3xl font-bold">{monthName}</h1>
					</div>

					<div className="space-y-6">
						<VotingResultsChart
							canvasId={longGamesCanvasId}
							results={results?.long || []}
						/>
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
				<div
					className="fixed inset-0 bg-black/30 backdrop-blur-sm"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="mx-auto max-w-2xl w-full rounded-xl bg-zinc-800 p-6 shadow-xl ring-1 ring-zinc-700">
						<DialogTitle className="text-lg font-medium text-zinc-100 mb-4">
							Pitches for {selectedNomination?.title}
						</DialogTitle>
						<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
							{selectedNomination &&
								pitches?.[selectedNomination.id]?.map((pitch) => (
									<div
										key={`${selectedNomination.id}-${pitch.discord_id}`}
										className="rounded-lg border border-zinc-700 p-4 bg-zinc-800/50 hover:bg-zinc-700 hover:border-zinc-600 transition-colors"
									>
										<div className="flex items-center mb-2">
											<div className="text-sm text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
												{pitch.discord_id}
											</div>
										</div>
										<div className="text-zinc-300 whitespace-pre-wrap text-sm">
											{pitch.pitch}
										</div>
									</div>
								))}
							{selectedNomination &&
								(!pitches?.[selectedNomination.id] ||
									pitches[selectedNomination.id].length === 0) && (
									<div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
										<p className="text-sm text-zinc-400">
											No pitches available for this game
										</p>
									</div>
								)}
						</div>
						<div className="mt-6 flex justify-end gap-3">
							<button
								type="button"
								className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-300 transition-colors hover:text-zinc-100 bg-zinc-700 hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-800"
								onClick={() => setSelectedNomination(null)}
							>
								Close
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</>
	);
}
