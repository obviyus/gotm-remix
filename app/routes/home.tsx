import { useMemo, useState } from "react";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import TwoColumnLayout, { Column } from "~/components/TwoColumnLayout";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { calculateVotingResults, getGameUrls } from "~/server/voting.server";
import type { Nomination } from "~/types";
import type { Route } from "./+types/home";

export async function loader() {
	const month = await getCurrentMonth();
	const gameUrls = await getGameUrls(month.id);

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
}

export default function Index({ loaderData }: Route.ComponentProps) {
	const { month, results, nominations, gameUrls } = loaderData;
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
					<TwoColumnLayout
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
					</TwoColumnLayout>
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
						<TwoColumnLayout
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
						</TwoColumnLayout>
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
