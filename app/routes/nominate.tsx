import React from "react";
import { useId, useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { db } from "~/server/database.server";
import { searchGames } from "~/server/igdb.server";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { getSession } from "~/sessions";
import type { Nomination } from "~/types";
import type { Route } from "./+types/nominate";

interface NominationResponse {
	error?: string;
	success?: boolean;
	nominationId?: number;
}

interface SearchResultCardProps {
	game: Nomination;
	existingNomination?: Nomination;
	isCurrentUserNomination: boolean;
	isPreviousWinner: boolean;
	buttonText: string;
	buttonDisabled: boolean;
	onNominateGame: (game: Nomination) => void;
	onOpenNominationModal: (nomination: Nomination) => void;
}

function SearchResultCard({
	game,
	existingNomination,
	isCurrentUserNomination,
	isPreviousWinner,
	buttonText,
	buttonDisabled,
	onNominateGame,
	onOpenNominationModal,
}: SearchResultCardProps) {
	const handleNominateClick = React.useCallback(() => {
		if (isPreviousWinner) {
			return;
		}

		if (existingNomination) {
			onOpenNominationModal(existingNomination);
			return;
		}

		onNominateGame(game);
	}, [existingNomination, game, isPreviousWinner, onNominateGame, onOpenNominationModal]);

	return (
		<GameCard
			key={game.id}
			game={game}
			variant="search"
			onNominate={handleNominateClick}
			alreadyNominated={Boolean(existingNomination)}
			isCurrentUserNomination={isCurrentUserNomination}
			isPreviousWinner={isPreviousWinner}
			buttonText={buttonText}
			buttonDisabled={buttonDisabled}
		/>
	);
}

export async function loader({ request }: Route.LoaderArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "nominating" ? monthRow.id : undefined;

	// Fetch all previous GOTM winners
	const result = await db.execute(
		`SELECT DISTINCT game_id 
        FROM winners;`,
	);
	const previousWinners = result.rows.map((w) =>
		(w.game_id as number).toString(),
	);

	// Fetch user's nominations for the current month if in nominating phase
	let userNominations: Nomination[] = [];
	let allNominations: Nomination[] = [];
	if (monthId) {
		// Fetch all nominations for the month
		allNominations = await getNominationsForMonth(monthId);

		// Filter for user's nominations
		userNominations = allNominations.filter((n) => n.discordId === discordId);
	}

	return {
		games: [],
		monthId,
		monthStatus: monthRow.status,
		userDiscordId: discordId,
		userNominations,
		allNominations,
		previousWinners,
	};
}

export async function action({ request }: Route.ActionArgs) {
	const method = request.method.toUpperCase();
	const formData = await request.formData();
	const intent = (formData.get("intent") || "").toString();

	// Handle search (POST + intent=search) to keep existing UX
	if (method === "POST" && intent === "search") {
		const query = formData.get("query");
		if (typeof query !== "string" || !query.trim()) {
			return Response.json({ games: [] });
		}
		const games = await searchGames(query);
		return Response.json({ games });
	}

	// All mutations below require auth
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");
	if (!discordId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Reuse previous winners check
	const winners = await db.execute("SELECT DISTINCT game_id FROM winners");
	const previousWinners = new Set(winners.rows.map((w) => (w.game_id ?? "").toString()));

	if (method === "POST" && intent === "createNomination") {
		try {
			const monthId = formData.get("monthId")?.toString() ?? "";
			const short = formData.get("short") === "true";
			const pitch = formData.get("pitch")?.toString() || null;

			const gameIdStr = formData.get("gameId")?.toString();
			const gameName = formData.get("gameName")?.toString() || "";
			const gameCover = formData.get("gameCover")?.toString() || null;
			const gameYear = formData.get("gameYear")?.toString() || null;
			const gameUrl = formData.get("gameUrl")?.toString() || null;

			if (!monthId || !gameIdStr || !gameName) {
				return Response.json(
					{ error: "Missing required fields" },
					{ status: 400 },
				);
			}

			// Reject previous winners
			if (previousWinners.has(gameIdStr)) {
				return Response.json(
					{ error: "This game has already won GOTM in a previous month" },
					{ status: 400 },
				);
			}

			// Check if user already nominated/pitched this game for the month
			const existing = await db.execute({
				sql: "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.month_id = ? AND n.game_id = ? AND p.discord_id = ?",
				args: [monthId, gameIdStr, discordId],
			});

			if (existing.rows.length > 0) {
				return Response.json(
					{
						error:
							"You have already nominated or pitched this game for this month",
					},
					{ status: 400 },
				);
			}

			// Normalize cover size like before
			const normalizedCover =
				gameCover?.replace("t_thumb", "t_cover_big") || null;

			// Insert nomination
			const nomination = await db.execute({
				sql: "INSERT INTO nominations (month_id, game_id, discord_id, short, game_name, game_year, game_cover, game_url, jury_selected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())",
				args: [
					monthId,
					gameIdStr,
					discordId,
					short ? 1 : 0,
					gameName,
					gameYear || null,
					normalizedCover,
					gameUrl || null,
					0,
				],
			});

			if (pitch && nomination.lastInsertRowid) {
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nomination.lastInsertRowid, discordId, pitch],
				});
			}

			return Response.json({
				success: true,
				nominationId: nomination.lastInsertRowid
					? Number(nomination.lastInsertRowid)
					: null,
			});
		} catch (error) {
			console.error("Error processing nomination:", error);
			return Response.json(
				{
					error:
						"Failed to process nomination. Please make sure all required fields are provided.",
				},
				{ status: 500 },
			);
		}
	}

	if (method === "PATCH") {
		try {
			const nominationIdStr = formData.get("nominationId")?.toString();
			const pitch = formData.get("pitch")?.toString() || null;
			const nominationId = nominationIdStr
				? Number.parseInt(nominationIdStr, 10)
				: null;
			if (!nominationId || Number.isNaN(nominationId)) {
				return Response.json(
					{ error: "Invalid nomination ID" },
					{ status: 400 },
				);
			}

			// Fetch nomination and any existing pitch by this user
			const nomination = await db.execute({
				sql: `SELECT n.*, p.discord_id as pitch_discord_id
                      FROM nominations n
                      LEFT JOIN pitches p ON n.id = p.nomination_id AND p.discord_id = ?
                      WHERE n.id = ?`,
				args: [discordId, nominationId],
			});

			if (nomination.rows.length === 0) {
				return Response.json(
					{ error: "Nomination not found" },
					{ status: 404 },
				);
			}

			const gameId = nomination.rows[0].game_id?.toString() ?? "";
			if (previousWinners.has(gameId)) {
				return Response.json(
					{ error: "Cannot modify nominations for previous GOTM winners" },
					{ status: 400 },
				);
			}

			const isOwner = nomination.rows[0].discord_id === discordId;
			const hasExistingPitch =
				nomination.rows[0].pitch_discord_id === discordId;

			if (!isOwner && hasExistingPitch) {
				return Response.json(
					{ error: "You have already added a pitch to this nomination" },
					{ status: 400 },
				);
			}

			if (hasExistingPitch) {
				await db.execute({
					sql: "UPDATE pitches SET pitch = ?, updated_at = unixepoch() WHERE nomination_id = ? AND discord_id = ?",
					args: [pitch, nominationId, discordId],
				});
			} else {
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nominationId, discordId, pitch],
				});
			}

			return Response.json({ success: true });
		} catch (error) {
			console.error("Error processing edit:", error);
			return Response.json(
				{ error: "Failed to process edit. Please try again." },
				{ status: 500 },
			);
		}
	}

	if (method === "DELETE") {
		const nominationId = formData.get("nominationId")?.toString();
		if (!nominationId) {
			return Response.json({ error: "Missing nomination ID" }, { status: 400 });
		}

		// Verify ownership
		const nomination = await db.execute({
			sql: "SELECT id FROM nominations WHERE id = ? AND discord_id = ?",
			args: [nominationId, discordId],
		});

		if (nomination.rows.length === 0) {
			return Response.json(
				{ error: "Nomination not found or unauthorized" },
				{ status: 404 },
			);
		}

		await db.execute({
			sql: "DELETE FROM nominations WHERE id = ?",
			args: [nominationId],
		});

		return Response.json({ success: true });
	}

	return Response.json({ error: "Invalid action" }, { status: 400 });
}

const GameSkeleton = () => (
	<div className="group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl shadow-lg border border-zinc-800/50 flex h-52 min-w-0">
		<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
			<div className="absolute inset-0 bg-zinc-800 animate-pulse" />
		</div>
		<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
			<div className="min-w-0 space-y-2">
				<div className="flex justify-between items-start gap-2">
					<div className="h-5 bg-zinc-800 rounded w-3/4 animate-pulse" />
					<div className="h-4 bg-zinc-800 rounded w-12 shrink-0 animate-pulse" />
				</div>
			</div>
			<div className="flex flex-col gap-2 mt-auto min-w-0">
				<div className="h-9 bg-zinc-800 rounded w-full animate-pulse" />
			</div>
		</div>
	</div>
);

export default function Nominate({ loaderData }: Route.ComponentProps) {
	const {
		games: initialGames,
		monthId,
		monthStatus,
		userNominations,
		allNominations,
		userDiscordId,
		previousWinners,
	} = loaderData;
	const search = useFetcher<{ games: Nomination[] }>();
	const games = search.data?.games || initialGames;
	const [searchTerm, setSearchTerm] = useState("");
	const nominate = useFetcher<NominationResponse>();
	const isSearching =
		search.state === "submitting" || search.state === "loading";
	const hasSearched = search.data !== undefined; // Track if a search was performed

	// Generate unique IDs for form elements
	const pitchId = useId();
	const editPitchId = useId();

	// New state for modal
	const [isOpen, setIsOpen] = useState(false);
	const [selectedGame, setSelectedGame] = useState<Nomination | null>(null);
	const [pitch, setPitch] = useState("");

	// State for edit modal
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editingNomination, setEditingNomination] = useState<Nomination | null>(
		null,
	);
	const [editPitch, setEditPitch] = useState("");

	// Delete confirmation modal state
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [deletingNomination, setDeletingNomination] =
		useState<Nomination | null>(null);

	// Track short and long nominations
	const shortNomination = userNominations.find((n) => n.short);
	const longNomination = userNominations.find((n) => !n.short);
	const hasReachedNominationLimit = shortNomination && longNomination;

	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const handleSearch = React.useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			if (!searchTerm.trim()) return;
			search.submit({ intent: "search", query: searchTerm }, { method: "post" });
		},
		[search, searchTerm],
	);

	const handleGameSelect = React.useCallback(
		(
			game: Nomination,
			existingNomination?: Nomination,
		) => {
			if (hasReachedNominationLimit && !existingNomination) {
				// Don't allow new nominations if limit reached
				return;
			}

			if (existingNomination) {
				// If game is already nominated, go straight to pitch dialog
				setEditingNomination(existingNomination);
				setEditPitch(
					existingNomination.pitches.find((p) => p.discordId === userDiscordId)
						?.pitch || "",
				);
				setIsEditOpen(true);
			} else {
				// Otherwise show the nomination dialog
				setSelectedGame(game);
				setIsOpen(true);
			}
		},
		[hasReachedNominationLimit, userDiscordId],
	);

	const handleEdit = React.useCallback(
		(nomination: Nomination) => {
			const fullNomination = userNominations.find((n) => n.id === nomination.id);
			if (fullNomination) {
				setEditingNomination(fullNomination);
				setEditPitch(
					fullNomination.pitches.find((p) => p.discordId === userDiscordId)
						?.pitch || "",
				);
				setIsEditOpen(true);
			}
		},
		[userDiscordId, userNominations],
	);

	const handleDelete = React.useCallback(
		(nomination: Nomination) => {
			const fullNomination = userNominations.find((n) => n.id === nomination.id);
			if (fullNomination) {
				setDeletingNomination(fullNomination);
				setIsDeleteOpen(true);
			}
		},
		[userNominations],
	);

	const handleEditSubmit = React.useCallback(() => {
		if (!editingNomination) return;

		nominate.submit(
			{
				nominationId: editingNomination.id,
				pitch: editPitch.trim() || "",
			},
			{
				method: "PATCH",
			},
		);

		setIsEditOpen(false);
		setEditingNomination(null);
		setEditPitch("");
	}, [editPitch, editingNomination, nominate]);

	const handleDeleteConfirm = React.useCallback(() => {
		if (!deletingNomination) return;

		nominate.submit(
			{
				nominationId: deletingNomination.id.toString(),
			},
			{
				method: "DELETE",
			},
		);

		setIsDeleteOpen(false);
		setDeletingNomination(null);
	}, [deletingNomination, nominate]);

	const handleGameLength = React.useCallback(
		(isShort: boolean) => {
			if (!selectedGame) return;

			// Submit directly to this route to trigger automatic revalidation
			nominate.submit(
				{
					intent: "createNomination",
					monthId: monthId?.toString() ?? "",
					short: String(isShort),
					pitch: pitch.trim() || "",
					gameId: String(selectedGame.gameId),
					gameName: selectedGame.gameName,
					gameCover: selectedGame.gameCover || "",
					gameYear: selectedGame.gameYear || "",
					gameUrl: selectedGame.gameUrl || "",
				},
				{ method: "POST" },
			);

			setIsOpen(false);
			setSelectedGame(null);
			setPitch("");
		}, [monthId, nominate, pitch, selectedGame]);

	const selectShortGame = React.useCallback(() => {
		handleGameLength(true);
	}, [handleGameLength]);

	const selectLongGame = React.useCallback(() => {
		handleGameLength(false);
	}, [handleGameLength]);

	const handleEditPitchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setEditPitch(event.target.value);
		},
		[],
	);

	const handleEditDialogOpenChange = React.useCallback(
		(open: boolean) => {
			setIsEditOpen(open);
			if (!open) {
				setEditPitch("");
			}
		},
		[],
	);

	const handleDeleteDialogOpenChange = React.useCallback(
		(open: boolean) => {
			setIsDeleteOpen(open);
			if (!open) {
				setDeletingNomination(null);
			}
		},
		[],
	);

	const closeEditModal = React.useCallback(() => {
		setIsEditOpen(false);
		setEditPitch("");
	}, []);

	const closeDeleteModal = React.useCallback(() => {
		setIsDeleteOpen(false);
		setDeletingNomination(null);
	}, []);

	const closePitchesModal = React.useCallback(() => {
		setIsViewingPitches(false);
		setSelectedNomination(null);
	}, []);

	const handleViewPitches = React.useCallback((nomination: Nomination) => {
		setSelectedNomination(nomination);
		setIsViewingPitches(true);
	}, []);

	const openNominationModal = React.useCallback((nomination: Nomination) => {
		setEditingNomination(nomination);
		setEditPitch("");
		setIsEditOpen(true);
	}, []);

	const handleSearchTermChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setSearchTerm(event.target.value);
		},
		[],
	);

	const userNominationPitchHandlers = React.useMemo(
		() =>
			new Map<number, () => void>(
				userNominations.map((nomination) => [
					nomination.id,
					() => handleViewPitches(nomination),
				] as const),
			),
		[userNominations, handleViewPitches],
	);

	const handleNominationDialogOpenChange = React.useCallback(
		(open: boolean) => {
			setIsOpen(open);
			if (!open) {
				setPitch("");
				setSelectedGame(null);
			}
		},
		[],
	);

	const handlePitchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setPitch(event.target.value);
		},
		[],
	);

	if (!monthId || monthStatus !== "nominating") {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 text-center">
				<h1 className="text-3xl font-bold tracking-tight text-zinc-200 mb-4">
					Nominations{" "}
					{monthStatus === "over" ? "haven't started" : "are closed"}
				</h1>

				<div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 p-8 shadow-lg">
					{monthStatus === "ready" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The month is being set up. Check back soon for nominations!
							</p>
							<Link
								to="/history"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
					{monthStatus === "voting" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The nomination phase is over, but you can now vote for your
								favorite games!
							</p>
							<Link
								to="/voting"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Go Vote Now →
							</Link>
						</>
					)}

					{monthStatus === "playing" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								Games have been selected! Check out what we&#39;re playing this
								month.
							</p>
							<Link
								to="/"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								See This Month&#39;s Games →
							</Link>
						</>
					)}

					{monthStatus === "jury" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The jury is currently selecting games from the nominations.
								Check back soon!
							</p>
							<p className="text-zinc-400">
								Once they&#39;re done, you&#39;ll be able to vote on the
								selected games.
							</p>
						</>
					)}

					{monthStatus === "over" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The next month&#39;s nominations haven&#39;t started yet. Check
								back soon!
							</p>
							<Link
								to="/history"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold mb-8">Nominate Games</h1>

			{/* User's nominations */}
			{userNominations.length > 0 && (
				<div className="mb-8">
					<h2 className="text-xl font-semibold mb-4">Your Nominations</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						{userNominations.map((nomination) => {
							const viewPitches = userNominationPitchHandlers.get(nomination.id);
							if (!viewPitches) {
								return null;
							}

							return (
								<GameCard
									game={nomination}
									key={nomination.id}
									variant="nomination"
									onEdit={handleEdit}
									onDelete={handleDelete}
									onViewPitches={viewPitches}
									pitchCount={nomination.pitches.length}
									showVotingButtons={false}
								/>
							);
						})}
					</div>
				</div>
			)}

			{nominate.data?.error && (
				<div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
					{nominate.data.error}
				</div>
			)}

			{nominate.data?.success && (
				<div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
					Game nominated successfully!
				</div>
			)}

			{!hasReachedNominationLimit && (
				<div>
					<div className="mb-4">
						<h3 className="text-lg font-medium text-zinc-200">
							Nomination Status:
						</h3>
						<ul className="mt-2 space-y-1 text-sm text-zinc-400">
							<li className="flex items-center">
								<span
									className={
										shortNomination ? "text-emerald-400" : "text-zinc-400"
									}
								>
									{shortNomination ? "✓" : "○"} Short Game (
									{shortNomination ? "Nominated" : "Available"})
								</span>
							</li>
							<li className="flex items-center">
								<span
									className={
										longNomination ? "text-emerald-400" : "text-zinc-400"
									}
								>
									{longNomination ? "✓" : "○"} Long Game (
									{longNomination ? "Nominated" : "Available"})
								</span>
							</li>
						</ul>
					</div>

					<search.Form method="post" onSubmit={handleSearch} className="mb-8">
						<div className="flex gap-4">
							<Input
								type="search"
								name="query"
								value={searchTerm}
								onChange={handleSearchTermChange}
								placeholder="Search for games..."
								className="flex-1 bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500"
							/>
							<input type="hidden" name="intent" value="search" />
							<button
								type="submit"
								disabled={isSearching || !searchTerm.trim()}
								className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-emerald-500 border border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:border-zinc-400/20"
							>
								{isSearching ? "Searching..." : "Search"}
							</button>
						</div>
					</search.Form>
					{isSearching ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{Array.from({ length: 10 }).map((_, i) => (
								<GameSkeleton key={`skeleton-${Date.now()}-${i}`} />
							))}
						</div>
					) : games.length > 0 ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{games.map((game: Nomination) => {
								const existingNomination = allNominations.find(
									(n) => n.gameId === game.gameId.toString(),
								);
								const isCurrentUserNomination =
									existingNomination?.discordId === userDiscordId;
								const isPreviousWinner = previousWinners.includes(
									game.id.toString(),
								);

								let buttonText = "Nominate";
								if (isPreviousWinner) {
									buttonText = "Previous GOTM";
								} else if (isCurrentUserNomination) {
									buttonText = "Edit Pitch";
								} else if (existingNomination) {
									buttonText = "Add Pitch";
								}

								return (
									<SearchResultCard
										key={game.id}
										game={game}
										existingNomination={existingNomination}
										isCurrentUserNomination={isCurrentUserNomination}
										isPreviousWinner={isPreviousWinner}
										buttonText={buttonText}
										buttonDisabled={isPreviousWinner}
										onNominateGame={handleGameSelect}
										onOpenNominationModal={openNominationModal}
									/>
								);
							})}
						</div>
					) : hasSearched && searchTerm ? (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								No results found
							</h3>
							<p className="mt-2 text-zinc-400">
								No games found matching &#34;{searchTerm}&#34;. Try a different
								search term.
							</p>
						</div>
					) : (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								Search for games to nominate
							</h3>
							<p className="mt-2 text-zinc-400">
								Type in the search box above to find games. You can nominate one
								short game and one long game.
							</p>
						</div>
					)}
				</div>
			)}

			{/* Game Length Selection Modal */}
			<Dialog
				open={isOpen}
				onOpenChange={handleNominationDialogOpenChange}
			>
				<DialogContent className="w-full sm:w-[32rem] bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							Nominate {selectedGame?.gameName} ({selectedGame?.gameYear})
						</DialogTitle>
					</DialogHeader>

					{/* Game Cover and Summary */}
					<div className="mb-6 flex gap-4">
						{selectedGame?.gameCover && (
							<div className="flex-shrink-0">
								<img
									src={selectedGame.gameCover.replace(
										"/t_thumb/",
										"/t_cover_big/",
									)}
									alt={selectedGame.gameName}
									className="w-32 rounded-lg shadow-lg border border-white/10"
								/>
							</div>
						)}
						{selectedGame?.summary && (
							<div className="flex-1">
								<p className="text-sm text-zinc-400 line-clamp-[12]">
									{selectedGame.summary}
								</p>
							</div>
						)}
					</div>

					{/* Pitch Input */}
					<div className="mb-6">
						<Label htmlFor={pitchId} className="text-zinc-400">
							Pitch (Optional)
						</Label>
						<Textarea
							id={pitchId}
							name="pitch"
							rows={3}
							className="bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500 mt-2"
							value={pitch}
							onChange={handlePitchChange}
						/>
					</div>

					<DialogFooter>
						<div className="grid grid-cols-2 gap-4 w-full">
							<button
								type="button"
								onClick={selectShortGame}
								disabled={Boolean(shortNomination)}
								className={`w-full inline-flex flex-col items-center justify-center gap-1 px-4 py-4 text-sm font-medium rounded-lg border transition-all duration-300 ${shortNomination
									? "opacity-50 cursor-not-allowed text-zinc-400 border-zinc-400/20 bg-transparent"
									: "text-emerald-500 border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30"
									}`}
							>
								<span>Short Game</span>
								<span className="text-xs opacity-80">(&lt; 12 hours)</span>
								{shortNomination && (
									<span className="text-xs">Already nominated</span>
								)}
							</button>
							<button
								type="button"
								onClick={selectLongGame}
								disabled={Boolean(longNomination)}
								className={`w-full inline-flex flex-col items-center justify-center gap-1 px-4 py-4 text-sm font-medium rounded-lg border transition-all duration-300 ${longNomination
									? "opacity-50 cursor-not-allowed text-zinc-400 border-zinc-400/20 bg-transparent"
									: "text-emerald-500 border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30"
									}`}
							>
								<span>Long Game</span>
								<span className="text-xs opacity-80">(&gt; 12 hours)</span>
								{longNomination && (
									<span className="text-xs">Already nominated</span>
								)}
							</button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Modal */}
			<Dialog
				open={isEditOpen}
				onOpenChange={handleEditDialogOpenChange}
			>
				<DialogContent className="w-full sm:w-[32rem] bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							{editingNomination && editingNomination.pitches.length > 0
								? "Edit"
								: "Add"}{" "}
							Pitch: {editingNomination?.gameName}
						</DialogTitle>
					</DialogHeader>

					<div className="mb-6">
						<Label htmlFor={editPitchId} className="text-zinc-400">
							Pitch
						</Label>
						<Textarea
							id={editPitchId}
							rows={3}
							className="bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500 mt-2"
							value={editPitch}
							onChange={handleEditPitchChange}
							placeholder="Write your pitch here..."
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							onClick={closeEditModal}
							variant="outline"
							className="bg-zinc-800 border-white/10 text-zinc-200 hover:bg-zinc-700"
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleEditSubmit}
							className="bg-blue-600 hover:bg-blue-700 text-white"
						>
							{editingNomination?.pitches ? "Save Changes" : "Add Pitch"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog
				open={isDeleteOpen}
				onOpenChange={handleDeleteDialogOpenChange}
			>
				<DialogContent className="w-full max-w-sm bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							Delete Nomination
						</DialogTitle>
					</DialogHeader>

					<p className="text-sm text-zinc-400 mb-6">
						Are you sure you want to delete your nomination for{" "}
						{deletingNomination?.gameName}? This action cannot be undone.
					</p>

					<DialogFooter>
						<Button
							type="button"
							onClick={closeDeleteModal}
							variant="outline"
							className="bg-zinc-800 border-white/10 text-zinc-200 hover:bg-zinc-700"
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleDeleteConfirm}
							variant="destructive"
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add PitchesModal */}
			<PitchesModal
				isOpen={isViewingPitches}
				onClose={closePitchesModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
