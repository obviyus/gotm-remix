import { getMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { OgCard } from "~/server/og-card";
import { ogResponse, renderOgImage, toDataUri } from "~/server/og.server";
import { getWinner } from "~/server/winner.server";
import globalCache from "~/utils/cache.server";
import { monthLabel } from "~/utils/seo";
import type { Route } from "./+types/og.month";

const CARD_TTL = 60 * 60 * 1000;

export async function loader({ params }: Route.LoaderArgs) {
	const monthId = Number(params.monthId);

	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	const cacheKey = `og-card-${monthId}`;
	const cached = globalCache.get<Uint8Array<ArrayBuffer>>(cacheKey);

	if (cached) {
		return ogResponse(cached);
	}

	const month = await getMonth(monthId);

	// Same gate the archive page uses: asking for a winner earlier makes
	// getWinner compute and store one, which a card request has no business doing.
	const hasResults =
		month.status === "over" || month.status === "complete" || month.status === "playing";

	const winners = hasResults
		? (await Promise.all([getWinner(monthId, false), getWinner(monthId, true)])).filter(
				(winner) => winner !== null,
			)
		: [];

	// Winners and shortlisted nominations are the same shape, so the card shows
	// whichever set the month has reached without treating either as special.
	const featured = winners.length
		? { games: winners, footnote: `Won by ${winners.map((w) => w.gameName).join(" · ")}` }
		: await shortlist(monthId);

	const covers = (
		await Promise.all(
			featured.games
				.map((game) => game.gameCover)
				.filter((cover) => cover !== undefined)
				.map((cover) => toDataUri(cover)),
		)
	).filter((cover) => cover !== null);

	const png = await renderOgImage(
		<OgCard
			eyebrow={monthLabel(month.month, month.year)}
			title={month.theme.name}
			subtitle={month.theme.description ?? undefined}
			covers={covers}
			footnote={featured.footnote}
		/>,
	);

	globalCache.set(cacheKey, png, CARD_TTL);

	return ogResponse(png);
}

async function shortlist(monthId: number) {
	const nominations = await getNominationsForMonth(monthId);

	return {
		games: nominations.filter((nomination) => nomination.jurySelected).slice(0, 3),
		footnote: `${nominations.length} games nominated`,
	};
}
