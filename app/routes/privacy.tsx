import * as stylex from "@stylexjs/stylex";
import React from "react";
import { color, media } from "~/styles/tokens.stylex";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/privacy";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Privacy | ${SITE_NAME}`,
		description: "This site stores your Discord account ID, and only if you nominate or vote.",
		path: "/privacy",
	});

const styles = stylex.create({
	page: {
		marginInline: "auto",
		paddingBlock: 24,
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	article: {
		marginInline: "auto",
	},
	header: {
		marginBottom: 24,
	},
	heading: {
		color: color.heading,
		fontSize: { default: "1.5rem", [media.sm]: "1.875rem" },
		fontWeight: 700,
		letterSpacing: "-0.025em",
		lineHeight: { default: 1.3333, [media.sm]: 1.2 },
	},
	list: {
		listStyleType: "disc",
		marginLeft: 24,
		marginTop: 8,
	},
	paragraph: {
		marginTop: 16,
	},
});

export default function Privacy() {
	return (
		<div {...stylex.props(styles.page)}>
			<article {...stylex.props(styles.article)}>
				<header {...stylex.props(styles.header)}>
					<h1 {...stylex.props(styles.heading)}>Privacy</h1>
				</header>

				<p>
					This website gets the following information from your Discord account when you
					authenticate:
				</p>

				<ul {...stylex.props(styles.list)}>
					<li>Account ID</li>
				</ul>

				<p {...stylex.props(styles.paragraph)}>
					All of these are publicly visible to anyone in every server you joined.
				</p>

				<p {...stylex.props(styles.paragraph)}>
					The only data that is used and saved on this site, is the account id and ONLY if you
					nominate or vote for a game. The sole purpose of this is to prevent multiple nominations
					and votings by the same user in one month.
				</p>

				<p {...stylex.props(styles.paragraph)}>No other data is made use of in any way.</p>
			</article>
		</div>
	);
}
