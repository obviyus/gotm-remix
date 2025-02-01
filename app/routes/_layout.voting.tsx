import { useLoaderData } from "@remix-run/react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { json } from "@remix-run/node";
import { pool } from "~/utils/database.server";
import type { Nomination } from "~/types";
import { useState } from "react";
import GameCard from "~/components/GameCard";
import type { RowDataPacket } from "mysql2";

interface LoaderData {
	monthId: number;
	userId: string;
	shortNominations: Nomination[];
	longNominations: Nomination[];
	votedShort: boolean;
	votedLong: boolean;
}

export const loader = async () => {
	const [monthRow] = await pool.execute<RowDataPacket[]>(
		"SELECT id FROM months WHERE status = 'voting' LIMIT 1",
	);
	const monthId = monthRow[0]?.id || 0;

	// Fetch nominations and voting status
	const [shortNoms] = await pool.execute(
		`SELECT * FROM nominations 
     WHERE month_id = ? AND jury_selected = 1 AND short = 1`,
		[monthId],
	);

	const [longNoms] = await pool.execute(
		`SELECT * FROM nominations 
     WHERE month_id = ? AND jury_selected = 1 AND short = 0`,
		[monthId],
	);

	return json({
		monthId,
		userId: "0",
		shortNominations: shortNoms,
		longNominations: longNoms,
		votedShort: false,
		votedLong: false,
	});
};

export default function Voting() {
	const { monthId, userId, shortNominations, longNominations } =
		useLoaderData<LoaderData>();

	const [currentOrder, setCurrentOrder] = useState<Record<number, string[]>>({
		0: [], // long games
		1: [], // short games
	});
	const [votedLong, setVotedLong] = useState(false);
	const [votedShort, setVotedShort] = useState(false);

	const deleteVote = async (short: boolean) => {
		const response = await fetch("/api/votes", {
			method: "DELETE",
			body: JSON.stringify({
				monthId,
				userId,
				short,
			}),
		});

		if (response.ok) {
			if (short) {
				setVotedShort(false);
				setCurrentOrder((prev) => ({ ...prev, 1: [] }));
			} else {
				setVotedLong(false);
				setCurrentOrder((prev) => ({ ...prev, 0: [] }));
			}
		}
	};

	const onDragEnd = async (result: any) => {
		if (!result.destination) return;

		const isShort = result.source.droppableId === "short";
		const shortKey = isShort ? 1 : 0;

		const items = Array.from(currentOrder[shortKey]);
		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		setCurrentOrder({ ...currentOrder, [shortKey]: items });
		await saveVote(isShort, items);
	};

	const saveVote = async (short: boolean, order: string[]) => {
		// Implementation similar to PHP saveVote method
		const response = await fetch("/api/votes", {
			method: "POST",
			body: JSON.stringify({
				monthId,
				userId,
				short,
				order,
			}),
		});

		// Update vote status after save
	};

	const updateVoteStatus = (short: boolean, voted: boolean) => {
		if (short) {
			setVotedShort(voted);
		} else {
			setVotedLong(voted);
		}
	};

	const renderGames = (games: Nomination[], isShort: boolean) => {
		const shortKey = isShort ? 1 : 0;
		const order = currentOrder[shortKey];
		const dividerIndex = order.indexOf("divider");

		const rankedGames =
			dividerIndex > -1
				? games.filter((g) =>
						order.slice(0, dividerIndex).includes(String(g.id)),
					)
				: [];

		const unrankedGames =
			dividerIndex > -1
				? games.filter((g) =>
						order.slice(dividerIndex + 1).includes(String(g.id)),
					)
				: games;

		return (
			<Droppable droppableId={isShort ? "short" : "long"}>
				{(provided) => (
					<div {...provided.droppableProps} ref={provided.innerRef}>
						{/* Ranked Section */}
						{rankedGames.length === 0 ? (
							<div className="bg-gray-50 rounded p-4 text-center text-gray-500 mb-4">
								Drag games here to rank them
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
											title={game.title}
											draggableProps={provided.draggableProps}
											dragHandleProps={provided.dragHandleProps}
											innerRef={provided.innerRef}
										/>
									)}
								</Draggable>
							))
						)}

						{/* Divider */}
						<div className="border-t-2 border-dashed border-gray-300 my-4 relative">
							<span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-gray-500">
								Divider
							</span>
						</div>

						{/* Unranked Section */}
						{unrankedGames.length === 0 ? (
							<div className="bg-gray-50 rounded p-4 text-center text-gray-500">
								Drag games here to unrank them
							</div>
						) : (
							unrankedGames.map((game, index) => (
								<Draggable
									key={game.id}
									draggableId={String(game.id)}
									index={dividerIndex + 1 + index}
								>
									{(provided) => (
										<GameCard
											title={game.title}
											draggableProps={provided.draggableProps}
											dragHandleProps={provided.dragHandleProps}
											innerRef={provided.innerRef}
										/>
									)}
								</Draggable>
							))
						)}
						{provided.placeholder}
					</div>
				)}
			</Droppable>
		);
	};

	return (
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center mb-8">
				<h1 className="text-3xl font-bold mb-2">Drag and Drop the games</h1>
				<h2 className="text-xl mb-4">
					to sort them in the priority you want them to win
				</h2>
				<p className="text-gray-600">
					Please only vote for games you actually want to play next month :)
				</p>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				{/* Long Games Column */}
				<div className="bg-white rounded-lg shadow p-4">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-2xl font-bold">Long Games</h2>
						<div>{votedLong ? "✅" : "❌"}</div>
					</div>
					<div className="min-h-[60px] mb-4">
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
				<div className="bg-white rounded-lg shadow p-4">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-2xl font-bold">Short Games</h2>
						<div>{votedShort ? "✅" : "❌"}</div>
					</div>
					<div className="min-h-[60px] mb-4">
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
