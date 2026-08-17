import * as stylex from "@stylexjs/stylex";
import React from "react";
import { color, radius } from "~/styles/tokens.stylex";
import type { Month } from "~/types";

interface ThemeCardProps extends Month {
	/** On an archive page the month and theme are the page heading; on the home
	 * page that role belongs to the club introduction above it. */
	asPageHeading?: boolean;
}

const styles = stylex.create({
	band: {
		width: "100%",
	},
	inner: {
		marginInline: "auto",
	},
	panel: {
		borderRadius: "1rem",
		paddingInline: 32,
		paddingTop: 40,
		position: "relative",
	},
	stack: {
		alignItems: "center",
		display: "flex",
		flexDirection: "column",
		gap: 32,
		textAlign: "center",
	},
	heading: {
		alignItems: "center",
		display: "flex",
		flexDirection: "column",
		gap: 12,
		margin: 0,
	},
	month: {
		fontSize: "2.25rem",
		fontWeight: 700,
		letterSpacing: "0.05em",
		lineHeight: 1.1111,
	},
	year: {
		fontSize: "1.25rem",
		fontWeight: 700,
		lineHeight: 1.4,
	},
	theme: {
		backgroundColor: color.action,
		borderRadius: radius.pill,
		paddingBlock: 4,
		paddingInline: 16,
	},
	description: {
		fontSize: "1.125rem",
		lineHeight: 1.625,
		whiteSpace: "pre-wrap",
	},
});

export default function ThemeCard({ asPageHeading = false, ...month }: ThemeCardProps) {
	const monthName = new Date(month.year, month.month - 1).toLocaleString("default", {
		month: "long",
	});
	const Heading = asPageHeading ? "h1" : "div";

	return (
		<div {...stylex.props(styles.band)}>
			<div {...stylex.props(styles.inner)}>
				<div {...stylex.props(styles.panel)}>
					<div {...stylex.props(styles.stack)}>
						{/* Month and Year */}
						<Heading {...stylex.props(styles.heading)}>
							<span {...stylex.props(styles.month)}>{monthName}</span>
							<span {...stylex.props(styles.year)}>{month.year}</span>
							<span {...stylex.props(styles.theme)}>{month.theme.name}</span>
						</Heading>

						{month.theme.description && (
							<p {...stylex.props(styles.description)}>{month.theme.description}</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
