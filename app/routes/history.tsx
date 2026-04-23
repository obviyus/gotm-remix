import React from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/server/database.server";
import { getMonths } from "~/server/month.server";
import type { Month, Nomination } from "~/types";
import { categoryWinnerLabel } from "~/utils/categoryLabels";
import type { Route } from "./+types/history";

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
		<div className="mx-auto max-w-7xl mt-8 px-2 sm:px-4 lg:px-6">
			{Object.entries(monthsByYear)
				.sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
				.map(([year, yearMonths]) => (
					<div key={year} className="mb-10">
						<div className="relative mb-6">
							<div className="absolute inset-0 flex items-center" aria-hidden="true">
								<div className="w-full border-t border-zinc-700" />
							</div>
							<div className="relative flex justify-center">
								<span className="bg-zinc-900 px-4 text-xl font-semibold text-zinc-300 flex items-center gap-1.5">
									<CalendarDays className="h-5 w-5 text-zinc-400" />
									{year}
								</span>
							</div>
						</div>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{yearMonths.map((month) => (
								<Link
									key={month.id}
									to={`/history/${month.id}`}
									prefetch="viewport"
									className="group block transition-all duration-200 ease-in-out hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-lg"
								>
									<Card className="h-full border-zinc-800 bg-zinc-900/60 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/15 hover:border-blue-500/60 backdrop-blur-sm">
										<CardHeader className="pb-3">
											<CardTitle className="text-xl text-zinc-100">
												{new Date(month.year, month.month - 1).toLocaleString("default", {
													month: "long",
												})}
											</CardTitle>
											{month.theme && (
												<Badge
													variant="secondary"
													className="w-fit bg-blue-700/30 text-blue-300 hover:bg-blue-700/40"
												>
													{month.theme.name}
												</Badge>
											)}
										</CardHeader>
										<CardContent className="pt-0">
											{month.winners && month.winners.length > 0 && month.status !== "voting" && (
												<div className="space-y-3">
													{month.winners
														.filter((w) => !w.short)
														.map((winner) => (
															<div key={winner.gameId} className="flex items-start space-x-3">
																{winner.gameCover && (
																	<img
																		src={winner.gameCover.replace("/t_thumb/", "/t_cover_big/")}
																		alt={winner.gameName}
																		width={48}
																		height={64}
																		loading="lazy"
																		className="w-12 h-16 object-cover rounded shadow-sm group-hover:shadow-md transition-all duration-200 transform group-hover:scale-105"
																	/>
																)}
																<div>
																	<div className="flex items-center text-xs font-medium text-blue-400 mb-0.5">
																		<Trophy className="h-3.5 w-3.5 mr-1" />
																		{categoryWinnerLabel(month.longLabel)}
																	</div>
																	<div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors duration-200">
																		{winner.gameName}
																	</div>
																</div>
															</div>
														))}
													{month.winners
														.filter((w) => w.short)
														.map((winner) => (
															<div key={winner.gameId} className="flex items-start space-x-3">
																{winner.gameCover && (
																	<img
																		src={winner.gameCover}
																		alt={winner.gameName}
																		width={48}
																		height={64}
																		loading="lazy"
																		className="w-12 h-16 object-cover rounded shadow-sm group-hover:shadow-md transition-all duration-200 transform group-hover:scale-105"
																	/>
																)}
																<div>
																	<div className="flex items-center text-xs font-medium text-emerald-400 mb-0.5">
																		<Trophy className="h-3.5 w-3.5 mr-1" />
																		{categoryWinnerLabel(month.shortLabel)}
																	</div>
																	<div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors duration-200">
																		{winner.gameName}
																	</div>
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
