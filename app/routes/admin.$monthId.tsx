import { Link, useFetcher, useNavigate, redirect } from "react-router";
import { useEffect, useState } from "react";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import PitchesModal from "~/components/PitchesModal";
import type { Nomination } from "~/types";
import { getNominationsForMonth } from "~/server/nomination.server";
import { getMonth, getThemeCategories } from "~/server/month.server";
import type { Row, Value } from "@libsql/client";
import type { Route } from "./+types/admin.$monthId";

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
	const [showCreateForm, setShowCreateForm] = useState(false);

	// Clear error when submission is successful
	useEffect(() => {
		if (
			createMonthFetcher.state === "idle" &&
			createMonthFetcher.data?.success
		) {
			setError(null);
			setShowCreateForm(false);
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

			// Ensure text is a string and clean it - replace tabs only
			const strText = String(text)
				.replace(/\t/g, " ")
				.replace(/\r/g, " ")
				.trim();

			return strText;
		};

		const longGames = nominations.filter((n) => !n.short);
		const shortGames = nominations.filter((n) => n.short);

		if (longGames.length > 0) {
			csvString += "Long Games\t\t\n";
			for (const nomination of longGames) {
				if (nomination.pitches && nomination.pitches.length > 0) {
					// Combine all pitches into a single cell with line breaks
					const combinedPitches = nomination.pitches
						.map((pitch) => escapeCSV(pitch.pitch))
						.join("\n");
					csvString += `\t${escapeCSV(nomination.gameName)}\t"${combinedPitches}"\n`;
				} else {
					csvString += `\t${escapeCSV(nomination.gameName)}\t\n`;
				}
			}
		}

		if (shortGames.length > 0) {
			csvString += "Short Games\t\t\n";
			for (const nomination of shortGames) {
				if (nomination.pitches && nomination.pitches.length > 0) {
					// Combine all pitches into a single cell with line breaks
					const combinedPitches = nomination.pitches
						.map((pitch) => escapeCSV(pitch.pitch))
						.join("\n");
					csvString += `\t${escapeCSV(nomination.gameName)}\t"${combinedPitches}"\n`;
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
			{/* Header with Month Navigation and Status */}
			{selectedMonth && (
				<div className="mb-8">
					<div className="flex flex-col sm:flex-row justify-between items-center gap-4">
						{/* Month title and status */}
						<div className="flex flex-col sm:flex-row sm:items-center gap-3">
							<h1 className="text-2xl font-bold text-zinc-200">
								{new Date(
									selectedMonth.year,
									selectedMonth.month - 1,
								).toLocaleString("default", { month: "long", year: "numeric" })}
							</h1>

							{["nominating", "jury", "voting"].includes(
								selectedMonth.status,
							) && (
								<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
									Active Month
								</span>
							)}
						</div>

						{/* Quick status update */}
						<statusUpdateFetcher.Form
							method="POST"
							className="flex items-center gap-2 w-full sm:w-auto"
						>
							<input type="hidden" name="monthId" value={selectedMonth.id} />
							<input type="hidden" name="intent" value="updateStatus" />
							<label
								htmlFor="status"
								className="text-sm font-medium text-zinc-400 sr-only sm:not-sr-only"
							>
								Status:
							</label>
							<select
								id="status"
								name="status"
								value={selectedMonth.status}
								onChange={(e) => e.target.form?.requestSubmit()}
								className="w-full sm:w-auto rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
							>
								{monthStatuses.map((status) => (
									<option key={status} value={status} className="py-1">
										{status.charAt(0).toUpperCase() + status.slice(1)}
									</option>
								))}
							</select>
							{statusUpdateFetcher.state !== "idle" && (
								<span className="text-xs text-zinc-400">Updating...</span>
							)}
						</statusUpdateFetcher.Form>
					</div>

					{/* Month Navigation */}
					<div className="flex items-center justify-between mt-4">
						<Link
							to={`/admin/${months[months.findIndex((m) => m.id === selectedMonth.id) + 1]?.id}`}
							prefetch="viewport"
							className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg ${
								months.findIndex((m) => m.id === selectedMonth.id) ===
								months.length - 1
									? "pointer-events-none opacity-50"
									: "text-zinc-200 shadow-sm border border-zinc-400/20 hover:bg-zinc-500/10"
							}`}
						>
							← Previous Month
						</Link>

						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setShowCreateForm(!showCreateForm)}
								className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/10"
							>
								{showCreateForm ? "Cancel" : "Create New Month"}
							</button>

							{nominations.length > 0 && (
								<button
									type="button"
									onClick={handleCopyAsCSV}
									className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-zinc-200 border border-zinc-400/20 hover:bg-zinc-500/10"
								>
									{csvCopied ? "Copied!" : "Export CSV"}
								</button>
							)}
						</div>

						<Link
							to={`/admin/${months[months.findIndex((m) => m.id === selectedMonth.id) - 1]?.id}`}
							prefetch="viewport"
							className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg ${
								months.findIndex((m) => m.id === selectedMonth.id) === 0
									? "pointer-events-none opacity-50"
									: "text-zinc-200 shadow-sm border border-zinc-400/20 hover:bg-zinc-500/10"
							}`}
						>
							Next Month →
						</Link>
					</div>

					{statusUpdateFetcher.data?.error && (
						<p className="mt-2 text-sm text-red-400">
							{statusUpdateFetcher.data.error}
						</p>
					)}
				</div>
			)}

			{/* Create New Month Form (Collapsible) */}
			{showCreateForm && (
				<section className="mb-8 bg-black/20 p-4 rounded-lg border border-white/10">
					<h2 className="text-lg font-semibold mb-4 text-zinc-200">
						Create New Month
					</h2>
					<createMonthFetcher.Form method="POST">
						<input type="hidden" name="intent" value="createMonth" />
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
							<div>
								<label
									htmlFor="year"
									className="block text-sm font-medium text-zinc-400 mb-1"
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
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label
									htmlFor="month"
									className="block text-sm font-medium text-zinc-400 mb-1"
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
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label
									htmlFor="status"
									className="block text-sm font-medium text-zinc-400 mb-1"
								>
									Initial Status
								</label>
								<select
									id="status"
									name="status"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
								>
									{monthStatuses.map((status) => (
										<option key={status} value={status} className="py-1">
											{status.charAt(0).toUpperCase() + status.slice(1)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label
									htmlFor="themeCategory"
									className="block text-sm font-medium text-zinc-400 mb-1"
								>
									Theme Category
								</label>
								<select
									id="themeCategory"
									name="themeCategoryId"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
								>
									<option value="">Select a category</option>
									{themeCategories.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>
							</div>
							<div>
								<label
									htmlFor="themeName"
									className="block text-sm font-medium text-zinc-400 mb-1"
								>
									Theme Name
								</label>
								<input
									type="text"
									id="themeName"
									name="themeName"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
									placeholder="Enter theme name"
								/>
							</div>
							<div className="md:col-span-2">
								<label
									htmlFor="themeDescription"
									className="block text-sm font-medium text-zinc-400 mb-1"
								>
									Theme Description
								</label>
								<textarea
									id="themeDescription"
									name="themeDescription"
									rows={2}
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm"
									placeholder="Enter theme description (optional)"
								/>
							</div>
						</div>
						<div className="flex justify-end">
							<button
								type="submit"
								disabled={createMonthFetcher.state !== "idle"}
								className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
									createMonthFetcher.state !== "idle"
										? "opacity-50 cursor-not-allowed"
										: "text-emerald-500 border border-emerald-400/20 hover:bg-emerald-500/10"
								}`}
							>
								{createMonthFetcher.state !== "idle"
									? "Creating..."
									: "Create Month"}
							</button>
						</div>
						{error && <p className="mt-2 text-sm text-red-400">{error}</p>}
					</createMonthFetcher.Form>
				</section>
			)}

			{/* Jury Selection Section */}
			{selectedMonth && nominations.length > 0 && (
				<section>
					<h2 className="text-xl font-semibold mb-4 text-zinc-200">
						{nominations.length} Game{nominations.length !== 1 ? "s" : ""}{" "}
						Nominated
					</h2>

					<div className="bg-black/10 backdrop-blur-sm rounded-lg shadow overflow-hidden border border-white/10">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-white/10">
								<thead>
									<tr>
										<th
											scope="col"
											className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Game
										</th>
										<th
											scope="col"
											className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Year
										</th>
										<th
											scope="col"
											className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Type
										</th>
										<th
											scope="col"
											className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Pitches
										</th>
										<th
											scope="col"
											className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Select
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/10">
									{nominations.map((nomination) => (
										<tr
											key={nomination.id}
											className="hover:bg-white/5 transition-colors"
										>
											<td className="px-4 py-3 whitespace-nowrap">
												<div className="flex items-center">
													{nomination.gameCover && (
														<img
															src={nomination.gameCover}
															alt=""
															className="h-10 w-10 object-cover rounded-sm mr-3 border border-white/10"
														/>
													)}
													<div className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
														{nomination.gameName}
													</div>
												</div>
											</td>
											<td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400">
												{nomination.gameYear}
											</td>
											<td className="px-4 py-3 whitespace-nowrap">
												<span
													className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
														nomination.short
															? "bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20"
															: "bg-blue-400/10 text-blue-400 ring-1 ring-inset ring-blue-400/20"
													}`}
												>
													{nomination.short ? "Short" : "Long"}
												</span>
											</td>
											<td className="px-4 py-3 whitespace-nowrap text-sm text-center">
												<button
													type="button"
													onClick={() => {
														setSelectedNomination(nomination);
														setIsPitchesModalOpen(true);
													}}
													className="inline-flex items-center justify-center px-2 py-1 text-xs rounded bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
												>
													{(
														nominations.find((n) => n.id === nomination.id)
															?.pitches || []
													).length || 0}
												</button>
											</td>
											<td className="px-4 py-3 whitespace-nowrap text-center">
												<button
													type="button"
													onClick={() => handleToggleJurySelected(nomination)}
													disabled={isProcessingNomination(nomination.id)}
													className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
														isProcessingNomination(nomination.id)
															? "opacity-70"
															: ""
													} ${
														getNominationSelectedState(nomination)
															? "bg-blue-500"
															: "bg-zinc-700"
													}`}
													aria-pressed={getNominationSelectedState(nomination)}
												>
													<span className="sr-only">
														{getNominationSelectedState(nomination)
															? "Selected"
															: "Not selected"}
													</span>
													<span
														className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ${
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
