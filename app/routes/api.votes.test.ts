import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RouterContextProvider } from "react-router";
import type { RequestUser } from "~/route-context.server";
import type { Month } from "~/types";

process.env.COOKIE_SECRET ??= "test-cookie-secret-for-vote-api";

type SqlQuery = { sql: string; args: unknown[] };
type QueryResult = { rows: { id?: number }[] };

const emptyResult = (): QueryResult => ({ rows: [] });
const voteResult = (): QueryResult => ({ rows: [{ id: 99 }] });

const executeMock = mock(async (_query: SqlQuery): Promise<QueryResult> => emptyResult());
const transactionExecuteMock = mock(async (_query: SqlQuery): Promise<QueryResult> => voteResult());
const transactionCommitMock = mock(async () => {});
const transactionRollbackMock = mock(async () => {});
const transactionCloseMock = mock(() => {});
const transactionMock = mock(async () => ({
	execute: transactionExecuteMock,
	commit: transactionCommitMock,
	rollback: transactionRollbackMock,
	close: transactionCloseMock,
}));

const getCurrentMonthMock = mock(async (): Promise<Month> => votingMonth);
const invalidateVotingCacheMock = mock((_monthId: number, _short: boolean) => {});
const invalidateVotingTimelapseCacheMock = mock((_monthId: number, _short: boolean) => {});

void mock.module("~/server/database.server", () => ({
	db: {
		execute: executeMock,
		transaction: transactionMock,
	},
}));

void mock.module("~/server/month.server", () => ({
	getCurrentMonth: getCurrentMonthMock,
}));

void mock.module("~/server/voting.server", () => ({
	invalidateVotingCache: invalidateVotingCacheMock,
	invalidateVotingTimelapseCache: invalidateVotingTimelapseCacheMock,
}));

const { action, middleware } = await import("~/routes/api.votes");
const { authenticatedUserContext, requireAuthenticatedUser } =
	await import("~/route-context.server");

const votingMonth: Month = {
	id: 42,
	month: 7,
	year: 2026,
	longLabel: "Long Games",
	shortLabel: "Short Games",
	theme: { id: 1, name: "Theme", description: null },
	status: "voting",
	winners: [],
};

const testUser: RequestUser = {
	discordId: "auth-discord-123",
	discordAvatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
	pseudoHandle: "TestUser",
	isAdmin: false,
};

function createContext(user: RequestUser = testUser): RouterContextProvider {
	const context = new RouterContextProvider();
	context.set(authenticatedUserContext, user);
	return context;
}

function jsonRequest(method: string, body: unknown): Request {
	return new Request("http://localhost/api/votes", {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function invokeAction(request: Request) {
	return action({
		request,
		context: createContext(),
		params: {},
		url: new URL(request.url),
		pattern: "/api/votes",
	});
}

function sqlArg(call: [SqlQuery] | undefined): SqlQuery {
	const query = call?.[0];
	if (!query) {
		throw new Error("Expected SQL query argument");
	}
	return query;
}

function resetMocks() {
	executeMock.mockReset();
	executeMock.mockImplementation(async () => emptyResult());
	transactionExecuteMock.mockReset();
	transactionExecuteMock.mockImplementation(async () => voteResult());
	transactionCommitMock.mockReset();
	transactionCommitMock.mockImplementation(async () => {});
	transactionRollbackMock.mockReset();
	transactionRollbackMock.mockImplementation(async () => {});
	transactionCloseMock.mockReset();
	transactionMock.mockReset();
	transactionMock.mockImplementation(async () => ({
		execute: transactionExecuteMock,
		commit: transactionCommitMock,
		rollback: transactionRollbackMock,
		close: transactionCloseMock,
	}));
	getCurrentMonthMock.mockReset();
	getCurrentMonthMock.mockImplementation(async () => votingMonth);
	invalidateVotingCacheMock.mockReset();
	invalidateVotingTimelapseCacheMock.mockReset();
}

beforeEach(() => {
	resetMocks();
});

describe("/api/votes action", () => {
	test("exports middleware containing requireAuthenticatedUser", () => {
		expect(middleware).toContain(requireAuthenticatedUser);
	});

	test("POST writes authenticated discord id and current month id, ignoring client identity fields", async () => {
		executeMock.mockImplementation(async () => ({ rows: [{ id: 10 }, { id: 11 }] }));

		const response = await invokeAction(
			jsonRequest("POST", {
				short: true,
				order: [10],
				userId: "attacker-id",
				monthId: "999",
			}),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);

		expect(getCurrentMonthMock).toHaveBeenCalled();

		const eligibilityCall = sqlArg(executeMock.mock.calls[0]);
		expect(eligibilityCall.sql).toContain("jury_selected");
		expect(eligibilityCall.args).toEqual([42, 1]);

		expect(transactionMock).toHaveBeenCalledTimes(1);

		const voteInsert = sqlArg(transactionExecuteMock.mock.calls[0]);
		expect(voteInsert.sql).toContain("INSERT INTO votes");
		expect(voteInsert.args).toEqual([42, "auth-discord-123", 1]);
		expect(voteInsert.args).not.toContain("attacker-id");
		expect(voteInsert.args).not.toContain("999");

		expect(invalidateVotingCacheMock).toHaveBeenCalledWith(42, true);
		expect(invalidateVotingTimelapseCacheMock).toHaveBeenCalledWith(42, true);
	});

	test("POST accepts a partial ranking of eligible jury-selected nominations", async () => {
		executeMock.mockImplementation(async () => ({
			rows: [{ id: 10 }, { id: 11 }, { id: 12 }],
		}));

		const response = await invokeAction(jsonRequest("POST", { short: false, order: [12, 10] }));

		expect(response.status).toBe(200);
		expect((await response.json()).success).toBe(true);
		expect(transactionMock).toHaveBeenCalledTimes(1);

		const rankingInserts = transactionExecuteMock.mock.calls
			.map((call) => sqlArg(call))
			.filter((call) => call.sql.includes("INSERT INTO rankings"));

		expect(rankingInserts).toHaveLength(2);
		expect(rankingInserts[0]?.args).toEqual([99, 12, 1]);
		expect(rankingInserts[1]?.args).toEqual([99, 10, 2]);
	});

	test("POST rejects duplicate ranking IDs with 400 and opens no transaction", async () => {
		const response = await invokeAction(jsonRequest("POST", { short: true, order: [10, 10] }));

		expect(response.status).toBe(400);
		expect((await response.json()).success).toBe(false);
		expect(transactionMock).not.toHaveBeenCalled();
		expect(executeMock).not.toHaveBeenCalled();
	});

	test("POST rejects nominations outside eligible jury-selected set with 400 and opens no transaction", async () => {
		executeMock.mockImplementation(async () => ({ rows: [{ id: 10 }, { id: 11 }] }));

		const response = await invokeAction(jsonRequest("POST", { short: true, order: [10, 99] }));

		expect(response.status).toBe(400);
		expect((await response.json()).success).toBe(false);
		expect(transactionMock).not.toHaveBeenCalled();
		expect(executeMock).toHaveBeenCalledTimes(1);
	});

	test("mutations outside voting status return 409 and perform no write", async () => {
		getCurrentMonthMock.mockImplementation(async () => ({
			...votingMonth,
			status: "jury",
		}));

		const postResponse = await invokeAction(jsonRequest("POST", { short: true, order: [10] }));

		expect(postResponse.status).toBe(409);
		const postBody = await postResponse.json();
		expect(postBody.success).toBe(false);
		expect(postBody.error).toBe("Voting is not open");
		expect(transactionMock).not.toHaveBeenCalled();
		expect(executeMock).not.toHaveBeenCalled();

		const deleteResponse = await invokeAction(jsonRequest("DELETE", { short: true }));

		expect(deleteResponse.status).toBe(409);
		expect((await deleteResponse.json()).success).toBe(false);
		expect(executeMock).not.toHaveBeenCalled();
		expect(invalidateVotingCacheMock).not.toHaveBeenCalled();
	});

	test("DELETE removes only the authenticated user's current-month ballot and invalidates caches", async () => {
		const response = await invokeAction(
			jsonRequest("DELETE", {
				short: false,
				userId: "attacker-id",
				monthId: "999",
			}),
		);

		expect(response.status).toBe(200);
		expect((await response.json()).success).toBe(true);

		expect(executeMock).toHaveBeenCalledTimes(1);
		const deleteCall = sqlArg(executeMock.mock.calls[0]);
		expect(deleteCall.sql).toContain("DELETE FROM votes");
		expect(deleteCall.args).toEqual([42, "auth-discord-123", 0]);
		expect(deleteCall.args).not.toContain("attacker-id");
		expect(deleteCall.args).not.toContain("999");

		expect(invalidateVotingCacheMock).toHaveBeenCalledWith(42, false);
		expect(invalidateVotingTimelapseCacheMock).toHaveBeenCalledWith(42, false);
		expect(transactionMock).not.toHaveBeenCalled();
	});

	test("unsupported methods return 405 with Allow header and perform no write", async () => {
		const response = await invokeAction(jsonRequest("PUT", { short: true, order: [10] }));

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST, DELETE");
		expect(executeMock).not.toHaveBeenCalled();
		expect(transactionMock).not.toHaveBeenCalled();
		expect(getCurrentMonthMock).not.toHaveBeenCalled();
	});

	test("malformed JSON or invalid short/order shape returns 400 and performs no write", async () => {
		const cases: Request[] = [
			new Request("http://localhost/api/votes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{not-json",
			}),
			jsonRequest("POST", { order: [10] }),
			jsonRequest("POST", { short: "true", order: [10] }),
			jsonRequest("POST", { short: true }),
			jsonRequest("POST", { short: true, order: "10" }),
			jsonRequest("POST", { short: true, order: [] }),
			jsonRequest("POST", { short: true, order: [0] }),
			jsonRequest("POST", { short: true, order: [-1] }),
			jsonRequest("POST", { short: true, order: [1.5] }),
			jsonRequest("POST", { short: true, order: ["10"] }),
			jsonRequest("DELETE", { short: "yes" }),
			jsonRequest("DELETE", {}),
		];

		for (const request of cases) {
			resetMocks();
			const response = await invokeAction(request);

			expect(response.status).toBe(400);
			expect((await response.json()).success).toBe(false);
			expect(executeMock).not.toHaveBeenCalled();
			expect(transactionMock).not.toHaveBeenCalled();
			expect(getCurrentMonthMock).not.toHaveBeenCalled();
		}
	});
});
