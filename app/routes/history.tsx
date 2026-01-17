import React from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/server/database.server";
import { getMonth } from "~/server/month.server";
import { getWinner } from "~/server/winner.server";
import type { Month, Theme } from "~/types";
import type { Route } from "./+types/history";

export async function loader() {
	const result = await db.execute(
		`SELECT id FROM months WHERE status_id NOT IN (
			SELECT id FROM month_status WHERE status = 'nominating'
		) ORDER BY id DESC;`,
	);

	const months: Month[] = await Promise.all(
		result.rows.map(async (row) => {
			try {
				const month = await getMonth(row.id as number);

				// Only fetch winners for months that have completed voting
				if (month.status === "voting") {
					return month;
				}

				try {
					const [longWinner, shortWinner] = await Promise.all([
						getWinner(month.id, false),
						getWinner(month.id, true),
					]);

					if (!longWinner && !shortWinner) {
						return month;
					}

					return {
						...month,
						winners: [
							...(longWinner ? [longWinner] : []),
							...(shortWinner ? [shortWinner] : []),
						],
					};
				} catch (winnerError) {
					console.error(
						`Error fetching winners for month ${month.id}:`,
						winnerError,
					);
					return month;
				}
			} catch (monthError) {
				console.error(`Error fetching month ${row.id}:`, monthError);
				return {
					id: row.id as number,
					month: 0,
					year: 0,
					status: "complete" as const,
					winners: [],
					theme: null as unknown as Theme,
				} as Month;
			}
		}),
	);

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
							<div
								className="absolute inset-0 flex items-center"
								aria-hidden="true"
							>
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
									className="group block transition-all duration-200 ease-in-out hover:scale-[1.02] focus:outline-none"
								>
									<Card className="h-full border-zinc-800 bg-zinc-900/60 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/15 hover:border-blue-500/60 backdrop-blur-sm">
										<CardHeader className="pb-3">
											<CardTitle className="text-xl text-zinc-100">
												{new Date(month.year, month.month - 1).toLocaleString(
													"default",
													{
														month: "long",
													},
												)}
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
											{month.winners &&
												month.winners.length > 0 &&
												month.status !== "voting" && (
													<div className="space-y-3">
														{month.winners
															.filter((w) => !w.short)
															.map((winner) => (
																<div
																	key={winner.gameId}
																	className="flex items-start space-x-3"
																>
																	{winner.gameCover && (
																		<img
																			src={winner.gameCover.replace(
																				"/t_thumb/",
																				"/t_cover_big/",
																			)}
																			alt={winner.gameName}
																			className="w-12 h-16 object-cover rounded shadow-sm group-hover:shadow-md transition-all duration-200 transform group-hover:scale-105"
																		/>
																	)}
																	<div>
																		<div className="flex items-center text-xs font-medium text-blue-400 mb-0.5">
																			<Trophy className="h-3.5 w-3.5 mr-1" />
																			Long Winner
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
																<div
																	key={winner.gameId}
																	className="flex items-start space-x-3"
																>
																	{winner.gameCover && (
																		<img
																			src={winner.gameCover}
																			alt={winner.gameName}
																			className="w-12 h-16 object-cover rounded shadow-sm group-hover:shadow-md transition-all duration-200 transform group-hover:scale-105"
																		/>
																	)}
																	<div>
																		<div className="flex items-center text-xs font-medium text-emerald-400 mb-0.5">
																			<Trophy className="h-3.5 w-3.5 mr-1" />
																			Short Winner
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
