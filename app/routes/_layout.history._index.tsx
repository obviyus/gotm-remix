import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { pool, getCurrentMonth } from "~/utils/database.server";
import type { RowDataPacket } from "mysql2";

interface Winner {
	game_id: string;
	game_name: string;
	game_cover: string | null;
	short: boolean;
}

interface Month {
	id: number;
	month: number;
	year: number;
	status: string;
	winners: Winner[];
	theme?: {
		name: string;
		description: string | null;
	};
}

export const loader = async () => {
	const currentMonth = await getCurrentMonth();

	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT m.id, m.month, m.year, m.status,
            t.name as theme_name, t.description as theme_description,
            COALESCE(
                JSON_ARRAYAGG(
                    CASE WHEN w.game_id IS NOT NULL THEN
                        JSON_OBJECT(
                            'game_id', w.game_id,
                            'game_name', w.game_name,
                            'game_cover', w.game_cover,
                            'short', w.short
                        )
                    END
                ),
                JSON_ARRAY()
            ) as winners
        FROM months m
        LEFT JOIN winners w ON m.id = w.month_id
        LEFT JOIN themes t ON m.theme_id = t.id
        WHERE m.status IN ('playing', 'over', 'voting')
        GROUP BY m.id, m.month, m.year, m.status, t.name, t.description
        ORDER BY m.year DESC, m.month DESC;`
	);

	const months = rows.map(row => ({
		...row,
		winners: row.winners.filter(Boolean),
		theme: row.theme_name ? {
			name: row.theme_name,
			description: row.theme_description
		} : undefined
	})) as Month[];

	return { months };
};

export default function History() {
	const { months } = useLoaderData<{ months: Month[] }>();

	// Group months by year
	const monthsByYear = months.reduce((acc, month) => {
		if (!acc[month.year]) {
			acc[month.year] = [];
		}
		acc[month.year].push(month);
		return acc;
	}, {} as Record<number, Month[]>);

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
												{new Date(month.year, month.month - 1).toLocaleString("default", {
													month: "long",
												})}
											</h2>
											{month.theme && (
												<div className="mb-4">
													<span className="px-3 py-1 rounded-full text-sm bg-blue-600 text-zinc-100 inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
														{month.theme.name}
													</span>
												</div>
											)}
											{month.winners && month.winners.length > 0 && (
												<div className="space-y-4">
													{month.winners.filter(w => !w.short).map(winner => (
														<div key={winner.game_id} className="flex items-start space-x-3">
															{winner.game_cover && (
																<img
																	src={winner.game_cover.replace(
																		"/t_thumb/",
																		"/t_cover_big/",
																	)}
																	alt={winner.game_name}
																	className="w-12 h-16 object-cover rounded-md group-hover:shadow-md transition-all duration-300"
																/>
															)}
															<div>
																<div className="text-xs font-medium text-blue-400 mb-1">Long Winner</div>
																<div className="text-sm font-medium text-zinc-200">{winner.game_name}</div>
															</div>
														</div>
													))}
													{month.winners.filter(w => w.short).map(winner => (
														<div key={winner.game_id} className="flex items-start space-x-3">
															{winner.game_cover && (
																<img
																	src={winner.game_cover}
																	alt={winner.game_name}
																	className="w-12 h-16 object-cover rounded-md group-hover:shadow-md transition-all duration-300"
																/>
															)}
															<div>
																<div className="text-xs font-medium text-emerald-400 mb-1">Short Winner</div>
																<div className="text-sm font-medium text-zinc-200">{winner.game_name}</div>
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
