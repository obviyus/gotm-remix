import * as stylex from "@stylexjs/stylex";
import type { ChangeEvent, FormEvent } from "react";
import { useId, useState } from "react";
import { Link, useFetcher } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { authenticatedUserContext, requireAuthenticatedUser } from "~/route-context.server";
import { db } from "~/server/database.server";
import { searchGames } from "~/server/igdb.server";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination, Pitch } from "~/types";
import {
	categoryGameLabel,
	categoryLabelsFromMonth,
	isDefaultCategoryLabels,
} from "~/utils/categoryLabels";
import { findNominationById } from "~/utils/nominations";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/nominate";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Nominate a Game | ${SITE_NAME}`,
		description: "Put a game forward for this month's theme.",
		path: "/nominate",
		noIndex: true,
	});

const pulse = stylex.keyframes({ "50%": { opacity: 0.5 } });

const styles = stylex.create({
	page: {
		marginInline: "auto",
		maxWidth: "80rem",
		paddingBlock: 24,
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	pageHeading: {
		fontSize: "1.875rem",
		fontWeight: 700,
		lineHeight: 1.2,
		marginBottom: 32,
	},
	section: {
		marginBottom: 32,
	},
	sectionHeading: {
		fontSize: "1.25rem",
		fontWeight: 600,
		lineHeight: 1.4,
		marginBottom: 16,
	},
	pairGrid: {
		display: "grid",
		gap: 24,
		gridTemplateColumns: { default: null, [media.sm]: "repeat(2, minmax(0, 1fr))" },
	},
	cardList: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	banner: {
		borderRadius: radius.lg,
		marginBottom: 16,
		padding: 16,
	},
	errorBanner: {
		backgroundColor: "oklch(93.6% 0.032 17.717)",
		color: "oklch(50.5% 0.213 27.518)",
	},
	successBanner: {
		backgroundColor: "oklch(96.2% 0.044 156.743)",
		color: "oklch(52.7% 0.154 150.069)",
	},
	statusBlock: {
		marginBottom: 16,
	},
	statusHeading: {
		color: color.body,
		fontSize: "1.125rem",
		fontWeight: 500,
		lineHeight: 1.5556,
	},
	statusList: {
		color: color.muted,
		display: "flex",
		flexDirection: "column",
		fontSize: "0.875rem",
		gap: 4,
		lineHeight: 1.4286,
		marginTop: 8,
	},
	statusItem: {
		alignItems: "center",
		display: "flex",
	},
	statusDone: { color: "oklch(76.5% 0.177 163.223)" },
	statusOpen: { color: color.muted },
	limitNotice: {
		backgroundColor: "oklch(69.6% 0.17 162.48 / 0.1)",
		borderColor: "oklch(76.5% 0.177 163.223 / 0.2)",
		borderRadius: radius.lg,
		borderWidth: 1,
		color: "oklch(90.5% 0.093 164.15)",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		marginBottom: 24,
		paddingBlock: 12,
		paddingInline: 16,
	},
	searchForm: {
		marginBottom: 32,
	},
	searchRow: {
		display: "flex",
		gap: 16,
	},
	searchInput: {
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: { default: "rgba(255, 255, 255, 0.1)", ":focus": color.focus },
		boxShadow: { default: null, ":focus": "0 0 0 1px oklch(62.3% 0.214 259.815)" },
		color: color.body,
		flex: 1,
		"::placeholder": { color: color.muted },
	},
	srOnly: {
		borderWidth: 0,
		clipPath: "inset(50%)",
		height: 1,
		margin: -1,
		overflow: "hidden",
		padding: 0,
		position: "absolute",
		whiteSpace: "nowrap",
		width: 1,
	},
	searchButton: {
		alignItems: "center",
		backgroundColor: { default: "transparent", ":hover": "oklch(69.6% 0.17 162.48 / 0.1)" },
		borderColor: {
			default: "oklch(76.5% 0.177 163.223 / 0.2)",
			":hover": "oklch(76.5% 0.177 163.223 / 0.3)",
		},
		borderRadius: radius.lg,
		borderWidth: 1,
		color: "oklch(90.5% 0.093 164.15)",
		display: "inline-flex",
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 8,
		justifyContent: "center",
		lineHeight: 1.4286,
		paddingBlock: 8,
		paddingInline: 16,
		transitionDuration: "0.3s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
	},
	searchButtonOff: {
		backgroundColor: "transparent",
		borderColor: "oklch(95% 0.052 163.051 / 0.2)",
		color: "oklch(97.9% 0.021 166.113)",
		cursor: "not-allowed",
		opacity: 0.5,
	},
	resultGrid: {
		display: "grid",
		gap: 24,
		gridTemplateColumns: { default: null, [media.sm]: "repeat(2, minmax(0, 1fr))" },
	},
	emptyPanel: {
		backdropFilter: "blur(8px)",
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.lg,
		borderWidth: 1,
		paddingBlock: 48,
		textAlign: "center",
	},
	emptyHeading: {
		color: color.body,
		fontSize: "1.125rem",
		fontWeight: 600,
		lineHeight: 1.5556,
	},
	emptyBody: {
		color: color.muted,
		marginTop: 8,
	},
	emphasis: {
		color: "oklch(90.5% 0.093 164.15)",
	},
	closedPage: {
		marginInline: "auto",
		maxWidth: "42rem",
		paddingBlock: { default: 64, [media.sm]: 96 },
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
		textAlign: "center",
	},
	closedHeading: {
		color: color.body,
		fontSize: "1.875rem",
		fontWeight: 700,
		letterSpacing: "-0.025em",
		lineHeight: 1.2,
		marginBottom: 16,
	},
	closedPanel: {
		backdropFilter: "blur(8px)",
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.lg,
		borderWidth: 1,
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		padding: 32,
	},
	closedBody: {
		color: color.body,
		fontSize: "1.125rem",
		lineHeight: 1.5556,
		marginBottom: 24,
	},
	closedAside: {
		color: color.muted,
	},
	closedLink: {
		backgroundColor: { default: color.action, ":hover": color.actionHover },
		borderRadius: radius.lg,
		color: color.white,
		display: "inline-block",
		paddingBlock: 12,
		paddingInline: 24,
		transitionDuration: motion.duration,
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
	pitchCard: {
		backdropFilter: "blur(8px)",
		backgroundColor: {
			default: "oklch(21% 0.006 285.885 / 0.5)",
			[media.backdropFilter]: "oklch(21% 0.006 285.885 / 0.2)",
		},
		borderColor: "oklch(27.4% 0.006 286.033 / 0.5)",
		borderRadius: radius.xl,
		borderWidth: 1,
		display: "flex",
		position: "relative",
		transitionDuration: "0.2s",
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
	pitchCover: {
		borderEndStartRadius: radius.xl,
		borderStartStartRadius: radius.xl,
		flexShrink: 0,
		overflow: "hidden",
		position: "relative",
		width: { default: "6.5rem", [media.sm]: "7.5rem" },
	},
	pitchCoverBlank: {
		backgroundColor: "oklch(27.4% 0.006 286.033 / 0.6)",
	},
	coverImage: {
		height: "100%",
		objectFit: "cover",
		width: "100%",
	},
	pitchBody: {
		display: "flex",
		flex: 1,
		flexDirection: "column",
		gap: 12,
		minWidth: 0,
		overflow: "hidden",
		padding: { default: 16, [media.sm]: 20 },
	},
	pitchHead: {
		alignItems: "flex-start",
		display: "flex",
		gap: 16,
		justifyContent: "space-between",
	},
	pitchIdentity: {
		minWidth: 0,
	},
	fill: {
		flex: 1,
	},
	pitchTitle: {
		color: color.heading,
		fontSize: "1rem",
		fontWeight: 600,
		lineHeight: 1.5,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	pitchYear: {
		color: color.dim,
		fontSize: "0.75rem",
		fontWeight: 500,
		lineHeight: 1.3333,
		marginTop: 4,
	},
	pitchQuote: {
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: 4,
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: "rgba(255, 255, 255, 0.05)",
		borderRadius: radius.lg,
		borderWidth: 1,
		color: color.body,
		display: "-webkit-box",
		fontSize: "0.875rem",
		lineHeight: 1.625,
		overflow: "hidden",
		padding: 12,
		whiteSpace: "pre-line",
	},
	pitchActions: {
		display: "flex",
		flexWrap: "wrap",
		gap: 8,
		justifyContent: "flex-end",
	},
	quietAction: {
		alignItems: "center",
		borderRadius: radius.lg,
		borderWidth: 1,
		display: "inline-flex",
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 8,
		justifyContent: "center",
		lineHeight: 1.4286,
		paddingBlock: 8,
		paddingInline: 12,
		transitionDuration: "0.3s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
	},
	informTone: {
		backgroundColor: { default: null, ":hover": "oklch(62.3% 0.214 259.815 / 0.1)" },
		borderColor: {
			default: "oklch(70.7% 0.165 254.624 / 0.2)",
			":hover": "oklch(70.7% 0.165 254.624 / 0.3)",
		},
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(62.3% 0.214 259.815 / 0.2), 0 1px 2px -1px oklch(62.3% 0.214 259.815 / 0.2)",
			":hover":
				"0 1px 3px 0 oklch(62.3% 0.214 259.815 / 0.4), 0 1px 2px -1px oklch(62.3% 0.214 259.815 / 0.4)",
		},
		color: color.focus,
	},
	affirmTone: {
		backgroundColor: { default: null, ":hover": "oklch(69.6% 0.17 162.48 / 0.1)" },
		borderColor: {
			default: "oklch(76.5% 0.177 163.223 / 0.2)",
			":hover": "oklch(76.5% 0.177 163.223 / 0.3)",
		},
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(69.6% 0.17 162.48 / 0.2), 0 1px 2px -1px oklch(69.6% 0.17 162.48 / 0.2)",
			":hover":
				"0 1px 3px 0 oklch(69.6% 0.17 162.48 / 0.4), 0 1px 2px -1px oklch(69.6% 0.17 162.48 / 0.4)",
		},
		color: color.affirm,
	},
	denyTone: {
		backgroundColor: { default: null, ":hover": "oklch(63.7% 0.237 25.331 / 0.1)" },
		borderColor: {
			default: "oklch(70.4% 0.191 22.216 / 0.2)",
			":hover": "oklch(70.4% 0.191 22.216 / 0.3)",
		},
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(63.7% 0.237 25.331 / 0.2), 0 1px 2px -1px oklch(63.7% 0.237 25.331 / 0.2)",
			":hover":
				"0 1px 3px 0 oklch(63.7% 0.237 25.331 / 0.4), 0 1px 2px -1px oklch(63.7% 0.237 25.331 / 0.4)",
		},
		color: color.deny,
	},
	neutralTone: {
		backgroundColor: { default: "transparent", ":hover": "rgba(255, 255, 255, 0.05)" },
		borderColor: {
			default: "rgba(255, 255, 255, 0.1)",
			":hover": "rgba(255, 255, 255, 0.2)",
		},
		color: color.body,
	},
	shrink: {
		flexShrink: 0,
	},
	wideAction: {
		width: { default: "100%", [media.sm]: "auto" },
	},
	skeleton: {
		backdropFilter: "blur(8px)",
		backgroundColor: {
			default: "oklch(21% 0.006 285.885 / 0.5)",
			[media.backdropFilter]: "oklch(21% 0.006 285.885 / 0.2)",
		},
		borderColor: "oklch(27.4% 0.006 286.033 / 0.5)",
		borderRadius: radius.xl,
		borderWidth: 1,
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		display: "flex",
		height: 208,
		minWidth: 0,
		position: "relative",
	},
	skeletonCover: {
		borderEndStartRadius: radius.xl,
		borderStartStartRadius: radius.xl,
		flexShrink: 0,
		overflow: "hidden",
		position: "relative",
		width: 156,
	},
	shimmer: {
		animationDuration: "2s",
		animationIterationCount: "infinite",
		animationName: { default: pulse, [media.reducedMotion]: "none" },
		animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
		backgroundColor: color.surface,
	},
	skeletonFill: {
		inset: 0,
		position: "absolute",
	},
	skeletonBody: {
		display: "flex",
		flex: 1,
		flexDirection: "column",
		gap: 12,
		minWidth: 0,
		overflow: "hidden",
		padding: 16,
	},
	skeletonLines: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		minWidth: 0,
	},
	skeletonRow: {
		alignItems: "flex-start",
		display: "flex",
		gap: 8,
		justifyContent: "space-between",
	},
	skeletonTitle: {
		borderRadius: radius.base,
		height: 20,
		width: "75%",
	},
	skeletonYear: {
		borderRadius: radius.base,
		flexShrink: 0,
		height: 16,
		width: 48,
	},
	skeletonFooter: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginTop: "auto",
		minWidth: 0,
	},
	skeletonButton: {
		borderRadius: radius.base,
		height: 36,
		width: "100%",
	},
	dialog: {
		backgroundColor: color.canvas,
		borderColor: "rgba(255, 255, 255, 0.1)",
		width: { default: "100%", [media.sm]: "32rem" },
	},
	confirmDialog: {
		backgroundColor: color.canvas,
		borderColor: "rgba(255, 255, 255, 0.1)",
		maxWidth: { default: "24rem", [media.sm]: "32rem" },
		width: "100%",
	},
	dialogTitle: {
		color: color.body,
	},
	gamePreview: {
		display: "flex",
		gap: 16,
		marginBottom: 24,
	},
	previewCover: {
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.lg,
		borderWidth: 1,
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		width: 128,
	},
	previewSummary: {
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: 12,
		color: color.muted,
		display: "-webkit-box",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		overflow: "hidden",
	},
	field: {
		marginBottom: 24,
	},
	fieldLabel: {
		color: color.muted,
	},
	fieldInput: {
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: { default: "rgba(255, 255, 255, 0.1)", ":focus": color.focus },
		boxShadow: { default: null, ":focus": "0 0 0 1px oklch(62.3% 0.214 259.815)" },
		color: color.body,
		marginTop: 8,
		"::placeholder": { color: color.muted },
	},
	lengthGrid: {
		display: "grid",
		gap: 16,
		gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		width: "100%",
	},
	lengthButton: {
		alignItems: "center",
		borderRadius: radius.lg,
		borderWidth: 1,
		display: "inline-flex",
		flexDirection: "column",
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 4,
		justifyContent: "center",
		lineHeight: 1.4286,
		paddingBlock: 16,
		paddingInline: 16,
		transitionDuration: "0.3s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		width: "100%",
	},
	lengthAvailable: {
		backgroundColor: { default: "transparent", ":hover": "oklch(69.6% 0.17 162.48 / 0.1)" },
		borderColor: {
			default: "oklch(76.5% 0.177 163.223 / 0.2)",
			":hover": "oklch(76.5% 0.177 163.223 / 0.3)",
		},
		color: color.affirm,
	},
	lengthTaken: {
		backgroundColor: "transparent",
		borderColor: "oklch(70.5% 0.015 286.067 / 0.2)",
		color: color.muted,
		cursor: "not-allowed",
		opacity: 0.5,
	},
	lengthHint: {
		fontSize: "0.75rem",
		lineHeight: 1.3333,
		opacity: 0.8,
	},
	lengthNote: {
		fontSize: "0.75rem",
		lineHeight: 1.3333,
	},
	editFooter: {
		alignItems: { default: null, [media.sm]: "center" },
		display: "flex",
		flexDirection: { default: "column-reverse", [media.sm]: "row" },
		gap: 8,
		justifyContent: { default: null, [media.sm]: "space-between" },
	},
	footerActions: {
		display: "flex",
		gap: 8,
		justifyContent: "flex-end",
		width: { default: "100%", [media.sm]: "auto" },
	},
	quietButton: {
		backgroundColor: { default: color.surface, ":hover": color.surfaceRaised },
		borderColor: "rgba(255, 255, 255, 0.1)",
		color: { default: color.body, ":hover": color.body },
	},
	primaryButton: {
		backgroundColor: { default: color.action, ":hover": color.actionHover },
		color: color.white,
	},
	destructiveButton: {
		backgroundColor: {
			default: "oklch(57.7% 0.245 27.325)",
			":hover": "oklch(50.5% 0.213 27.518)",
		},
		color: color.white,
	},
	confirmText: {
		color: color.muted,
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		marginBottom: 24,
	},
});

interface NominationResponse {
	error?: string;
	success?: boolean;
	nominationId?: number;
}

interface SearchResultCardProps {
	game: Nomination;
	existingNomination?: Nomination;
	isCurrentUserNomination: boolean;
	isPreviousWinner: boolean;
	buttonText: string;
	buttonDisabled: boolean;
	canNominateMore: boolean;
	onNominateGame: (game: Nomination) => void;
	onOpenNominationModal: (nomination: Nomination) => void;
}

function SearchResultCard({
	game,
	existingNomination,
	isCurrentUserNomination,
	isPreviousWinner,
	buttonText,
	buttonDisabled,
	canNominateMore,
	onNominateGame,
	onOpenNominationModal,
}: SearchResultCardProps) {
	const disableNominationAction = buttonDisabled || (!existingNomination && !canNominateMore);

	const handleNominateClick = () => {
		if (isPreviousWinner || disableNominationAction) {
			return;
		}

		if (existingNomination) {
			onOpenNominationModal(existingNomination);
			return;
		}

		onNominateGame(game);
	};

	return (
		<GameCard
			key={game.id}
			game={game}
			variant="search"
			onNominate={handleNominateClick}
			alreadyNominated={Boolean(existingNomination)}
			isCurrentUserNomination={isCurrentUserNomination}
			isPreviousWinner={isPreviousWinner}
			buttonText={buttonText}
			buttonDisabled={disableNominationAction}
		/>
	);
}

interface PitchCardProps {
	nomination: Nomination;
	pitch: Pitch;
	onEditPitch: (nomination: Nomination) => void;
	onDeletePitch: (nomination: Nomination) => void;
	onViewPitches: (nomination: Nomination) => void;
}

function PitchCard({
	nomination,
	pitch,
	onEditPitch,
	onDeletePitch,
	onViewPitches,
}: PitchCardProps) {
	const coverUrl = nomination.gameCover?.replace("t_thumb", "t_cover_big");
	const year = nomination.gameYear;

	return (
		<div {...stylex.props(styles.pitchCard)}>
			{coverUrl ? (
				<div {...stylex.props(styles.pitchCover)}>
					<img
						src={coverUrl}
						alt={nomination.gameName}
						loading="lazy"
						{...stylex.props(styles.coverImage)}
					/>
				</div>
			) : (
				<div {...stylex.props(styles.pitchCover, styles.pitchCoverBlank)} />
			)}

			<div {...stylex.props(styles.pitchBody)}>
				<div {...stylex.props(styles.pitchHead)}>
					<div {...stylex.props(styles.pitchIdentity)}>
						<h3 {...stylex.props(styles.pitchTitle)}>{nomination.gameName}</h3>
						{year && <p {...stylex.props(styles.pitchYear)}>{year}</p>}
					</div>
					<button
						type="button"
						onClick={() => onViewPitches(nomination)}
						{...stylex.props(styles.quietAction, styles.informTone, styles.shrink)}
					>
						View pitches
					</button>
				</div>

				<div {...stylex.props(styles.pitchQuote)}>{pitch.pitch}</div>

				<div {...stylex.props(styles.pitchActions)}>
					<button
						type="button"
						onClick={() => onEditPitch(nomination)}
						{...stylex.props(styles.quietAction, styles.affirmTone)}
					>
						Edit pitch
					</button>
					<button
						type="button"
						onClick={() => onDeletePitch(nomination)}
						{...stylex.props(styles.quietAction, styles.denyTone)}
					>
						Delete pitch
					</button>
				</div>
			</div>
		</div>
	);
}

export const middleware: Route.MiddlewareFunction[] = [requireAuthenticatedUser];

export async function loader({ context }: Route.LoaderArgs) {
	const { discordId } = context.get(authenticatedUserContext);
	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "nominating" ? monthRow.id : undefined;

	// Fetch all previous GOTM winners
	const result = await db.execute(
		`SELECT DISTINCT game_id 
        FROM winners;`,
	);
	const previousWinners = result.rows.map((w) => (w.game_id as number).toString());

	// Fetch user's nominations for the current month if in nominating phase
	let userNominations: Nomination[] = [];
	let allNominations: Nomination[] = [];
	if (monthId) {
		// Fetch all nominations for the month
		allNominations = await getNominationsForMonth(monthId);

		// Filter for user's nominations
		userNominations = allNominations.filter((n) => n.discordId === discordId);
	}

	return {
		games: [],
		monthId,
		monthStatus: monthRow.status,
		labels: categoryLabelsFromMonth(monthRow),
		userDiscordId: discordId,
		userNominations,
		allNominations,
		previousWinners,
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const { discordId } = context.get(authenticatedUserContext);
	const method = request.method.toUpperCase();
	const formData = await request.formData();
	const intent = (formData.get("intent") || "").toString();

	// Handle search (POST + intent=search) to keep existing UX
	if (method === "POST" && intent === "search") {
		const query = formData.get("query");
		if (typeof query !== "string" || !query.trim()) {
			return Response.json({ games: [] });
		}
		const games = await searchGames(query);
		return Response.json({ games });
	}

	// Reuse previous winners check
	const winners = await db.execute("SELECT DISTINCT game_id FROM winners");
	const previousWinners = new Set(winners.rows.map((w) => (w.game_id ?? "").toString()));

	if (method === "POST" && intent === "createNomination") {
		try {
			const monthId = formData.get("monthId")?.toString() ?? "";
			const short = formData.get("short") === "true";
			const pitch = formData.get("pitch")?.toString() || null;

			const gameIdStr = formData.get("gameId")?.toString();
			const gameName = formData.get("gameName")?.toString() || "";
			const gameCover = formData.get("gameCover")?.toString() || null;
			const gameYear = formData.get("gameYear")?.toString() || null;
			const gameUrl = formData.get("gameUrl")?.toString() || null;

			if (!monthId || !gameIdStr || !gameName) {
				return Response.json({ error: "Missing required fields" }, { status: 400 });
			}

			// Reject previous winners
			if (previousWinners.has(gameIdStr)) {
				return Response.json(
					{ error: "This game has already won GOTM in a previous month" },
					{ status: 400 },
				);
			}

			// Check if user already nominated/pitched this game for the month
			const existing = await db.execute({
				sql: "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.month_id = ? AND n.game_id = ? AND p.discord_id = ?",
				args: [monthId, gameIdStr, discordId],
			});

			if (existing.rows.length > 0) {
				return Response.json(
					{
						error: "You have already nominated or pitched this game for this month",
					},
					{ status: 400 },
				);
			}

			// Normalize cover size like before
			const normalizedCover = gameCover?.replace("t_thumb", "t_cover_big") || null;

			// Insert nomination
			const nomination = await db.execute({
				sql: "INSERT INTO nominations (month_id, game_id, discord_id, short, game_name, game_year, game_cover, game_url, jury_selected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())",
				args: [
					monthId,
					gameIdStr,
					discordId,
					short ? 1 : 0,
					gameName,
					gameYear || null,
					normalizedCover,
					gameUrl || null,
					0,
				],
			});

			if (pitch && nomination.lastInsertRowid) {
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nomination.lastInsertRowid, discordId, pitch],
				});
			}

			return Response.json({
				success: true,
				nominationId: nomination.lastInsertRowid ? Number(nomination.lastInsertRowid) : null,
			});
		} catch (error) {
			console.error("Error processing nomination:", error);
			return Response.json(
				{
					error: "Failed to process nomination. Please make sure all required fields are provided.",
				},
				{ status: 500 },
			);
		}
	}

	if (method === "PATCH") {
		try {
			const nominationIdStr = formData.get("nominationId")?.toString();
			const nominationId = nominationIdStr ? Number.parseInt(nominationIdStr, 10) : null;
			if (!nominationId || Number.isNaN(nominationId)) {
				return Response.json({ error: "Invalid nomination ID" }, { status: 400 });
			}

			// Fetch nomination and any existing pitch by this user
			const nomination = await db.execute({
				sql: `SELECT n.*, p.discord_id as pitch_discord_id
                      FROM nominations n
                      LEFT JOIN pitches p ON n.id = p.nomination_id AND p.discord_id = ?
                      WHERE n.id = ?`,
				args: [discordId, nominationId],
			});

			if (nomination.rows.length === 0) {
				return Response.json({ error: "Nomination not found" }, { status: 404 });
			}

			const gameId = nomination.rows[0].game_id?.toString() ?? "";
			if (previousWinners.has(gameId)) {
				return Response.json(
					{ error: "Cannot modify nominations for previous GOTM winners" },
					{ status: 400 },
				);
			}

			const hasExistingPitch = nomination.rows[0].pitch_discord_id === discordId;
			const patchIntent = intent || "savePitch";

			if (patchIntent === "deletePitch") {
				if (!hasExistingPitch) {
					return Response.json({ error: "No existing pitch to delete" }, { status: 400 });
				}

				await db.execute({
					sql: "DELETE FROM pitches WHERE nomination_id = ? AND discord_id = ?",
					args: [nominationId, discordId],
				});

				return Response.json({ success: true });
			}

			const pitchInput = formData.get("pitch");
			const pitch = typeof pitchInput === "string" ? pitchInput.trim() : "";
			if (!pitch) {
				return Response.json({ error: "Pitch cannot be empty" }, { status: 400 });
			}

			if (hasExistingPitch) {
				await db.execute({
					sql: "UPDATE pitches SET pitch = ?, updated_at = unixepoch() WHERE nomination_id = ? AND discord_id = ?",
					args: [pitch, nominationId, discordId],
				});
			} else {
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nominationId, discordId, pitch],
				});
			}

			return Response.json({ success: true });
		} catch (error) {
			console.error("Error processing edit:", error);
			return Response.json({ error: "Failed to process edit. Please try again." }, { status: 500 });
		}
	}

	if (method === "DELETE") {
		const nominationId = formData.get("nominationId")?.toString();
		if (!nominationId) {
			return Response.json({ error: "Missing nomination ID" }, { status: 400 });
		}

		// Verify ownership
		const nomination = await db.execute({
			sql: "SELECT id FROM nominations WHERE id = ? AND discord_id = ?",
			args: [nominationId, discordId],
		});

		if (nomination.rows.length === 0) {
			return Response.json({ error: "Nomination not found or unauthorized" }, { status: 404 });
		}

		await db.execute({
			sql: "DELETE FROM nominations WHERE id = ?",
			args: [nominationId],
		});

		return Response.json({ success: true });
	}

	return Response.json({ error: "Invalid action" }, { status: 400 });
}

const GameSkeleton = () => (
	<div {...stylex.props(styles.skeleton)}>
		<div {...stylex.props(styles.skeletonCover)}>
			<div {...stylex.props(styles.skeletonFill, styles.shimmer)} />
		</div>
		<div {...stylex.props(styles.skeletonBody)}>
			<div {...stylex.props(styles.skeletonLines)}>
				<div {...stylex.props(styles.skeletonRow)}>
					<div {...stylex.props(styles.skeletonTitle, styles.shimmer)} />
					<div {...stylex.props(styles.skeletonYear, styles.shimmer)} />
				</div>
			</div>
			<div {...stylex.props(styles.skeletonFooter)}>
				<div {...stylex.props(styles.skeletonButton, styles.shimmer)} />
			</div>
		</div>
	</div>
);

export default function Nominate({ loaderData }: Route.ComponentProps) {
	const {
		games: initialGames,
		monthId,
		monthStatus,
		labels,
		userNominations,
		allNominations,
		userDiscordId,
		previousWinners,
	} = loaderData;
	const search = useFetcher<{ games: Nomination[] }>();
	const games = search.data?.games || initialGames;
	const [searchTerm, setSearchTerm] = useState("");
	const nominate = useFetcher<NominationResponse>();

	// Generate unique IDs for form elements
	const pitchId = useId();
	const editPitchId = useId();
	const searchInputId = useId();

	// New state for modal
	const [isOpen, setIsOpen] = useState(false);
	const [selectedGame, setSelectedGame] = useState<Nomination | null>(null);
	const [pitch, setPitch] = useState("");

	// State for edit modal
	const [editingNominationId, setEditingNominationId] = useState<number | null>(null);
	const [editPitch, setEditPitch] = useState("");
	const editingNomination = findNominationById(
		editingNominationId,
		allNominations,
		userNominations,
	);

	// Delete confirmation modal state
	const [deletingNominationId, setDeletingNominationId] = useState<number | null>(null);
	const [pitchToDeleteId, setPitchToDeleteId] = useState<number | null>(null);
	const deletingNomination = findNominationById(
		deletingNominationId,
		allNominations,
		userNominations,
	);
	const pitchToDelete = findNominationById(pitchToDeleteId, allNominations, userNominations);

	// Track short and long nominations
	const shortNomination = userNominations.find((n) => n.short);
	const longNomination = userNominations.find((n) => !n.short);
	const hasReachedNominationLimit = shortNomination && longNomination;

	const nominationsWithUserPitches = allNominations.filter((nomination) =>
		nomination.pitches.some((pitchEntry) => pitchEntry.discordId === userDiscordId),
	);
	const userPitchNominations = nominationsWithUserPitches.filter(
		(nomination) => nomination.discordId !== userDiscordId,
	);

	const shouldUseLocalSearch = Boolean(hasReachedNominationLimit);
	const normalizedSearchTerm = searchTerm.trim().toLowerCase();
	const filteredLocalNominations = shouldUseLocalSearch
		? allNominations.filter((nomination) =>
				nomination.gameName.toLowerCase().includes(normalizedSearchTerm),
			)
		: [];
	const displayedGames = shouldUseLocalSearch ? filteredLocalNominations : games;
	const filteredDisplayedGames = displayedGames.filter((game) => {
		const rawGameId = game.gameId ?? game.id;
		const igdbId = rawGameId ? String(rawGameId) : "";
		const existingNomination = shouldUseLocalSearch
			? game
			: allNominations.find((nomination) => nomination.gameId === igdbId);
		if (!existingNomination) {
			return true;
		}

		const hasUserPitch = existingNomination.pitches.some(
			(pitchEntry) => pitchEntry.discordId === userDiscordId,
		);
		return !hasUserPitch;
	});
	const isSearching = shouldUseLocalSearch
		? false
		: search.state === "submitting" || search.state === "loading";
	const showDurationHints = isDefaultCategoryLabels(labels);
	const hasSearched = shouldUseLocalSearch
		? normalizedSearchTerm.length > 0
		: search.data !== undefined;
	const searchPlaceholder = shouldUseLocalSearch
		? "Search existing nominations…"
		: "Search for games…";
	const searchButtonLabel = shouldUseLocalSearch ? "Filter" : isSearching ? "Searching…" : "Search";
	const isSearchDisabled = !shouldUseLocalSearch && (isSearching || !searchTerm.trim());

	const [selectedNominationId, setSelectedNominationId] = useState<number | null>(null);
	const selectedNomination = findNominationById(
		selectedNominationId,
		allNominations,
		userNominations,
	);
	const editingPitchEntry = editingNomination?.pitches.find(
		(pitchEntry) => pitchEntry.discordId === userDiscordId,
	);
	const hasExistingEditingPitch = Boolean(editingPitchEntry);
	const isSaveDisabled = editPitch.trim().length === 0;
	const isEditOpen = editingNomination !== null;
	const isDeleteOpen = deletingNomination !== null;
	const isDeletePitchOpen = pitchToDelete !== null;

	const handleSearch = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (shouldUseLocalSearch) {
			return;
		}
		if (!searchTerm.trim()) return;
		void search.submit({ intent: "search", query: searchTerm }, { method: "post" });
	};

	const handleGameSelect = (game: Nomination, existingNomination?: Nomination) => {
		if (hasReachedNominationLimit && !existingNomination) {
			return;
		}

		if (existingNomination) {
			openNominationModal(existingNomination);
			return;
		}

		setSelectedGame(game);
		setIsOpen(true);
	};

	const handleEdit = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (!fullNomination) {
			return;
		}

		openNominationModal(fullNomination);
	};

	const handleDelete = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (!fullNomination) {
			return;
		}

		setDeletingNominationId(fullNomination.id);
	};

	const handlePitchEdit = (nomination: Nomination) => {
		openNominationModal(nomination);
	};

	const openDeletePitchDialog = (nomination: Nomination) => {
		setPitchToDeleteId(nomination.id);
	};

	const handleEditSubmit = () => {
		if (!editingNomination || isSaveDisabled) {
			return;
		}

		void nominate.submit(
			{
				intent: "savePitch",
				nominationId: editingNomination.id.toString(),
				pitch: editPitch.trim(),
			},
			{ method: "PATCH" },
		);

		setEditingNominationId(null);
		setEditPitch("");
	};

	const handleDeleteConfirm = () => {
		if (!deletingNomination) {
			return;
		}

		void nominate.submit(
			{
				nominationId: deletingNomination.id.toString(),
			},
			{ method: "DELETE" },
		);

		setDeletingNominationId(null);
	};

	const handleGameLength = (isShort: boolean) => {
		if (!selectedGame) {
			return;
		}

		void nominate.submit(
			{
				intent: "createNomination",
				monthId: monthId?.toString() ?? "",
				short: String(isShort),
				pitch: pitch.trim() || "",
				gameId: String(selectedGame.gameId),
				gameName: selectedGame.gameName,
				gameCover: selectedGame.gameCover || "",
				gameYear: selectedGame.gameYear || "",
				gameUrl: selectedGame.gameUrl || "",
			},
			{ method: "POST" },
		);

		setIsOpen(false);
		setSelectedGame(null);
		setPitch("");
	};

	const selectShortGame = () => {
		handleGameLength(true);
	};

	const selectLongGame = () => {
		handleGameLength(false);
	};

	const handleEditPitchChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setEditPitch(event.target.value);
	};

	const handleEditDialogOpenChange = (open: boolean) => {
		if (!open) {
			setEditingNominationId(null);
			setEditPitch("");
		}
	};

	const handleDeleteDialogOpenChange = (open: boolean) => {
		if (!open) {
			setDeletingNominationId(null);
		}
	};

	const closeEditModal = () => {
		setEditingNominationId(null);
		setEditPitch("");
	};

	const closeDeleteModal = () => {
		setDeletingNominationId(null);
	};

	const handleDeletePitchDialogOpenChange = (open: boolean) => {
		if (!open) {
			setPitchToDeleteId(null);
		}
	};

	const handleDeletePitchConfirm = () => {
		if (!pitchToDelete) {
			return;
		}

		void nominate.submit(
			{
				intent: "deletePitch",
				nominationId: pitchToDelete.id.toString(),
			},
			{ method: "PATCH" },
		);

		setPitchToDeleteId(null);
		setEditingNominationId(null);
		setEditPitch("");
	};

	const closePitchesModal = () => {
		setSelectedNominationId(null);
	};

	const handleViewPitches = (nomination: Nomination) => {
		setSelectedNominationId(nomination.id);
	};

	const openNominationModal = (nomination: Nomination) => {
		setEditingNominationId(nomination.id);
		setEditPitch(nomination.pitches.find((p) => p.discordId === userDiscordId)?.pitch || "");
	};

	const handleSearchTermChange = (event: ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(event.target.value);
	};

	const handleNominationDialogOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setPitch("");
			setSelectedGame(null);
		}
	};

	const handlePitchChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setPitch(event.target.value);
	};

	if (!monthId || monthStatus !== "nominating") {
		return (
			<div {...stylex.props(styles.closedPage)}>
				<h1 {...stylex.props(styles.closedHeading)}>
					Nominations {monthStatus === "over" ? "haven't started" : "are closed"}
				</h1>

				<div {...stylex.props(styles.closedPanel)}>
					{monthStatus === "ready" && (
						<>
							<p {...stylex.props(styles.closedBody)}>
								The month is being set up. Check back soon for nominations!
							</p>
							<Link to="/history" prefetch="viewport" {...stylex.props(styles.closedLink)}>
								Browse Past Months →
							</Link>
						</>
					)}
					{monthStatus === "voting" && (
						<>
							<p {...stylex.props(styles.closedBody)}>
								The nomination phase is over, but you can now vote for your favorite games!
							</p>
							<Link to="/voting" prefetch="viewport" {...stylex.props(styles.closedLink)}>
								Go Vote Now →
							</Link>
						</>
					)}

					{monthStatus === "playing" && (
						<>
							<p {...stylex.props(styles.closedBody)}>
								Games have been selected! Check out what we&#39;re playing this month.
							</p>
							<Link to="/" prefetch="viewport" {...stylex.props(styles.closedLink)}>
								See This Month&#39;s Games →
							</Link>
						</>
					)}

					{monthStatus === "jury" && (
						<>
							<p {...stylex.props(styles.closedBody)}>
								The jury is currently selecting games from the nominations. Check back soon!
							</p>
							<p {...stylex.props(styles.closedAside)}>
								Once they&#39;re done, you&#39;ll be able to vote on the selected games.
							</p>
						</>
					)}

					{monthStatus === "over" && (
						<>
							<p {...stylex.props(styles.closedBody)}>
								The next month&#39;s nominations haven&#39;t started yet. Check back soon!
							</p>
							<Link to="/history" prefetch="viewport" {...stylex.props(styles.closedLink)}>
								Browse Past Months →
							</Link>
						</>
					)}
				</div>
			</div>
		);
	}

	return (
		<div {...stylex.props(styles.page)}>
			<h1 {...stylex.props(styles.pageHeading)}>Nominate Games</h1>

			{/* User's nominations */}
			{userNominations.length > 0 && (
				<div {...stylex.props(styles.section)}>
					<h2 {...stylex.props(styles.sectionHeading)}>Your Nominations</h2>
					<div {...stylex.props(styles.pairGrid)}>
						{userNominations.map((nomination) => (
							<GameCard
								game={nomination}
								key={nomination.id}
								variant="nomination"
								onEdit={handleEdit}
								onDelete={handleDelete}
								onViewPitches={() => handleViewPitches(nomination)}
								pitchCount={nomination.pitches.length}
								showVotingButtons={false}
							/>
						))}
					</div>
				</div>
			)}

			{userPitchNominations.length > 0 && (
				<div {...stylex.props(styles.section)}>
					<h2 {...stylex.props(styles.sectionHeading)}>Your Pitches</h2>
					<div {...stylex.props(styles.cardList)}>
						{userPitchNominations.map((nomination) => {
							const currentPitch = nomination.pitches.find(
								(pitchEntry) => pitchEntry.discordId === userDiscordId,
							);
							if (!currentPitch) {
								return null;
							}

							return (
								<PitchCard
									key={nomination.id}
									nomination={nomination}
									pitch={currentPitch}
									onEditPitch={handlePitchEdit}
									onDeletePitch={openDeletePitchDialog}
									onViewPitches={handleViewPitches}
								/>
							);
						})}
					</div>
				</div>
			)}

			{nominate.data?.error && (
				<div {...stylex.props(styles.banner, styles.errorBanner)}>{nominate.data.error}</div>
			)}

			{nominate.data?.success && (
				<div {...stylex.props(styles.banner, styles.successBanner)}>
					Game nominated successfully!
				</div>
			)}

			<div>
				<div {...stylex.props(styles.statusBlock)}>
					<h3 {...stylex.props(styles.statusHeading)}>Nomination Status:</h3>
					<ul {...stylex.props(styles.statusList)}>
						<li {...stylex.props(styles.statusItem)}>
							<span {...stylex.props(shortNomination ? styles.statusDone : styles.statusOpen)}>
								{shortNomination ? "✓" : "○"} {categoryGameLabel(labels.short)} (
								{shortNomination ? "Nominated" : "Available"})
							</span>
						</li>
						<li {...stylex.props(styles.statusItem)}>
							<span {...stylex.props(longNomination ? styles.statusDone : styles.statusOpen)}>
								{longNomination ? "✓" : "○"} {categoryGameLabel(labels.long)} (
								{longNomination ? "Nominated" : "Available"})
							</span>
						</li>
					</ul>
				</div>

				{hasReachedNominationLimit && (
					<div {...stylex.props(styles.limitNotice)}>
						You have nominated a {labels.short} game and a {labels.long} game. You can still add
						pitches to existing nominations using the search below.
					</div>
				)}

				<search.Form method="post" onSubmit={handleSearch} {...stylex.props(styles.searchForm)}>
					<div {...stylex.props(styles.searchRow)}>
						<Label htmlFor={searchInputId} style={styles.srOnly}>
							Search games
						</Label>
						<Input
							type="search"
							id={searchInputId}
							name="query"
							autoComplete="off"
							value={searchTerm}
							onChange={handleSearchTermChange}
							placeholder={searchPlaceholder}
							style={styles.searchInput}
						/>
						<input type="hidden" name="intent" value="search" />
						<button
							type="submit"
							disabled={isSearchDisabled}
							{...stylex.props(styles.searchButton, isSearchDisabled && styles.searchButtonOff)}
						>
							{searchButtonLabel}
						</button>
					</div>
				</search.Form>
				{isSearching ? (
					<div {...stylex.props(styles.resultGrid)}>
						{Array.from({ length: 10 }).map((_, i) => (
							<GameSkeleton key={`skeleton-${i}`} />
						))}
					</div>
				) : filteredDisplayedGames.length > 0 ? (
					<div {...stylex.props(styles.resultGrid)}>
						{filteredDisplayedGames.map((game: Nomination) => {
							const rawGameId = game.gameId ?? game.id;
							const igdbId = rawGameId ? String(rawGameId) : "";
							const existingNomination = shouldUseLocalSearch
								? game
								: allNominations.find((n) => n.gameId === igdbId);
							const isCurrentUserNomination = existingNomination?.discordId === userDiscordId;
							const isPreviousWinner = igdbId !== "" && previousWinners.includes(igdbId);
							const canNominateMore = !hasReachedNominationLimit;
							const blockNewNomination = !existingNomination && !canNominateMore;

							let buttonText = "Nominate";
							if (isPreviousWinner) {
								buttonText = "Previous GOTM";
							} else if (isCurrentUserNomination) {
								buttonText = "Edit Pitch";
							} else if (existingNomination) {
								buttonText = "Add Pitch";
							} else if (blockNewNomination) {
								buttonText = "Nomination limit reached";
							}
							const disableButton = isPreviousWinner || blockNewNomination;

							return (
								<SearchResultCard
									key={game.id}
									game={game}
									existingNomination={existingNomination}
									isCurrentUserNomination={isCurrentUserNomination}
									isPreviousWinner={isPreviousWinner}
									buttonText={buttonText}
									buttonDisabled={disableButton}
									canNominateMore={canNominateMore}
									onNominateGame={handleGameSelect}
									onOpenNominationModal={openNominationModal}
								/>
							);
						})}
					</div>
				) : shouldUseLocalSearch ? (
					allNominations.length === 0 ? (
						<div {...stylex.props(styles.emptyPanel)}>
							<h3 {...stylex.props(styles.emptyHeading)}>No nominations yet</h3>
							<p {...stylex.props(styles.emptyBody)}>
								Once nominations start rolling in, you can add pitches to them here.
							</p>
						</div>
					) : (
						<div {...stylex.props(styles.emptyPanel)}>
							<h3 {...stylex.props(styles.emptyHeading)}>
								{normalizedSearchTerm.length > 0 ? (
									<>
										No nominations match{" "}
										<span {...stylex.props(styles.emphasis)}>&quot;{searchTerm}&quot;</span>
									</>
								) : (
									"You're all caught up"
								)}
							</h3>
							<p {...stylex.props(styles.emptyBody)}>
								{normalizedSearchTerm.length > 0
									? "Try a different name or browse the full list to find a game to pitch."
									: "You've already added pitches to every nomination currently available."}
							</p>
						</div>
					)
				) : hasSearched ? (
					<div {...stylex.props(styles.emptyPanel)}>
						<h3 {...stylex.props(styles.emptyHeading)}>No results found</h3>
						<p {...stylex.props(styles.emptyBody)}>
							No games found matching &quot;{searchTerm}&quot;. Try a different search term.
						</p>
					</div>
				) : (
					<div {...stylex.props(styles.emptyPanel)}>
						<h3 {...stylex.props(styles.emptyHeading)}>Search for games to nominate</h3>
						<p {...stylex.props(styles.emptyBody)}>
							Type in the search box above to find games. You can nominate one {labels.short} game
							and one {labels.long} game.
						</p>
					</div>
				)}
			</div>

			{/* Game Length Selection Modal */}
			<Dialog open={isOpen} onOpenChange={handleNominationDialogOpenChange}>
				<DialogContent style={styles.dialog}>
					<DialogHeader>
						<DialogTitle style={styles.dialogTitle}>
							Nominate {selectedGame?.gameName} ({selectedGame?.gameYear})
						</DialogTitle>
					</DialogHeader>

					{/* Game Cover and Summary */}
					<div {...stylex.props(styles.gamePreview)}>
						{selectedGame?.gameCover && (
							<div {...stylex.props(styles.shrink)}>
								<img
									src={selectedGame.gameCover.replace("/t_thumb/", "/t_cover_big/")}
									alt={selectedGame.gameName}
									{...stylex.props(styles.previewCover)}
								/>
							</div>
						)}
						{selectedGame?.summary && (
							<div {...stylex.props(styles.fill)}>
								<p {...stylex.props(styles.previewSummary)}>{selectedGame.summary}</p>
							</div>
						)}
					</div>

					{/* Pitch Input */}
					<div {...stylex.props(styles.field)}>
						<Label htmlFor={pitchId} style={styles.fieldLabel}>
							Pitch (Optional)
						</Label>
						<Textarea
							id={pitchId}
							name="pitch"
							autoComplete="off"
							rows={3}
							style={styles.fieldInput}
							value={pitch}
							onChange={handlePitchChange}
						/>
					</div>

					<DialogFooter>
						<div {...stylex.props(styles.lengthGrid)}>
							<button
								type="button"
								onClick={selectShortGame}
								disabled={Boolean(shortNomination)}
								{...stylex.props(
									styles.lengthButton,
									shortNomination ? styles.lengthTaken : styles.lengthAvailable,
								)}
							>
								<span>{categoryGameLabel(labels.short)}</span>
								{showDurationHints && (
									<span {...stylex.props(styles.lengthHint)}>(&lt; 12 hours)</span>
								)}
								{shortNomination && (
									<span {...stylex.props(styles.lengthNote)}>Already nominated</span>
								)}
							</button>
							<button
								type="button"
								onClick={selectLongGame}
								disabled={Boolean(longNomination)}
								{...stylex.props(
									styles.lengthButton,
									longNomination ? styles.lengthTaken : styles.lengthAvailable,
								)}
							>
								<span>{categoryGameLabel(labels.long)}</span>
								{showDurationHints && (
									<span {...stylex.props(styles.lengthHint)}>(&gt; 12 hours)</span>
								)}
								{longNomination && (
									<span {...stylex.props(styles.lengthNote)}>Already nominated</span>
								)}
							</button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Modal */}
			<Dialog open={isEditOpen} onOpenChange={handleEditDialogOpenChange}>
				<DialogContent style={styles.dialog}>
					<DialogHeader>
						<DialogTitle style={styles.dialogTitle}>
							{hasExistingEditingPitch ? "Edit" : "Add"} Pitch: {editingNomination?.gameName}
						</DialogTitle>
					</DialogHeader>

					<div {...stylex.props(styles.field)}>
						<Label htmlFor={editPitchId} style={styles.fieldLabel}>
							Pitch
						</Label>
						<Textarea
							id={editPitchId}
							name="pitch"
							autoComplete="off"
							rows={3}
							style={styles.fieldInput}
							value={editPitch}
							onChange={handleEditPitchChange}
							placeholder="Why is this game worth playing? What makes it a good fit for the month's theme?"
						/>
					</div>

					<DialogFooter style={styles.editFooter}>
						{hasExistingEditingPitch && editingNomination && (
							<button
								type="button"
								onClick={() => openDeletePitchDialog(editingNomination)}
								{...stylex.props(styles.quietAction, styles.denyTone, styles.wideAction)}
							>
								Delete pitch
							</button>
						)}
						<div {...stylex.props(styles.footerActions)}>
							<Button
								type="button"
								onClick={closeEditModal}
								variant="outline"
								style={styles.quietButton}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={handleEditSubmit}
								style={styles.primaryButton}
								disabled={isSaveDisabled}
							>
								{hasExistingEditingPitch ? "Save Changes" : "Add Pitch"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isDeletePitchOpen} onOpenChange={handleDeletePitchDialogOpenChange}>
				<DialogContent style={styles.confirmDialog}>
					<DialogHeader>
						<DialogTitle style={styles.dialogTitle}>Delete Pitch</DialogTitle>
					</DialogHeader>

					<p {...stylex.props(styles.confirmText)}>
						Are you sure you want to remove your pitch for {pitchToDelete?.gameName}? You can always
						add a new pitch later.
					</p>

					<DialogFooter>
						<button
							type="button"
							onClick={() => handleDeletePitchDialogOpenChange(false)}
							{...stylex.props(styles.quietAction, styles.neutralTone)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleDeletePitchConfirm}
							{...stylex.props(styles.quietAction, styles.denyTone)}
						>
							Delete pitch
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog open={isDeleteOpen} onOpenChange={handleDeleteDialogOpenChange}>
				<DialogContent style={styles.confirmDialog}>
					<DialogHeader>
						<DialogTitle style={styles.dialogTitle}>Delete Nomination</DialogTitle>
					</DialogHeader>

					<p {...stylex.props(styles.confirmText)}>
						Are you sure you want to delete your nomination for {deletingNomination?.gameName}? This
						action cannot be undone.
					</p>

					<DialogFooter>
						<Button
							type="button"
							onClick={closeDeleteModal}
							variant="outline"
							style={styles.quietButton}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleDeleteConfirm}
							variant="destructive"
							style={styles.destructiveButton}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add PitchesModal */}
			<PitchesModal
				isOpen={selectedNomination !== null}
				onClose={closePitchesModal}
				nomination={selectedNomination}
				userDiscordId={userDiscordId}
				canManagePitch
			/>
		</div>
	);
}
