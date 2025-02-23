import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "@remix-run/react";
import type { MetaFunction } from "@remix-run/react";

import "./tailwind.css";

export const meta: MetaFunction = () => {
	return [
		{ title: "PG GOTM" },
		{ name: "description", content: "Vote for and discover the PG Discord Game of the Month! Join our community in selecting and playing both short and long games every month." },
		{ name: "theme-color", content: "#18181B" },  // zinc-900 color
		{ property: "og:title", content: "PG Game of the Month" },
		{ property: "og:description", content: "Vote for and discover the PG Discord Game of the Month! Join our community in selecting and playing both short and long games every month." },
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://pg-gotm.com" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: "PG GOTM" },
		{ name: "twitter:description", content: "Vote for and discover the PG Discord Game of the Month!" },
	];
};

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="bg-zinc-900 text-zinc-100">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="prose lg:prose-xl bg-zinc-900 text-zinc-100">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
