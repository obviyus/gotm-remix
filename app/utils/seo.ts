import type { MetaDescriptor } from "react-router";

export const SITE_URL = "https://pg-gotm.com";
export const SITE_NAME = "PG Game of the Month";
export const DISCORD_INVITE_URL = "https://discord.gg/EJ6bXaz";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function monthLabel(month: number, year: number): string {
	return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Resolves site paths, protocol-relative IGDB covers, and absolute URLs alike. */
export function absoluteUrl(path: string): string {
	return new URL(path, SITE_URL).toString();
}

interface PageMetaOptions {
	title: string;
	description: string;
	path: string;
	/** Root-relative image URL. Defaults to the generic site card. */
	image?: string;
	/** Useful to members, not worth indexing (infinite date space, auth walls). */
	noIndex?: boolean;
}

export function pageMeta({
	title,
	description,
	path,
	image = "/og",
	noIndex = false,
}: PageMetaOptions): MetaDescriptor[] {
	const url = absoluteUrl(path);
	const imageUrl = absoluteUrl(image);

	return [
		{ title },
		{ name: "description", content: description },
		{ tagName: "link", rel: "canonical", href: url },
		...(noIndex ? [{ name: "robots", content: "noindex, follow" }] : []),
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: url },
		{ property: "og:image", content: imageUrl },
		{ property: "og:image:width", content: "1200" },
		{ property: "og:image:height", content: "630" },
		{ property: "og:image:alt", content: title },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: imageUrl },
	];
}
