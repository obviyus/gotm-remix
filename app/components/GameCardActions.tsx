import * as stylex from "@stylexjs/stylex";
import { ArrowDown, ArrowUp, Edit, ExternalLink, MessageCircle, Trash2 } from "lucide-react";
import { control } from "~/styles/markers.stylex";
import { color, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination } from "~/types";

interface GameCardActionsProps {
	game: Nomination;
	variant: "default" | "nomination" | "search";
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	onViewPitches?: () => void;
	pitchCount?: number;
	showVotingButtons?: boolean;
	showPitchesButton?: boolean;
	onNominate?: (game: Nomination) => void;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
	buttonText?: string;
	buttonDisabled?: boolean;
	isPreviousWinner?: boolean;
	onEdit?: (game: Nomination) => void;
	onDelete?: (game: Nomination) => void;
}

const styles = stylex.create({
	stack: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginTop: "auto",
		minWidth: 0,
	},
	votingStack: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		width: "100%",
	},
	linkColumn: {
		display: "flex",
		flexDirection: "column",
		gap: 6,
	},
	fullWidth: {
		width: "100%",
	},
	action: {
		alignItems: "center",
		borderRadius: radius.lg,
		borderWidth: 1,
		display: "inline-flex",
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 8,
		justifyContent: "center",
		lineHeight: 1.4286,
		overflow: "hidden",
		paddingBlock: 8,
		position: "relative",
		transitionDuration: "0.3s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		width: "100%",
		"::after": {
			content: "''",
			inset: 0,
			position: "absolute",
			transitionDuration: motion.duration,
			transitionProperty: "color, background-color, border-color",
			transitionTimingFunction: motion.easing,
		},
	},
	roomy: { paddingInline: 16 },
	snug: { paddingInline: 12 },
	label: {
		alignItems: "center",
		display: "flex",
		gap: 8,
		justifyContent: "center",
		position: "relative",
		transform: { default: null, [stylex.when.ancestor(":hover", control)]: "scale(1.05)" },
		transitionDuration: motion.duration,
		transitionProperty: "transform, translate, scale, rotate",
		transitionTimingFunction: motion.easing,
		zIndex: 10,
	},
	icon: {
		height: 16,
		width: 16,
	},
	leadingIcon: {
		height: 16,
		transitionDuration: motion.duration,
		transitionProperty: "transform, translate, scale, rotate",
		transitionTimingFunction: motion.easing,
		translate: { default: null, [stylex.when.ancestor(":hover", control)]: "2px -2px" },
		width: 16,
	},
	neutral: {
		alignItems: "center",
		backdropFilter: "blur(8px)",
		backgroundColor: {
			default: "oklch(55.2% 0.016 285.938 / 0.1)",
			":hover": "oklch(55.2% 0.016 285.938 / 0.2)",
		},
		borderColor: {
			default: "oklch(55.2% 0.016 285.938 / 0.2)",
			":hover": "oklch(55.2% 0.016 285.938 / 0.3)",
		},
		borderRadius: radius.lg,
		borderWidth: 1,
		color: color.body,
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
		width: "100%",
	},
	// Replaces the tone entirely rather than layering on top of it, because a
	// disabled control should not keep the tone's hover response.
	unavailable: {
		backgroundColor: "transparent",
		borderColor: "oklch(70.5% 0.015 286.067 / 0.2)",
		color: color.muted,
		cursor: "not-allowed",
		opacity: 0.5,
	},
});

/**
 * Each action reads as a colour: green adds, red removes, amber warns, blue
 * informs, purple leaves the site.
 */
const toneStyles = stylex.create({
	affirm: {
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
		"::after": {
			backgroundColor: {
				default: "transparent",
				":hover": "oklch(76.5% 0.177 163.223 / 0.05)",
			},
		},
	},
	deny: {
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
		"::after": {
			backgroundColor: { default: "transparent", ":hover": "oklch(70.4% 0.191 22.216 / 0.05)" },
		},
	},
	award: {
		backgroundColor: { default: null, ":hover": "oklch(76.9% 0.188 70.08 / 0.1)" },
		borderColor: {
			default: "oklch(82.8% 0.189 84.429 / 0.2)",
			":hover": "oklch(82.8% 0.189 84.429 / 0.3)",
		},
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(76.9% 0.188 70.08 / 0.2), 0 1px 2px -1px oklch(76.9% 0.188 70.08 / 0.2)",
			":hover":
				"0 1px 3px 0 oklch(76.9% 0.188 70.08 / 0.4), 0 1px 2px -1px oklch(76.9% 0.188 70.08 / 0.4)",
		},
		color: color.award,
		"::after": {
			backgroundColor: { default: "transparent", ":hover": "oklch(82.8% 0.189 84.429 / 0.05)" },
		},
	},
	inform: {
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
		"::after": {
			backgroundColor: { default: "transparent", ":hover": "oklch(70.7% 0.165 254.624 / 0.05)" },
		},
	},
	offsite: {
		backgroundColor: { default: null, ":hover": "oklch(62.7% 0.265 303.9 / 0.1)" },
		borderColor: {
			default: "oklch(71.4% 0.203 305.504 / 0.2)",
			":hover": "oklch(71.4% 0.203 305.504 / 0.3)",
		},
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(62.7% 0.265 303.9 / 0.2), 0 1px 2px -1px oklch(62.7% 0.265 303.9 / 0.2)",
			":hover":
				"0 1px 3px 0 oklch(62.7% 0.265 303.9 / 0.4), 0 1px 2px -1px oklch(62.7% 0.265 303.9 / 0.4)",
		},
		color: "oklch(62.7% 0.265 303.9)",
		"::after": {
			backgroundColor: { default: "transparent", ":hover": "oklch(71.4% 0.203 305.504 / 0.05)" },
		},
	},
});

const pitchLabel = (pitchCount: number) =>
	pitchCount === 0
		? "No Pitches Yet"
		: `View ${pitchCount} ${pitchCount === 1 ? "Pitch" : "Pitches"}`;

export function GameCardActions({
	game,
	variant,
	onRank,
	onUnrank,
	isRanked,
	onViewPitches,
	pitchCount = 0,
	showVotingButtons,
	showPitchesButton,
	onNominate,
	alreadyNominated,
	isCurrentUserNomination,
	buttonText,
	buttonDisabled,
	isPreviousWinner,
	onEdit,
	onDelete,
}: GameCardActionsProps) {
	const handleNominateClick = () => {
		if (onNominate) {
			onNominate(game);
		}
	};

	const handleEditClick = () => {
		if (onEdit) {
			onEdit(game);
		}
	};

	const handleDeleteClick = () => {
		if (onDelete) {
			onDelete(game);
		}
	};

	const nominateDisabled = Boolean(
		buttonDisabled || (alreadyNominated && isCurrentUserNomination) || isPreviousWinner,
	);
	const nominateTone = isPreviousWinner
		? toneStyles.award
		: alreadyNominated && !isCurrentUserNomination
			? toneStyles.inform
			: toneStyles.affirm;

	return (
		<div {...stylex.props(styles.stack)}>
			{showVotingButtons && (
				<div {...stylex.props(styles.votingStack)}>
					<button
						type="button"
						onClick={isRanked ? onUnrank : onRank}
						{...stylex.props(
							control,
							styles.action,
							styles.roomy,
							isRanked ? toneStyles.deny : toneStyles.affirm,
						)}
					>
						<span {...stylex.props(styles.label)}>
							{isRanked ? (
								<>
									<ArrowDown {...stylex.props(styles.leadingIcon)} />
									Remove from Ranking
								</>
							) : (
								<>
									<ArrowUp {...stylex.props(styles.leadingIcon)} />
									Add to Ranking
								</>
							)}
						</span>
					</button>

					{onViewPitches && (
						<button type="button" onClick={onViewPitches} {...stylex.props(styles.neutral)}>
							<MessageCircle {...stylex.props(styles.icon)} />
							{pitchLabel(pitchCount)}
						</button>
					)}
				</div>
			)}

			{showPitchesButton && onViewPitches && (
				<button type="button" onClick={onViewPitches} {...stylex.props(styles.neutral)}>
					<MessageCircle {...stylex.props(styles.icon)} />
					{pitchLabel(pitchCount)}
				</button>
			)}

			{onNominate && (
				<button
					type="button"
					onClick={handleNominateClick}
					disabled={nominateDisabled}
					{...stylex.props(
						control,
						styles.action,
						styles.roomy,
						nominateDisabled ? styles.unavailable : nominateTone,
					)}
				>
					<span {...stylex.props(styles.label)}>
						{buttonText ||
							(alreadyNominated
								? isCurrentUserNomination
									? "Already nominated"
									: "Add Pitch"
								: "Nominate")}
					</span>
				</button>
			)}

			{(onEdit || onDelete || game.gameUrl) && (
				<div {...stylex.props(variant === "nomination" ? styles.linkColumn : styles.fullWidth)}>
					{game.gameUrl && (
						<a
							href={game.gameUrl}
							target="_blank"
							rel="noopener noreferrer"
							title="View on IGDB"
							{...stylex.props(control, styles.action, styles.snug, toneStyles.offsite)}
						>
							<span {...stylex.props(styles.label)}>
								<ExternalLink {...stylex.props(styles.leadingIcon)} />
								{variant === "nomination" ? "View on IGDB" : "IGDB"}
							</span>
						</a>
					)}
					{variant === "nomination" && (
						<>
							{onEdit && (
								<button
									type="button"
									onClick={handleEditClick}
									title={game.pitches.length > 0 ? "Edit pitch" : "Add pitch"}
									{...stylex.props(control, styles.action, styles.snug, toneStyles.inform)}
								>
									<span {...stylex.props(styles.label)}>
										<Edit {...stylex.props(styles.leadingIcon)} />
										{game.pitches.length > 0 ? "Edit pitch" : "Add pitch"}
									</span>
								</button>
							)}
							{onDelete && (
								<button
									type="button"
									onClick={handleDeleteClick}
									title="Delete nomination"
									{...stylex.props(control, styles.action, styles.snug, toneStyles.deny)}
								>
									<span {...stylex.props(styles.label)}>
										<Trash2 {...stylex.props(styles.leadingIcon)} />
										Delete
									</span>
								</button>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

export type { GameCardActionsProps };
