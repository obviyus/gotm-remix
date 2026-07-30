import { OgCard } from "~/server/og-card";
import { ogResponse, renderOgImage } from "~/server/og.server";

export async function loader() {
	const png = await renderOgImage(
		<OgCard
			eyebrow="PatientGamers"
			title="Game of the Month"
			subtitle="One short game and one long game, picked together every month."
			footnote="Nominate · Vote · Play"
		/>,
	);

	return ogResponse(png);
}
