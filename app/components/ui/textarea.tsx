import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import type { StyledProps } from "~/styles/style-props";
import { media, motion, radius } from "~/styles/tokens.stylex";

const styles = stylex.create({
	textarea: {
		backgroundColor: "transparent",
		borderColor: "oklch(92.2% 0 0)",
		borderRadius: radius.md,
		borderWidth: 1,
		boxShadow: {
			default: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
			":focus-visible": "0 0 0 3px oklch(70.8% 0 0 / 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
		},
		display: "flex",
		fieldSizing: "content",
		fontSize: { default: "1rem", [media.md]: "0.875rem" },
		lineHeight: { default: 1.5, [media.md]: 1.4286 },
		minHeight: 64,
		outline: "none",
		paddingBlock: 8,
		paddingInline: 12,
		transitionDuration: motion.duration,
		transitionProperty: "color, box-shadow",
		transitionTimingFunction: motion.easing,
		width: "100%",
		"::placeholder": { color: "oklch(55.6% 0 0)" },
		cursor: { default: null, ":disabled": "not-allowed" },
		opacity: { default: null, ":disabled": 0.5 },
	},
});

export function Textarea({ style, ...props }: StyledProps<React.ComponentProps<"textarea">>) {
	return <textarea {...props} {...stylex.props(styles.textarea, style)} />;
}
