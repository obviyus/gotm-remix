import { SITE_URL } from "~/utils/seo";

// /patience is deliberately absent: it carries a `noindex` meta tag, and a
// Disallow here would stop crawlers from ever reading that tag.
const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /auth
Disallow: /api

Sitemap: ${SITE_URL}/sitemap.xml
`;

export function loader() {
	return new Response(robots, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
