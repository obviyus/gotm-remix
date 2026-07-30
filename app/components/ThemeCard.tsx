import React from "react";
import type { Month } from "~/types";

interface ThemeCardProps extends Month {
	/** On an archive page the month and theme are the page heading; on the home
	 * page that role belongs to the club introduction above it. */
	asPageHeading?: boolean;
}

export default function ThemeCard({ asPageHeading = false, ...month }: ThemeCardProps) {
	const monthName = new Date(month.year, month.month - 1).toLocaleString("default", {
		month: "long",
	});
	const Heading = asPageHeading ? "h1" : "div";

	return (
		<div className="w-full">
			<div className="mx-auto">
				<div className="relative px-8 pt-10 rounded-2xl">
					<div className="flex flex-col items-center text-center space-y-8">
						{/* Month and Year */}
						<Heading className="flex flex-col items-center gap-3 m-0">
							<span className="text-4xl font-bold tracking-wider">{monthName}</span>
							<span className="text-xl font-bold">{month.year}</span>
							<span className="px-4 py-1 rounded-full bg-blue-600">{month.theme.name}</span>
						</Heading>

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
