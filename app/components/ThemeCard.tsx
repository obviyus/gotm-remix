import type { Month } from "~/types";

export default function ThemeCard(month: Month) {
	const monthName = new Date(month.year, month.month - 1).toLocaleString(
		"default",
		{ month: "long" },
	);

	return (
		<div className="w-full">
			<div className="mx-auto">
				<div className="relative px-8 pt-10 rounded-2xl">
					<div className="flex flex-col items-center text-center space-y-8">
						{/* Month and Year */}
						<div className="flex flex-col items-center gap-3">
							<span className="text-4xl font-bold tracking-wider">
								{monthName}
							</span>
							<span className="text-xl font-bold">{month.year}</span>
							<span className="px-4 py-1 rounded-full bg-blue-600">
								{month.theme.name}
							</span>
						</div>

						{month.theme.description && (
							<p className="text-lg leading-relaxed whitespace-pre-wrap">
								{month.theme.description}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
