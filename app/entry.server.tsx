import { PassThrough } from "node:stream";

import type {
	EntryContext,
	InstrumentationHandlerResult,
	RouterContextProvider,
	ServerInstrumentation,
} from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";

// AIDEV-NOTE: Increased from default 5s to 30s to allow IGDB pagination to complete
export const streamTimeout = 30_000;

const ROUTE_TIMING_LOG_MS = 250;
const REQUEST_TIMING_LOG_MS = 500;

function getPathname(requestUrl: string) {
	return new URL(requestUrl).pathname;
}

async function measureRouterWork(
	label: string,
	thresholdMs: number,
	callHandler: () => Promise<InstrumentationHandlerResult>,
): Promise<void> {
	const start = performance.now();
	const result = await callHandler();
	const durationMs = Math.round(performance.now() - start);

	if (result.status === "error") {
		console.error(`[router] ${label} failed after ${durationMs}ms`, result.error);
		return;
	}

	if (durationMs >= thresholdMs) {
		console.info(`[router] ${label} completed in ${durationMs}ms`);
	}
}

export const instrumentations: ServerInstrumentation[] = [
	{
		handler(handler) {
			handler.instrument({
				async request(callRequest, { request }) {
					await measureRouterWork(
						`${request.method} ${getPathname(request.url)}`,
						REQUEST_TIMING_LOG_MS,
						callRequest,
					);
				},
			});
		},
		route(route) {
			route.instrument({
				async loader(callLoader, { pattern, request }) {
					await measureRouterWork(
						`loader ${route.id} ${pattern} ${getPathname(request.url)}`,
						ROUTE_TIMING_LOG_MS,
						callLoader,
					);
				},
				async action(callAction, { pattern, request }) {
					await measureRouterWork(
						`action ${route.id} ${pattern} ${getPathname(request.url)}`,
						ROUTE_TIMING_LOG_MS,
						callAction,
					);
				},
				async middleware(callMiddleware, { pattern, request }) {
					await measureRouterWork(
						`middleware ${route.id} ${pattern} ${getPathname(request.url)}`,
						ROUTE_TIMING_LOG_MS,
						callMiddleware,
					);
				},
			});
		},
	},
];

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	_loadContext: RouterContextProvider,
) {
	if (request.method.toUpperCase() === "HEAD") {
		return new Response(null, {
			status: responseStatusCode,
			headers: responseHeaders,
		});
	}

	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const userAgent = request.headers.get("user-agent");

		const readyOption: keyof RenderToPipeableStreamOptions =
			(userAgent && isbot(userAgent)) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";

		let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
			() => abort(),
			streamTimeout + 1000,
		);

		const { pipe, abort } = renderToPipeableStream(
			<ServerRouter context={routerContext} url={request.url} />,
			{
				[readyOption]() {
					shellRendered = true;
					const body = new PassThrough({
						final(callback) {
							clearTimeout(timeoutId);
							timeoutId = undefined;
							callback();
						},
					});
					const stream = createReadableStreamFromReadable(body);

					responseHeaders.set("Content-Type", "text/html");

					pipe(body);

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					responseStatusCode = 500;
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);
	});
}
