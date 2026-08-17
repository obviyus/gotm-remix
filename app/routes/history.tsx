import * as stylex from "@stylexjs/stylex";
import React from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/server/database.server";
import { getMonths } from "~/server/month.server";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Month, Nomination } from "~/types";
import { categoryWinnerLabel } from "~/utils/categoryLabels";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/history";
import { monthTile } from "./history-card.stylex";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Past Winners | ${SITE_NAME}`,
		description:
			"Every month the PatientGamers Discord has played, with the theme and the winning games for each.",
		path: "/history",
	});

export async function loader() {
	const [allMonths, winnersResult] = await Promise.all([
		getMonths(),
		db.execute({
			sql: `SELECT game_id,
			             month_id,
			             nomination_id,
			             short,
			             game_name,
			             game_year,
			             game_cover,
			             game_url
			      FROM winners`,
			args: [],
		}),
	]);

	const winnersByMonth = new Map<number, Nomination[]>();
	for (const row of winnersResult.rows) {
		const monthId = Number(row.month_id);
		const existing = winnersByMonth.get(monthId) ?? [];
		existing.push({
			id: Number(row.nomination_id),
			gameId: String(row.game_id),
			monthId,
			short: Boolean(row.short),
			gameName: String(row.game_name),
			gameYear: String(row.game_year),
			gameCover: String(row.game_cover),
			gameUrl: String(row.game_url),
			jurySelected: true,
			discordId: "",
			pitches: [],
		});
		winnersByMonth.set(monthId, existing);
	}

	const months: Month[] = allMonths
		.filter((month) => month.status !== "nominating")
		.map((month) => ({
			...month,
			winners: month.status === "voting" ? [] : (winnersByMonth.get(month.id) ?? []),
		}));

	return { months };
}

const styles = stylex.create({
	page: {
		marginInline: "auto",
		marginTop: 32,
		maxWidth: "80rem",
		paddingInline: { default: 8, [media.sm]: 16, [media.lg]: 24 },
	},
	year: {
		marginBottom: 40,
	},
	yearRule: {
		marginBottom: 24,
		position: "relative",
	},
	ruleLine: {
		alignItems: "center",
		display: "flex",
		inset: 0,
		position: "absolute",
	},
	rule: {
		borderTopColor: color.surfaceRaised,
		borderTopWidth: 1,
		width: "100%",
	},
	yearLabelRow: {
		display: "flex",
		justifyContent: "center",
		position: "relative",
	},
	yearLabel: {
		alignItems: "center",
		backgroundColor: color.canvas,
		color: "oklch(87.1% 0.006 286.286)",
		display: "flex",
		fontSize: "1.25rem",
		fontWeight: 600,
		gap: 6,
		lineHeight: 1.4,
		paddingInline: 16,
	},
	yearIcon: {
		color: color.muted,
		height: 20,
		width: 20,
	},
	grid: {
		display: "grid",
		gap: 16,
		gridTemplateColumns: {
			default: null,
			[media.sm]: "repeat(2, minmax(0, 1fr))",
			[media.lg]: "repeat(3, minmax(0, 1fr))",
			[media.xl]: "repeat(4, minmax(0, 1fr))",
		},
	},
	monthLink: {
		borderRadius: radius.lg,
		display: "block",
		outlineStyle: { default: null, ":focus-visible": "none" },
		boxShadow: {
			default: null,
			":focus-visible":
				"0 0 0 2px oklch(21% 0.006 285.885), 0 0 0 4px oklch(62.3% 0.214 259.815 / 0.7)",
		},
		transform: { default: null, ":hover": "scale(1.02)" },
		transitionDuration: "0.2s",
		transitionProperty: "all",
		transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
	},
	card: {
		backdropFilter: "blur(8px)",
		backgroundColor: "oklch(21% 0.006 285.885 / 0.6)",
		borderColor: { default: color.surface, ":hover": "oklch(62.3% 0.214 259.815 / 0.6)" },
		boxShadow: {
			default: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
			":hover":
				"0 10px 15px -3px oklch(62.3% 0.214 259.815 / 0.15), 0 4px 6px -4px oklch(62.3% 0.214 259.815 / 0.15)",
		},
		height: "100%",
		transitionDuration: "0.2s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
	},
	cardHeader: {
		paddingBottom: 12,
	},
	cardTitle: {
		color: color.heading,
		fontSize: "1.25rem",
		lineHeight: 1.4,
	},
	themeBadge: {
		backgroundColor: {
			default: "oklch(48.8% 0.243 264.376 / 0.3)",
			":hover": "oklch(48.8% 0.243 264.376 / 0.4)",
		},
		color: "oklch(80.9% 0.105 251.813)",
		width: "fit-content",
	},
	cardContent: {
		paddingTop: 0,
	},
	winnerList: {
		display: "flex",
		flexDirection: "column",
		gap: 12,
	},
	winner: {
		alignItems: "flex-start",
		display: "flex",
		gap: 12,
	},
	cover: {
		borderRadius: radius.base,
		boxShadow: {
			default: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
			[stylex.when.ancestor(":hover", monthTile)]:
				"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
		},
		height: 64,
		objectFit: "cover",
		transform: { default: null, [stylex.when.ancestor(":hover", monthTile)]: "scale(1.05)" },
		transitionDuration: "0.2s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		width: 48,
	},
	winnerKind: {
		alignItems: "center",
		display: "flex",
		fontSize: "0.75rem",
		fontWeight: 500,
		lineHeight: 1.3333,
		marginBottom: 2,
	},
	longKind: {
		color: color.link,
	},
	shortKind: {
		color: "oklch(76.5% 0.177 163.223)",
	},
	trophy: {
		height: 14,
		marginRight: 4,
		width: 14,
	},
	winnerName: {
		color: { default: color.body, [stylex.when.ancestor(":hover", monthTile)]: color.white },
		fontSize: "0.875rem",
		fontWeight: 500,
		lineHeight: 1.4286,
		transitionDuration: "0.2s",
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
});

export default function History({ loaderData }: Route.ComponentProps) {
	const { months } = loaderData;

	// Group months by year
	const monthsByYear = months.reduce(
		(acc, month) => {
			if (!acc[month.year]) {
				acc[month.year] = [];
			}
			acc[month.year].push(month);
			return acc;
		},
		{} as Record<number, Month[]>,
	);

	return (
		<div {...stylex.props(styles.page)}>
			{Object.entries(monthsByYear)
				.sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
				.map(([year, yearMonths]) => (
					<div key={year} {...stylex.props(styles.year)}>
						<div {...stylex.props(styles.yearRule)}>
							<div {...stylex.props(styles.ruleLine)} aria-hidden="true">
								<div {...stylex.props(styles.rule)} />
							</div>
							<div {...stylex.props(styles.yearLabelRow)}>
								<span {...stylex.props(styles.yearLabel)}>
									<CalendarDays {...stylex.props(styles.yearIcon)} />
									{year}
								</span>
							</div>
						</div>
						<div {...stylex.props(styles.grid)}>
							{yearMonths.map((month) => (
								<Link
									key={month.id}
									to={`/history/${month.id}`}
									prefetch="viewport"
									{...stylex.props(monthTile, styles.monthLink)}
								>
									<Card style={styles.card}>
										<CardHeader style={styles.cardHeader}>
											<CardTitle style={styles.cardTitle}>
												{new Date(month.year, month.month - 1).toLocaleString("default", {
													month: "long",
												})}
											</CardTitle>
											{month.theme && (
												<Badge variant="secondary" style={styles.themeBadge}>
													{month.theme.name}
												</Badge>
											)}
										</CardHeader>
										<CardContent style={styles.cardContent}>
											{month.winners && month.winners.length > 0 && month.status !== "voting" && (
												<div {...stylex.props(styles.winnerList)}>
													{month.winners
														.filter((w) => !w.short)
														.map((winner) => (
															<div key={winner.gameId} {...stylex.props(styles.winner)}>
																{winner.gameCover && (
																	<img
																		src={winner.gameCover.replace("/t_thumb/", "/t_cover_big/")}
																		alt={winner.gameName}
																		width={48}
																		height={64}
																		loading="lazy"
																		{...stylex.props(styles.cover)}
																	/>
																)}
																<div>
																	<div {...stylex.props(styles.winnerKind, styles.longKind)}>
																		<Trophy {...stylex.props(styles.trophy)} />
																		{categoryWinnerLabel(month.longLabel)}
																	</div>
																	<div {...stylex.props(styles.winnerName)}>{winner.gameName}</div>
																</div>
															</div>
														))}
													{month.winners
														.filter((w) => w.short)
														.map((winner) => (
															<div key={winner.gameId} {...stylex.props(styles.winner)}>
																{winner.gameCover && (
																	<img
																		src={winner.gameCover}
																		alt={winner.gameName}
																		width={48}
																		height={64}
																		loading="lazy"
																		{...stylex.props(styles.cover)}
																	/>
																)}
																<div>
																	<div {...stylex.props(styles.winnerKind, styles.shortKind)}>
																		<Trophy {...stylex.props(styles.trophy)} />
																		{categoryWinnerLabel(month.shortLabel)}
																	</div>
																	<div {...stylex.props(styles.winnerName)}>{winner.gameName}</div>
																</div>
															</div>
														))}
												</div>
											)}
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</div>
				))}
		</div>
	);
}
