import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import type { StyledProps } from "~/styles/style-props";

const styles = stylex.create({
	label: {
		alignItems: "center",
		display: "flex",
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 8,
		lineHeight: 1,
		userSelect: "none",
	},
});

export function Label({ style, ...props }: StyledProps<React.ComponentProps<"label">>) {
	return <label {...props} {...stylex.props(styles.label, style)} />;
}
