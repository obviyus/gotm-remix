import * as stylex from "@stylexjs/stylex";
import React from "react";
import { db } from "~/server/database.server";
import { color, media } from "~/styles/tokens.stylex";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/jury";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Jury Members | ${SITE_NAME}`,
		description: "The members who set each month's theme and cut the nominations down to a ballot.",
		path: "/jury",
	});

export async function loader() {
	const result = await db.execute(
		`SELECT name
         FROM jury_members
         WHERE active = 1
         ORDER BY name;`,
	);

	return { juryMembers: result.rows.map((row) => row.name as string) };
}

const styles = stylex.create({
	page: {
		height: "100%",
		marginInline: "auto",
		paddingBlock: 24,
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	article: {
		height: "100%",
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
});

export default function Jury({ loaderData }: Route.ComponentProps) {
	const { juryMembers } = loaderData;

	return (
		<div {...stylex.props(styles.page)}>
			<article {...stylex.props(styles.article)}>
				<header {...stylex.props(styles.header)}>
					<h1 {...stylex.props(styles.heading)}>Jury Members</h1>
				</header>

				<ul {...stylex.props(styles.list)}>
					{juryMembers.map((member) => (
						<li key={member}>{member}</li>
					))}
				</ul>
			</article>
		</div>
	);
}
