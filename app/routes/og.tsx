import { OgCard } from "~/server/og-card";
import { ogResponse, renderOgImage } from "~/server/og.server";

export async function loader() {
	const png = await renderOgImage(
		<OgCard
			eyebrow="PatientGamers"
			title="Game of the Month"
			subtitle="Two games every month, one short and one long."
		/>,
	);

	return ogResponse(png);
}
