import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as stylex from "@stylexjs/stylex";

import type { StyledProps } from "~/styles/style-props";
import { media, radius } from "~/styles/tokens.stylex";

const OFFSET = "0.5rem";

const fromAbove = stylex.keyframes({
	from: { opacity: 0, transform: `translateY(-${OFFSET}) scale(0.95)` },
});
const fromBelow = stylex.keyframes({
	from: { opacity: 0, transform: `translateY(${OFFSET}) scale(0.95)` },
});
const fromLeft = stylex.keyframes({
	from: { opacity: 0, transform: `translateX(-${OFFSET}) scale(0.95)` },
});
const fromRight = stylex.keyframes({
	from: { opacity: 0, transform: `translateX(${OFFSET}) scale(0.95)` },
});
const shrinkOut = stylex.keyframes({ to: { opacity: 0, transform: "scale(0.95)" } });

const styles = stylex.create({
	positioner: {
		isolation: "isolate",
		zIndex: 50,
	},
	popup: {
		animationDuration: "0.1s",
		// Base UI reports which edge it landed on, so the popup can enter from the
		// direction it opened toward.
		animationName: {
			default: null,
			':is([data-side="bottom"][data-open])': fromAbove,
			':is([data-side="top"][data-open])': fromBelow,
			':is([data-side="right"][data-open])': fromLeft,
			':is([data-side="inline-end"][data-open])': fromLeft,
			':is([data-side="left"][data-open])': fromRight,
			':is([data-side="inline-start"][data-open])': fromRight,
			":is([data-closed])": shrinkOut,
			[media.reducedMotion]: "none",
		},
		animationTimingFunction: "ease",
		backgroundColor: "oklch(100% 0 0)",
		borderRadius: radius.lg,
		boxShadow:
			"0 0 0 1px oklch(14.5% 0 0 / 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
		color: "oklch(14.5% 0 0)",
		display: "flex",
		flexDirection: "column",
		fontSize: "0.875rem",
		gap: 10,
		lineHeight: 1.4286,
		outline: "2px solid transparent",
		outlineOffset: 2,
		padding: 10,
		transformOrigin: "var(--transform-origin)",
		width: "18rem",
		zIndex: 50,
	},
	title: {
		fontWeight: 500,
	},
});

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

type PopoverContentProps = StyledProps<PopoverPrimitive.Popup.Props> &
	Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

export function PopoverContent({
	style,
	align = "center",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	...props
}: PopoverContentProps) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				{...stylex.props(styles.positioner)}
			>
				<PopoverPrimitive.Popup {...props} {...stylex.props(styles.popup, style)} />
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export function PopoverTitle({ style, ...props }: StyledProps<PopoverPrimitive.Title.Props>) {
	return <PopoverPrimitive.Title {...props} {...stylex.props(styles.title, style)} />;
}
