import { Button as ButtonPrimitive } from "@base-ui/react/button";
import * as stylex from "@stylexjs/stylex";

import type { StyledProps } from "~/styles/style-props";
import { color, motion, radius } from "~/styles/tokens.stylex";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const SHADOW = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
const RING = "0 0 0 3px oklch(70.8% 0 0 / 0.5)";
const DESTRUCTIVE_RING = "0 0 0 3px oklch(57.7% 0.245 27.325 / 0.2)";

const styles = stylex.create({
	root: {
		alignItems: "center",
		borderColor: { default: null, ":focus-visible": "oklch(70.8% 0 0)" },
		borderRadius: radius.md,
		boxShadow: { default: null, ":focus-visible": RING },
		display: "inline-flex",
		flexShrink: 0,
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 8,
		justifyContent: "center",
		outline: "none",
		transitionDuration: motion.duration,
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		whiteSpace: "nowrap",
		opacity: { default: null, ":disabled": 0.5 },
		pointerEvents: { default: null, ":disabled": "none" },
	},
});

const variantStyles = stylex.create({
	default: {
		backgroundColor: {
			default: "oklch(20.5% 0 0)",
			":hover": "oklch(20.5% 0 0 / 0.9)",
		},
		boxShadow: { default: SHADOW, ":focus-visible": `${RING}, ${SHADOW}` },
		color: "oklch(98.5% 0 0)",
	},
	destructive: {
		backgroundColor: {
			default: "oklch(57.7% 0.245 27.325)",
			":hover": "oklch(57.7% 0.245 27.325 / 0.9)",
		},
		boxShadow: { default: SHADOW, ":focus-visible": `${DESTRUCTIVE_RING}, ${SHADOW}` },
		color: color.white,
	},
	outline: {
		backgroundColor: { default: "oklch(100% 0 0)", ":hover": "oklch(97% 0 0)" },
		borderWidth: 1,
		boxShadow: { default: SHADOW, ":focus-visible": `${RING}, ${SHADOW}` },
		color: { default: null, ":hover": "oklch(20.5% 0 0)" },
	},
	secondary: {
		backgroundColor: { default: "oklch(97% 0 0)", ":hover": "oklch(97% 0 0 / 0.8)" },
		boxShadow: { default: SHADOW, ":focus-visible": `${RING}, ${SHADOW}` },
		color: "oklch(20.5% 0 0)",
	},
	ghost: {
		backgroundColor: { default: null, ":hover": "oklch(97% 0 0)" },
		color: { default: null, ":hover": "oklch(20.5% 0 0)" },
	},
	link: {
		color: "oklch(20.5% 0 0)",
		textDecorationLine: { default: null, ":hover": "underline" },
		textUnderlineOffset: 4,
	},
});

const sizeStyles = stylex.create({
	default: {
		height: 36,
		paddingBlock: 8,
		paddingInline: 16,
	},
	sm: {
		gap: 6,
		height: 32,
		paddingInline: 12,
	},
	lg: {
		height: 40,
		paddingInline: 24,
	},
	icon: {
		height: 36,
		width: 36,
	},
});

export type ButtonProps = StyledProps<ButtonPrimitive.Props> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
};

export function Button({ style, variant = "default", size = "default", ...props }: ButtonProps) {
	return (
		<ButtonPrimitive
			{...props}
			{...stylex.props(styles.root, variantStyles[variant], sizeStyles[size], style)}
		/>
	);
}
