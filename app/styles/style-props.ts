import type { StyleXStyles, StyleXStylesWithout } from "@stylexjs/stylex";

/**
 * Replaces a component's native `className` and inline `style` escape hatches
 * with a single typed StyleX override. Components apply it last so a caller can
 * refine visual policy without learning generated class names.
 */
export type StyledProps<Props, Override = StyleXStyles> = Omit<Props, "className" | "style"> & {
	style?: Override;
};

/**
 * A dialog popup is centred by the component. Callers may restyle everything
 * else about it, but not the properties that place it.
 */
export type CenteredPopupStyle = StyleXStylesWithout<{
	position: string;
	top: string;
	left: string;
	translate: string;
	zIndex: number;
}>;
