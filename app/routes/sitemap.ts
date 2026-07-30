import { getMonths } from "~/server/month.server";
import { SITE_URL } from "~/utils/seo";

const STATIC_PATHS = ["/", "/history", "/stats", "/jury", "/privacy"];

export async function loader() {
	const months = await getMonths();

	// Months still taking nominations have no archive page yet; /history hides
	// them too, so listing them here would only advertise thin pages.
	const paths = [
		...STATIC_PATHS,
		...months
			.filter((month) => month.status !== "nominating")
			.map((month) => `/history/${month.id}`),
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `\t<url><loc>${SITE_URL}${path}</loc></url>`).join("\n")}
</urlset>
`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
