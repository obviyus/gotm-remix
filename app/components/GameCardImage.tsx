import * as stylex from "@stylexjs/stylex";
import React from "react";
import { color, motion, radius } from "~/styles/tokens.stylex";
import { gameCard } from "./game-card.stylex";

interface GameCardImageProps {
	coverUrl: string | null;
	gameName: string;
	status: "winner" | "jury" | "regular";
}

const styles = stylex.create({
	frame: {
		borderEndStartRadius: radius.xl,
		borderStartStartRadius: radius.xl,
		flexShrink: 0,
		overflow: "hidden",
		position: "relative",
		width: 156,
	},
	scrim: {
		backgroundImage: "linear-gradient(to top, oklch(21% 0.006 285.885 / 0.4), transparent)",
		inset: 0,
		position: "absolute",
		zIndex: 10,
	},
	cover: {
		height: "100%",
		objectFit: "cover",
		transform: { default: null, [stylex.when.ancestor(":hover", gameCard)]: "scale(1.05)" },
		transitionDuration: "0.5s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		width: "100%",
	},
	badgeSlot: {
		left: 8,
		position: "absolute",
		top: 8,
		zIndex: 20,
	},
	placeholder: {
		alignItems: "center",
		backdropFilter: "blur(8px)",
		backgroundColor: "oklch(27.4% 0.006 286.033 / 0.5)",
		color: color.dim,
		display: "flex",
		height: "100%",
		justifyContent: "center",
		position: "relative",
		width: "100%",
	},
	badge: {
		borderRadius: radius.md,
		borderWidth: 1,
		fontSize: "0.75rem",
		fontWeight: 500,
		lineHeight: 1.3333,
		paddingBlock: 4,
		paddingInline: 10,
	},
	winnerBadge: {
		backgroundColor: "oklch(66.6% 0.179 58.318)",
		borderColor: "oklch(82.8% 0.189 84.429 / 0.5)",
		color: "oklch(96.2% 0.059 95.617)",
	},
	juryBadge: {
		backgroundColor: "oklch(54.6% 0.245 262.881)",
		borderColor: "oklch(70.7% 0.165 254.624 / 0.5)",
		color: "oklch(93.2% 0.032 255.585)",
	},
});

const brightnessStyles = stylex.create({
	winner: {
		filter: { default: null, [stylex.when.ancestor(":hover", gameCard)]: "brightness(1.25)" },
	},
	jury: {
		filter: { default: null, [stylex.when.ancestor(":hover", gameCard)]: "brightness(1.1)" },
	},
	regular: {
		filter: { default: null, [stylex.when.ancestor(":hover", gameCard)]: "brightness(1.1)" },
	},
});

function StatusBadge({ status }: { status: "winner" | "jury" | "regular" }) {
	switch (status) {
		case "winner":
			return <span {...stylex.props(styles.badge, styles.winnerBadge)}>Winner</span>;
		case "jury":
			return <span {...stylex.props(styles.badge, styles.juryBadge)}>Jury Selected</span>;
		default:
			return null;
	}
}

export function GameCardImage({ coverUrl, gameName, status }: GameCardImageProps) {
	return (
		<div {...stylex.props(styles.frame)}>
			{coverUrl ? (
				<>
					<div {...stylex.props(styles.scrim)} />
					<img
						src={coverUrl}
						alt={gameName}
						width={156}
						height={208}
						loading="lazy"
						decoding="async"
						{...stylex.props(styles.cover, brightnessStyles[status])}
					/>
					<div {...stylex.props(styles.badgeSlot)}>
						<StatusBadge status={status} />
					</div>
				</>
			) : (
				<div {...stylex.props(styles.placeholder)}>
					<span>No cover</span>
					<div {...stylex.props(styles.badgeSlot)}>
						<StatusBadge status={status} />
					</div>
				</div>
			)}
		</div>
	);
}

export type { GameCardImageProps };
