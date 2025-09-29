import React from "react";
import { useState } from "react";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import TwoColumnLayout, { Column } from "~/components/TwoColumnLayout";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import type { Result } from "~/server/voting.server";
import { calculateVotingResults, getGameUrls } from "~/server/voting.server";
import type { Nomination } from "~/types";
import type { Route } from "./+types/home";

type NominationsByType = {
	short: Nomination[];
	long: Nomination[];
};

type ResultsByType = {
	long: Result[];
	short: Result[];
};

type LoaderData = {
	month: Awaited<ReturnType<typeof getCurrentMonth>>;
	gameUrls: Awaited<ReturnType<typeof getGameUrls>>;
	nominations?: NominationsByType;
	results?: ResultsByType;
};

const EMPTY_RESULTS: Result[] = [];

interface NominationsListProps {
	games: Nomination[];
	onViewPitches: (nomination: Nomination) => void;
}

function NominationsList({ games, onViewPitches }: NominationsListProps) {
	const pitchHandlers = React.useMemo(() => {
		return new Map<number, () => void>(
			games.map((game) => [game.id, () => onViewPitches(game)] as const),
		);
	}, [games, onViewPitches]);

	return (
		<div className="space-y-4">
			{games.map((game) => {
				const viewPitches = pitchHandlers.get(game.id);
				if (!viewPitches) {
					return null;
				}

				return (
					<GameCard
						key={game.id}
						game={game}
						onViewPitches={viewPitches}
						pitchCount={game.pitches.length}
						showPitchesButton
					/>
				);
			})}
		</div>
	);
}

function groupNominationsByType(nominations: Nomination[]): NominationsByType {
	return nominations.reduce<NominationsByType>(
		(acc, nomination) => {
			if (nomination.short) {
				acc.short.push(nomination);
			} else {
				acc.long.push(nomination);
			}
			return acc;
		},
		{ short: [], long: [] },
	);
}

async function getResults(monthId: number): Promise<ResultsByType> {
	const [long, short] = await Promise.all([
		calculateVotingResults(monthId, false),
		calculateVotingResults(monthId, true),
	]);
	return { long, short };
}

export async function loader(): Promise<LoaderData> {
	const month = await getCurrentMonth();
	const gameUrlsPromise = getGameUrls(month.id);

	switch (month.status) {
		case "nominating":
		case "jury": {
			const nominationsPromise = getNominationsForMonth(month.id).then(
				groupNominationsByType,
			);
			const [gameUrls, nominations] = await Promise.all([
				gameUrlsPromise,
				nominationsPromise,
			]);

			return {
				month,
				nominations,
				gameUrls,
			} satisfies LoaderData;
		}
		case "voting":
		case "over":
		case "playing": {
			const resultsPromise = getResults(month.id);
			const [gameUrls, results] = await Promise.all([
				gameUrlsPromise,
				resultsPromise,
			]);

			return {
				month,
				results,
				gameUrls,
			} satisfies LoaderData;
		}
		default: {
			const gameUrls = await gameUrlsPromise;
			return { month, gameUrls } satisfies LoaderData;
		}
	}
}

export default function Index({ loaderData }: Route.ComponentProps) {
	const { month, results, nominations, gameUrls } = loaderData;
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);
	const handleViewPitches = React.useCallback((nomination: Nomination) => {
		setSelectedNomination(nomination);
		setIsViewingPitches(true);
	}, []);
	const handleCloseModal = React.useCallback(() => {
		setIsViewingPitches(false);
		setSelectedNomination(null);
	}, []);

	const columnStatus = React.useMemo(() => {
		if (!nominations) {
			return null;
		}

		const longCount = nominations.long.length;
		const shortCount = nominations.short.length;

		return {
			long: {
				text: `${longCount} nominations`,
				isSuccess: longCount > 0,
			},
			short: {
				text: `${shortCount} nominations`,
				isSuccess: shortCount > 0,
			},
		};
	}, [nominations]);

	const longResults = React.useMemo(
		() => results?.long ?? EMPTY_RESULTS,
		[results?.long],
	);

	const shortResults = React.useMemo(
		() => results?.short ?? EMPTY_RESULTS,
		[results?.short],
	);

	const longGamesCanvasId = `longGamesChart-${month.month}-${month.year}`;
	const shortGamesCanvasId = `shortGamesChart-${month.month}-${month.year}`;

	const showWinner =
		month.status === "over" ||
		month.status === "complete" ||
		month.status === "playing";

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
							statusBadge={columnStatus?.long}
						>
							<NominationsList
								games={nominations.long}
								onViewPitches={handleViewPitches}
							/>
						</Column>

						<Column
							title="Short Games"
							statusBadge={columnStatus?.short}
						>
							<NominationsList
								games={nominations.short}
								onViewPitches={handleViewPitches}
							/>
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
								statusBadge={columnStatus?.long}
							>
								<NominationsList
									games={nominations.long}
									onViewPitches={handleViewPitches}
								/>
							</Column>

							<Column
								title="Short Games"
								statusBadge={columnStatus?.short}
							>
								<NominationsList
									games={nominations.short}
									onViewPitches={handleViewPitches}
								/>
							</Column>
						</TwoColumnLayout>
					</>
				) : (
					<div className="space-y-6">
						<VotingResultsChart
							canvasId={longGamesCanvasId}
							results={longResults}
							gameUrls={gameUrls}
							showWinner={showWinner}
						/>
						<VotingResultsChart
							canvasId={shortGamesCanvasId}
							results={shortResults}
							gameUrls={gameUrls}
							showWinner={showWinner}
						/>
					</div>
				)}
			</div>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={handleCloseModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
