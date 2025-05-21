import { Link, useFetcher, useNavigate, redirect } from "react-router";
import { useEffect, useState } from "react";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import PitchesModal from "~/components/PitchesModal";
import type { Nomination } from "~/types";
import { getNominationsForMonth } from "~/server/nomination.server";
import { getMonth, getThemeCategories } from "~/server/month.server";
import type { Row, Value } from "@libsql/client";
import type { Route } from "./+types";

interface ActionResponse {
	success?: boolean;
	error?: string;
}

interface DBRow extends Row {
	[key: string]: Value;
}

interface MonthRow extends DBRow {
	id: number;
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Check if user is a jury member
	const result = await db.execute({
		sql: "SELECT 1 FROM jury_members WHERE discord_id = ? AND is_admin = 1",
		args: [discordId],
	});

	if (result.rows.length === 0) {
		throw new Response("Unauthorized", { status: 403 });
	}

	// Get all months
	const monthsResult = await db.execute({
		sql: "SELECT id FROM months ORDER BY year DESC, month DESC",
		args: [],
	});

	const selectedMonthId = Number(params.monthId);
	const selectedMonth = await getMonth(selectedMonthId);

	if (!selectedMonth) {
		throw new Response("Month not found", { status: 404 });
	}

	// Get nominations for selected month
	const nominations = await getNominationsForMonth(selectedMonthId);

	return {
		months: await Promise.all(
			(monthsResult.rows as unknown as MonthRow[]).map(async (row) =>
				getMonth(row.id),
			),
		),
		selectedMonth,
		nominations,
		themeCategories: await getThemeCategories(),
	};
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	switch (intent) {
		case "createMonth": {
			const year = Number(formData.get("year"));
			const month = Number(formData.get("month"));
			const status = formData.get("status");
			const themeCategoryId = Number(formData.get("themeCategoryId"));
			const themeName = formData.get("themeName");
			const themeDescription = formData.get("themeDescription");

			if (
				!year ||
				!month ||
				!status ||
				!themeCategoryId ||
				!themeName ||
				typeof status !== "string" ||
				typeof themeName !== "string"
			) {
				return Response.json(
					{ error: "Missing required fields" },
					{ status: 400 },
				);
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(status)) {
					const activeMonthsResult = await db.execute({
						sql: `SELECT m.id, m.year, m.month, ms.status 
							  FROM months m 
							  JOIN month_status ms ON m.status_id = ms.id 
							  WHERE ms.status IN ('nominating', 'jury', 'voting')`,
						args: [],
					});

					if (activeMonthsResult.rows.length > 0) {
						return Response.json(
							{
								error:
									"Another month is already active. Only one month can be in nominating / jury / voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				// Get the status_id for the new status
				const statusResult = await db.execute({
					sql: "SELECT id FROM month_status WHERE status = ?",
					args: [status],
				});

				if (statusResult.rows.length === 0) {
					return Response.json(
						{ error: `Invalid status: ${status}` },
						{ status: 400 },
					);
				}

				const statusId = statusResult.rows[0].id;

				// Create theme first
				const themeResult = await db.execute({
					sql: "INSERT INTO themes (theme_category_id, name, description) VALUES (?, ?, ?) RETURNING id",
					args: [
						themeCategoryId,
						themeName,
						themeDescription?.toString() || null,
					],
				});

				const themeId = (themeResult.rows[0] as unknown as MonthRow).id;

				// Then create month with the new theme
				await db.execute({
					sql: "INSERT INTO months (year, month, status_id, theme_id) VALUES (?, ?, ?, ?)",
					args: [year, month, statusId, themeId],
				});

				return Response.json({ success: true });
			} catch (error) {
				// Check for unique constraint violation
				if (
					error instanceof Error &&
					error.message.includes("UNIQUE constraint failed")
				) {
					return Response.json(
						{ error: "This month already exists" },
						{ status: 400 },
					);
				}
				throw error;
			}
		}

		case "updateStatus": {
			const monthId = formData.get("monthId")?.toString();
			const newStatus = formData.get("status");

			if (!monthId || !newStatus || typeof newStatus !== "string") {
				return Response.json(
					{ error: "Missing required fields" },
					{ status: 400 },
				);
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(newStatus)) {
					const activeMonthsResult = await db.execute({
						sql: `SELECT m.id, m.year, m.month, ms.status 
							  FROM months m 
							  JOIN month_status ms ON m.status_id = ms.id 
							  WHERE ms.status IN ('nominating', 'jury', 'voting') AND m.id != ?`,
						args: [monthId],
					});

					if (activeMonthsResult.rows.length > 0) {
						return Response.json(
							{
								error:
									"Another month is already active. Only one month can be in nominating/jury/voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				// First get the status_id for the new status
				const statusResult = await db.execute({
					sql: "SELECT id FROM month_status WHERE status = ?",
					args: [newStatus],
				});

				if (statusResult.rows.length === 0) {
					return Response.json(
						{ error: `Invalid status: ${newStatus}` },
						{ status: 400 },
					);
				}

				const statusId = statusResult.rows[0].id;

				// Update the month with the new status_id
				await db.execute({
					sql: "UPDATE months SET status_id = ? WHERE id = ?",
					args: [statusId, monthId],
				});

				return Response.json({ success: true });
			} catch (error) {
				console.error("Error updating month status:", error);
				return Response.json(
					{ error: "Failed to update month status" },
					{ status: 500 },
				);
			}
		}

		case "toggleJurySelected": {
			const nominationId = formData.get("nominationId")?.toString();
			const selected = formData.get("selected") === "true";

			if (!nominationId) {
				return Response.json(
					{ error: "Missing nomination ID" },
					{ status: 400 },
				);
			}

			await db.execute({
				sql: "UPDATE nominations SET jury_selected = ? WHERE id = ?",
				args: [selected ? 1 : 0, nominationId],
			});

			return Response.json({ success: true });
		}

		default:
			return Response.json({ error: "Invalid action" }, { status: 400 });
	}
}

export default function Admin({ loaderData }: Route.ComponentProps) {
	const { months, selectedMonth, nominations, themeCategories } = loaderData;
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isPitchesModalOpen, setIsPitchesModalOpen] = useState(false);
	const navigate = useNavigate();
	const createMonthFetcher = useFetcher<ActionResponse>();
	const statusUpdateFetcher = useFetcher<ActionResponse>();
	const jurySelectionFetcher = useFetcher<ActionResponse>();
	const [error, setError] = useState<string | null>(null);
	const [csvCopied, setCsvCopied] = useState(false);

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

	const handleToggleJurySelected = (nomination: Nomination) => {
		jurySelectionFetcher.submit(
			{
				intent: "toggleJurySelected",
				nominationId: nomination.id.toString(),
				selected: (!nomination.jurySelected).toString(),
			},
			{ method: "POST" },
		);
	};

	// Function to determine if a nomination is being processed
	const isProcessingNomination = (nominationId: number) => {
		if (jurySelectionFetcher.state === "idle") return false;

		const formData = jurySelectionFetcher.formData;
		if (!formData) return false;

		return formData.get("nominationId") === nominationId.toString();
	};

	// Function to get the optimistic selection state
	const getNominationSelectedState = (nomination: Nomination) => {
		const isProcessing = isProcessingNomination(nomination.id);
		if (!isProcessing) return nomination.jurySelected;

		// Return the optimistic state
		return jurySelectionFetcher.formData?.get("selected") === "true";
	};

	const handleCopyAsCSV = () => {
		// Create CSV with tab delimiters for better compatibilty with Google Sheets
		const header = "Category\tGame Name\tSubmitted Pitches\n";
		let csvString = header;

		const escapeCSV = (text: string | null | undefined) => {
			if (text === null || text === undefined) return "";

			// Ensure text is a string and clean it - replace tabs and newlines
			const strText = String(text)
				.replace(/\t/g, " ") // Replace tabs with spaces
				.replace(/\n/g, " ") // Replace newlines with spaces
				.replace(/\r/g, " ") // Replace carriage returns with spaces
				.trim(); // Trim any leading/trailing whitespace

			// No need to escape quotes with tab-delimited format
			return strText;
		};

		const longGames = nominations.filter((n) => !n.short);
		const shortGames = nominations.filter((n) => n.short);

		if (longGames.length > 0) {
			csvString += "Long Games\t\t\n";
			for (const nomination of longGames) {
				if (nomination.pitches && nomination.pitches.length > 0) {
					for (const [index, pitch] of nomination.pitches.entries()) {
						if (index === 0) {
							csvString += `\t${escapeCSV(nomination.gameName)}\t${escapeCSV(pitch.pitch)}\n`;
						} else {
							csvString += `\t\t${escapeCSV(pitch.pitch)}\n`;
						}
					}
				} else {
					csvString += `\t${escapeCSV(nomination.gameName)}\t\n`;
				}
			}
		}

		if (shortGames.length > 0) {
			csvString += "Short Games\t\t\n";
			for (const nomination of shortGames) {
				if (nomination.pitches && nomination.pitches.length > 0) {
					for (const [index, pitch] of nomination.pitches.entries()) {
						if (index === 0) {
							csvString += `\t${escapeCSV(nomination.gameName)}\t${escapeCSV(pitch.pitch)}\n`;
						} else {
							csvString += `\t\t${escapeCSV(pitch.pitch)}\n`;
						}
					}
				} else {
					csvString += `\t${escapeCSV(nomination.gameName)}\t\n`;
				}
			}
		}

		navigator.clipboard.writeText(csvString).then(() => {
			setCsvCopied(true);
			setTimeout(() => setCsvCopied(false), 2000);
		});
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
					<div className="flex flex-col gap-4">
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
						</div>
						<div className="flex items-center gap-4">
							<div className="flex-1">
								<label
									htmlFor="themeCategory"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Theme Category
								</label>
								<select
									id="themeCategory"
									name="themeCategoryId"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								>
									<option value="">Select a category</option>
									{themeCategories.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>
							</div>
							<div className="flex-1">
								<label
									htmlFor="themeName"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Theme Name
								</label>
								<input
									type="text"
									id="themeName"
									name="themeName"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
									placeholder="Enter theme name"
								/>
							</div>
						</div>
						<div>
							<label
								htmlFor="themeDescription"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Theme Description
							</label>
							<textarea
								id="themeDescription"
								name="themeDescription"
								rows={3}
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								placeholder="Enter theme description (optional)"
							/>
						</div>
						<div className="flex justify-end">
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
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-2xl font-semibold text-zinc-200">
							Jury Selection
						</h2>
						<button
							type="button"
							onClick={handleCopyAsCSV}
							className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-zinc-200 shadow-sm shadow-zinc-500/20 border border-zinc-400/20 hover:bg-zinc-500/10 hover:border-zinc-400/30 hover:shadow-zinc-500/40 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-400/5 after:transition-colors"
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
								{csvCopied ? "Copied!" : "Copy as CSV"}
							</span>
						</button>
					</div>

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
													{nomination.gameCover && (
														<img
															src={nomination.gameCover}
															alt=""
															className="h-10 w-10 object-cover rounded-sm mr-3 border border-white/10"
														/>
													)}
													<div className="text-sm font-medium text-zinc-200">
														{nomination.gameName}
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
												{nomination.gameYear}
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
													onClick={() => {
														setSelectedNomination(nomination);
														setIsPitchesModalOpen(true);
													}}
													className="text-zinc-400 hover:text-zinc-200 transition-colors"
												>
													View Pitches (
													{
														(
															nominations.find((n) => n.id === nomination.id)
																?.pitches || []
														).length
													}
													)
												</button>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<button
													type="button"
													onClick={() => handleToggleJurySelected(nomination)}
													disabled={isProcessingNomination(nomination.id)}
													className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
														isProcessingNomination(nomination.id)
															? "opacity-70 border-yellow-400/30"
															: ""
													} ${
														getNominationSelectedState(nomination)
															? "bg-blue-500"
															: "bg-zinc-700"
													}`}
												>
													<span
														className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
															getNominationSelectedState(nomination)
																? "translate-x-5"
																: "translate-x-0"
														}`}
													>
														{isProcessingNomination(nomination.id) && (
															<span className="absolute inset-0 flex items-center justify-center">
																<span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
															</span>
														)}
													</span>
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			)}

			<PitchesModal
				isOpen={isPitchesModalOpen}
				onClose={() => {
					setIsPitchesModalOpen(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}
