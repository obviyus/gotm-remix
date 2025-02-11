import { json, useLoaderData } from "@remix-run/react";
import { pool, getCurrentMonth } from "~/utils/database.server";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import type { RowDataPacket } from "mysql2";
import { calculateVotingResults, type Result } from "~/utils/voting.server";
import type { Nomination } from "~/types";
import SplitLayout, { Column } from "~/components/SplitLayout";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";

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
	pitches: Record<number, Array<{ discord_id: string; pitch: string }>>;
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
			pitches: {}, // Add empty pitches for non-nominating states
		});
	}

	// Default case: just return the month info
	return json<LoaderData>({ month, pitches: {} });
};

export default function Index() {
	const { month, results, nominations, pitches } = useLoaderData<LoaderData>();
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

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
						game_year: game.game_year ?? undefined,
						game_url: game.game_url ?? undefined,
					}}
					onViewPitches={() => {
						setSelectedNomination(game);
						setIsViewingPitches(true);
					}}
					pitchCount={pitches?.[game.id]?.length || 0}
					showPitchesButton={true}
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

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setSelectedNomination(null);
					setIsViewingPitches(false);
				}}
				nomination={selectedNomination}
				pitches={selectedNomination ? pitches[selectedNomination.id] || [] : []}
			/>
		</>
	);
}
