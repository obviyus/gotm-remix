import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, spyOn } from "bun:test";
import { createClient } from "@libsql/client";
import { RouterContextProvider } from "react-router";

process.env.COOKIE_SECRET = "isolated-route-test-secret";
process.env.DISCORD_CLIENT_ID = "test-client";
process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
process.env.DISCORD_REDIRECT_URI = "http://localhost/auth/discord/callback";

// libSQL opens a new connection after each transaction, so use a temporary file.
const directory = mkdtempSync(join(tmpdir(), "gotm-route-test-"));
const db = createClient({ url: `file:${join(directory, "test.db")}` });
process.on("exit", () => {
	db.close();
	rmSync(directory, { recursive: true });
});
await db.executeMultiple(await Bun.file(new URL("../../db/schema.sql", import.meta.url)).text());
await mock.module("~/server/database.server", () => ({ db }));
await mock.module("~/server/igdb.server", () => ({ searchGames: async () => [] }));
let respond: (input: URL | RequestInfo) => Promise<Response> = async () => {
	throw new Error("Unexpected network request");
};
const fetchMock = spyOn(globalThis, "fetch").mockImplementation(
	Object.assign((input: URL | RequestInfo) => respond(input), { preconnect() {} }),
);

const { authenticatedUserContext } = await import("~/route-context.server");
const { action: nominate } = await import("~/routes/nominate");
const { loader: startLogin } = await import("~/routes/auth.discord");
const { loader: finishLogin } = await import("~/routes/auth.discord.callback");
const { getSession, commitSession } = await import("~/sessions");
const { updateNominationCategory } = await import("~/server/nomination.server");
const { calculateVotingResults } = await import("~/server/voting.server");
const { getWinnerName } = await import("~/utils/votingResults");
const { loader: loadBallot } = await import("~/routes/voting");
const { buildOrderFromRankings } = await import("~/utils/votingOrder");

await db.executeMultiple(`
INSERT INTO month_status(id,status) VALUES (1,'nominating'),(2,'jury'),(3,'voting'),(4,'playing'),(5,'over'),(6,'complete'),(7,'ready');
INSERT INTO theme_categories(id,name) VALUES(1,'Test');
INSERT INTO themes(id,theme_category_id,name) VALUES(1,1,'Test');
INSERT INTO months(id,theme_id,year,month,status_id) VALUES(41,1,2026,8,5),(42,1,2026,9,1);
INSERT INTO nominations(id,month_id,game_id,discord_id,short,game_name,jury_selected)
VALUES(1,42,101,'100',1,'Current',0),(2,42,102,'200',0,'Other member',0),(3,41,103,'100',1,'Previous',1);
INSERT INTO pitches(nomination_id,discord_id,pitch) VALUES(1,'100','Original'),(1,'200','Other pitch'),(3,'100','Historical');
INSERT INTO votes(id,month_id,discord_id,short) VALUES(1,41,'200',1);
INSERT INTO rankings(vote_id,nomination_id,rank) VALUES(1,3,1);
`);

const context = new RouterContextProvider();
context.set(authenticatedUserContext, {
	discordId: "100",
	discordAvatarUrl: "",
	pseudoHandle: "Test member",
	isAdmin: false,
});
function args(request: Request) {
	return {
		request,
		url: new URL(request.url),
		params: {},
		context,
		pattern: new URL(request.url).pathname,
	};
}
async function submit(method: string, data: Record<string, string>) {
	return nominate(
		args(
			new Request("http://localhost/nominate", {
				method,
				body: new URLSearchParams(data),
			}),
		),
	);
}
function createData(monthId = "42", gameId = "104") {
	return {
		intent: "createNomination",
		monthId,
		gameId,
		gameName: "New nomination",
		short: "true",
		pitch: "New pitch",
	};
}
async function snapshot() {
	return Promise.all(
		["nominations", "pitches", "rankings"].map(
			async (table) => (await db.execute(`SELECT * FROM ${table} ORDER BY id`)).rows,
		),
	);
}
const original = await snapshot();

// An active month does not authorize changes to a historical nomination.
for (const [method, data] of [
	["POST", createData("41")],
	["PATCH", { nominationId: "3", intent: "savePitch", pitch: "Changed" }],
	["PATCH", { nominationId: "3", intent: "deletePitch" }],
	["DELETE", { nominationId: "3" }],
] satisfies Array<[string, Record<string, string>]>) {
	assert.equal((await submit(method, data)).status, 409);
	assert.deepEqual(await snapshot(), original);
}

// An already-open page must stop working as soon as its phase closes.
for (const statusId of [2, 3, 4, 5, 6, 7]) {
	await db.execute({ sql: "UPDATE months SET status_id=? WHERE id=42", args: [statusId] });
	for (const [method, data] of [
		["POST", createData()],
		["PATCH", { nominationId: "1", intent: "savePitch", pitch: "Changed" }],
		["PATCH", { nominationId: "2", intent: "savePitch", pitch: "Added" }],
		["PATCH", { nominationId: "1", intent: "deletePitch" }],
		["DELETE", { nominationId: "1" }],
	] satisfies Array<[string, Record<string, string>]>) {
		assert.equal((await submit(method, data)).status, 409);
		assert.deepEqual(await snapshot(), original);
	}
}
await db.execute("UPDATE months SET status_id=1 WHERE id=42");
assert.equal((await submit("DELETE", { nominationId: "2" })).status, 404);
assert.equal((await submit("POST", createData())).status, 200);
assert.equal(
	(await submit("PATCH", { nominationId: "1", intent: "savePitch", pitch: "Edited" })).status,
	200,
);
assert.equal(
	(await db.execute("SELECT pitch FROM pitches WHERE nomination_id=1 AND discord_id='100'")).rows[0]
		.pitch,
	"Edited",
);
assert.equal(
	(await submit("PATCH", { nominationId: "2", intent: "savePitch", pitch: "Added" })).status,
	200,
);
assert.equal((await submit("PATCH", { nominationId: "1", intent: "deletePitch" })).status, 200);
assert.equal(
	(await db.execute("SELECT pitch FROM pitches WHERE nomination_id=1 AND discord_id='200'")).rows[0]
		.pitch,
	"Other pitch",
);
assert.equal((await submit("DELETE", { nominationId: "1" })).status, 200);
assert.equal(
	(await db.execute("SELECT COUNT(*) AS n FROM rankings WHERE nomination_id=3")).rows[0].n,
	1,
);

// A failure writing the pitch must not leave a half-created nomination.
await db.executeMultiple(
	"CREATE TRIGGER reject_test_pitch BEFORE INSERT ON pitches WHEN NEW.pitch='Reject this pitch' BEGIN SELECT RAISE(ABORT,'test pitch failure'); END;",
);
const errorLog = spyOn(console, "error").mockImplementation(() => {});
assert.equal(
	(await submit("POST", { ...createData("42", "105"), pitch: "Reject this pitch" })).status,
	500,
);
errorLog.mockRestore();
assert.equal(
	(await db.execute("SELECT COUNT(*) AS n FROM nominations WHERE game_id=105")).rows[0].n,
	0,
);

// Exercise the category change, result query, and returning voter's ballot together.
await db.executeMultiple(`
UPDATE months SET status_id=3 WHERE id=42;
INSERT INTO nominations(id,month_id,game_id,discord_id,short,game_name,jury_selected)
VALUES(10,42,110,'100',0,'A',1),(11,42,111,'200',0,'B',1),(12,42,112,'300',0,'C',1);
INSERT INTO votes(id,month_id,discord_id,short) VALUES(10,42,'100',0),(11,42,'200',0),(12,42,'300',0);
INSERT INTO rankings(vote_id,nomination_id,rank) VALUES(10,10,1),(10,11,2),(11,10,1),(11,11,2),(12,12,1);
`);
await updateNominationCategory(10, true);
const infoLog = spyOn(console, "log").mockImplementation(() => {});
assert.equal(getWinnerName(await calculateVotingResults(42, false)), "B");
infoLog.mockRestore();
const loadedBallot = await loadBallot(args(new Request("http://localhost/voting")));
assert(!(loadedBallot instanceof Response));
assert.deepEqual(buildOrderFromRankings(loadedBallot.longNominations, loadedBallot.longRankings), [
	"11",
	"divider",
	"12",
]);

function cookie(response: Response) {
	const value = response.headers.get("Set-Cookie");
	assert(value);
	return value.split(";")[0];
}
async function start() {
	const response = await startLogin(args(new Request("http://localhost/auth/discord")));
	const location = response.headers.get("Location");
	assert(location);
	const state = new URL(location).searchParams.get("state");
	assert(state);
	return { state, cookie: cookie(response) };
}
async function finish(query: Record<string, string>, sessionCookie?: string) {
	return finishLogin(
		args(
			new Request(`http://localhost/auth/discord/callback?${new URLSearchParams(query)}`, {
				headers: sessionCookie ? { Cookie: sessionCookie } : {},
			}),
		),
	);
}
const first = await start();
const second = await start();
assert.notEqual(first.state, second.state);
assert.equal((await getSession(first.cookie)).get("discordOAuthState")?.value, first.state);
const expiredSession = await getSession(first.cookie);
expiredSession.set("discordOAuthState", { value: first.state, expiresAt: Date.now() - 1 });
const expiredCookie = (await commitSession(expiredSession)).split(";")[0];
for (const [query, sessionCookie] of [
	[{ code: "code" }, first.cookie],
	[{ code: "code", state: first.state }, undefined],
	[{ code: "code", state: second.state }, first.cookie],
	[{ code: "code", state: first.state }, expiredCookie],
] satisfies Array<[Record<string, string>, string | undefined]>) {
	const response = await finish(query, sessionCookie);
	assert.equal(response.headers.get("Location"), "/?error=auth_failed");
	assert.equal((await getSession(cookie(response))).get("discordOAuthState"), undefined);
}
assert.equal(fetchMock.mock.calls.length, 0);
const denied = await finish({ error: "access_denied", state: first.state }, first.cookie);
assert.equal(denied.headers.get("Location"), "/?error=user_denied");
assert.equal((await getSession(cookie(denied))).get("discordOAuthState"), undefined);

respond = async (input) => {
	const url = String(input);
	if (url === "https://discord.com/api/oauth2/token")
		return Response.json({ access_token: "test-token" });
	assert.equal(url, "https://discord.com/api/users/@me");
	return Response.json({ id: "123456789012345678", avatar: null });
};
const success = await finish({ code: "valid-code", state: second.state }, second.cookie);
assert.equal(success.headers.get("Location"), "/voting");
const signedIn = await getSession(cookie(success));
assert.equal(signedIn.get("discordId"), "123456789012345678");
assert.equal(signedIn.get("discordOAuthState"), undefined);
assert.equal(fetchMock.mock.calls.length, 2);
const replay = await finish({ code: "valid-code", state: second.state }, cookie(success));
assert.equal(replay.headers.get("Location"), "/?error=auth_failed");
assert.equal(fetchMock.mock.calls.length, 2);

const failedAttempt = await start();
respond = async () => new Response(null, { status: 400 });
const authErrorLog = spyOn(console, "error").mockImplementation(() => {});
const failed = await finish({ code: "bad-code", state: failedAttempt.state }, failedAttempt.cookie);
authErrorLog.mockRestore();
assert.equal(failed.headers.get("Location"), "/?error=auth_failed");
assert.equal((await getSession(cookie(failed))).get("discordOAuthState"), undefined);
fetchMock.mockRestore();
console.log("Route regressions passed");
