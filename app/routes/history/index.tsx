import { Link } from "react-router";
import { db } from "~/server/database.server";
import type { Month } from "~/types";
import { getMonth } from "~/server/month.server";
import { getWinner } from "~/server/winner.server";
import type { Route } from "./+types";

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
		<div className="mx-auto max-w-7xl mt-6 px-4 sm:px-6 lg:px-8">
			{Object.entries(monthsByYear)
				.sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
				.map(([year, yearMonths]) => (
					<div key={year}>
						<div className="mb-12">
							<div className="flex items-center gap-4 mb-8">
								<div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
								<h2 className="text-3xl font-bold text-zinc-100">{year}</h2>
								<div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
							</div>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{yearMonths.map((month) => (
									<Link
										key={month.id}
										to={`/history/${month.id}`}
										prefetch="viewport"
										className="group block overflow-hidden rounded-xl border transition-all duration-300 ease-out
                                            bg-zinc-900/50 border-zinc-800 backdrop-blur-sm
                                            hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
									>
										<div className="p-5">
											<h2 className="text-2xl font-semibold text-zinc-100 mb-4">
												{new Date(month.year, month.month - 1).toLocaleString(
													"default",
													{
														month: "long",
													},
												)}
											</h2>
											{month.theme && (
												<div className="mb-4">
													<span className="px-3 py-1 rounded-full text-sm bg-blue-600 text-zinc-100 inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
														{month.theme.name}
													</span>
												</div>
											)}
											{/* Only show winners if voting is completed (not in voting stage) */}
											{month.winners &&
												month.winners.length > 0 &&
												month.status !== "voting" && (
													<div className="space-y-4">
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
																			className="w-12 h-16 object-cover rounded-md group-hover:shadow-md transition-all duration-300"
																		/>
																	)}
																	<div>
																		<div className="text-xs font-medium text-blue-400 mb-1">
																			Long Winner
																		</div>
																		<div className="text-sm font-medium text-zinc-200">
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
																			className="w-12 h-16 object-cover rounded-md group-hover:shadow-md transition-all duration-300"
																		/>
																	)}
																	<div>
																		<div className="text-xs font-medium text-emerald-400 mb-1">
																			Short Winner
																		</div>
																		<div className="text-sm font-medium text-zinc-200">
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
					</div>
				))}
		</div>
	);
}
