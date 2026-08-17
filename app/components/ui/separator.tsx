import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import * as stylex from "@stylexjs/stylex";

import type { StyledProps } from "~/styles/style-props";

const styles = stylex.create({
	separator: {
		backgroundColor: "oklch(92.2% 0 0)",
		flexShrink: 0,
		alignSelf: { default: null, ':is([data-orientation="vertical"])': "stretch" },
		height: { default: null, ':is([data-orientation="horizontal"])': 1 },
		width: {
			default: null,
			':is([data-orientation="horizontal"])': "100%",
			':is([data-orientation="vertical"])': 1,
		},
	},
});

export function Separator({
	style,
	orientation = "horizontal",
	decorative = true,
	...props
}: StyledProps<SeparatorPrimitive.Props> & { decorative?: boolean }) {
	return (
		<SeparatorPrimitive
			{...props}
			role={decorative ? "none" : "separator"}
			orientation={orientation}
			{...stylex.props(styles.separator, style)}
		/>
	);
}
