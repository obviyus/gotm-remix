import { Input as InputPrimitive } from "@base-ui/react/input";
import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import type { StyledProps } from "~/styles/style-props";
import { media, motion, radius } from "~/styles/tokens.stylex";

const styles = stylex.create({
	input: {
		backgroundColor: "transparent",
		borderColor: "oklch(92.2% 0 0)",
		borderRadius: radius.md,
		borderWidth: 1,
		boxShadow: {
			default: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
			":focus-visible": "0 0 0 3px oklch(70.8% 0 0 / 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
		},
		display: "flex",
		fontSize: { default: "1rem", [media.md]: "0.875rem" },
		height: 36,
		lineHeight: { default: 1.5, [media.md]: 1.4286 },
		minWidth: 0,
		outline: "none",
		paddingBlock: 4,
		paddingInline: 12,
		transitionDuration: motion.duration,
		transitionProperty: "color, box-shadow",
		transitionTimingFunction: motion.easing,
		width: "100%",
		"::placeholder": { color: "oklch(55.6% 0 0)" },
		"::selection": { backgroundColor: "oklch(20.5% 0 0)", color: "oklch(98.5% 0 0)" },
		"::file-selector-button": {
			backgroundColor: "transparent",
			borderWidth: 0,
			color: "oklch(14.5% 0 0)",
			display: "inline-flex",
			fontSize: "0.875rem",
			fontWeight: 500,
			height: 28,
		},
		cursor: { default: null, ":disabled": "not-allowed" },
		opacity: { default: null, ":disabled": 0.5 },
		pointerEvents: { default: null, ":disabled": "none" },
	},
});

export function Input({ style, ...props }: StyledProps<React.ComponentProps<"input">>) {
	return <InputPrimitive {...props} {...stylex.props(styles.input, style)} />;
}
