import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import {
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
	draggableProps?: React.HTMLAttributes<HTMLDivElement>;
	dragHandleProps?: DraggableProvidedDragHandleProps;
	innerRef?: (element?: HTMLElement | null) => void;
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
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

	if (variant === "nomination") {
		return (
			<div className="flex flex-row rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full">
				<div className="relative w-1/3" style={{ aspectRatio: "2/3" }}>
					{coverUrl ? (
						<img
							src={coverUrl}
							alt={game.name}
							className="absolute inset-0 w-full h-full object-cover rounded-l-lg"
						/>
					) : (
						<div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
							<span className="text-gray-400">No cover</span>
						</div>
					)}
				</div>
				<div className="flex-1 p-2 flex flex-col">
					<div className="flex-1">
						<div className="flex justify-between items-start gap-x-1">
							<h3
								className="text-sm font-semibold text-gray-900 flex-1"
								title={game.name}
							>
								{game.name}
							</h3>
							{year && (
								<span className="text-xs text-gray-500 shrink-0">{year}</span>
							)}
						</div>
						<p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
							{game.short !== undefined && (
								<span>{game.short ? "Short" : "Long"}</span>
							)}
						</p>
						{game.pitch && (
							<p
								className="text-xs text-gray-600 line-clamp-2 mt-1"
								title={game.pitch}
							>
								{game.pitch}
							</p>
						)}
					</div>
					{(onEdit || onDelete) && (
						<div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 w-full overflow-hidden">
							{onEdit && (
								<button
									type="button"
									onClick={() => onEdit(game)}
									className="flex-1 min-w-0 flex items-center justify-center p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
									title={game.pitch ? "Edit pitch" : "Add pitch"}
								>
									<PencilSquareIcon className="w-4 h-4" />
								</button>
							)}
							{onDelete && (
								<button
									type="button"
									onClick={() => onDelete(game)}
									className="flex-1 min-w-0 flex items-center justify-center p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
									title="Delete nomination"
								>
									<TrashIcon className="w-4 h-4" />
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	if (variant === "search") {
		return (
			<div className="flex flex-row rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full">
				<div className="relative w-1/3" style={{ aspectRatio: "2/3" }}>
					{coverUrl ? (
						<img
							src={coverUrl}
							alt={game.name}
							className="absolute inset-0 w-full h-full object-cover rounded-l-lg"
						/>
					) : (
						<div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
							<span className="text-gray-400">No cover</span>
						</div>
					)}
				</div>
				<div className="flex-1 p-2 flex flex-col">
					<div className="flex-1">
						<div className="flex justify-between items-start gap-x-1">
							<h3 className="text-sm font-semibold text-gray-900 flex-1">
								{game.name}
							</h3>
							{year && (
								<span className="text-xs text-gray-500 shrink-0">{year}</span>
							)}
						</div>
						{game.summary && (
							<p className="text-xs text-gray-600 line-clamp-2 mt-1">
								{game.summary}
							</p>
						)}
					</div>
					<div className="pt-2">
						{onNominate &&
							(alreadyNominated ? (
								isCurrentUserNomination ? (
									<p className="text-xs text-gray-500 italic">
										You already nominated this game
									</p>
								) : (
									<button
										type="button"
										onClick={() => onNominate(game)}
										className="w-full rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-500 focus:ring-offset-1"
									>
										Add Your Pitch
									</button>
								)
							) : (
								<button
									type="button"
									onClick={() => onNominate(game)}
									className="w-full rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-500 focus:ring-offset-1"
								>
									Nominate
								</button>
							))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="flex flex-row rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full"
			{...draggableProps}
			ref={innerRef}
		>
			<div
				className="relative w-1/3"
				style={{ aspectRatio: "2/3" }}
				{...dragHandleProps}
			>
				{coverUrl ? (
					<img
						src={coverUrl}
						alt={game.name}
						className="absolute inset-0 w-full h-full object-cover rounded-l-lg"
					/>
				) : (
					<div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
						<span className="text-gray-400">No cover</span>
					</div>
				)}
			</div>
			<div className="flex-1 p-2 flex flex-col">
				<div className="flex-1">
					<div className="flex justify-between items-start gap-x-1">
						<h3 className="text-sm font-semibold text-gray-900 flex-1">
							{game.name}
						</h3>
						{year && (
							<span className="text-xs text-gray-500 shrink-0">{year}</span>
						)}
					</div>
					{(game.summary || game.pitch) && (
						<p className="text-xs text-gray-600 line-clamp-2 mt-1">
							{game.summary || game.pitch}
						</p>
					)}
				</div>
				<div className="pt-2">
					{onNominate && (
						<button
							type="button"
							onClick={() => onNominate(game)}
							className="w-full rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-500 focus:ring-offset-1"
						>
							Nominate
						</button>
					)}
					{(onRank || onUnrank) && (
						<button
							type="button"
							onClick={isRanked ? onUnrank : onRank}
							className={`w-full rounded-md px-2 py-1 text-xs font-medium text-white focus:outline-none focus:ring focus:ring-offset-1 flex items-center justify-center gap-1 ${
								isRanked
									? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
									: "bg-green-600 hover:bg-green-700 focus:ring-green-500"
							}`}
						>
							{isRanked ? (
								<>
									<ArrowDownIcon className="w-4 h-4" />
									Unrank
								</>
							) : (
								<>
									<ArrowUpIcon className="w-4 h-4" />
									Rank
								</>
							)}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
