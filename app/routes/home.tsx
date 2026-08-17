import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import TwoColumnLayout, { Column } from "~/components/TwoColumnLayout";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { requestUserContext } from "~/route-context.server";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import type { Result } from "~/server/voting.server";
import {
	calculateVotingResults,
	getGameUrls,
	getTotalVotesForMonth,
	getVotingTimelapse,
} from "~/server/voting.server";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination } from "~/types";
import { categoryGameTitle, categoryLabelsFromMonth } from "~/utils/categoryLabels";
import { findNominationById } from "~/utils/nominations";
import { pageMeta } from "~/utils/seo";
import type { Route } from "./+types/home";

type NominationsByType = {
	short: Nomination[];
	long: Nomination[];
};

type ResultsByType = {
	long: Result[];
	short: Result[];
};

type TimelapseByType = {
	long: Awaited<ReturnType<typeof getVotingTimelapse>> | null;
	short: Awaited<ReturnType<typeof getVotingTimelapse>> | null;
};

type LoaderData = {
	month: Awaited<ReturnType<typeof getCurrentMonth>>;
	gameUrls: Awaited<ReturnType<typeof getGameUrls>>;
	userDiscordId: string | null;
	nominations?: NominationsByType;
	results?: ResultsByType;
	timelapse?: TimelapseByType;
	totalVotes?: number;
};

const EMPTY_RESULTS: Result[] = [];

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
	notice: {
		borderRadius: radius.lg,
		borderWidth: 1,
		padding: 24,
		textAlign: "center",
	},
	juryNotice: {
		backgroundColor: "oklch(37.9% 0.146 265.522 / 0.3)",
		borderColor: "oklch(48.8% 0.243 264.376 / 0.5)",
		marginBottom: 32,
	},
	votingNotice: {
		backgroundColor: "oklch(41.4% 0.112 45.904 / 0.3)",
		borderColor: "oklch(55.5% 0.163 48.998 / 0.5)",
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	noticeHeading: {
		fontSize: "1.25rem",
		fontWeight: 700,
		lineHeight: 1.4,
		marginBottom: 8,
	},
	juryHeading: {
		color: "oklch(80.9% 0.105 251.813)",
	},
	votingHeading: {
		color: "oklch(87.9% 0.169 91.605)",
	},
	noticeBody: {
		color: color.body,
	},
	noticeAside: {
		color: "oklch(87.1% 0.006 286.286)",
		marginTop: 8,
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
	ballotSection: {
		marginTop: 32,
	},
	results: {
		display: "flex",
		flexDirection: "column",
		gap: 24,
	},
});

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
		<div {...stylex.props(styles.cardList)}>
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

async function getTimelapse(monthId: number): Promise<TimelapseByType> {
	const [long, short] = await Promise.all([
		getVotingTimelapse(monthId, false),
		getVotingTimelapse(monthId, true),
	]);
	return { long, short };
}

export async function loader({ context }: Route.LoaderArgs): Promise<LoaderData> {
	const userDiscordId = context.get(requestUserContext)?.discordId ?? null;
	const month = await getCurrentMonth();

	switch (month.status) {
		case "nominating":
		case "jury": {
			const nominationsPromise = getNominationsForMonth(month.id).then(groupNominationsByType);
			const nominations = await nominationsPromise;

			return {
				month,
				nominations,
				userDiscordId,
				gameUrls: {},
			} satisfies LoaderData;
		}
		case "voting": {
			const nominationsPromise = getNominationsForMonth(month.id).then(groupNominationsByType);
			const [totalVotes, nominations] = await Promise.all([
				getTotalVotesForMonth(month.id),
				nominationsPromise,
			]);

			return {
				month,
				gameUrls: {},
				userDiscordId,
				totalVotes,
				nominations,
			} satisfies LoaderData;
		}
		case "over":
		case "playing":
		case "complete": {
			const resultsPromise = getResults(month.id);
			const timelapsePromise = getTimelapse(month.id);
			const [gameUrls, results, timelapse] = await Promise.all([
				getGameUrls(month.id),
				resultsPromise,
				timelapsePromise,
			]);

			return {
				month,
				results,
				timelapse,
				userDiscordId,
				gameUrls,
			} satisfies LoaderData;
		}
		default: {
			return { month, gameUrls: {}, userDiscordId } satisfies LoaderData;
		}
	}
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
	const { month } = loaderData;

	return pageMeta({
		title: "PatientGamers Game of the Month",
		description: `The PatientGamers Discord picks two games to play every month, one short and one long. This month's theme is "${month.theme.name}".`,
		path: "/",
		image: `/og/month/${month.id}`,
	});
};

export default function Index({ loaderData }: Route.ComponentProps) {
	const { month, results, nominations, gameUrls, userDiscordId } = loaderData;
	const [selectedNominationId, setSelectedNominationId] = useState<number | null>(null);
	const selectedNomination = findNominationById(
		selectedNominationId,
		nominations?.long,
		nominations?.short,
	);
	const handleViewPitches = (nomination: Nomination) => {
		setSelectedNominationId(nomination.id);
	};
	const handleCloseModal = () => {
		setSelectedNominationId(null);
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
	const timelapse = loaderData.timelapse;
	const labels = categoryLabelsFromMonth(month);

	const showWinner =
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const showResults =
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const totalVotes = loaderData.totalVotes ?? 0;
	const totalVotesLabel = totalVotes.toLocaleString();
	const longTimelapse =
		timelapse?.long?.frames?.length && timelapse.long.totalVotes
			? {
					frames: timelapse.long.frames,
					totalVotes: timelapse.long.totalVotes,
				}
			: undefined;
	const shortTimelapse =
		timelapse?.short?.frames?.length && timelapse.short.totalVotes
			? {
					frames: timelapse.short.frames,
					totalVotes: timelapse.short.totalVotes,
				}
			: undefined;

	return (
		<div {...stylex.props(styles.page)}>
			<div {...stylex.props(styles.themeBlock)}>
				{month.theme && <ThemeCard {...month} asPageHeading />}
			</div>

			<div>
				{month.status === "nominating" && nominations ? (
					<TwoColumnLayout
						title="Current Nominations"
						description="These games have been nominated for this month's Game of the Month."
					>
						<Column title={categoryGameTitle(labels.long)} statusBadge={columnStatus?.long}>
							<NominationsList games={nominations.long} onViewPitches={handleViewPitches} />
						</Column>

						<Column title={categoryGameTitle(labels.short)} statusBadge={columnStatus?.short}>
							<NominationsList games={nominations.short} onViewPitches={handleViewPitches} />
						</Column>
					</TwoColumnLayout>
				) : month.status === "jury" && nominations ? (
					<>
						<div {...stylex.props(styles.notice, styles.juryNotice)}>
							<h2 {...stylex.props(styles.noticeHeading, styles.juryHeading)}>
								Jury Selection in Progress
							</h2>
							<p {...stylex.props(styles.noticeBody)}>
								Our jury members are currently reviewing all nominations and will select a curated
								list of games to be included in the voting phase.
							</p>
							<p {...stylex.props(styles.noticeAside)}>
								Once the jury has made their selections, the voting phase will begin and you&apos;ll
								be able to rank your favorites.
							</p>
						</div>
						<TwoColumnLayout
							title="All Nominations"
							description="These games have been nominated for this month's Game of the Month. The jury is currently selecting which games will advance to the voting phase."
						>
							<Column title={categoryGameTitle(labels.long)} statusBadge={columnStatus?.long}>
								<NominationsList games={nominations.long} onViewPitches={handleViewPitches} />
							</Column>

							<Column title={categoryGameTitle(labels.short)} statusBadge={columnStatus?.short}>
								<NominationsList games={nominations.short} onViewPitches={handleViewPitches} />
							</Column>
						</TwoColumnLayout>
					</>
				) : month.status === "voting" && nominations ? (
					<>
						<div {...stylex.props(styles.notice, styles.votingNotice)}>
							<div>
								<h2 {...stylex.props(styles.noticeHeading, styles.votingHeading)}>
									Voting in Progress
								</h2>
								<p {...stylex.props(styles.noticeBody)}>
									Votes are being collected right now. Results will be revealed after the voting
									phase ends.
								</p>
							</div>
							<p {...stylex.props(styles.tally)}>
								{totalVotesLabel} {totalVotes === 1 ? "vote" : "votes"} cast so far.
							</p>
							<Link to="/voting" prefetch="viewport" {...stylex.props(styles.voteLink)}>
								Go Vote Now →
							</Link>
						</div>
						<div {...stylex.props(styles.ballotSection)}>
							<TwoColumnLayout
								title="Games Up for Vote"
								description="These games have been selected by the jury for this month's vote."
							>
								<Column title={categoryGameTitle(labels.long)} statusBadge={columnStatus?.long}>
									<NominationsList games={nominations.long} onViewPitches={handleViewPitches} />
								</Column>

								<Column title={categoryGameTitle(labels.short)} statusBadge={columnStatus?.short}>
									<NominationsList games={nominations.short} onViewPitches={handleViewPitches} />
								</Column>
							</TwoColumnLayout>
						</div>
					</>
				) : showResults ? (
					<div {...stylex.props(styles.results)}>
						<VotingResultsChart
							title={labels.long}
							results={longResults}
							gameUrls={gameUrls}
							showWinner={showWinner}
							timelapse={longTimelapse}
						/>
						<VotingResultsChart
							title={labels.short}
							results={shortResults}
							gameUrls={gameUrls}
							showWinner={showWinner}
							timelapse={shortTimelapse}
						/>
					</div>
				) : null}
			</div>

			<PitchesModal
				isOpen={selectedNomination !== null}
				onClose={handleCloseModal}
				nomination={selectedNomination}
				userDiscordId={userDiscordId}
				canManagePitch={month.status === "nominating" && Boolean(userDiscordId)}
			/>
		</div>
	);
}
