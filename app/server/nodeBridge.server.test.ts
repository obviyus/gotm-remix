import { request, createServer } from "node:http";
import { afterEach, describe, expect, test } from "bun:test";
import { writeNodeResponse } from "./nodeBridge.server";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
	await Promise.all(
		servers.splice(0).map(
			(server) =>
				new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
				}),
		),
	);
});

describe("node response bridge", () => {
	test("preserves duplicate Set-Cookie headers", async () => {
		const headers = new Headers();
		headers.append("Set-Cookie", "session=abc; Path=/; HttpOnly");
		headers.append("Set-Cookie", "theme=dark; Path=/");

		const response = await serveResponse(new Response("ok", { headers }), "GET");

		expect(response.cookies).toEqual(["session=abc; Path=/; HttpOnly", "theme=dark; Path=/"]);
		expect(response.body).toBe("ok");
	});

	test("omits response bodies for HEAD requests", async () => {
		const response = await serveResponse(new Response("not sent"), "HEAD");

		expect(response.body).toBe("");
	});
});

async function serveResponse(response: Response, method: "GET" | "HEAD") {
	const server = createServer((req, res) => {
		void writeNodeResponse(res, response.clone(), req.method);
	});
	servers.push(server);

	const port = await new Promise<number>((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (typeof address === "object" && address) {
				resolve(address.port);
			}
		});
	});

	return new Promise<{ body: string; cookies: string[] }>((resolve, reject) => {
		const req = request({ host: "127.0.0.1", port, path: "/", method }, (res) => {
			const chunks: Buffer[] = [];
			res.on("data", (chunk: Buffer) => chunks.push(chunk));
			res.on("end", () => {
				resolve({
					body: Buffer.concat(chunks).toString("utf8"),
					cookies: res.headers["set-cookie"] ?? [],
				});
			});
		});
		req.on("error", reject);
		req.end();
	});
}
