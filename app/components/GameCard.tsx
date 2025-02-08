import type {
	DraggableProvidedDraggableProps,
	DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import {
	ChatBubbleBottomCenterTextIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	PencilSquareIcon,
	TrashIcon,
} from "@heroicons/react/20/solid";
import type { Game } from "~/types";

interface GameCardProps {
	game: Game;
	variant?: "default" | "nomination" | "search";
	onNominate?: (game: Game) => void;
	onEdit?: (game: Game) => void;
	onDelete?: (game: Game) => void;
	draggableProps?: DraggableProvidedDraggableProps;
	dragHandleProps?: DraggableProvidedDragHandleProps;
	innerRef?: (element?: HTMLElement | null) => void;
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
	onViewPitches?: () => void;
	pitchCount?: number;
	showVotingButtons?: boolean;
}

export default function GameCard({
	game,
	variant = "default",
	onNominate,
	onEdit,
	onDelete,
	draggableProps,
	dragHandleProps,
	innerRef,
	onRank,
	onUnrank,
	isRanked,
	alreadyNominated,
	isCurrentUserNomination,
	onViewPitches,
	pitchCount = 0,
	showVotingButtons = false,
}: GameCardProps) {
	const getCoverUrl = (cover: Game["cover"]) => {
		if (!cover) return null;
		if (typeof cover === "string") return cover;
		return cover.url.replace("t_thumb", "t_cover_big");
	};

	const getYear = (game: Game) => {
		if (game.game_year) return game.game_year;
		if (game.first_release_date)
			return new Date(game.first_release_date * 1000).getFullYear().toString();
		return null;
	};

	const coverUrl = getCoverUrl(game.cover);
	const year = getYear(game);

	return (
		<div
			ref={innerRef}
			{...draggableProps}
			className="group relative bg-zinc-800 rounded-lg shadow-sm border border-zinc-700 hover:border-zinc-600 transition-colors flex h-32"
		>
			{/* Cover Image */}
			<div className="w-24 flex-shrink-0">
				{coverUrl ? (
					<img
						src={coverUrl}
						alt={game.name}
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="h-full w-full bg-zinc-900 flex items-center justify-center">
						<span className="text-zinc-500">No cover</span>
					</div>
				)}
			</div>

			{/* Content */}
			<div
				className="flex-1 p-4 flex flex-col justify-between"
				{...dragHandleProps}
			>
				<div>
					<div className="flex justify-between items-start">
						<h3 className="text-sm font-medium text-zinc-100">{game.name}</h3>
						{year && <p className="text-sm text-zinc-400 ml-2">{year}</p>}
					</div>

					{game.summary && (
						<p className="mt-1 text-sm text-zinc-400 line-clamp-2">
							{game.summary}
						</p>
					)}
				</div>

				<div className="flex items-center justify-end gap-2">
					{showVotingButtons && (
						<button
							type="button"
							onClick={isRanked ? onUnrank : onRank}
							className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
								isRanked
									? "text-red-400 bg-red-950 hover:bg-red-900"
									: "text-emerald-400 bg-emerald-950 hover:bg-emerald-900"
							}`}
						>
							{isRanked ? (
								<>
									<ArrowDownIcon className="w-3.5 h-3.5" />
									Unrank
								</>
							) : (
								<>
									<ArrowUpIcon className="w-3.5 h-3.5" />
									Rank
								</>
							)}
						</button>
					)}

					{onViewPitches && (
						<button
							type="button"
							onClick={onViewPitches}
							className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors"
						>
							<ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />
							{pitchCount} {pitchCount === 1 ? "pitch" : "pitches"}
						</button>
					)}

					{(onEdit || onDelete) && (
						<>
							{onEdit && (
								<button
									type="button"
									onClick={() => onEdit(game)}
									className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950 rounded-md"
									title={game.pitch ? "Edit pitch" : "Add pitch"}
								>
									<PencilSquareIcon className="w-4 h-4" />
								</button>
							)}
							{onDelete && (
								<button
									type="button"
									onClick={() => onDelete(game)}
									className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950 rounded-md"
									title="Delete nomination"
								>
									<TrashIcon className="w-4 h-4" />
								</button>
							)}
						</>
					)}

					{onNominate && (
						<button
							type="button"
							onClick={() => onNominate(game)}
							disabled={alreadyNominated && isCurrentUserNomination}
							className="px-3 py-1 text-xs font-medium rounded-full text-zinc-100 transition-colors bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
						>
							{alreadyNominated
								? isCurrentUserNomination
									? "Already nominated"
									: "Add Your Pitch"
								: "Nominate"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
