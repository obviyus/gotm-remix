import {
	useLoaderData,
	Link,
	Form,
	useNavigate,
	useFetcher,
} from "@remix-run/react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState, useEffect } from "react";
import {
	json,
	redirect,
	type ActionFunction,
	type LoaderFunction,
	type ActionFunctionArgs,
} from "@remix-run/node";
import { pool } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { RowDataPacket } from "mysql2";
import { ClipboardDocumentIcon } from "@heroicons/react/20/solid";

interface Month extends RowDataPacket {
	id: number;
	year: number;
	month: number;
	status: "ready" | "nominating" | "jury" | "voting" | "playing" | "over";
}

interface Nomination extends RowDataPacket {
	id: number;
	game_name: string;
	game_cover: string | null;
	game_year: string | null;
	short: boolean;
	jury_selected: boolean;
}

interface Pitch extends RowDataPacket {
	id: number;
	nomination_id: number;
	discord_id: string;
	pitch: string;
}

interface LoaderData {
	months: Month[];
	selectedMonth: Month | null;
	nominations: Nomination[];
	pitches: Record<number, Pitch[]>;
}

interface ActionResponse {
	success?: boolean;
	error?: string;
}

export const loader: LoaderFunction = async ({ request, params }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Check if user is a jury member
	const [juryRows] = await pool.execute<RowDataPacket[]>(
		"SELECT id FROM jury_members WHERE discord_id = ? AND active = 1",
		[discordId],
	);

	if (juryRows.length === 0) {
		throw new Response("Unauthorized", { status: 403 });
	}

	// Get all months
	const [monthRows] = await pool.execute<Month[]>(
		"SELECT id, year, month, status FROM months ORDER BY year DESC, month DESC",
	);

	const selectedMonthId = Number(params.monthId);
	const selectedMonth = monthRows.find((m) => m.id === selectedMonthId) ?? null;

	if (!selectedMonth) {
		throw new Response("Month not found", { status: 404 });
	}

	// Get nominations for selected month
	let nominations: Nomination[] = [];
	let pitches: Record<number, Pitch[]> = {};

	const [nominationRows] = await pool.execute<Nomination[]>(
		`SELECT id, game_name, game_cover, game_year, short, jury_selected 
		 FROM nominations 
		 WHERE month_id = ? 
		 ORDER BY short, game_name`,
		[selectedMonth.id],
	);
	nominations = nominationRows;

	if (nominations.length > 0) {
		const [pitchRows] = await pool.execute<Pitch[]>(
			`SELECT id, nomination_id, discord_id, pitch 
			FROM pitches 
			WHERE nomination_id IN (${nominations.map(() => "?").join(",")})`,
			nominations.map((n) => n.id),
		);

		// Group pitches by nomination_id
		pitches = pitchRows.reduce(
			(acc, row) => {
				if (!acc[row.nomination_id]) {
					acc[row.nomination_id] = [];
				}
				acc[row.nomination_id].push(row);
				return acc;
			},
			{} as Record<number, Pitch[]>,
		);
	}

	return json<LoaderData>({
		months: monthRows,
		selectedMonth,
		nominations,
		pitches,
	});
};

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	switch (intent) {
		case "createMonth": {
			const year = Number(formData.get("year"));
			const month = Number(formData.get("month"));
			const status = formData.get("status") as string;

			if (!year || !month || !status) {
				return json({ error: "Missing required fields" }, { status: 400 });
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(status)) {
					const [activeMonths] = await pool.execute<RowDataPacket[]>(
						`SELECT id, year, month, status 
						 FROM months 
						 WHERE status IN ('nominating', 'jury', 'voting')`,
					);

					if (activeMonths.length > 0) {
						return json(
							{
								error:
									"Another month is already active. Only one month can be in nominating/jury/voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				await pool.execute(
					"INSERT INTO months (year, month, status) VALUES (?, ?, ?)",
					[year, month, status],
				);

				return json({ success: true });
			} catch (error) {
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					error.code === "ER_DUP_ENTRY"
				) {
					return json({ error: "This month already exists" }, { status: 400 });
				}
				throw error;
			}
		}

		case "updateStatus": {
			const monthId = formData.get("monthId");
			const newStatus = formData.get("status") as string;

			if (!monthId || !newStatus) {
				return json({ error: "Missing required fields" }, { status: 400 });
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(newStatus)) {
					const [activeMonths] = await pool.execute<RowDataPacket[]>(
						`SELECT id, year, month, status 
						 FROM months 
						 WHERE status IN ('nominating', 'jury', 'voting')
						 AND id != ?`,
						[monthId],
					);

					if (activeMonths.length > 0) {
						return json(
							{
								error:
									"Another month is already active. Only one month can be in nominating/jury/voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				await pool.execute("UPDATE months SET status = ? WHERE id = ?", [
					newStatus,
					monthId,
				]);

				return json({ success: true });
			} catch (error) {
				console.error("Error updating month status:", error);
				return json(
					{ error: "Failed to update month status" },
					{ status: 500 },
				);
			}
		}

		case "toggleJurySelected": {
			const nominationId = formData.get("nominationId");
			const selected = formData.get("selected") === "true";

			if (!nominationId) {
				return json({ error: "Missing nomination ID" }, { status: 400 });
			}

			await pool.execute(
				"UPDATE nominations SET jury_selected = ? WHERE id = ?",
				[selected, nominationId],
			);

			return json({ success: true });
		}

		default:
			return json({ error: "Invalid action" }, { status: 400 });
	}
}

export default function Admin() {
	const { months, selectedMonth, nominations, pitches } =
		useLoaderData<LoaderData>();
	const [selectedNominationId, setSelectedNominationId] = useState<
		number | null
	>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const navigate = useNavigate();
	const createMonthFetcher = useFetcher<ActionResponse>();
	const statusUpdateFetcher = useFetcher<ActionResponse>();
	const [error, setError] = useState<string | null>(null);

	// Clear error when submission is successful
	useEffect(() => {
		if (
			createMonthFetcher.state === "idle" &&
			createMonthFetcher.data?.success
		) {
			setError(null);
			navigate(".", { replace: true });
		} else if (createMonthFetcher.data?.error) {
			setError(createMonthFetcher.data.error);
		}
	}, [createMonthFetcher.state, createMonthFetcher.data, navigate]);

	const copyToClipboard = async (discordId: string) => {
		await navigator.clipboard.writeText(discordId);
		setCopiedId(discordId);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const monthStatuses = [
		"ready",
		"nominating",
		"jury",
		"voting",
		"playing",
		"over",
	] as const;

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			{/* Month Navigation */}
			{selectedMonth && (
				<div className="flex justify-between items-center mb-8">
					<Link
						to={`/admin/${months[months.findIndex((m) => m.id === selectedMonth.id) + 1]?.id}`}
						className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
							months.findIndex((m) => m.id === selectedMonth.id) ===
							months.length - 1
								? "pointer-events-none opacity-50"
								: "text-zinc-200 shadow-sm shadow-zinc-500/20 border border-zinc-400/20 hover:bg-zinc-500/10 hover:border-zinc-400/30 hover:shadow-zinc-500/40 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-400/5 after:transition-colors"
						}`}
					>
						<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
							← Previous Month
						</span>
					</Link>

					<h1 className="text-2xl font-bold flex items-center gap-2 text-zinc-200">
						{new Date(
							selectedMonth.year,
							selectedMonth.month - 1,
						).toLocaleString("default", { month: "long", year: "numeric" })}
						{["nominating", "jury", "voting"].includes(
							selectedMonth.status,
						) && (
							<span className="inline-flex items-center p-2 px-4 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
								Active Month
							</span>
						)}
					</h1>

					<Link
						to={`/admin/${months[months.findIndex((m) => m.id === selectedMonth.id) - 1]?.id}`}
						className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
							months.findIndex((m) => m.id === selectedMonth.id) === 0
								? "pointer-events-none opacity-50"
								: "text-zinc-200 shadow-sm shadow-zinc-500/20 border border-zinc-400/20 hover:bg-zinc-500/10 hover:border-zinc-400/30 hover:shadow-zinc-500/40 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-400/5 after:transition-colors"
						}`}
					>
						<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
							Next Month →
						</span>
					</Link>
				</div>
			)}

			{/* Create New Month Section */}
			<section className="mb-12">
				<h2 className="text-2xl font-semibold mb-4 text-zinc-200">
					Create New Month
				</h2>
				<createMonthFetcher.Form method="POST">
					<input type="hidden" name="intent" value="createMonth" />
					<div className="flex items-center gap-4">
						<div className="flex-1">
							<label
								htmlFor="year"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Year
							</label>
							<input
								type="number"
								id="year"
								name="year"
								min="2000"
								max="2100"
								required
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
							/>
						</div>
						<div className="flex-1">
							<label
								htmlFor="month"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Month (1-12)
							</label>
							<input
								type="number"
								id="month"
								name="month"
								min="1"
								max="12"
								required
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
							/>
						</div>
						<div className="flex-1">
							<label
								htmlFor="status"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Initial Status
							</label>
							<select
								id="status"
								name="status"
								required
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
							>
								{monthStatuses.map((status) => (
									<option key={status} value={status} className="py-1">
										{status.charAt(0).toUpperCase() + status.slice(1)}
									</option>
								))}
							</select>
						</div>
						<button
							type="submit"
							disabled={createMonthFetcher.state !== "idle"}
							className={`self-end inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
								createMonthFetcher.state !== "idle"
									? "opacity-50 cursor-not-allowed"
									: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
							}`}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
								{createMonthFetcher.state !== "idle"
									? "Creating..."
									: "Create Month"}
							</span>
						</button>
					</div>
					{error && <p className="mt-2 text-sm text-red-400">{error}</p>}
				</createMonthFetcher.Form>
			</section>

			{/* Month Status Section */}
			<section className="mb-12">
				<h2 className="text-2xl font-semibold mb-4 text-zinc-200">
					Month Status
				</h2>
				{selectedMonth && (
					<>
						<statusUpdateFetcher.Form
							method="POST"
							className="flex items-end gap-4"
						>
							<input type="hidden" name="monthId" value={selectedMonth.id} />
							<input type="hidden" name="intent" value="updateStatus" />
							<div className="flex-1">
								<label
									htmlFor="status"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Status for{" "}
									{new Date(
										selectedMonth.year,
										selectedMonth.month - 1,
									).toLocaleString("default", {
										month: "long",
										year: "numeric",
									})}
								</label>
								<select
									id="status"
									name="status"
									value={selectedMonth.status}
									onChange={(e) => {
										const form = e.target.form;
										if (form) {
											form.requestSubmit();
										}
									}}
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								>
									{monthStatuses.map((status) => (
										<option key={status} value={status} className="py-1">
											{status.charAt(0).toUpperCase() + status.slice(1)}
										</option>
									))}
								</select>
							</div>
						</statusUpdateFetcher.Form>
						{statusUpdateFetcher.data?.error && (
							<p className="mt-2 text-sm text-red-400">
								{statusUpdateFetcher.data.error}
							</p>
						)}
					</>
				)}
			</section>

			{/* Jury Selection Section */}
			{selectedMonth && nominations.length > 0 && (
				<section>
					<h2 className="text-2xl font-semibold mb-4">Jury Selection</h2>
					<div className="bg-black/10 backdrop-blur-sm rounded-lg shadow overflow-hidden border border-white/10">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-white/10">
								<thead>
									<tr>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Game
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Year
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Type
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Pitches
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Selected
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/10">
									{nominations.map((nomination) => (
										<tr
											key={nomination.id}
											className="hover:bg-white/5 transition-colors"
										>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex items-center">
													{nomination.game_cover && (
														<img
															src={nomination.game_cover}
															alt=""
															className="h-10 w-10 object-cover rounded-sm mr-3 border border-white/10"
														/>
													)}
													<div className="text-sm font-medium text-zinc-200">
														{nomination.game_name}
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
												{nomination.game_year}
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<span
													className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
														nomination.short
															? "bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20"
															: "bg-blue-400/10 text-blue-400 ring-1 ring-inset ring-blue-400/20"
													}`}
												>
													{nomination.short ? "Short" : "Long"}
												</span>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm">
												<button
													type="button"
													onClick={() => setSelectedNominationId(nomination.id)}
													className="text-zinc-400 hover:text-zinc-200 transition-colors"
												>
													View Pitches ({pitches[nomination.id]?.length || 0})
												</button>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<form method="POST">
													<input
														type="hidden"
														name="intent"
														value="toggleJurySelected"
													/>
													<input
														type="hidden"
														name="nominationId"
														value={nomination.id}
													/>
													<input
														type="hidden"
														name="selected"
														value={(!nomination.jury_selected).toString()}
													/>
													<button
														type="submit"
														className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
															nomination.jury_selected
																? "bg-blue-500"
																: "bg-zinc-700"
														}`}
													>
														<span
															className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
																nomination.jury_selected
																	? "translate-x-5"
																	: "translate-x-0"
															}`}
														/>
													</button>
												</form>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			)}

			{/* Pitches Dialog */}
			<Dialog
				open={selectedNominationId !== null}
				onClose={() => setSelectedNominationId(null)}
				className="relative z-50"
			>
				<div
					className="fixed inset-0 bg-black/80 backdrop-blur-sm"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="mx-auto max-w-2xl w-full rounded-xl bg-zinc-900 border border-white/10 p-6 shadow-2xl">
						<DialogTitle className="text-lg font-medium mb-4 text-zinc-200">
							Pitches for{" "}
							{
								nominations.find((n) => n.id === selectedNominationId)
									?.game_name
							}
						</DialogTitle>
						<div className="space-y-4 max-h-[60vh] overflow-y-auto">
							{selectedNominationId &&
								pitches[selectedNominationId]?.map((pitch) => (
									<div
										key={pitch.id}
										className="border border-white/10 rounded-lg p-4 bg-black/20"
									>
										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-2 text-sm text-zinc-400">
												<span>From: {pitch.discord_id}</span>
												<button
													type="button"
													onClick={() => copyToClipboard(pitch.discord_id)}
													className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-white/5 transition-colors"
													title="Copy Discord ID"
												>
													<ClipboardDocumentIcon className="h-4 w-4" />
													{copiedId === pitch.discord_id && (
														<span className="absolute bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded -mt-8 -ml-4 border border-white/10">
															Copied!
														</span>
													)}
												</button>
											</div>
										</div>
										<div className="text-zinc-300 whitespace-pre-wrap">
											{pitch.pitch}
										</div>
									</div>
								))}
							{selectedNominationId &&
								(!pitches[selectedNominationId] ||
									pitches[selectedNominationId].length === 0) && (
									<p className="text-zinc-400 text-center py-4">
										No pitches available
									</p>
								)}
						</div>
						<div className="mt-6 flex justify-end">
							<button
								type="button"
								className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-zinc-200 shadow-sm shadow-zinc-500/20 border border-zinc-400/20 hover:bg-zinc-500/10 hover:border-zinc-400/30 hover:shadow-zinc-500/40 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-400/5 after:transition-colors"
								onClick={() => setSelectedNominationId(null)}
							>
								<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
									Close
								</span>
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</div>
	);
}
