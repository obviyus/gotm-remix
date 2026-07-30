import { describe, expect, test } from "bun:test";
import { absoluteUrl, monthLabel, pageMeta } from "~/utils/seo";

function contentOf(descriptors: ReturnType<typeof pageMeta>, key: string): string | undefined {
	for (const descriptor of descriptors) {
		if ("name" in descriptor && descriptor.name === key) {
			return String(descriptor.content);
		}
		if ("property" in descriptor && descriptor.property === key) {
			return String(descriptor.content);
		}
	}
}

describe("pageMeta", () => {
	const meta = pageMeta({ title: "Stats", description: "Numbers.", path: "/stats" });

	test("canonical and og:url point at the page, not the site root", () => {
		const canonical = meta.find((d) => "rel" in d && d.rel === "canonical");

		expect(canonical).toEqual({
			tagName: "link",
			rel: "canonical",
			href: "https://pg-gotm.com/stats",
		});
		expect(contentOf(meta, "og:url")).toBe("https://pg-gotm.com/stats");
	});

	test("declares a card image so social embeds are never blank", () => {
		expect(contentOf(meta, "og:image")).toBe("https://pg-gotm.com/og");
		expect(contentOf(meta, "twitter:image")).toBe("https://pg-gotm.com/og");
		expect(contentOf(meta, "twitter:card")).toBe("summary_large_image");
	});

	test("omits robots unless the page opts out of indexing", () => {
		expect(contentOf(meta, "robots")).toBeUndefined();
		expect(
			contentOf(pageMeta({ title: "T", description: "D", path: "/p", noIndex: true }), "robots"),
		).toBe("noindex, follow");
	});

	test("resolves a per-month card image", () => {
		const monthMeta = pageMeta({
			title: "T",
			description: "D",
			path: "/history/12",
			image: "/og/month/12",
		});

		expect(contentOf(monthMeta, "og:image")).toBe("https://pg-gotm.com/og/month/12");
	});
});

describe("absoluteUrl", () => {
	test("resolves site paths", () => {
		expect(absoluteUrl("/history/12")).toBe("https://pg-gotm.com/history/12");
	});

	test("gives protocol-relative IGDB covers a scheme", () => {
		expect(absoluteUrl("//images.igdb.com/a.jpg")).toBe("https://images.igdb.com/a.jpg");
	});

	test("leaves absolute urls alone", () => {
		expect(absoluteUrl("https://images.igdb.com/a.jpg")).toBe("https://images.igdb.com/a.jpg");
	});
});

describe("monthLabel", () => {
	test("formats month and year", () => {
		expect(monthLabel(1, 2025)).toBe("January 2025");
		expect(monthLabel(12, 2024)).toBe("December 2024");
	});
});
