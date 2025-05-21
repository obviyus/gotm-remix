import type { Route } from "./+types/history.$monthId";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import { calculateVotingResults, getGameUrls } from "~/server/voting.server";
import ThemeCard from "~/components/ThemeCard";
import type { Nomination } from "~/types";
import { getMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import SplitLayout, { Column } from "~/components/SplitLayout";
import { getWinner } from "~/server/winner.server";

export async function loader({ params }: Route.LoaderArgs) {
	const monthId = Number(params.monthId);
	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	// Get theme information along with other data
	const [month, results, gameUrls, allNominations] = await Promise.all([
		getMonth(monthId),
		Promise.all([
			calculateVotingResults(monthId, false),
			calculateVotingResults(monthId, true),
		]).then(([long, short]) => ({ long, short })),
		getGameUrls(monthId),
		getNominationsForMonth(monthId),
	]);

	// Only fetch winners if month status is not "voting"
	let shortWinner = null;
	let longWinner = null;

	if (month.status !== "voting") {
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
		gameUrls,
		nominations,
		winners: {
			short: shortWinner,
			long: longWinner,
		},
	};
}

export default function HistoryMonth({ loaderData }: Route.ComponentProps) {
	const { month, results, gameUrls, nominations, winners } = loaderData;
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

	// Only show winners if month status is not "voting"
	const showWinner =
		month.status !== "voting" &&
		(month.status === "over" ||
			month.status === "complete" ||
			month.status === "playing");

	// Create arrays of winner game IDs for highlighting
	const winnerGameIds = [];
	if (showWinner) {
		if (winners.short?.gameId) winnerGameIds.push(winners.short.gameId);
		if (winners.long?.gameId) winnerGameIds.push(winners.long.gameId);
	}

	const renderNominationsList = (games: Nomination[], isShort: boolean) => {
		// Sort games: winners first, then jury selected, then the rest
		const sortedGames = [...games].sort((a, b) => {
			if (!showWinner) {
				// If not showing winners, just sort by jury selection
				if (a.jurySelected && !b.jurySelected) return -1;
				if (!a.jurySelected && b.jurySelected) return 1;
				return 0;
			}

			const aIsWinner = isShort
				? winners.short?.id === a.id
				: winners.long?.id === a.id;
			const bIsWinner = isShort
				? winners.short?.id === b.id
				: winners.long?.id === b.id;

			if (aIsWinner && !bIsWinner) return -1;
			if (!aIsWinner && bIsWinner) return 1;
			if (a.jurySelected && !b.jurySelected) return -1;
			if (!a.jurySelected && b.jurySelected) return 1;
			return 0;
		});

		return (
			<div className="space-y-4">
				{sortedGames.map((game) => {
					const isWinner =
						showWinner &&
						(isShort
							? winners.short?.id === game.id
							: winners.long?.id === game.id);

					return (
						<GameCard
							key={game.id}
							game={game}
							onViewPitches={() => {
								setSelectedNomination(game);
								setIsViewingPitches(true);
							}}
							pitchCount={game.pitches.length}
							showPitchesButton={true}
							isWinner={isWinner}
							isJurySelected={game.jurySelected}
						/>
					);
				})}
			</div>
		);
	};

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				{month.theme && <ThemeCard {...month} />}
			</div>

			<div className="space-y-6">
				<VotingResultsChart
					canvasId={longGamesCanvasId}
					results={results.long}
					gameUrls={gameUrls}
					showWinner={showWinner}
				/>
				<VotingResultsChart
					canvasId={shortGamesCanvasId}
					results={results.short}
					gameUrls={gameUrls}
					showWinner={showWinner}
				/>
			</div>

			<div className="mt-12">
				<SplitLayout
					title="All Nominations"
					description="These games were nominated for this month's Game of the Month."
				>
					<Column
						title="Long Games"
						statusBadge={{
							text: `${nominations.long.length} nominations`,
							isSuccess: nominations.long.length > 0,
						}}
					>
						{renderNominationsList(nominations.long, false)}
					</Column>

					<Column
						title="Short Games"
						statusBadge={{
							text: `${nominations.short.length} nominations`,
							isSuccess: nominations.short.length > 0,
						}}
					>
						{renderNominationsList(nominations.short, true)}
					</Column>
				</SplitLayout>
			</div>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}
