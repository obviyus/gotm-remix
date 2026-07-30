import { getMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { OgCard } from "~/server/og-card";
import { ogResponse, renderOgImage, toDataUri } from "~/server/og.server";
import { getWinner } from "~/server/winner.server";
import { monthLabel } from "~/utils/seo";
import type { Route } from "./+types/og.month";

export async function loader({ params }: Route.LoaderArgs) {
	const monthId = Number(params.monthId);

	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	const month = await getMonth(monthId);
	const [longWinner, shortWinner, nominations] = await Promise.all([
		getWinner(monthId, false),
		getWinner(monthId, true),
		getNominationsForMonth(monthId),
	]);

	const winners = [longWinner, shortWinner].filter((winner) => winner !== null);
	const coverUrls = winners.length
		? winners.map((winner) => winner.gameCover)
		: nominations
				.filter((nomination) => nomination.jurySelected)
				.slice(0, 3)
				.map((nomination) => nomination.gameCover);

	const covers = (
		await Promise.all(coverUrls.filter(Boolean).map((url) => toDataUri(url as string)))
	).filter((cover) => cover !== null);

	const footnote = winners.length
		? `Won by ${winners.map((winner) => winner.gameName).join(" · ")}`
		: `${nominations.length} games nominated`;

	const png = await renderOgImage(
		<OgCard
			eyebrow={monthLabel(month.month, month.year)}
			title={month.theme.name}
			subtitle={month.theme.description ?? undefined}
			covers={covers}
			footnote={footnote}
		/>,
	);

	return ogResponse(png);
}
