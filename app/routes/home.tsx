import { useMemo, useState } from "react";
import { Link } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import TwoColumnLayout, { Column } from "~/components/TwoColumnLayout";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import type { Result } from "~/server/voting.server";
import { calculateVotingResults, getGameUrls, getTotalVotesForMonth } from "~/server/voting.server";
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
	totalVotes?: number;
};

const EMPTY_RESULTS: Result[] = [];

interface NominationsListProps {
	games: Nomination[];
	onViewPitches: (nomination: Nomination) => void;
}

function NominationsList({ games, onViewPitches }: NominationsListProps) {
	const sortedGames = useMemo(() => {
		return [...games].sort((a, b) => {
			if (a.jurySelected && !b.jurySelected) return -1;
			if (!a.jurySelected && b.jurySelected) return 1;
			return 0;
		});
	}, [games]);

	return (
		<div className="space-y-4">
			{sortedGames.map((game) => {
				return (
					<GameCard
						key={game.id}
						game={game}
						onViewPitches={() => onViewPitches(game)}
						pitchCount={game.pitches.length}
						showPitchesButton
						isJurySelected={game.jurySelected}
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
			const nominationsPromise = getNominationsForMonth(month.id).then(groupNominationsByType);
			const [gameUrls, nominations] = await Promise.all([gameUrlsPromise, nominationsPromise]);

			return {
				month,
				nominations,
				gameUrls,
			} satisfies LoaderData;
		}
		case "voting": {
			const nominationsPromise = getNominationsForMonth(month.id).then(groupNominationsByType);
			const [gameUrls, totalVotes, nominations] = await Promise.all([
				gameUrlsPromise,
				getTotalVotesForMonth(month.id),
				nominationsPromise,
			]);

			return {
				month,
				gameUrls,
				totalVotes,
				nominations,
			} satisfies LoaderData;
		}
		case "over":
		case "playing":
		case "complete": {
			const resultsPromise = getResults(month.id);
			const [gameUrls, results] = await Promise.all([gameUrlsPromise, resultsPromise]);

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
	const [selectedNomination, setSelectedNomination] = useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);
	const handleViewPitches = (nomination: Nomination) => {
		setSelectedNomination(nomination);
		setIsViewingPitches(true);
	};
	const handleCloseModal = () => {
		setIsViewingPitches(false);
		setSelectedNomination(null);
	};

	const columnStatus = nominations
		? {
				long: {
					text: `${nominations.long.length} nominations`,
					isSuccess: nominations.long.length > 0,
				},
				short: {
					text: `${nominations.short.length} nominations`,
					isSuccess: nominations.short.length > 0,
				},
			}
		: null;

	const longResults = results?.long ?? EMPTY_RESULTS;
	const shortResults = results?.short ?? EMPTY_RESULTS;

	const longGamesCanvasId = `longGamesChart-${month.month}-${month.year}`;
	const shortGamesCanvasId = `shortGamesChart-${month.month}-${month.year}`;

	const showWinner =
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const showResults =
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const totalVotes = loaderData.totalVotes ?? 0;
	const totalVotesLabel = totalVotes.toLocaleString();

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">{month.theme && <ThemeCard {...month} />}</div>

			<div>
				{month.status === "nominating" && nominations ? (
					<TwoColumnLayout
						title="Current Nominations"
						description="These games have been nominated for this month's Game of the Month."
					>
						<Column title="Long Games" statusBadge={columnStatus?.long}>
							<NominationsList games={nominations.long} onViewPitches={handleViewPitches} />
						</Column>

						<Column title="Short Games" statusBadge={columnStatus?.short}>
							<NominationsList games={nominations.short} onViewPitches={handleViewPitches} />
						</Column>
					</TwoColumnLayout>
				) : month.status === "jury" && nominations ? (
					<>
						<div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-6 mb-8 text-center">
							<h2 className="text-xl font-bold text-blue-300 mb-2">Jury Selection in Progress</h2>
							<p className="text-zinc-200">
								Our jury members are currently reviewing all nominations and will select a curated
								list of games to be included in the voting phase.
							</p>
							<p className="text-zinc-300 mt-2">
								Once the jury has made their selections, the voting phase will begin and you&apos;ll
								be able to rank your favorites.
							</p>
						</div>
						<TwoColumnLayout
							title="All Nominations"
							description="These games have been nominated for this month's Game of the Month. The jury is currently selecting which games will advance to the voting phase."
						>
							<Column title="Long Games" statusBadge={columnStatus?.long}>
								<NominationsList games={nominations.long} onViewPitches={handleViewPitches} />
							</Column>

							<Column title="Short Games" statusBadge={columnStatus?.short}>
								<NominationsList games={nominations.short} onViewPitches={handleViewPitches} />
							</Column>
						</TwoColumnLayout>
					</>
				) : month.status === "voting" && nominations ? (
					<>
						<div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-6 text-center space-y-4">
							<div>
								<h2 className="text-xl font-bold text-amber-300 mb-2">Voting in Progress</h2>
								<p className="text-zinc-200">
									Votes are being collected right now. Results will be revealed after the voting
									phase ends.
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
						<div className="mt-8">
							<TwoColumnLayout
								title="Games Up for Vote"
								description="These games have been selected by the jury for this month's vote."
							>
								<Column title="Long Games" statusBadge={columnStatus?.long}>
									<NominationsList games={nominations.long} onViewPitches={handleViewPitches} />
								</Column>

								<Column title="Short Games" statusBadge={columnStatus?.short}>
									<NominationsList games={nominations.short} onViewPitches={handleViewPitches} />
								</Column>
							</TwoColumnLayout>
						</div>
					</>
				) : showResults ? (
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
				) : null}
			</div>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={handleCloseModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
