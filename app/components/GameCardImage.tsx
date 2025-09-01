import { cn } from "~/lib/utils";

interface GameCardImageProps {
	coverUrl: string | null;
	gameName: string;
	status: "winner" | "jury" | "regular";
}

function StatusBadge({ status }: { status: "winner" | "jury" | "regular" }) {
	switch (status) {
		case "winner":
			return (
				<span className="px-2.5 py-1 bg-amber-600 text-amber-100 text-xs font-medium rounded-md border border-amber-400/50">
					Winner
				</span>
			);
		case "jury":
			return (
				<span className="px-2.5 py-1 bg-blue-600 text-blue-100 text-xs font-medium rounded-md border border-blue-400/50">
					Jury Selected
				</span>
			);
		default:
			return null;
	}
}

export function GameCardImage({
	coverUrl,
	gameName,
	status,
}: GameCardImageProps) {
	return (
		<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
			{coverUrl ? (
				<>
					<div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 to-transparent z-10" />
					<img
						src={coverUrl}
						alt={gameName}
						className={cn(
							"h-full w-full object-cover transition-all duration-500 group-hover:scale-105",
							status === "winner"
								? "group-hover:brightness-125 filter-none"
								: status === "jury"
									? "group-hover:brightness-110 filter-none"
									: "group-hover:brightness-110",
						)}
					/>
					<div className="absolute top-2 left-2 z-20">
						<StatusBadge status={status} />
					</div>
				</>
			) : (
				<div className="h-full w-full bg-zinc-800/50 flex items-center justify-center backdrop-blur-sm relative">
					<span className="text-zinc-500">No cover</span>
					<div className="absolute top-2 left-2 z-20">
						<StatusBadge status={status} />
					</div>
				</div>
			)}
		</div>
	);
}

export type { GameCardImageProps };
