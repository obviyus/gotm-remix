import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";

import type { StyledProps } from "~/styles/style-props";
import { color, motion, radius } from "~/styles/tokens.stylex";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const styles = stylex.create({
	root: {
		alignItems: "center",
		borderRadius: radius.md,
		borderWidth: 1,
		display: "inline-flex",
		flexShrink: 0,
		fontSize: "0.75rem",
		fontWeight: 500,
		gap: 4,
		justifyContent: "center",
		overflow: "hidden",
		paddingBlock: 2,
		paddingInline: 8,
		transitionDuration: motion.duration,
		transitionProperty: "color, box-shadow",
		transitionTimingFunction: motion.easing,
		whiteSpace: "nowrap",
		width: "fit-content",
		borderColor: { default: null, ":focus-visible": "oklch(70.8% 0 0)" },
		boxShadow: { default: null, ":focus-visible": "0 0 0 3px oklch(70.8% 0 0 / 0.5)" },
	},
});

const variantStyles = stylex.create({
	default: {
		backgroundColor: "oklch(20.5% 0 0)",
		borderColor: "transparent",
		color: "oklch(98.5% 0 0)",
	},
	secondary: {
		backgroundColor: "oklch(97% 0 0)",
		borderColor: "transparent",
		color: "oklch(20.5% 0 0)",
	},
	destructive: {
		backgroundColor: "oklch(57.7% 0.245 27.325)",
		borderColor: "transparent",
		color: color.white,
	},
	outline: {
		color: "oklch(14.5% 0 0)",
	},
});

export type BadgeProps = StyledProps<useRender.ComponentProps<"span">> & {
	variant?: BadgeVariant;
};

export function Badge({ style, variant = "default", render, ...props }: BadgeProps) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(stylex.props(styles.root, variantStyles[variant], style), props),
		render,
	});
}
