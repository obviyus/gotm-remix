import { Resvg, initWasm } from "@resvg/resvg-wasm";
import satori from "satori";
import type { ReactNode } from "react";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Read straight out of node_modules rather than bundling: the runtime image
// copies these packages in the same way it copies @libsql.
const RESVG_WASM = "node_modules/@resvg/resvg-wasm/index_bg.wasm";
const FONT_REGULAR = "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff";
const FONT_BOLD = "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff";

async function loadRenderer() {
	const [wasm, regular, bold] = await Promise.all([
		Bun.file(RESVG_WASM).arrayBuffer(),
		Bun.file(FONT_REGULAR).arrayBuffer(),
		Bun.file(FONT_BOLD).arrayBuffer(),
	]);

	await initWasm(wasm);

	return [
		{ name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
		{ name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
	];
}

declare global {
	// initWasm() throws if called twice in a process, and Vite re-instantiates
	// server modules on change, so this has to outlive the module instance.
	var ogRenderer: ReturnType<typeof loadRenderer> | undefined;
}

export async function renderOgImage(element: ReactNode): Promise<Uint8Array<ArrayBuffer>> {
	globalThis.ogRenderer ??= loadRenderer();
	const fonts = await globalThis.ogRenderer;

	const svg = await satori(element, { width: OG_WIDTH, height: OG_HEIGHT, fonts });

	return Uint8Array.from(new Resvg(svg).render().asPng());
}

export function ogResponse(png: Uint8Array<ArrayBuffer>): Response {
	return new Response(png, {
		headers: {
			"Content-Type": "image/png",
			// Cards change only when a month does; let Cloudflare hold them.
			"Cache-Control": "public, max-age=3600, s-maxage=86400",
		},
	});
}

/** Satori cannot fetch remote images, so covers are inlined as data URIs. */
export async function toDataUri(url: string): Promise<string | null> {
	const response = await fetch(url.startsWith("//") ? `https:${url}` : url);

	if (!response.ok) {
		return null;
	}

	const contentType = response.headers.get("content-type") ?? "image/jpeg";
	const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");

	return `data:${contentType};base64,${base64}`;
}
