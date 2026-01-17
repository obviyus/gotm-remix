import type { Row, Value } from "@libsql/client";
import type { ChangeEvent } from "react";
import { useEffect, useId, useState } from "react";
import { Link, redirect, useFetcher, useNavigate } from "react-router";
import PitchesModal from "~/components/PitchesModal";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { db } from "~/server/database.server";
import { getMonth, getThemeCategories } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { getSession } from "~/sessions";
import type { Nomination } from "~/types";
import type { Route } from "./+types/admin.$monthId";

const escapeCsvField = (text: string | null | undefined) => {
	if (text === null || text === undefined) return "";

	return String(text)
		.replace(/\t/g, " ")
		.replace(/[\r\n]/g, " ")
		.replace(/"/g, '""')
		.trim();
};

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

	const selectedMonthId = Number(params.monthId);
	if (!Number.isFinite(selectedMonthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}
	const monthsResultPromise = db.execute({
		sql: "SELECT id FROM months ORDER BY year DESC, month DESC",
		args: [],
	});
	const selectedMonthPromise = getMonth(selectedMonthId);
	const nominationsPromise = getNominationsForMonth(selectedMonthId);
	const themeCategoriesPromise = getThemeCategories();

	const [monthsResult, selectedMonth, nominations, themeCategories] =
		await Promise.all([
			monthsResultPromise,
			selectedMonthPromise,
			nominationsPromise,
			themeCategoriesPromise,
		]);

	if (!selectedMonth) {
		throw new Response("Month not found", { status: 404 });
	}

	return {
		months: await Promise.all(
			(monthsResult.rows as unknown as MonthRow[]).map(async (row) =>
				getMonth(row.id),
			),
		),
		selectedMonth,
		nominations,
		themeCategories,
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
	const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
		event.target.form?.requestSubmit();
	};

	const toggleCreateForm = () => {
		setShowCreateForm((previous) => !previous);
	};
	const openPitchesModal = (nomination: Nomination) => {
		setSelectedNomination(nomination);
		setIsPitchesModalOpen(true);
	};
	const closePitchesModal = () => {
		setIsPitchesModalOpen(false);
		setSelectedNomination(null);
	};

	// Generate unique IDs for form elements
	const statusSelectId = useId();
	const yearInputId = useId();
	const monthInputId = useId();
	const createStatusSelectId = useId();
	const themeCategorySelectId = useId();
	const themeNameInputId = useId();
	const themeDescriptionTextareaId = useId();

	// Clear error when submission is successful
	useEffect(() => {
		if (
			createMonthFetcher.state === "idle" &&
			createMonthFetcher.data?.success
		) {
			setError(null);
			setShowCreateForm(false);
			void navigate(".", { replace: true });
		} else if (createMonthFetcher.data?.error) {
			setError(createMonthFetcher.data.error);
		}
	}, [createMonthFetcher.state, createMonthFetcher.data, navigate]);

	const handleToggleJurySelected = (nomination: Nomination) => {
		void jurySelectionFetcher.submit(
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
		const header = "Category\tGame Name\tSubmitted Pitches\n";
		let csvString = header;
		const longGames = nominations.filter((n) => !n.short);
		const shortGames = nominations.filter((n) => n.short);

		if (longGames.length > 0) {
			csvString += "Long Games\t\t\n";
			for (const nomination of longGames) {
				if (nomination.pitches && nomination.pitches.length > 0) {
					const combinedPitches = nomination.pitches
						.map((pitch) => escapeCsvField(pitch.pitch))
						.join("; ");
					csvString += `\t${escapeCsvField(nomination.gameName)}\t"${combinedPitches}"\n`;
				} else {
					csvString += `\t${escapeCsvField(nomination.gameName)}\t\n`;
				}
			}
		}

		if (shortGames.length > 0) {
			csvString += "Short Games\t\t\n";
			for (const nomination of shortGames) {
				if (nomination.pitches && nomination.pitches.length > 0) {
					const combinedPitches = nomination.pitches
						.map((pitch) => escapeCsvField(pitch.pitch))
						.join("; ");
					csvString += `\t${escapeCsvField(nomination.gameName)}\t"${combinedPitches}"\n`;
				} else {
					csvString += `\t${escapeCsvField(nomination.gameName)}\t\n`;
				}
			}
		}

		void navigator.clipboard.writeText(csvString).then(() => {
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
								htmlFor={statusSelectId}
								className="text-sm font-medium text-zinc-400 sr-only sm:not-sr-only"
							>
								Status:
							</label>
							<select
								id={statusSelectId}
								name="status"
								value={selectedMonth.status}
								onChange={handleStatusChange}
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
						{(() => {
							const currentIndex = months.findIndex(
								(m) => m.id === selectedMonth.id,
							);
							const prev = months[currentIndex + 1];
							return prev ? (
								<Button
									asChild
									variant="outline"
									size="sm"
									className="px-3 py-1.5 bg-transparent text-zinc-200 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-800/40"
								>
									<Link to={`/admin/${prev.id}`} prefetch="viewport">
										← Previous Month
									</Link>
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									disabled
									className="px-3 py-1.5 text-zinc-400 opacity-50"
								>
									← Previous Month
								</Button>
							);
						})()}

						<div className="flex gap-2">
							<Button
								type="button"
								onClick={toggleCreateForm}
								variant="outline"
								size="sm"
								className="bg-transparent text-emerald-400 hover:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
							>
								{showCreateForm ? "Cancel" : "Create New Month"}
							</Button>

							{nominations.length > 0 && (
								<Button
									type="button"
									onClick={handleCopyAsCSV}
									variant="outline"
									size="sm"
									className="bg-transparent text-zinc-200 hover:text-zinc-200 border border-zinc-600/30 hover:bg-zinc-700/20"
								>
									{csvCopied ? "Copied!" : "Export CSV"}
								</Button>
							)}
						</div>

						{(() => {
							const currentIndex = months.findIndex(
								(m) => m.id === selectedMonth.id,
							);
							const next = months[currentIndex - 1];
							return next ? (
								<Button
									asChild
									variant="outline"
									size="sm"
									className="px-3 py-1.5 bg-transparent text-zinc-200 hover:text-zinc-200 border-zinc-700 hover:bg-zinc-800/40"
								>
									<Link to={`/admin/${next.id}`} prefetch="viewport">
										Next Month →
									</Link>
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									disabled
									className="px-3 py-1.5 text-zinc-400 opacity-50"
								>
									Next Month →
								</Button>
							);
						})()}
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
				<Card className="mb-8 bg-black/20 border-white/10">
					<CardHeader>
						<CardTitle className="text-zinc-200">Create New Month</CardTitle>
					</CardHeader>
					<CardContent>
						<createMonthFetcher.Form method="POST">
							<input type="hidden" name="intent" value="createMonth" />
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								<div>
									<Label
										htmlFor={yearInputId}
										className="text-sm font-medium text-zinc-400 mb-1"
									>
										Year
									</Label>
									<Input
										type="number"
										id={yearInputId}
										name="year"
										min="2000"
										max="2100"
										required
										className="bg-black/20 text-zinc-200 border-white/10 focus:border-blue-500 focus:ring-blue-500"
									/>
								</div>
								<div>
									<Label
										htmlFor={monthInputId}
										className="text-sm font-medium text-zinc-400 mb-1"
									>
										Month (1-12)
									</Label>
									<Input
										type="number"
										id={monthInputId}
										name="month"
										min="1"
										max="12"
										required
										className="bg-black/20 text-zinc-200 border-white/10 focus:border-blue-500 focus:ring-blue-500"
									/>
								</div>
								<div>
									<Label
										htmlFor={createStatusSelectId}
										className="text-sm font-medium text-zinc-400 mb-1"
									>
										Initial Status
									</Label>
									<select
										id={createStatusSelectId}
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
									<Label
										htmlFor={themeCategorySelectId}
										className="text-sm font-medium text-zinc-400 mb-1"
									>
										Theme Category
									</Label>
									<select
										id={themeCategorySelectId}
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
									<Label
										htmlFor={themeNameInputId}
										className="text-sm font-medium text-zinc-400 mb-1"
									>
										Theme Name
									</Label>
									<Input
										type="text"
										id={themeNameInputId}
										name="themeName"
										required
										className="bg-black/20 text-zinc-200 border-white/10 focus:border-blue-500 focus:ring-blue-500"
										placeholder="Enter theme name"
									/>
								</div>
								<div className="md:col-span-2">
									<Label
										htmlFor={themeDescriptionTextareaId}
										className="text-sm font-medium text-zinc-400 mb-1"
									>
										Theme Description
									</Label>
									<Textarea
										id={themeDescriptionTextareaId}
										name="themeDescription"
										rows={2}
										className="bg-black/20 text-zinc-200 border-white/10 focus:border-blue-500 focus:ring-blue-500"
										placeholder="Enter theme description (optional)"
									/>
								</div>
							</div>
							<div className="flex justify-end">
								<Button
									type="submit"
									disabled={createMonthFetcher.state !== "idle"}
									variant="outline"
									className="text-emerald-500 border border-emerald-400/20 hover:bg-emerald-500/10"
								>
									{createMonthFetcher.state !== "idle"
										? "Creating..."
										: "Create Month"}
								</Button>
							</div>
							{error && <p className="mt-2 text-sm text-red-400">{error}</p>}
						</createMonthFetcher.Form>
					</CardContent>
				</Card>
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
												<Button
													type="button"
													onClick={() => openPitchesModal(nomination)}
													variant="outline"
													size="sm"
													className="px-2 py-1 text-xs bg-transparent text-zinc-300 hover:text-zinc-300 border-zinc-700 hover:bg-zinc-800/40"
												>
													{nomination.pitches?.length ?? 0}
												</Button>
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
				onClose={closePitchesModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
