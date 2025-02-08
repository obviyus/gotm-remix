import { useLoaderData, useFetcher } from "@remix-run/react";
import {
	DragDropContext,
	Droppable,
	Draggable,
	type DropResult,
} from "@hello-pangea/dnd";
import { json, redirect, type LoaderFunction } from "@remix-run/node";
import { pool, getCurrentMonth } from "~/utils/database.server";
import type { Nomination } from "~/types";
import { useState } from "react";
import GameCard from "~/components/GameCard";
import type { RowDataPacket } from "mysql2";
import { getSession } from "~/sessions";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { TrashIcon } from "@heroicons/react/20/solid";
import SplitLayout, { Column } from "~/components/SplitLayout";

interface LoaderData {
	monthId: number;
	userId: string;
	shortNominations: Nomination[];
	longNominations: Nomination[];
	votedShort: boolean;
	votedLong: boolean;
	shortRankings: Array<{ nomination_id: number; rank: number }>;
	longRankings: Array<{ nomination_id: number; rank: number }>;
	pitches: Record<number, Array<{ discord_id: string; pitch: string }>>;
}

export const loader: LoaderFunction = async ({ request }) => {
	// Check for authentication
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	const monthRow = await getCurrentMonth();

	const monthId = monthRow.status === "voting" ? monthRow.id : undefined;

	if (!monthId) {
		return json({ monthId: undefined });
	}

	// Check if user has already voted
	const [shortVoteRow] = await pool.execute<RowDataPacket[]>(
		"SELECT id FROM votes WHERE month_id = ? AND discord_id = ? AND short = 1",
		[monthId, discordId],
	);

	const [longVoteRow] = await pool.execute<RowDataPacket[]>(
		"SELECT id FROM votes WHERE month_id = ? AND discord_id = ? AND short = 0",
		[monthId, discordId],
	);

	// Fetch nominations
	const [shortNoms] = await pool.execute<RowDataPacket[]>(
		`SELECT id, game_id, game_name as title, game_year, game_cover, game_url, game_platform_ids 
     FROM nominations 
     WHERE month_id = ? AND jury_selected = 1 AND short = 1`,
		[monthId],
	);

	const [longNoms] = await pool.execute<RowDataPacket[]>(
		`SELECT id, game_id, game_name as title, game_year, game_cover, game_url, game_platform_ids 
     FROM nominations 
     WHERE month_id = ? AND jury_selected = 1 AND short = 0`,
		[monthId],
	);

	// Fetch existing rankings if user has voted
	let shortRankings: RowDataPacket[] = [];
	let longRankings: RowDataPacket[] = [];

	if (shortVoteRow[0]) {
		[shortRankings] = await pool.execute<RowDataPacket[]>(
			`SELECT nomination_id, \`rank\` 
			 FROM rankings 
			 WHERE vote_id = ? 
			 ORDER BY \`rank\``,
			[shortVoteRow[0].id],
		);
	}

	if (longVoteRow[0]) {
		[longRankings] = await pool.execute<RowDataPacket[]>(
			`SELECT nomination_id, \`rank\` 
			 FROM rankings 
			 WHERE vote_id = ? 
			 ORDER BY \`rank\``,
			[longVoteRow[0].id],
		);
	}

	// Fetch pitches for all nominations
	const allNominationIds = [...shortNoms, ...longNoms].map(
		(n: RowDataPacket) => n.id,
	);
	let pitchesByNomination = {};

	if (allNominationIds.length > 0) {
		const placeholders = Array(allNominationIds.length).fill("?").join(",");
		const [pitchRows] = await pool.execute<RowDataPacket[]>(
			`SELECT nomination_id, discord_id, pitch 
			 FROM pitches 
			 WHERE nomination_id IN (${placeholders})`,
			allNominationIds,
		);

		// Group pitches by nomination_id
		pitchesByNomination = pitchRows.reduce(
			(acc, row) => {
				if (!acc[row.nomination_id]) {
					acc[row.nomination_id] = [];
				}
				acc[row.nomination_id].push({
					discord_id: row.discord_id,
					pitch: row.pitch,
				});
				return acc;
			},
			{} as Record<number, Array<{ discord_id: string; pitch: string }>>,
		);
	}

	return json({
		monthId,
		userId: discordId,
		shortNominations: shortNoms,
		longNominations: longNoms,
		votedShort: Boolean(shortVoteRow[0]),
		votedLong: Boolean(longVoteRow[0]),
		shortRankings,
		longRankings,
		pitches: pitchesByNomination,
	});
};

export default function Voting() {
	const {
		monthId,
		userId,
		shortNominations = [],
		longNominations = [],
		votedShort: initialVotedShort,
		votedLong: initialVotedLong,
		shortRankings = [],
		longRankings = [],
		pitches = {},
	} = useLoaderData<LoaderData>();

	const voteFetcher = useFetcher();

	// Initialize order based on existing rankings if available
	const [currentOrder, setCurrentOrder] = useState<Record<number, string[]>>(
		() => {
			const initialOrder: Record<number, string[]> = {
				0: ["divider"], // long games
				1: ["divider"], // short games
			};

			// For long games
			if (longRankings?.length > 0) {
				// Add ranked games in order
				const rankedLongIds = longRankings
					.sort((a, b) => a.rank - b.rank)
					.map((r) => String(r.nomination_id));
				initialOrder[0].unshift(...rankedLongIds);

				// Add remaining unranked games below divider
				const unrankedLongIds = longNominations
					.filter((n) => !longRankings.find((r) => r.nomination_id === n.id))
					.map((n) => String(n.id));
				initialOrder[0].push(...unrankedLongIds);
			} else {
				// If no rankings, all games go below divider
				initialOrder[0].push(
					...(longNominations || []).map((n) => String(n.id)),
				);
			}

			// For short games
			if (shortRankings?.length > 0) {
				// Add ranked games in order
				const rankedShortIds = shortRankings
					.sort((a, b) => a.rank - b.rank)
					.map((r) => String(r.nomination_id));
				initialOrder[1].unshift(...rankedShortIds);

				// Add remaining unranked games below divider
				const unrankedShortIds = shortNominations
					.filter((n) => !shortRankings.find((r) => r.nomination_id === n.id))
					.map((n) => String(n.id));
				initialOrder[1].push(...unrankedShortIds);
			} else {
				// If no rankings, all games go below divider
				initialOrder[1].push(
					...(shortNominations || []).map((n) => String(n.id)),
				);
			}

			return initialOrder;
		},
	);

	const [votedLong, setVotedLong] = useState(initialVotedLong);
	const [votedShort, setVotedShort] = useState(initialVotedShort);
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);

	const deleteVote = async (short: boolean) => {
		voteFetcher.submit(
			{ monthId, userId, short },
			{ method: "DELETE", action: "/api/votes" },
		);

		// Update local state
		const shortKey = short ? 1 : 0;
		const games = short ? shortNominations : longNominations;

		setCurrentOrder((prev) => ({
			...prev,
			[shortKey]: ["divider", ...games.map((n) => String(n.id))],
		}));

		if (short) {
			setVotedShort(false);
		} else {
			setVotedLong(false);
		}
	};

	const onDragEnd = async (result: DropResult) => {
		if (!result.destination) return;

		const isShort = result.source.droppableId === "short";
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);
		const dividerIndex = items.indexOf("divider");

		// Handle dragging items
		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		// Update the local state
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));

		// Get items above the divider and save them as votes
		const newDividerIndex = items.indexOf("divider");
		const rankedItems = items.slice(0, newDividerIndex);

		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		} else {
			await deleteVote(isShort);
		}
	};

	const saveVote = async (short: boolean, order: string[]) => {
		const validOrder = order
			.filter((id) => id && id !== "divider")
			.map((id) => Number.parseInt(id));

		if (validOrder.length === 0) {
			await deleteVote(short);
			return;
		}

		voteFetcher.submit(
			{ monthId, userId, short, order: validOrder },
			{
				method: "POST",
				action: "/api/votes",
				encType: "application/json",
			},
		);

		updateVoteStatus(short, true);
	};

	const updateVoteStatus = (short: boolean, voted: boolean) => {
		if (short) {
			setVotedShort(voted);
		} else {
			setVotedLong(voted);
		}
	};

	const moveItemAboveDivider = (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);
		const dividerIndex = items.indexOf("divider");

		// Remove the item from its current position
		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		// Insert just above the divider
		const newDividerIndex = items.indexOf("divider");
		items.splice(newDividerIndex, 0, itemId);

		// Update state and save
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, items.indexOf("divider"));
		if (rankedItems.length > 0) {
			saveVote(isShort, rankedItems);
		}
	};

	const moveItemBelowDivider = (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Remove the item from its current position
		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		// Insert just below the divider
		const dividerIndex = items.indexOf("divider");
		items.splice(dividerIndex + 1, 0, itemId);

		// Update state and save
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, dividerIndex);
		if (rankedItems.length > 0) {
			saveVote(isShort, rankedItems);
		} else {
			deleteVote(isShort);
		}
	};

	const renderGames = (games: Nomination[], isShort: boolean) => {
		const shortKey = isShort ? 1 : 0;
		const order = currentOrder[shortKey];
		const dividerIndex = order.indexOf("divider");

		// Initialize ranked and unranked games based on the current order
		const rankedGames = games
			.filter(
				(g) =>
					dividerIndex > -1 &&
					order.slice(0, dividerIndex).includes(String(g.id)),
			)
			.sort((a, b) => {
				const aIndex = order.indexOf(String(a.id));
				const bIndex = order.indexOf(String(b.id));
				return aIndex - bIndex;
			});

		const unrankedGames = games
			.filter(
				(g) =>
					dividerIndex === -1 ||
					order.slice(dividerIndex + 1).includes(String(g.id)) ||
					!order.includes(String(g.id)),
			)
			.sort((a, b) => {
				const aIndex = order.indexOf(String(a.id));
				const bIndex = order.indexOf(String(b.id));
				return aIndex - bIndex;
			});

		return (
			<Droppable droppableId={isShort ? "short" : "long"}>
				{(provided) => (
					<div {...provided.droppableProps} ref={provided.innerRef}>
						{/* Ranked Section */}
						<div className="space-y-4">
							{rankedGames.length === 0 && order.length === 0 ? (
								<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
									<p className="text-sm text-gray-500">
										Drag games here to rank them in order of preference
									</p>
								</div>
							) : (
								rankedGames.map((game, index) => (
									<Draggable
										key={game.id}
										draggableId={String(game.id)}
										index={index}
									>
										{(provided) => (
											<GameCard
												game={{
													id: game.id,
													name: game.title,
													cover: game.game_cover
														? { url: game.game_cover }
														: undefined,
													first_release_date: game.game_year
														? Number.parseInt(game.game_year)
														: undefined,
												}}
												draggableProps={provided.draggableProps}
												dragHandleProps={provided.dragHandleProps ?? undefined}
												innerRef={provided.innerRef}
												isRanked={true}
												onUnrank={() =>
													moveItemBelowDivider(isShort, String(game.id))
												}
												onViewPitches={() => setSelectedNomination(game)}
												pitchCount={pitches?.[game.id]?.length || 0}
												showVotingButtons={true}
											/>
										)}
									</Draggable>
								))
							)}
						</div>

						{/* Divider */}
						<Draggable draggableId="divider" index={rankedGames.length}>
							{(provided) => (
								<div
									ref={provided.innerRef}
									{...provided.draggableProps}
									{...provided.dragHandleProps}
									className="border-t border-gray-200 my-6 relative"
								>
									<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs font-medium text-gray-400 select-none">
										Drag above to rank
									</span>
								</div>
							)}
						</Draggable>

						{/* Unranked Section */}
						<div className="space-y-4">
							{unrankedGames.length === 0 ? (
								<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
									<p className="text-sm text-gray-500">No unranked games</p>
								</div>
							) : (
								unrankedGames.map((game, index) => (
									<Draggable
										key={game.id}
										draggableId={String(game.id)}
										index={rankedGames.length + 1 + index}
									>
										{(provided) => (
											<GameCard
												game={{
													id: game.id,
													name: game.title,
													cover: game.game_cover
														? { url: game.game_cover }
														: undefined,
													first_release_date: game.game_year
														? Number.parseInt(game.game_year)
														: undefined,
												}}
												draggableProps={provided.draggableProps}
												dragHandleProps={provided.dragHandleProps ?? undefined}
												innerRef={provided.innerRef}
												isRanked={false}
												onRank={() =>
													moveItemAboveDivider(isShort, String(game.id))
												}
												onViewPitches={() => setSelectedNomination(game)}
												pitchCount={pitches?.[game.id]?.length || 0}
												showVotingButtons={true}
											/>
										)}
									</Draggable>
								))
							)}
						</div>
						{provided.placeholder}
					</div>
				)}
			</Droppable>
		);
	};

	return (
		<SplitLayout
			title="Drag and Drop the games"
			subtitle="to sort them in the priority you want them to win"
			description="Please only vote for games you actually want to play next month :)"
		>
			<Column
				title="Long Games"
				statusBadge={{
					text: votedLong ? "Voted" : "Not Voted",
					isSuccess: votedLong,
				}}
				action={
					votedLong && (
						<button
							type="button"
							className="px-4 py-2 text-sm font-medium rounded-md text-red-600 transition-colors hover:text-red-900 bg-red-50 border border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 flex items-center gap-2"
							onClick={() => deleteVote(false)}
						>
							<TrashIcon className="w-4 h-4" />
							Clear Long Vote
						</button>
					)
				}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					{renderGames(longNominations, false)}
				</DragDropContext>
			</Column>

			<Column
				title="Short Games"
				statusBadge={{
					text: votedShort ? "Voted" : "Not Voted",
					isSuccess: votedShort,
				}}
				action={
					votedShort && (
						<button
							type="button"
							className="px-4 py-2 text-sm font-medium rounded-md text-red-600 transition-colors hover:text-red-900 bg-red-50 border border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 flex items-center gap-2"
							onClick={() => deleteVote(true)}
						>
							<TrashIcon className="w-4 h-4" />
							Clear Short Vote
						</button>
					)
				}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					{renderGames(shortNominations, true)}
				</DragDropContext>
			</Column>

			{/* Pitches Dialog */}
			<Dialog
				open={selectedNomination !== null}
				onClose={() => setSelectedNomination(null)}
				className="relative z-50"
			>
				<div
					className="fixed inset-0 bg-black/30 backdrop-blur-sm"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="mx-auto max-w-2xl w-full rounded-xl bg-white p-6 shadow-xl ring-1 ring-gray-900/5">
						<DialogTitle className="text-lg font-medium text-gray-900 mb-4">
							Pitches for {selectedNomination?.title}
						</DialogTitle>
						<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
							{selectedNomination &&
								pitches?.[selectedNomination.id]?.map((pitch) => (
									<div
										key={`${selectedNomination.id}-${pitch.discord_id}`}
										className="rounded-lg border border-gray-200 p-4 bg-gray-50/50 hover:bg-white hover:border-gray-300 transition-colors"
									>
										<div className="flex items-center mb-2">
											<div className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
												{pitch.discord_id}
											</div>
										</div>
										<div className="text-gray-700 whitespace-pre-wrap text-sm">
											{pitch.pitch}
										</div>
									</div>
								))}
							{selectedNomination &&
								(!pitches?.[selectedNomination.id] ||
									pitches[selectedNomination.id].length === 0) && (
									<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
										<p className="text-sm text-gray-500">
											No pitches available for this game
										</p>
									</div>
								)}
						</div>
						<div className="mt-6 flex justify-end gap-3">
							<button
								type="button"
								className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 transition-colors hover:text-gray-900 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
								onClick={() => setSelectedNomination(null)}
							>
								Close
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</SplitLayout>
	);
}
