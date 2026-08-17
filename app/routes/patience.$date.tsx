import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { Await, Link, useNavigation } from "react-router";
import GameCard from "~/components/GameCard";
import { getReleasesForDate, isValidDate, type Release } from "~/server/releases.server";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/patience.$date.ts";

// One page per calendar day over an unbounded date range, with prev/next links
// and live IGDB data. Useful to browse, not something to put in the index.
export const meta: Route.MetaFunction = ({ loaderData }) =>
	pageMeta({
		title: `Patient on ${loaderData.displayPatienceDate} | ${SITE_NAME}`,
		description: "Games that turned a year old on this date.",
		path: `/patience/${loaderData.patienceDate}`,
		noIndex: true,
	});

// Convert a "patience date" (today) to the release date (1 year ago)
function getReleaseDateFromPatienceDate(patienceDate: string): string {
	const date = new Date(`${patienceDate}T00:00:00Z`);
	date.setFullYear(date.getFullYear() - 1);
	return date.toISOString().split("T")[0];
}

export function loader({ params }: Route.LoaderArgs) {
	const patienceDate = params.date;

	if (!isValidDate(patienceDate)) {
		throw new Response("Invalid date format. Use YYYY-MM-DD", { status: 400 });
	}

	const releaseDate = getReleaseDateFromPatienceDate(patienceDate);
	const patienceDateObj = new Date(`${patienceDate}T00:00:00Z`);

	// Calculate prev/next patience dates
	const prevPatienceDate = new Date(patienceDateObj);
	prevPatienceDate.setDate(prevPatienceDate.getDate() - 1);
	const nextPatienceDate = new Date(patienceDateObj);
	nextPatienceDate.setDate(nextPatienceDate.getDate() + 1);

	const today = new Date().toISOString().split("T")[0];

	return {
		patienceDate,
		releaseDate,
		// Show the patience date (matches URL)
		displayPatienceDate: patienceDateObj.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		}),
		releases: getReleasesForDate(releaseDate),
		prevDate: prevPatienceDate.toISOString().split("T")[0],
		nextDate: nextPatienceDate.toISOString().split("T")[0],
		isToday: patienceDate === today,
	};
}

const spin = stylex.keyframes({ to: { transform: "rotate(360deg)" } });

const styles = stylex.create({
	page: {
		marginInline: "auto",
		maxWidth: "48rem",
		paddingBlock: 24,
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	dateBar: {
		alignItems: "center",
		display: "flex",
		justifyContent: "space-between",
		marginBottom: 24,
	},
	step: {
		alignItems: "center",
		backgroundColor: { default: color.surface, ":hover": color.surfaceRaised },
		borderRadius: radius.lg,
		color: "oklch(87.1% 0.006 286.286)",
		display: "flex",
		fontSize: "0.875rem",
		gap: 4,
		lineHeight: 1.4286,
		paddingBlock: 8,
		paddingInline: 12,
		transitionDuration: motion.duration,
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
	stepIcon: {
		height: 16,
		width: 16,
	},
	dateBlock: {
		textAlign: "center",
	},
	dateMeta: {
		alignItems: "center",
		color: color.muted,
		display: "flex",
		fontSize: "0.875rem",
		gap: 8,
		justifyContent: "center",
		lineHeight: 1.4286,
		marginBottom: 4,
	},
	today: {
		color: color.link,
	},
	dateHeading: {
		color: color.white,
		fontSize: "1.25rem",
		fontWeight: 700,
		lineHeight: 1.4,
	},
	dateCount: {
		color: color.muted,
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		marginTop: 4,
	},
	jump: {
		marginBottom: 24,
		textAlign: "center",
	},
	jumpLink: {
		color: { default: color.link, ":hover": color.linkHover },
		fontSize: "0.875rem",
		lineHeight: 1.4286,
	},
	results: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	loading: {
		alignItems: "center",
		color: color.muted,
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		paddingBlock: 64,
	},
	spinner: {
		animationDuration: "1s",
		animationIterationCount: "infinite",
		animationName: { default: spin, [media.reducedMotion]: "none" },
		animationTimingFunction: "linear",
		height: 32,
		marginBottom: 16,
		width: 32,
	},
	emptyState: {
		color: color.muted,
		paddingBlock: 48,
		textAlign: "center",
	},
});

function PatienceLoading() {
	return (
		<div {...stylex.props(styles.loading)}>
			<Loader2 {...stylex.props(styles.spinner)} />
			<p>Fetching games from IGDB...</p>
		</div>
	);
}

function GamesList({ releases }: { releases: Release[] }) {
	if (releases.length === 0) {
		return <div {...stylex.props(styles.emptyState)}>No games became patient on this date.</div>;
	}

	return (
		<>
			{releases.map((release) => (
				<GameCard key={release.gameId} game={release} />
			))}
		</>
	);
}

export default function PatienceDate({ loaderData }: Route.ComponentProps) {
	const { displayPatienceDate, releases, prevDate, nextDate, isToday } = loaderData;
	const navigation = useNavigation();
	const isNavigating = navigation.state === "loading";

	return (
		<div {...stylex.props(styles.page)}>
			<div {...stylex.props(styles.dateBar)}>
				<Link to={`/patience/${prevDate}`} prefetch="intent" {...stylex.props(styles.step)}>
					<ChevronLeft {...stylex.props(styles.stepIcon)} />
					Prev
				</Link>

				<div {...stylex.props(styles.dateBlock)}>
					<div {...stylex.props(styles.dateMeta)}>
						<Calendar {...stylex.props(styles.stepIcon)} />
						{isToday && <span {...stylex.props(styles.today)}>(Today)</span>}
					</div>
					<h1 {...stylex.props(styles.dateHeading)}>{displayPatienceDate}</h1>
					<Suspense fallback={<p {...stylex.props(styles.dateCount)}>Loading...</p>}>
						<Await resolve={releases}>
							{(resolvedReleases) => (
								<p {...stylex.props(styles.dateCount)}>
									{resolvedReleases.length} game{resolvedReleases.length !== 1 ? "s" : ""} became
									patient
								</p>
							)}
						</Await>
					</Suspense>
				</div>

				<Link to={`/patience/${nextDate}`} prefetch="intent" {...stylex.props(styles.step)}>
					Next
					<ChevronRight {...stylex.props(styles.stepIcon)} />
				</Link>
			</div>

			{!isToday && (
				<div {...stylex.props(styles.jump)}>
					<Link to="/patience" {...stylex.props(styles.jumpLink)}>
						Jump to today
					</Link>
				</div>
			)}

			<div {...stylex.props(styles.results)}>
				{isNavigating ? (
					<PatienceLoading />
				) : (
					<Suspense fallback={<PatienceLoading />}>
						<Await resolve={releases}>
							{(resolvedReleases) => <GamesList releases={resolvedReleases} />}
						</Await>
					</Suspense>
				)}
			</div>
		</div>
	);
}
