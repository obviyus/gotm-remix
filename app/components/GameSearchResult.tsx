interface GameSearchResultProps {
	name: string;
	cover?: { url: string };
	summary?: string;
	first_release_date?: number;
	onNominate: () => void;
}

export function GameSearchResult({
	name,
	cover,
	summary,
	first_release_date,
	onNominate,
}: GameSearchResultProps) {
	return (
		<div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
			{cover && (
				<img
					src={cover.url.replace("t_thumb", "t_cover_big")}
					alt={name}
					className="h-48 w-full rounded-t-lg object-cover"
				/>
			)}
			<div className="flex flex-1 flex-col p-4">
				<h3 className="text-lg font-semibold text-gray-900">{name}</h3>
				{first_release_date && (
					<p className="text-sm text-gray-500">
						{new Date(first_release_date * 1000).getFullYear()}
					</p>
				)}
				{summary && (
					<p className="mt-2 text-sm text-gray-600 line-clamp-3">{summary}</p>
				)}
				<button
					type="button"
					onClick={onNominate}
					className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Nominate
				</button>
			</div>
		</div>
	);
}
