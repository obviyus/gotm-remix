import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import type { StyledProps } from "~/styles/style-props";
import { radius } from "~/styles/tokens.stylex";

type DivProps = StyledProps<React.ComponentProps<"div">>;

const styles = stylex.create({
	card: {
		backgroundColor: "oklch(100% 0 0)",
		borderRadius: radius.xl,
		borderWidth: 1,
		boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
		color: "oklch(14.5% 0 0)",
		display: "flex",
		flexDirection: "column",
		gap: 24,
		paddingBlock: 24,
	},
	header: {
		alignItems: "start",
		display: "grid",
		gap: 6,
		gridAutoRows: "min-content",
		gridTemplateRows: "auto auto",
		paddingInline: 24,
	},
	title: {
		fontWeight: 600,
		lineHeight: 1,
	},
	content: {
		paddingInline: 24,
	},
});

export function Card({ style, ...props }: DivProps) {
	return <div {...props} {...stylex.props(styles.card, style)} />;
}

export function CardHeader({ style, ...props }: DivProps) {
	return <div {...props} {...stylex.props(styles.header, style)} />;
}

export function CardTitle({ style, ...props }: DivProps) {
	return <div {...props} {...stylex.props(styles.title, style)} />;
}

export function CardContent({ style, ...props }: DivProps) {
	return <div {...props} {...stylex.props(styles.content, style)} />;
}
