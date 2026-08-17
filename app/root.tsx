import * as stylex from "@stylexjs/stylex";
import React from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { loadRequestUser } from "~/route-context.server";
import { color } from "~/styles/tokens.stylex";
import { DISCORD_INVITE_URL, SITE_NAME, SITE_URL, absoluteUrl, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/root";
import "./global.css";

export const middleware: Route.MiddlewareFunction[] = [loadRequestUser];

export const links: Route.LinksFunction = () => [
	{ rel: "icon", href: "/favicon.ico", sizes: "any" },
	{ rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
	{ rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
	{ rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
	{ rel: "manifest", href: "/site.webmanifest" },
	// Every game cover is served from IGDB.
	{ rel: "preconnect", href: "https://images.igdb.com" },
];

// Fallback for routes without their own meta. Every public route overrides this.
export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: SITE_NAME,
		description:
			"The PatientGamers Discord picks two games to play every month, one short and one long.",
		path: "/",
	});

// Site-wide structured data. Lives in the document rather than in `meta` so it
// survives routes that export their own meta.
const siteSchema = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${SITE_URL}/#website`,
			url: SITE_URL,
			name: SITE_NAME,
			description:
				"The PatientGamers Discord picks two games to play every month, one short and one long. Winners are decided by instant-runoff voting.",
			inLanguage: "en",
			publisher: { "@id": `${SITE_URL}/#organization` },
		},
		{
			"@type": "Organization",
			"@id": `${SITE_URL}/#organization`,
			name: SITE_NAME,
			alternateName: "PG GOTM",
			url: SITE_URL,
			logo: absoluteUrl("/android-chrome-512x512.png"),
			sameAs: [DISCORD_INVITE_URL, "https://github.com/obviyus/gotm-remix"],
		},
	],
};

const styles = stylex.create({
	document: {
		backgroundColor: color.canvas,
		color: color.heading,
		colorScheme: "dark",
	},
	body: {
		backgroundColor: color.canvas,
		color: color.heading,
		position: "relative",
	},
	isolation: {
		isolation: "isolate",
	},
});

function DevStyleX() {
	React.useEffect(() => {
		if (import.meta.env.DEV) {
			void import("virtual:stylex:css-only");
		}
	}, []);

	return import.meta.env.DEV ? <link rel="stylesheet" href="/virtual:stylex.css" /> : null;
}

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" {...stylex.props(styles.document)}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#18181B" />
				<Meta />
				<Links />
				<DevStyleX />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }}
				/>
			</head>
			<body {...stylex.props(styles.body)}>
				<div {...stylex.props(styles.isolation)}>{children}</div>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
