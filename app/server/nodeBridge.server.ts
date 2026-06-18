import type { IncomingMessage, ServerResponse } from "node:http";
import {
	createReadableStreamFromReadable,
	writeReadableStreamToWritable,
} from "@react-router/node";

export function createNodeRequest(req: IncomingMessage, fallbackHost: string) {
	const origin = `http://${req.headers.host ?? fallbackHost}`;
	const url = new URL(req.url ?? "/", origin);
	const headers = new Headers();

	for (const [name, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(name, item);
			}
			continue;
		}

		if (value) {
			headers.set(name, value);
		}
	}

	const body =
		req.method === "GET" || req.method === "HEAD"
			? undefined
			: createReadableStreamFromReadable(req);

	return new Request(url, {
		method: req.method,
		headers,
		body,
	});
}

export async function writeNodeResponse(
	res: ServerResponse,
	response: Response,
	method: string | undefined,
) {
	res.statusCode = response.status;
	res.statusMessage = response.statusText;
	writeHeaders(res, response.headers);

	if (method === "HEAD") {
		res.end();
		return;
	}

	if (response.body) {
		await writeReadableStreamToWritable(response.body, res);
		return;
	}

	res.end();
}

function writeHeaders(res: ServerResponse, headers: Headers) {
	const setCookie = headers.getSetCookie();

	headers.forEach((value, name) => {
		if (name !== "set-cookie") {
			res.setHeader(name, value);
		}
	});

	if (setCookie.length) {
		res.setHeader("set-cookie", setCookie);
	}
}
