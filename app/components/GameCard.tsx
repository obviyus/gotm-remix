import type {
	DraggableProvidedDraggableProps,
	DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import * as stylex from "@stylexjs/stylex";
import React from "react";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination } from "~/types";
import { gameCard } from "./game-card.stylex";
import { GameCardActions } from "./GameCardActions";
import { GameCardImage } from "./GameCardImage";

const extractGameYear = (nomination: Nomination) => {
	if (nomination.gameYear) {
		return nomination.gameYear;
	}

	return null;
};

interface GameCardProps {
	game: Nomination;
	variant?: "default" | "nomination" | "search";
	onNominate?: (game: Nomination) => void;
	onEdit?: (game: Nomination) => void;
	onDelete?: (game: Nomination) => void;
	draggableProps?: DraggableProvidedDraggableProps;
	dragHandleProps?: DraggableProvidedDragHandleProps;
	innerRef?: (element?: HTMLElement | null) => void;
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
	onViewPitches?: () => void;
	pitchCount?: number;
	showVotingButtons?: boolean;
	showPitchesButton?: boolean;
	buttonText?: string;
	buttonDisabled?: boolean;
	isPreviousWinner?: boolean;
	isWinner?: boolean;
	isJurySelected?: boolean;
}

const styles = stylex.create({
	card: {
		backdropFilter: "blur(8px)",
		backgroundColor: {
			default: "oklch(21% 0.006 285.885 / 0.5)",
			[media.backdropFilter]: "oklch(21% 0.006 285.885 / 0.2)",
		},
		borderRadius: radius.xl,
		borderWidth: 1,
		display: "flex",
		height: 208,
		minWidth: 0,
		position: "relative",
		transitionDuration: "0.2s",
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
		willChange: "transform",
	},
	body: {
		display: "flex",
		flex: 1,
		flexDirection: "column",
		gap: 12,
		minWidth: 0,
		overflow: "hidden",
		padding: 16,
	},
	summaryBlock: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		minWidth: 0,
	},
	titleRow: {
		alignItems: "flex-start",
		display: "flex",
		gap: 8,
		justifyContent: "space-between",
	},
	title: {
		fontSize: "0.875rem",
		fontWeight: 500,
		lineHeight: 1.375,
		overflowWrap: "break-word",
	},
	year: {
		color: color.dim,
		flexShrink: 0,
		fontSize: "0.75rem",
		fontWeight: 500,
		lineHeight: 1.3333,
	},
	summary: {
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: 3,
		color: color.muted,
		display: "-webkit-box",
		fontSize: "1rem",
		lineHeight: 1.5,
		overflow: "hidden",
	},
});

// Hovering any card settles on the same neutral edge, so the status colour only
// describes the card at rest.
const HOVER_EDGE = "oklch(37% 0.013 285.805 / 0.5)";

const statusStyles = stylex.create({
	winner: {
		borderColor: { default: "oklch(76.9% 0.188 70.08)", ":hover": HOVER_EDGE },
	},
	jury: {
		borderColor: { default: "oklch(62.3% 0.214 259.815)", ":hover": HOVER_EDGE },
	},
	regular: {
		borderColor: { default: "oklch(27.4% 0.006 286.033 / 0.5)", ":hover": HOVER_EDGE },
	},
});

const titleStyles = stylex.create({
	winner: { color: "oklch(92.4% 0.12 95.746)", fontWeight: 600 },
	jury: { color: "oklch(88.2% 0.059 254.128)" },
	regular: { color: color.heading },
});

export default function GameCard({
	game,
	variant = "default",
	onNominate,
	onEdit,
	onDelete,
	draggableProps,
	dragHandleProps,
	innerRef,
	onRank,
	onUnrank,
	isRanked,
	alreadyNominated,
	isCurrentUserNomination,
	onViewPitches,
	pitchCount = 0,
	showVotingButtons = false,
	showPitchesButton = false,
	buttonText,
	buttonDisabled,
	isPreviousWinner = false,
	isWinner = false,
	isJurySelected = false,
}: GameCardProps) {
	const coverUrl = game.gameCover?.replace("t_thumb", "t_cover_big");
	const year = extractGameYear(game);

	// Determine status for highlighting and badges
	// Winner takes precedence over jury selected
	const status = isWinner ? "winner" : isJurySelected ? "jury" : "regular";

	// Drag and drop owns the live transform while a card is moving, so its inline
	// style is applied after the card's own.
	const cardProps = stylex.props(gameCard, styles.card, statusStyles[status]);
	const mergedStyle = draggableProps?.style
		? { ...cardProps.style, ...draggableProps.style }
		: cardProps.style;

	return (
		<div {...draggableProps} {...dragHandleProps} {...cardProps} ref={innerRef} style={mergedStyle}>
			<GameCardImage coverUrl={coverUrl ?? null} gameName={game.gameName} status={status} />

			<div {...stylex.props(styles.body)}>
				<div {...stylex.props(styles.summaryBlock)}>
					<div {...stylex.props(styles.titleRow)}>
						<h3 {...stylex.props(styles.title, titleStyles[status])}>{game.gameName}</h3>
						{year && <p {...stylex.props(styles.year)}>{year}</p>}
					</div>
					{game.summary && <p {...stylex.props(styles.summary)}>{game.summary}</p>}
				</div>

				<GameCardActions
					game={game}
					variant={variant}
					onRank={onRank}
					onUnrank={onUnrank}
					isRanked={isRanked}
					onViewPitches={onViewPitches}
					pitchCount={pitchCount}
					showVotingButtons={showVotingButtons}
					showPitchesButton={showPitchesButton}
					onNominate={onNominate}
					alreadyNominated={alreadyNominated}
					isCurrentUserNomination={isCurrentUserNomination}
					buttonText={buttonText}
					buttonDisabled={buttonDisabled}
					isPreviousWinner={isPreviousWinner}
					onEdit={onEdit}
					onDelete={onDelete}
				/>
			</div>
		</div>
	);
}
