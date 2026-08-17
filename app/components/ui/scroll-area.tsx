import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import * as stylex from "@stylexjs/stylex";

import type { StyledProps } from "~/styles/style-props";
import { motion, radius } from "~/styles/tokens.stylex";

const styles = stylex.create({
	root: {
		position: "relative",
	},
	viewport: {
		borderRadius: "inherit",
		boxShadow: { default: null, ":focus-visible": "0 0 0 3px oklch(70.8% 0 0 / 0.5)" },
		height: "100%",
		outline: { default: "none", ":focus-visible": "1px solid" },
		transitionDuration: motion.duration,
		transitionProperty: "color, box-shadow",
		transitionTimingFunction: motion.easing,
		width: "100%",
	},
	scrollbar: {
		display: "flex",
		padding: 1,
		touchAction: "none",
		transitionDuration: motion.duration,
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
		userSelect: "none",
		borderLeftColor: { default: null, ':is([data-orientation="vertical"])': "transparent" },
		borderLeftWidth: { default: null, ':is([data-orientation="vertical"])': 1 },
		borderTopColor: { default: null, ':is([data-orientation="horizontal"])': "transparent" },
		borderTopWidth: { default: null, ':is([data-orientation="horizontal"])': 1 },
		flexDirection: { default: null, ':is([data-orientation="horizontal"])': "column" },
		height: {
			default: null,
			':is([data-orientation="vertical"])': "100%",
			':is([data-orientation="horizontal"])': 10,
		},
		width: { default: null, ':is([data-orientation="vertical"])': 10 },
	},
	thumb: {
		backgroundColor: "oklch(92.2% 0 0)",
		borderRadius: radius.pill,
		flex: 1,
		position: "relative",
	},
});

export function ScrollArea({
	style,
	children,
	...props
}: StyledProps<ScrollAreaPrimitive.Root.Props>) {
	return (
		<ScrollAreaPrimitive.Root {...props} {...stylex.props(styles.root, style)}>
			<ScrollAreaPrimitive.Viewport {...stylex.props(styles.viewport)}>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollAreaPrimitive.Scrollbar orientation="vertical" {...stylex.props(styles.scrollbar)}>
				<ScrollAreaPrimitive.Thumb {...stylex.props(styles.thumb)} />
			</ScrollAreaPrimitive.Scrollbar>
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}
