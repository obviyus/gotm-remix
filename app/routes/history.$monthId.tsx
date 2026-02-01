import { useState } from "react";
import { Link } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import TwoColumnLayout, { Column } from "~/components/TwoColumnLayout";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { getMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import {
	calculateVotingResults,
	getGameUrls,
	getTotalVotesForMonth,
	getVotingTimelapse,
	type Result,
} from "~/server/voting.server";
import { getWinner } from "~/server/winner.server";
import type { Nomination } from "~/types";
import type { Route } from "./+types/history.$monthId";

type LoaderData = Route.ComponentProps["loaderData"];
type WinnersByLength = LoaderData["winners"];

interface SortedNominationsListProps {
	games: Nomination[];
	isShort: boolean;
	showWinner: boolean;
	winners: WinnersByLength;
	onViewPitches: (nomination: Nomination) => void;
}

function SortedNominationsList({
	games,
	isShort,
	showWinner,
	winners,
	onViewPitches,
}: SortedNominationsListProps) {
	const winnerForLength = isShort ? winners.short : winners.long;
	const sortedGames = [...games].sort((a, b) => {
		if (!showWinner) {
			if (a.jurySelected && !b.jurySelected) return -1;
			if (!a.jurySelected && b.jurySelected) return 1;
			return 0;
		}

		const aIsWinner = winnerForLength?.id === a.id;
		const bIsWinner = winnerForLength?.id === b.id;

		if (aIsWinner !== bIsWinner) {
			return aIsWinner ? -1 : 1;
		}

		if (a.jurySelected !== b.jurySelected) {
			return a.jurySelected ? -1 : 1;
		}

		return 0;
	});

	return (
		<div className="space-y-4">
			{sortedGames.map((game) => {
				const isWinner = showWinner && winnerForLength?.id === game.id;

				return (
					<GameCard
						key={game.id}
						game={game}
						onViewPitches={() => onViewPitches(game)}
						pitchCount={game.pitches.length}
						showPitchesButton
						isWinner={isWinner}
						isJurySelected={game.jurySelected}
					/>
				);
			})}
		</div>
	);
}

export async function loader({ params }: Route.LoaderArgs) {
	const monthId = Number(params.monthId);
	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	const month = await getMonth(monthId);
	const shouldShowResults =
		month.status === "over" ||
		month.status === "complete" ||
		month.status === "playing";

	const [gameUrls, allNominations] = await Promise.all([
		getGameUrls(monthId),
		getNominationsForMonth(monthId),
	]);

	let results: { long: Result[]; short: Result[] } = { long: [], short: [] };
	let timelapse: {
		long: Awaited<ReturnType<typeof getVotingTimelapse>> | null;
		short: Awaited<ReturnType<typeof getVotingTimelapse>> | null;
	} = { long: null, short: null };
	let totalVotes: number | null = null;

	if (shouldShowResults) {
		[results.long, results.short, timelapse.long, timelapse.short] =
			await Promise.all([
				calculateVotingResults(monthId, false),
				calculateVotingResults(monthId, true),
				getVotingTimelapse(monthId, false),
				getVotingTimelapse(monthId, true),
			]);
	} else if (month.status === "voting") {
		totalVotes = await getTotalVotesForMonth(monthId);
	}

	// Only fetch winners once results are meant to be visible
	let shortWinner = null;
	let longWinner = null;

	if (shouldShowResults) {
		[shortWinner, longWinner] = await Promise.all([
			getWinner(monthId, true),
			getWinner(monthId, false),
		]);
	}

	// Group nominations by type
	const nominations = allNominations.reduce(
		(acc, nom) => {
			if (nom.short) {
				acc.short.push(nom);
			} else {
				acc.long.push(nom);
			}
			return acc;
		},
		{ short: [] as Nomination[], long: [] as Nomination[] },
	);

	return {
		month,
		results,
		timelapse,
		gameUrls,
		nominations,
		totalVotes,
		winners: {
			short: shortWinner,
			long: longWinner,
		},
	};
}

export default function HistoryMonth({ loaderData }: Route.ComponentProps) {
	const { month, results, gameUrls, nominations, winners, totalVotes } =
		loaderData;
	const timelapse = loaderData.timelapse;
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);
	const handleViewPitches = (nomination: Nomination) => {
		setSelectedNomination(nomination);
		setIsViewingPitches(true);
	};
	const handleCloseModal = () => {
		setIsViewingPitches(false);
		setSelectedNomination(null);
	};

	const columnStatus = {
		long: {
			text: `${nominations.long.length} nominations`,
			isSuccess: nominations.long.length > 0,
		},
		short: {
			text: `${nominations.short.length} nominations`,
			isSuccess: nominations.short.length > 0,
		},
	};

	const longGamesCanvasId = `longGamesChart-${month.month}-${month.year}`;
	const shortGamesCanvasId = `shortGamesChart-${month.month}-${month.year}`;

	const showResults =
		month.status === "over" ||
		month.status === "complete" ||
		month.status === "playing";

	const showWinner = showResults;
	const totalVotesLabel = (totalVotes ?? 0).toLocaleString();
	const longTimelapse =
		timelapse.long?.frames?.length && timelapse.long.totalVotes
			? {
					frames: timelapse.long.frames,
					totalVotes: timelapse.long.totalVotes,
				}
			: undefined;
	const shortTimelapse =
		timelapse.short?.frames?.length && timelapse.short.totalVotes
			? {
					frames: timelapse.short.frames,
					totalVotes: timelapse.short.totalVotes,
				}
			: undefined;

	// Create arrays of winner game IDs for highlighting
	const winnerGameIds = [];
	if (showWinner) {
		if (winners.short?.gameId) winnerGameIds.push(winners.short.gameId);
		if (winners.long?.gameId) winnerGameIds.push(winners.long.gameId);
	}

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				{month.theme && <ThemeCard {...month} />}
			</div>

			{month.status === "voting" ? (
				<div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-6 text-center space-y-4">
					<div>
						<h2 className="text-xl font-bold text-amber-300 mb-2">
							Voting in Progress
						</h2>
						<p className="text-zinc-200">
							Votes are being collected right now. Results will be revealed
							after the voting phase ends.
						</p>
					</div>
					<p className="text-sm text-zinc-300">
						{totalVotesLabel} {totalVotes === 1 ? "vote" : "votes"} cast so far.
					</p>
					<Link
						to="/voting"
						prefetch="viewport"
						className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
					>
						Go Vote Now →
					</Link>
				</div>
			) : showResults ? (
				<div className="space-y-6">
					<VotingResultsChart
						canvasId={longGamesCanvasId}
						results={results.long}
						gameUrls={gameUrls}
						showWinner={showWinner}
						timelapse={longTimelapse}
					/>
					<VotingResultsChart
						canvasId={shortGamesCanvasId}
						results={results.short}
						gameUrls={gameUrls}
						showWinner={showWinner}
						timelapse={shortTimelapse}
					/>
				</div>
			) : null}

			<div className="mt-12">
				<TwoColumnLayout
					title="All Nominations"
					description="These games were nominated for this month's Game of the Month."
				>
					<Column
						title="Long Games"
						statusBadge={columnStatus.long}
					>
						<SortedNominationsList
							games={nominations.long}
							isShort={false}
							showWinner={showWinner}
							winners={winners}
							onViewPitches={handleViewPitches}
						/>
					</Column>

					<Column
						title="Short Games"
						statusBadge={columnStatus.short}
					>
						<SortedNominationsList
							games={nominations.short}
							isShort
							showWinner={showWinner}
							winners={winners}
							onViewPitches={handleViewPitches}
						/>
					</Column>
				</TwoColumnLayout>
			</div>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={handleCloseModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
