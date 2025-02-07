import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";

interface Game {
	id: number;
	name: string;
	cover?: {
		url: string;
	};
	first_release_date?: number;
	summary?: string;
}

interface GameCardProps {
	game: Game;
	onNominate?: (game: Game) => void;
	draggableProps?: any;
	dragHandleProps?: any;
	innerRef?: (element?: HTMLElement | null) => void;
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
}

export default function GameCard({
	game,
	onNominate,
	draggableProps,
	dragHandleProps,
	innerRef,
	onRank,
	onUnrank,
	isRanked,
}: GameCardProps) {
	return (
		<div
			className="flex flex-row rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full"
			{...draggableProps}
			ref={innerRef}
		>
			<div className="relative w-1/3" style={{ aspectRatio: '2/3' }} {...dragHandleProps}>
				{game.cover ? (
					<img
						src={game.cover.url.replace("t_thumb", "t_cover_big")}
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
						{game.first_release_date && (
							<span className="text-xs text-gray-500 shrink-0">
								{new Date(game.first_release_date * 1000).getFullYear()}
							</span>
						)}
					</div>
					{game.summary && (
						<p className="text-xs text-gray-600 line-clamp-2 mt-1">
							{game.summary}
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
									? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
									: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
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
