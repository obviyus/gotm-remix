import { Link } from "react-router";
import { db } from "~/server/database.server";
import type { Month } from "~/types";
import { getMonth } from "~/server/month.server";
import { getWinner } from "~/server/winner.server";
import type { Route } from "./+types";
import { CalendarDaysIcon, TrophyIcon } from "@heroicons/react/24/outline";

export async function loader() {
	const result = await db.execute(
		`SELECT id FROM months WHERE status_id NOT IN (
			SELECT id FROM month_status WHERE status = 'nominating'
		) ORDER BY id DESC;`,
	);

	const months: Month[] = await Promise.all(
		result.rows.map(async (row) => {
			const month = await getMonth(row.id as number);

			// Only fetch winners for months that have completed voting
			if (month.status === "voting") {
				return month;
			}

			const longWinner = await getWinner(month.id, false);
			const shortWinner = await getWinner(month.id, true);

			if (!longWinner || !shortWinner) {
				return month;
			}

			return {
				...month,
				winners: [longWinner, shortWinner],
			};
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
								<span className="bg-zinc-900 px-2 text-xl font-semibold text-zinc-300 flex items-center gap-1.5">
									<CalendarDaysIcon className="h-5 w-5 text-zinc-400" />
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
									className="group block overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/60 shadow-sm backdrop-blur-sm transition-all duration-200 ease-in-out hover:shadow-lg hover:shadow-blue-500/15 hover:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
								>
									<div className="p-4">
										<h2 className="text-xl font-semibold text-zinc-100 mb-3">
											{new Date(month.year, month.month - 1).toLocaleString(
												"default",
												{
													month: "long",
												},
											)}
										</h2>
										{month.theme && (
											<div className="mb-4 flex items-center gap-1.5">
												<span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-700/30 text-blue-300 inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
													{month.theme.name}
												</span>
											</div>
										)}
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
																	<div className="flex items-center text-2xs font-medium text-blue-400 mb-0.5">
																		<TrophyIcon className="h-3.5 w-3.5 mr-1" />
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
																	<div className="flex items-center text-2xs font-medium text-emerald-400 mb-0.5">
																		<TrophyIcon className="h-3.5 w-3.5 mr-1" />
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
									</div>
								</Link>
							))}
						</div>
					</div>
				))}
		</div>
	);
}
