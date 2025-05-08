import { useLoaderData } from "react-router";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import {
	calculateVotingResults,
	getGameUrls,
	type Result,
} from "~/server/voting.server";
import type { Month, Nomination } from "~/types";
import SplitLayout, { Column } from "~/components/SplitLayout";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";

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
	gameUrls: Record<string, string>;
};

export const loader = async () => {
	const month = await getCurrentMonth();
	const gameUrls = getGameUrls(month.id);

	if (month.status === "nominating" || month.status === "jury") {
		const nominations = await getNominationsForMonth(month.id);

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

		return {
			month,
			nominations: nominationsByType,
			gameUrls,
		};
	}

	if (
		month.status === "voting" ||
		month.status === "over" ||
		month.status === "playing"
	) {
		// Calculate results and get URLs in parallel
		const results = await Promise.all([
			calculateVotingResults(month.id, false),
			calculateVotingResults(month.id, true),
		]).then(([long, short]) => ({ long, short }));

		return {
			month,
			results,
			gameUrls,
		};
	}

	// Default case: just return the month info
	return { month, results: undefined, gameUrls };
};

export default function Index() {
	const { month, results, nominations, gameUrls } = useLoaderData<LoaderData>();
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

	const showWinner =
		month.status === "over" ||
		month.status === "complete" ||
		month.status === "playing";

	const renderNominationsList = (games: Nomination[]) => (
		<div className="space-y-4">
			{games.map((game) => (
				<GameCard
					key={game.id}
					game={game}
					onViewPitches={() => {
						setSelectedNomination(game);
						setIsViewingPitches(true);
					}}
					pitchCount={game.pitches.length}
					showPitchesButton={true}
				/>
			))}
		</div>
	);

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				{month.theme && <ThemeCard {...month} />}
			</div>

			<div>
				{month.status === "nominating" && nominations ? (
					<SplitLayout
						title="Current Nominations"
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
				) : month.status === "jury" && nominations ? (
					<>
						<div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-6 mb-8 text-center">
							<h2 className="text-xl font-bold text-blue-300 mb-2">
								Jury Selection in Progress
							</h2>
							<p className="text-zinc-200">
								Our jury members are currently reviewing all nominations and
								will select a curated list of games to be included in the voting
								phase.
							</p>
							<p className="text-zinc-300 mt-2">
								Once the jury has made their selections, the voting phase will
								begin and you&apos;ll be able to rank your favorites.
							</p>
						</div>
						<SplitLayout
							title="All Nominations"
							description="These games have been nominated for this month's Game of the Month. The jury is currently selecting which games will advance to the voting phase."
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
					</>
				) : (
					<div className="space-y-6">
						<VotingResultsChart
							canvasId={longGamesCanvasId}
							results={results?.long || []}
							gameUrls={gameUrls}
							showWinner={showWinner}
						/>
						<VotingResultsChart
							canvasId={shortGamesCanvasId}
							results={results?.short || []}
							gameUrls={gameUrls}
							showWinner={showWinner}
						/>
					</div>
				)}
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
