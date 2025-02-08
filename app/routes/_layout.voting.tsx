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

interface LoaderData {
	monthId: number;
	userId: string;
	shortNominations: Nomination[];
	longNominations: Nomination[];
	votedShort: boolean;
	votedLong: boolean;
	shortRankings: Array<{ nomination_id: number; rank: number }>;
	longRankings: Array<{ nomination_id: number; rank: number }>;
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
	const [shortNoms] = await pool.execute(
		`SELECT id, game_id, game_name as title, game_year, game_cover, game_url, game_platform_ids 
     FROM nominations 
     WHERE month_id = ? AND jury_selected = 1 AND short = 1`,
		[monthId],
	);

	const [longNoms] = await pool.execute(
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

	return json({
		monthId,
		userId: discordId,
		shortNominations: shortNoms,
		longNominations: longNoms,
		votedShort: Boolean(shortVoteRow[0]),
		votedLong: Boolean(longVoteRow[0]),
		shortRankings,
		longRankings,
	});
};

export default function Voting() {
	const {
		monthId,
		userId,
		shortNominations,
		longNominations,
		votedShort: initialVotedShort,
		votedLong: initialVotedLong,
		shortRankings,
		longRankings,
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
			if (longRankings.length > 0) {
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
				initialOrder[0].push(...longNominations.map((n) => String(n.id)));
			}

			// For short games
			if (shortRankings.length > 0) {
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
				initialOrder[1].push(...shortNominations.map((n) => String(n.id)));
			}

			return initialOrder;
		},
	);

	const [votedLong, setVotedLong] = useState(initialVotedLong);
	const [votedShort, setVotedShort] = useState(initialVotedShort);

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
								<div className="bg-gray-50 rounded p-4 text-center text-gray-500">
									Drag games here to rank them
								</div>
							) : (
								rankedGames.map((game, index) => (
									<div key={game.id}>
										<Draggable draggableId={String(game.id)} index={index}>
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
													dragHandleProps={
														provided.dragHandleProps ?? undefined
													}
													innerRef={provided.innerRef}
													isRanked={true}
													onUnrank={() =>
														moveItemBelowDivider(isShort, String(game.id))
													}
												/>
											)}
										</Draggable>
									</div>
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
									className="border-t-2 border-dashed border-gray-300 my-4 relative"
								>
									<span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-gray-500">
										Divider
									</span>
								</div>
							)}
						</Draggable>

						{/* Unranked Section */}
						<div className="space-y-4">
							{unrankedGames.length === 0 ? (
								<div className="bg-gray-50 rounded p-4 text-center text-gray-500">
									Drag games here to unrank them
								</div>
							) : (
								unrankedGames.map((game, index) => (
									<div key={game.id}>
										<Draggable
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
													dragHandleProps={
														provided.dragHandleProps ?? undefined
													}
													innerRef={provided.innerRef}
													isRanked={false}
													onRank={() =>
														moveItemAboveDivider(isShort, String(game.id))
													}
												/>
											)}
										</Draggable>
									</div>
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
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				<h1 className="text-3xl font-bold">Drag and Drop the games</h1>
				<h2 className="text-xl">
					to sort them in the priority you want them to win
				</h2>
				<p className="text-gray-600">
					Please only vote for games you actually want to play next month :)
				</p>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				{/* Long Games Column */}
				<div className="bg-white rounded-lg shadow p-4 space-y-4">
					<div className="flex justify-between items-center">
						<h2 className="text-2xl font-bold">Long Games</h2>
						<div>{votedLong ? "✅" : "❌"}</div>
					</div>
					<div className="min-h-[60px]">
						{votedLong && (
							<button
								type="button"
								className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
								onClick={() => deleteVote(false)}
							>
								Unvote Long
							</button>
						)}
					</div>
					<DragDropContext onDragEnd={onDragEnd}>
						{renderGames(longNominations, false)}
					</DragDropContext>
				</div>

				{/* Short Games Column */}
				<div className="bg-white rounded-lg shadow p-4 space-y-4">
					<div className="flex justify-between items-center">
						<h2 className="text-2xl font-bold">Short Games</h2>
						<div>{votedShort ? "✅" : "❌"}</div>
					</div>
					<div className="min-h-[60px]">
						{votedShort && (
							<button
								type="button"
								className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
								onClick={() => deleteVote(true)}
							>
								Unvote Short
							</button>
						)}
					</div>
					<DragDropContext onDragEnd={onDragEnd}>
						{renderGames(shortNominations, true)}
					</DragDropContext>
				</div>
			</div>
		</div>
	);
}
