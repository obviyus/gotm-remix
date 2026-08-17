import * as stylex from "@stylexjs/stylex";
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
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination } from "~/types";
import { categoryGameTitle, categoryLabelsFromMonth } from "~/utils/categoryLabels";
import { findNominationById } from "~/utils/nominations";
import { SITE_NAME, absoluteUrl, monthLabel, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/history.$monthId";

type LoaderData = Route.ComponentProps["loaderData"];
type WinnersByLength = LoaderData["winners"];

const styles = stylex.create({
	page: {
		marginInline: "auto",
		maxWidth: "64rem",
		paddingBlock: 24,
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	themeBlock: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginBottom: 32,
		textAlign: "center",
	},
	cardList: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	votingNotice: {
		backgroundColor: "oklch(41.4% 0.112 45.904 / 0.3)",
		borderColor: "oklch(55.5% 0.163 48.998 / 0.5)",
		borderRadius: radius.lg,
		borderWidth: 1,
		display: "flex",
		flexDirection: "column",
		gap: 16,
		padding: 24,
		textAlign: "center",
	},
	noticeHeading: {
		color: "oklch(87.9% 0.169 91.605)",
		fontSize: "1.25rem",
		fontWeight: 700,
		lineHeight: 1.4,
		marginBottom: 8,
	},
	noticeBody: {
		color: color.body,
	},
	tally: {
		color: "oklch(87.1% 0.006 286.286)",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
	},
	voteLink: {
		alignItems: "center",
		backgroundColor: { default: color.action, ":hover": color.actionHover },
		borderRadius: radius.lg,
		color: color.white,
		display: "inline-flex",
		fontSize: "0.875rem",
		fontWeight: 600,
		justifyContent: "center",
		lineHeight: 1.4286,
		paddingBlock: 10,
		paddingInline: 20,
		transitionDuration: motion.duration,
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
	results: {
		display: "flex",
		flexDirection: "column",
		gap: 24,
	},
	nominations: {
		marginTop: 48,
	},
});

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
		<div {...stylex.props(styles.cardList)}>
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
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const allNominations = await getNominationsForMonth(monthId);

	let results: { long: Result[]; short: Result[] } = { long: [], short: [] };
	let timelapse: {
		long: Awaited<ReturnType<typeof getVotingTimelapse>> | null;
		short: Awaited<ReturnType<typeof getVotingTimelapse>> | null;
	} = { long: null, short: null };
	let totalVotes: number | null = null;
	let gameUrls: Awaited<ReturnType<typeof getGameUrls>> = {};

	if (shouldShowResults) {
		[gameUrls, results.long, results.short, timelapse.long, timelapse.short] = await Promise.all([
			getGameUrls(monthId),
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

export const meta: Route.MetaFunction = ({ loaderData }) => {
	const { month, nominations, winners } = loaderData;
	const label = monthLabel(month.month, month.year);
	const path = `/history/${month.id}`;
	const allNominations = [...nominations.long, ...nominations.short];
	const winnerNames = [winners.long?.gameName, winners.short?.gameName].filter(Boolean);

	const description = winnerNames.length
		? `${winnerNames.join(" and ")} won the "${month.theme.name}" theme in ${label}, out of ${allNominations.length} games nominated by the PatientGamers Discord.`
		: `${allNominations.length} games nominated by the PatientGamers Discord for the "${month.theme.name}" theme in ${label}.`;

	const itemList = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: `${label} nominations for ${month.theme.name}`,
		numberOfItems: allNominations.length,
		itemListElement: allNominations.map((nomination, index) => ({
			"@type": "ListItem",
			position: index + 1,
			item: {
				"@type": "VideoGame",
				name: nomination.gameName,
				...(nomination.gameUrl ? { sameAs: nomination.gameUrl } : {}),
				...(nomination.gameCover ? { image: absoluteUrl(nomination.gameCover) } : {}),
			},
		})),
	};

	return [
		...pageMeta({
			title: `${label}: ${month.theme.name} | ${SITE_NAME}`,
			description,
			path,
			image: `/og/month/${month.id}`,
		}),
		{ "script:ld+json": itemList },
	];
};

export default function HistoryMonth({ loaderData }: Route.ComponentProps) {
	const { month, results, gameUrls, nominations, winners, totalVotes } = loaderData;
	const timelapse = loaderData.timelapse;
	const [selectedNominationId, setSelectedNominationId] = useState<number | null>(null);
	const selectedNomination = findNominationById(
		selectedNominationId,
		nominations.long,
		nominations.short,
	);
	const handleViewPitches = (nomination: Nomination) => {
		setSelectedNominationId(nomination.id);
	};
	const handleCloseModal = () => {
		setSelectedNominationId(null);
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

	const showResults =
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const showWinner = showResults;
	const labels = categoryLabelsFromMonth(month);
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
		<div {...stylex.props(styles.page)}>
			<div {...stylex.props(styles.themeBlock)}>
				{month.theme && <ThemeCard {...month} asPageHeading />}
			</div>

			{month.status === "voting" ? (
				<div {...stylex.props(styles.votingNotice)}>
					<div>
						<h2 {...stylex.props(styles.noticeHeading)}>Voting in Progress</h2>
						<p {...stylex.props(styles.noticeBody)}>
							Votes are being collected right now. Results will be revealed after the voting phase
							ends.
						</p>
					</div>
					<p {...stylex.props(styles.tally)}>
						{totalVotesLabel} {totalVotes === 1 ? "vote" : "votes"} cast so far.
					</p>
					<Link to="/voting" prefetch="viewport" {...stylex.props(styles.voteLink)}>
						Go Vote Now →
					</Link>
				</div>
			) : showResults ? (
				<div {...stylex.props(styles.results)}>
					<VotingResultsChart
						title={labels.long}
						results={results.long}
						gameUrls={gameUrls}
						showWinner={showWinner}
						timelapse={longTimelapse}
					/>
					<VotingResultsChart
						title={labels.short}
						results={results.short}
						gameUrls={gameUrls}
						showWinner={showWinner}
						timelapse={shortTimelapse}
					/>
				</div>
			) : null}

			<div {...stylex.props(styles.nominations)}>
				<TwoColumnLayout
					title="All Nominations"
					description="These games were nominated for this month's Game of the Month."
				>
					<Column title={categoryGameTitle(labels.long)} statusBadge={columnStatus.long}>
						<SortedNominationsList
							games={nominations.long}
							isShort={false}
							showWinner={showWinner}
							winners={winners}
							onViewPitches={handleViewPitches}
						/>
					</Column>

					<Column title={categoryGameTitle(labels.short)} statusBadge={columnStatus.short}>
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
				isOpen={selectedNomination !== null}
				onClose={handleCloseModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
