app/root.tsx
```
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { MetaFunction } from "react-router";

import "./tailwind.css";

export const meta: MetaFunction = () => {
	return [
		{ title: "PG GOTM" },
		{
			name: "description",
			content:
				"Vote for and discover the PG Discord Game of the Month! Join our community in selecting and playing both short and long games every month.",
		},
		{ name: "theme-color", content: "#18181B" }, // zinc-900 color
		{ property: "og:title", content: "PG Game of the Month" },
		{
			property: "og:description",
			content:
				"Vote for and discover the PG Discord Game of the Month! Join our community in selecting and playing both short and long games every month.",
		},
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://pg-gotm.com" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: "PG GOTM" },
		{
			name: "twitter:description",
			content: "Vote for and discover the PG Discord Game of the Month!",
		},
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

```
app/routes.ts
```typescript
import {
	type RouteConfig,
	route,
	index,
	layout,
	prefix,
} from "@react-router/dev/routes";

export default [
	// Main layout with all child routes
	layout("./routes/layout.tsx", [
		// Home page (index)
		index("./routes/home/index.tsx"),

		// Simple pages
		route("privacy", "./routes/privacy/index.tsx"),
		route("voting", "./routes/voting/index.tsx"),
		route("nominate", "./routes/nominate/index.tsx"),
		route("jury", "./routes/jury/index.tsx"),

		// History routes
		...prefix("history", [
			index("./routes/history/index.tsx"),
			route(":monthId", "./routes/history/monthId/index.tsx"),
		]),

		// Admin routes
		...prefix("admin", [
			index("./routes/admin/index.tsx"),
			route(":monthId", "./routes/admin/monthId/index.tsx"),
		]),
	]),

	// Auth routes
	...prefix("auth", [
		route("logout", "./routes/auth/logout.tsx"),

		// Discord auth routes
		...prefix("discord", [
			index("./routes/auth/discord/index.tsx"),
			route("callback", "./routes/auth/discord/callback/index.tsx"),
		]),
	]),

	// API routes
	...prefix("api", [
		route("votes", "./routes/api/votes.ts"),
		route("nominations", "./routes/api/nominations.ts"),
	]),
] satisfies RouteConfig;

```
app/sessions.ts
```typescript
import { createCookieSessionStorage } from "react-router";

type SessionData = {
	discordId: string;
	accessToken: string;
};

type SessionFlashData = {
	error: string;
};

const { getSession, commitSession, destroySession } =
	createCookieSessionStorage<SessionData, SessionFlashData>({
		cookie: {
			name: "__session",
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secrets: [process.env.COOKIE_SECRET ?? "secret"],
			secure: process.env.NODE_ENV === "production",
		},
	});

export { getSession, commitSession, destroySession };

```
app/types.ts
```typescript
export interface Pitch {
	id: number;
	nominationId: number;
	pitch: string;
	discordId: string;
	generatedName: string;
}

export interface Nomination {
	id: number;
	gameId: string;
	short: boolean;
	jurySelected: boolean;
	monthId: number;
	gameName: string;
	summary?: string;
	gameYear: string;
	gameCover?: string;
	gameUrl: string;
	discordId: string;
	pitches: Pitch[];
}

export interface Vote {
	id: number;
	monthId: number;
	discordId: string;
	short: boolean;
}

export interface Ranking {
	voteId: number;
	nominationId: number;
	rank: number;
}

export interface Theme {
	id: number;
	name: string;
	description: string | null;
}

export interface ThemeCategory {
	id: number;
	name: string;
}

export interface Month {
	id: number;
	month: number;
	year: number;
	theme: Theme;
	status:
		| "nominating"
		| "jury"
		| "voting"
		| "complete"
		| "playing"
		| "over"
		| "ready";
	winners: Nomination[];
}

export interface NominationFormData {
	game: {
		id: number;
		name: string;
		cover?: string;
		firstReleaseDate?: number;
		gameYear?: string;
		summary?: string;
		url?: string;
	};
	monthId: string;
	short: boolean;
	pitch?: string | null;
}

```
app/server/database.server.ts
```typescript
import { createClient } from "@libsql/client";

export const db = createClient({
	url: process.env.TURSO_DATABASE_URL ?? "",
	authToken: process.env.TURSO_AUTH_TOKEN,
});

```
app/server/igdb.server.ts
```typescript
import stringSimilarity from "string-similarity";
import type { Nomination } from "~/types";

type TwitchAuth = {
	access_token: string;
	expires_in: number;
	token_type: string;
};

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

async function getIGDBToken() {
	// Add a buffer of 5 minutes before token expiry to handle clock skew
	if (cachedToken && tokenExpiry && Date.now() + 300000 < tokenExpiry) {
		return cachedToken;
	}

	try {
		const response = await fetch("https://id.twitch.tv/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				client_id: process.env.TWITCH_CLIENT_ID,
				client_secret: process.env.TWITCH_CLIENT_SECRET,
				grant_type: "client_credentials",
			}),
		});

		if (!response.ok) {
			console.error("Twitch Auth Error:", {
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries()),
			});
			const errorText = await response.text();
			console.error("Twitch Auth Error Response:", errorText);
			throw new Error(
				`Twitch auth error: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as TwitchAuth;
		cachedToken = data.access_token;
		// Store expiry as absolute timestamp
		tokenExpiry = Date.now() + data.expires_in * 1000;

		return cachedToken;
	} catch (error) {
		console.error("Failed to get IGDB token:", error);
		throw new Error("Failed to authenticate with IGDB");
	}
}

export async function searchGames(query: string): Promise<Nomination[]> {
	if (!process.env.TWITCH_CLIENT_ID) {
		throw new Error("TWITCH_CLIENT_ID must be defined");
	}

	const token = await getIGDBToken();

	const response = await fetch("https://api.igdb.com/v4/games", {
		method: "POST",
		headers: {
			"Client-ID": process.env.TWITCH_CLIENT_ID,
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: `search "${query}";
			  fields name, cover.url, first_release_date, summary, url;
			  where version_parent = null;
			  limit 100;`,
	});

	if (!response.ok) {
		console.error("IGDB API Error:", {
			status: response.status,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers.entries()),
		});
		const errorText = await response.text();
		console.error("IGDB API Error Response:", errorText);
		throw new Error(
			`IGDB API error: ${response.status} ${response.statusText}`,
		);
	}

	const games = await response.json();

	if (!Array.isArray(games)) {
		console.error("IGDB API returned unexpected response:", games);
		throw new Error("IGDB API returned invalid response format");
	}

	// Sort games by name similarity to the search query and return top 10
	return games
		.sort((a, b) => {
			const similarityA = stringSimilarity.compareTwoStrings(
				query.toLowerCase(),
				a.name.toLowerCase(),
			);
			const similarityB = stringSimilarity.compareTwoStrings(
				query.toLowerCase(),
				b.name.toLowerCase(),
			);
			return similarityB - similarityA;
		})
		.slice(0, 10)
		.map((game) => ({
			id: game.id,
			short: false,
			jurySelected: false,
			monthId: 0,
			discordId: "",
			pitches: [],
			gamePlatformIds: "",
			gameId: game.id,
			gameName: game.name,
			gameCover: game.cover
				? game.cover.url.replace("t_thumb", "t_cover_big")
				: undefined,
			gameYear: new Date(game.first_release_date * 1000)
				.getFullYear()
				.toString(),
			summary: game.summary,
			gameUrl: game.url,
		}));
}

```
app/server/month.server.ts
```typescript
import type { Month, ThemeCategory } from "~/types";
import { db } from "~/server/database.server";

interface MonthRow {
	month_id: number;
	month: number;
	year: number;
	theme_id: number;
	name: string;
	description: string | null;
	status:
		| "nominating"
		| "jury"
		| "voting"
		| "complete"
		| "playing"
		| "over"
		| "ready";
}

export async function getMonth(monthId: number): Promise<Month> {
	const result = await db.execute({
		sql: `SELECT m.id AS month_id, m.month, m.year, 
                t.id AS theme_id, t.name, t.description,
                ms.status as status
         FROM months m
         JOIN themes t ON m.theme_id = t.id
         JOIN month_status ms ON m.status_id = ms.id
         WHERE m.id = ?`,
		args: [monthId],
	});

	if (result.rows.length === 0) {
		throw new Response("Month not found", { status: 404 });
	}

	const month = result.rows[0] as unknown as MonthRow;
	return {
		id: month.month_id,
		month: month.month,
		year: month.year,
		status: month.status,
		theme: {
			id: month.theme_id,
			name: month.name,
			description: month.description,
		},
		winners: [],
	};
}

export async function getCurrentMonth(): Promise<Month> {
	// Get the current active month (nominating / jury / voting)
	const activeResult = await db.execute({
		sql: `SELECT m.id
         FROM months m
         JOIN month_status ms ON m.status_id = ms.id
         WHERE ms.status IN ('nominating', 'jury', 'voting')
         LIMIT 1`,
		args: [],
	});

	if (activeResult.rows.length > 0) {
		const activeRow = activeResult.rows[0] as unknown as { id: number };
		return getMonth(activeRow.id);
	}

	// If no active month, fall back to latest month
	const latestResult = await db.execute({
		sql: `SELECT id, year, month
         FROM months
         ORDER BY year DESC, month DESC
         LIMIT 1`,
		args: [],
	});

	if (latestResult.rows.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	const latestRow = latestResult.rows[0] as unknown as { id: number };
	return getMonth(latestRow.id);
}

export async function getThemeCategories(): Promise<ThemeCategory[]> {
	const result = await db.execute({
		sql: `SELECT id, name
         FROM theme_categories`,
		args: [],
	});

	return result.rows.map((row) => ({
		id: (row as unknown as { id: number }).id,
		name: (row as unknown as { name: string }).name,
	}));
}

```
app/server/nameGenerator.ts
```typescript
import adjectiveList from "~/server/adjectives.json";
import characterList from "~/server/characters.json";

export function uniqueNameGenerator(discordId: string): string {
	const seed = BigInt(discordId);

	const adjectiveIndex = Number(seed % BigInt(adjectiveList.length));
	const characterIndex = Number((seed >> 32n) % BigInt(characterList.length));

	const adjective = adjectiveList[adjectiveIndex];
	const character = characterList[characterIndex].name;

	// Capitalize first letter of both words
	const capitalizedAdjective =
		adjective.charAt(0).toUpperCase() + adjective.slice(1);
	const capitalizedCharacter =
		character.charAt(0).toUpperCase() + character.slice(1);

	return `${capitalizedAdjective} ${capitalizedCharacter}`;
}

```
app/server/nomination.server.ts
```typescript
import type { Nomination } from "~/types";
import { db } from "~/server/database.server";
import { getPitchesForNomination } from "~/server/pitches.server";

export async function getNominationsForMonth(
	monthId: number,
): Promise<Nomination[]> {
	const result = await db.execute({
		sql: `SELECT id,
                game_id,
                discord_id,
                short,
                game_name,
                game_year,
                game_cover,
                game_url,
                jury_selected
         FROM nominations
         WHERE month_id = ?`,
		args: [monthId],
	});

	return Promise.all(
		result.rows.map(async (row) => ({
			id: Number(row.id),
			monthId: monthId,
			gameId: String(row.game_id),
			discordId: String(row.discord_id),
			short: Boolean(row.short),
			gameName: String(row.game_name),
			gameYear: String(row.game_year),
			gameCover: String(row.game_cover),
			gameUrl: String(row.game_url),
			jurySelected: Boolean(row.jury_selected),
			pitches: await getPitchesForNomination(Number(row.id)),
		})),
	);
}

export async function getNominationById(
	nominationId: number,
): Promise<Nomination> {
	const result = await db.execute({
		sql: `SELECT id,
                month_id,
                game_id,
                discord_id,
                short,
                game_name,
                game_year,
                game_cover,
                game_url,
                jury_selected
         FROM nominations
         WHERE id = ?`,
		args: [nominationId],
	});

	if (result.rows.length === 0) {
		throw new Error(`Nomination with ID ${nominationId} not found`);
	}

	const row = result.rows[0];
	return {
		id: Number(row.id),
		monthId: Number(row.month_id),
		gameId: String(row.game_id),
		discordId: String(row.discord_id),
		short: Boolean(row.short),
		gameName: String(row.game_name),
		gameYear: String(row.game_year),
		gameCover: String(row.game_cover),
		gameUrl: String(row.game_url),
		jurySelected: Boolean(row.jury_selected),
		pitches: await getPitchesForNomination(Number(row.id)),
	};
}

```
app/server/pitches.server.ts
```typescript
import type { Pitch } from "~/types";
import { db } from "~/server/database.server";
import { uniqueNameGenerator } from "~/server/nameGenerator";

export async function getPitchesForNomination(
	nominationId: number,
): Promise<Pitch[]> {
	const result = await db.execute({
		sql: `SELECT id, discord_id, pitch
         FROM pitches
         WHERE nomination_id = ?`,
		args: [nominationId],
	});

	return result.rows.map((row) => ({
		id: Number(row.id),
		nominationId: nominationId,
		discordId: String(row.discord_id),
		pitch: String(row.pitch),
		generatedName: uniqueNameGenerator(String(row.discord_id)),
	}));
}

```
app/server/voting.server.ts
```typescript
import { db } from "~/server/database.server";
import type { Nomination, Ranking, Vote } from "~/types";

export type Result = {
	source: string;
	target: string;
	weight: string;
};

// Cache structure to store voting results
const resultsCache = new Map<
	string,
	{ results: Result[]; timestamp: number }
>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const getNominationsAndVotes = async (
	monthId: number,
	short: boolean,
): Promise<{ nominations: Nomination[]; votes: Vote[] }> => {
	const [nominationsResult, votesResult] = await Promise.all([
		db.execute({
			sql: `SELECT id,
                    game_id,
                    discord_id,
                    short,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    jury_selected
             FROM nominations
             WHERE month_id = ?1
               AND jury_selected = 1
               AND short = ?2
             ORDER BY game_name;`,
			args: [monthId, short ? 1 : 0],
		}),
		db.execute({
			sql: `SELECT v.id, v.month_id, v.short
             FROM votes v
             WHERE v.month_id = ?1
               AND v.short = ?2
               AND EXISTS (SELECT 1
                           FROM rankings r
                           WHERE r.vote_id = v.id)`,
			args: [monthId, short ? 1 : 0],
		}),
	]);

	return {
		nominations: nominationsResult.rows.map(
			(row): Nomination => ({
				id: Number(row.id),
				gameId: String(row.game_id),
				short: Boolean(row.short),
				jurySelected: Boolean(row.jury_selected),
				monthId: monthId,
				gameName: String(row.game_name),
				gameYear: String(row.game_year),
				gameCover: String(row.game_cover),
				gameUrl: String(row.game_url),
				discordId: String(row.discord_id),
				pitches: [],
			}),
		),
		votes: votesResult.rows.map(
			(row): Vote => ({
				id: Number(row.id),
				monthId: Number(row.month_id),
				short: Boolean(row.short),
				discordId: "",
			}),
		),
	};
};

export const getRankingsForVotes = async (
	voteIds: number[],
): Promise<Map<number, Ranking[]>> => {
	if (voteIds.length === 0) return new Map();

	// Create a properly formatted args array for Turso
	const placeholders = `?${",?".repeat(voteIds.length - 1)}`;
	const args = voteIds;

	const rankings = await db.execute({
		sql: `SELECT vote_id, nomination_id, \`rank\`
         FROM rankings
         WHERE vote_id IN (${placeholders})
         ORDER BY vote_id, \`rank\``,
		args,
	});

	const rankingsMap = new Map<number, Ranking[]>();
	for (const row of rankings.rows) {
		const voteId = Number(row.vote_id);
		if (!rankingsMap.has(voteId)) {
			rankingsMap.set(voteId, []);
		}
		rankingsMap.get(voteId)?.push({
			voteId: Number(row.vote_id),
			nominationId: Number(row.nomination_id),
			rank: Number(row.rank),
		});
	}
	return rankingsMap;
};

export const buildInMemoryRankings = async (
	votes: Vote[],
): Promise<Map<number, Ranking[]>> => {
	if (votes.length === 0) return new Map();

	// Use the existing getRankingsForVotes function instead
	return await getRankingsForVotes(votes.map((v) => v.id));
};

export const getCurrentVoteCount = (
	nominations: Nomination[],
	voteRankingsMap: Map<number, Ranking[]>,
): Record<number, number> => {
	const voteCount: Record<number, number> = {};
	for (const nom of nominations) {
		voteCount[nom.id] = 0;
	}

	for (const [, rankings] of voteRankingsMap) {
		if (rankings.length > 0) {
			const topNomId = rankings[0].nominationId;
			if (topNomId in voteCount) {
				voteCount[topNomId]++;
			}
		}
	}

	return voteCount;
};

export const eliminateNominationFromRankings = (
	loserId: number,
	voteRankingsMap: Map<number, Ranking[]>,
) => {
	for (const [voteId, rankings] of voteRankingsMap.entries()) {
		let filtered = rankings.filter((r) => r.nominationId !== loserId);
		filtered = filtered.map((r, idx) => ({ ...r, rank: idx + 1 }));
		voteRankingsMap.set(voteId, filtered);
	}
};

export const transferVotes = (
	loserId: number,
	remainingNoms: Nomination[],
	votes: Vote[],
	voteRankingsMap: Map<number, Ranking[]>,
): Map<number, number> => {
	const transferred = new Map<number, number>();
	const remainingIds = new Set(remainingNoms.map((n) => n.id));

	for (const vote of votes) {
		const rankings = voteRankingsMap.get(vote.id) ?? [];
		if (rankings.length === 0) continue;

		if (rankings[0].nominationId === loserId) {
			if (rankings.length > 1 && remainingIds.has(rankings[1].nominationId)) {
				const nextTopId = rankings[1].nominationId;
				transferred.set(nextTopId, (transferred.get(nextTopId) || 0) + 1);
			}
		}
	}

	return transferred;
};

export const calculateWeightedScores = async (
	nominations: Nomination[],
	votes: Vote[],
	voteRankingsMap: Map<number, Ranking[]>,
): Promise<Map<number, number>> => {
	const maxRank = nominations.length;
	const rankWeights = Array.from({ length: maxRank }, (_, i) => maxRank - i);

	const weighted = new Map<number, number>();
	for (const nom of nominations) {
		let sum = 0;
		for (const vote of votes) {
			const ranks = voteRankingsMap.get(vote.id) ?? [];
			const found = ranks.find((r) => r.nominationId === nom.id);
			if (found) {
				sum += rankWeights[found.rank - 1] || 0;
			}
		}
		weighted.set(nom.id, sum);
	}
	return weighted;
};

export const runRounds = async (
	initialNominations: Nomination[],
	votes: Vote[],
): Promise<Result[]> => {
	const graph = new Map<
		string,
		{ votes: number; edges: Map<string, number> }
	>();
	const results: Result[] = [];

	const voteRankingsMap = await buildInMemoryRankings(votes);

	let nominations = [...initialNominations];
	let round = 1;

	let currentVoteCount = getCurrentVoteCount(nominations, voteRankingsMap);
	let nominationWeightedScores = await calculateWeightedScores(
		nominations,
		votes,
		voteRankingsMap,
	);

	for (const nomination of nominations) {
		const vertexId = `${nomination.gameName}_${round}`;
		graph.set(vertexId, {
			votes: currentVoteCount[nomination.id],
			edges: new Map(),
		});
	}

	while (nominations.length > 1) {
		nominations.sort((a, b) => {
			const aScore = currentVoteCount[a.id];
			const bScore = currentVoteCount[b.id];
			if (aScore !== bScore) {
				return aScore - bScore;
			}
			return (
				(nominationWeightedScores.get(a.id) ?? 0) -
				(nominationWeightedScores.get(b.id) ?? 0)
			);
		});

		const loser = nominations.shift();
		if (!loser) break;

		const remaining = [...nominations];

		const transferred = transferVotes(
			loser.id,
			remaining,
			votes,
			voteRankingsMap,
		);

		eliminateNominationFromRankings(loser.id, voteRankingsMap);

		for (const nomination of remaining) {
			const winnerId = nomination.id;
			const winnerName = nomination.gameName;
			const votesTransferred = transferred.get(winnerId) || 0;

			const nextRoundVertexId = `${winnerName}_${round + 1}`;
			const nextRoundVertex = graph.get(nextRoundVertexId) || {
				votes: 0,
				edges: new Map(),
			};
			nextRoundVertex.votes =
				(currentVoteCount[winnerId] || 0) + votesTransferred;

			const loserVertexId = `${loser.gameName}_${round}`;
			const loserVertex = graph.get(loserVertexId) || {
				votes: 0,
				edges: new Map(),
			};
			loserVertex.edges.set(nextRoundVertexId, votesTransferred);

			const currentRoundWinnerId = `${winnerName}_${round}`;
			const currentRoundWinnerVertex = graph.get(currentRoundWinnerId) || {
				votes: 0,
				edges: new Map(),
			};
			currentRoundWinnerVertex.edges.set(
				nextRoundVertexId,
				currentVoteCount[winnerId],
			);

			graph.set(nextRoundVertexId, nextRoundVertex);
			graph.set(loserVertexId, loserVertex);
			graph.set(currentRoundWinnerId, currentRoundWinnerVertex);
		}

		currentVoteCount = getCurrentVoteCount(remaining, voteRankingsMap);
		nominationWeightedScores = await calculateWeightedScores(
			remaining,
			votes,
			voteRankingsMap,
		);
		round++;
		nominations = remaining;
	}

	if (nominations.length === 1) {
		const finalNom = nominations[0];
		const finalCount =
			getCurrentVoteCount([finalNom], voteRankingsMap)[finalNom.id] || 0;

		const finalVertexId = `${finalNom.gameName}_${round + 1}`;
		const finalVertex = graph.get(finalVertexId) || {
			votes: 0,
			edges: new Map(),
		};
		finalVertex.votes = finalCount;

		const prevVertexId = `${finalNom.gameName}_${round}`;
		const prevVertex = graph.get(prevVertexId) || {
			votes: 0,
			edges: new Map(),
		};
		prevVertex.edges.set(finalVertexId, finalCount);

		graph.set(finalVertexId, finalVertex);
		graph.set(prevVertexId, prevVertex);
	}

	for (const [source, sourceData] of graph) {
		const [sourceName, sourceRound] = source.split("_");
		for (const [target, weight] of sourceData.edges) {
			const [targetName, targetRound] = target.split("_");
			const t = graph.get(target);

			results.push({
				source: `${sourceName} (${sourceData.votes})${" ".repeat(Number.parseInt(sourceRound, 10))}`,
				target: `${targetName} (${t?.votes})${" ".repeat(Number.parseInt(targetRound, 10))}`,
				weight: String(weight),
			});
		}
	}

	return results;
};

export const calculateVotingResults = async (
	monthId: number,
	short: boolean,
): Promise<Result[]> => {
	try {
		const cacheKey = `${monthId}-${short}`;
		const cached = resultsCache.get(cacheKey);

		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.results;
		}

		const { nominations, votes } = await getNominationsAndVotes(monthId, short);
		console.log(
			`[Voting] Found ${votes.length} votes for ${short ? "short" : "long"} games`,
		);

		if (votes.length === 0) {
			const emptyResults: Result[] = [];
			resultsCache.set(cacheKey, {
				results: emptyResults,
				timestamp: Date.now(),
			});
			return emptyResults;
		}

		const voteRankingsMap = await getRankingsForVotes(votes.map((v) => v.id));
		const initialCounts = getCurrentVoteCount(nominations, voteRankingsMap);
		const viable = nominations.filter((n) => initialCounts[n.id] > 0);

		if (viable.length === 0) {
			const emptyResults: Result[] = [];
			resultsCache.set(cacheKey, {
				results: emptyResults,
				timestamp: Date.now(),
			});
			return emptyResults;
		}

		const results = await runRounds(viable, votes);
		resultsCache.set(cacheKey, { results, timestamp: Date.now() });
		return results;
	} catch (error) {
		console.error("[Voting] Error calculating results:", error);
		return [];
	}
};

// Function to invalidate cache when votes change
export const invalidateVotingCache = (monthId: number, short: boolean) => {
	const cacheKey = `${monthId}-${short}`;
	resultsCache.delete(cacheKey);
};

export const getGameUrls = async (
	monthId: number,
): Promise<Record<string, string>> => {
	const nominations = await db.execute({
		sql: "SELECT game_name, game_url FROM nominations WHERE month_id = ?1 AND jury_selected = 1",
		args: [monthId],
	});

	return nominations.rows.reduce((acc: Record<string, string>, nom) => {
		if (nom.game_url) {
			acc[String(nom.game_name)] = String(nom.game_url);
		}
		return acc;
	}, {});
};

```
app/server/winner.server.ts
```typescript
import { db } from "./database.server";
import { calculateVotingResults } from "~/server/voting.server";
import type { Nomination } from "~/types";

export async function calculateAndStoreWinner(
	monthId: number,
	short: boolean,
): Promise<Nomination | null> {
	try {
		// Get voting results
		const results = await calculateVotingResults(monthId, short);
		if (results.length === 0) {
			return null;
		}

		// Find the winner from the results
		// The winner is the target of the last edge in the results array
		const lastResult = results[results.length - 1];
		const winnerNameWithVotes = lastResult.target;
		const winnerName = winnerNameWithVotes.split(" (")[0];

		// Get nomination details for the winner
		const nominations = await db.execute({
			sql: `SELECT game_id,
                    id as nomination_id,
                    game_name,
                    game_year,
                    game_cover,
                    game_url,
                    discord_id
             FROM nominations
             WHERE month_id = ?1
               AND short = ?2
               AND game_name = ?3
               AND jury_selected = 1
             LIMIT 1;`,
			args: [monthId, short ? 1 : 0, winnerName],
		});

		if (!nominations.rows.length) {
			return null;
		}

		const nomination = nominations.rows[0];
		const winner: Nomination = {
			id: Number(nomination.nomination_id),
			gameId: String(nomination.game_id),
			monthId: monthId,
			short: short,
			gameName: String(nomination.game_name),
			gameYear: String(nomination.game_year),
			gameCover: String(nomination.game_cover),
			gameUrl: String(nomination.game_url),
			jurySelected: true,
			discordId: String(nomination.discord_id),
			pitches: [],
		};

		// Update or insert the winner using SQLite's UPSERT syntax
		await db.execute({
			sql: `INSERT INTO winners (
					game_id, 
					month_id, 
					nomination_id, 
					short, 
					game_name, 
					game_year, 
					game_cover, 
					game_url,
					created_at, 
					updated_at
				)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, unixepoch(), unixepoch())
				ON CONFLICT(game_id) DO UPDATE SET 
					nomination_id = ?3,
					game_name = ?5,
					game_year = ?6,
					game_cover = ?7,
					game_url = ?8,
					updated_at = unixepoch();`,
			args: [
				winner.gameId || "",
				winner.monthId,
				winner.id,
				winner.short ? 1 : 0,
				winner.gameName || "",
				winner.gameYear || "",
				winner.gameCover || "",
				winner.gameUrl || "",
			],
		});

		return winner;
	} catch (error) {
		console.error("[Winner] Error calculating and storing winner:", error);
		return null;
	}
}

export async function getWinner(
	monthId: number,
	short: boolean,
): Promise<Nomination | null> {
	try {
		const winners = await db.execute({
			sql: `SELECT game_id,
                    month_id,
                    nomination_id,
                    short,
                    game_name,
                    game_year,
                    game_cover,
                    game_url
             FROM winners
             WHERE month_id = ?1
               AND short = ?2;`,
			args: [monthId, short ? 1 : 0],
		});

		if (!winners.rows.length) {
			return calculateAndStoreWinner(monthId, short);
		}

		const winner = winners.rows[0];
		return {
			id: Number(winner.nomination_id),
			gameId: String(winner.game_id),
			monthId: Number(winner.month_id),
			short: Boolean(winner.short),
			gameName: String(winner.game_name),
			gameYear: String(winner.game_year),
			gameCover: String(winner.game_cover),
			gameUrl: String(winner.game_url),
			jurySelected: true,
			discordId: "",
			pitches: [],
		};
	} catch (error) {
		console.error("[Winner] Error getting winner:", error);
		return null;
	}
}

export async function recalculateAllWinners(): Promise<void> {
	try {
		// Get all months
		const months = await db.execute({
			sql: `SELECT id
             FROM months
             ORDER BY year DESC, month DESC;`,
			args: [],
		});

		for (const month of months.rows) {
			// Calculate and store winners for both short and long games
			await calculateAndStoreWinner(Number(month.id), true);
			await calculateAndStoreWinner(Number(month.id), false);
		}
	} catch (error) {
		console.error("[Winner] Error recalculating all winners:", error);
	}
}

```
app/components/GameCard.tsx
```
import type {
	DraggableProvidedDraggableProps,
	DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChatBubbleBottomCenterTextIcon,
	LinkIcon,
	PencilSquareIcon,
	TrashIcon,
} from "@heroicons/react/20/solid";
import type { Nomination } from "~/types";

interface GameCardProps {
	game: Nomination;
	variant?: "default" | "nomination" | "search";
	onNominate?: (game: Nomination) => void;
	onEdit?: (game: Nomination) => void;
	onDelete?: (game: Nomination) => void;
	draggableProps?: DraggableProvidedDraggableProps;
	dragHandleProps?: DraggableProvidedDragHandleProps;
	innerRef?: (element?: HTMLElement | null) => void;
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
	onViewPitches?: () => void;
	pitchCount?: number;
	showVotingButtons?: boolean;
	showPitchesButton?: boolean;
	buttonText?: string;
	buttonDisabled?: boolean;
	isPreviousWinner?: boolean;
	isWinner?: boolean;
	isJurySelected?: boolean;
}

export default function GameCard({
	game,
	variant = "default",
	onNominate,
	onEdit,
	onDelete,
	draggableProps,
	dragHandleProps,
	innerRef,
	onRank,
	onUnrank,
	isRanked,
	alreadyNominated,
	isCurrentUserNomination,
	onViewPitches,
	pitchCount = 0,
	showVotingButtons = false,
	showPitchesButton = false,
	buttonText,
	buttonDisabled,
	isPreviousWinner = false,
	isWinner = false,
	isJurySelected = false,
}: GameCardProps) {
	const getYear = (game: Nomination) => {
		if (game.gameYear) return game.gameYear;
		return null;
	};

	const coverUrl = game.gameCover?.replace("t_thumb", "t_cover_big");
	const year = getYear(game);

	// Determine status for highlighting and badges
	// Winner takes precedence over jury selected
	const status = isWinner ? "winner" : isJurySelected ? "jury" : "regular";

	return (
		<div
			ref={innerRef}
			{...draggableProps}
			{...dragHandleProps}
			className={`group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl border-1 ${
				status === "winner"
					? "border-amber-500"
					: status === "jury"
						? "border-blue-500"
						: "border-zinc-800/50"
			} hover:border-zinc-700/50 transition-all duration-500 flex h-52 min-w-0`}
		>
			{/* Cover Image */}
			<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
				{coverUrl ? (
					<>
						<div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 to-transparent z-10" />
						<img
							src={coverUrl}
							alt={game.gameName}
							className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
								status === "winner"
									? "group-hover:brightness-125 filter-none"
									: status === "jury"
										? "group-hover:brightness-110 filter-none"
										: "group-hover:brightness-110"
							}`}
						/>
						{/* Status badge - show only one badge (winner takes priority) */}
						<div className="absolute top-2 left-2 z-20">
							{status === "winner" && (
								<span className="px-2.5 py-1 bg-amber-600 text-amber-100 text-xs font-medium rounded-md border border-amber-400/50">
									Winner
								</span>
							)}
							{status === "jury" && (
								<span className="px-2.5 py-1 bg-blue-600 text-blue-100 text-xs font-medium rounded-md border border-blue-400/50">
									Jury Selected
								</span>
							)}
						</div>
					</>
				) : (
					<div className="h-full w-full bg-zinc-800/50 flex items-center justify-center backdrop-blur-sm relative">
						<span className="text-zinc-500">No cover</span>
						{/* Status badge for images without cover - show only one badge */}
						<div className="absolute top-2 left-2 z-20">
							{status === "winner" && (
								<span className="px-2.5 py-1 bg-amber-600 text-amber-100 text-xs font-medium rounded-md border border-amber-400/50">
									Winner
								</span>
							)}
							{status === "jury" && (
								<span className="px-2.5 py-1 bg-blue-600 text-blue-100 text-xs font-medium rounded-md border border-blue-400/50">
									Jury Selected
								</span>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="min-w-0 space-y-2">
					<div className="flex justify-between items-start gap-2">
						<h3
							className={`text-sm font-medium break-words leading-snug ${
								status === "winner"
									? "text-amber-200 font-semibold"
									: status === "jury"
										? "text-blue-200 font-medium"
										: "text-zinc-100"
							}`}
						>
							{game.gameName}
						</h3>
						{year && (
							<p className="text-xs text-zinc-500 flex-shrink-0 font-medium">
								{year}
							</p>
						)}
					</div>
				</div>

				<div className="flex flex-col gap-2 mt-auto min-w-0">
					{showVotingButtons && (
						<div className="flex flex-col w-full gap-2">
							<button
								type="button"
								onClick={isRanked ? onUnrank : onRank}
								className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
									isRanked
										? "text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
								}`}
							>
								<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
									{isRanked ? (
										<>
											<ArrowDownIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
											Remove from Ranking
										</>
									) : (
										<>
											<ArrowUpIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
											Add to Ranking
										</>
									)}
								</span>
							</button>

							{onViewPitches && (
								<button
									type="button"
									onClick={onViewPitches}
									className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-zinc-200 bg-zinc-500/10 hover:bg-zinc-500/20 transition-all duration-300 backdrop-blur-sm border border-zinc-500/20 hover:border-zinc-500/30"
								>
									<ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
									{pitchCount > 0 ? (
										<>
											View {pitchCount} {pitchCount === 1 ? "Pitch" : "Pitches"}
										</>
									) : (
										"No Pitches Yet"
									)}
								</button>
							)}
						</div>
					)}

					{showPitchesButton && onViewPitches && (
						<button
							type="button"
							onClick={onViewPitches}
							className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-zinc-200 bg-zinc-500/10 hover:bg-zinc-500/20 transition-all duration-300 backdrop-blur-sm border border-zinc-500/20 hover:border-zinc-500/30"
						>
							<ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
							{pitchCount > 0 ? (
								<>
									View {pitchCount} {pitchCount === 1 ? "Pitch" : "Pitches"}
								</>
							) : (
								"No Pitches Yet"
							)}
						</button>
					)}

					{onNominate && (
						<button
							type="button"
							onClick={() => onNominate(game)}
							disabled={
								buttonDisabled ||
								(alreadyNominated && isCurrentUserNomination) ||
								isPreviousWinner
							}
							className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
								isPreviousWinner
									? "text-amber-500 shadow-sm shadow-amber-500/20 border border-amber-400/20 hover:bg-amber-500/10 hover:border-amber-400/30 hover:shadow-amber-500/40 after:absolute after:inset-0 after:bg-amber-400/0 hover:after:bg-amber-400/5 after:transition-colors"
									: alreadyNominated && !isCurrentUserNomination
										? "text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
							} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:text-zinc-400 disabled:border-zinc-400/20`}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105 group-disabled:transform-none">
								{buttonText ||
									(alreadyNominated
										? isCurrentUserNomination
											? "Already nominated"
											: "Add Pitch"
										: "Nominate")}
							</span>
						</button>
					)}

					{(onEdit || onDelete || game.gameUrl) && (
						<div
							className={
								variant === "nomination" ? "flex flex-col gap-1.5" : "w-full"
							}
						>
							{game.gameUrl && (
								<a
									href={game.gameUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-purple-500 shadow-sm shadow-purple-500/20 border border-purple-400/20 hover:bg-purple-500/10 hover:border-purple-400/30 hover:shadow-purple-500/40 after:absolute after:inset-0 after:bg-purple-400/0 hover:after:bg-purple-400/5 after:transition-colors w-full"
									title="View on IGDB"
								>
									<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
										<LinkIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
										{variant === "nomination" ? "View on IGDB" : "IGDB"}
									</span>
								</a>
							)}
							{variant === "nomination" && (
								<>
									{onEdit && (
										<button
											type="button"
											onClick={() => onEdit(game)}
											className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors w-full"
											title={
												game.pitches.length > 0 ? "Edit pitch" : "Add pitch"
											}
										>
											<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
												<PencilSquareIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
												{game.pitches.length > 0 ? "Edit pitch" : "Add pitch"}
											</span>
										</button>
									)}
									{onDelete && (
										<button
											type="button"
											onClick={() => onDelete(game)}
											className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors w-full"
											title="Delete nomination"
										>
											<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
												<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
												Delete
											</span>
										</button>
									)}
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

```
app/components/PitchesModal.tsx
```
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { Nomination } from "~/types";

interface PitchesModalProps {
	isOpen: boolean;
	onClose: () => void;
	nomination: Nomination | null;
}

export default function PitchesModal({
	isOpen,
	onClose,
	nomination,
}: PitchesModalProps) {
	if (!nomination) {
		return null;
	}

	return (
		<Dialog open={isOpen} onClose={onClose} className="relative z-50">
			<div
				className="fixed inset-0 bg-black/30 backdrop-blur-sm"
				aria-hidden="true"
			/>
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="mx-auto max-w-2xl w-full rounded-xl bg-gray-900 p-6 shadow-xl ring-1 ring-white/10">
					<DialogTitle className="text-lg font-medium text-gray-100 mb-4">
						Pitches for {nomination?.gameName}
					</DialogTitle>
					<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
						{nomination.pitches.length > 0 ? (
							nomination.pitches.map((pitch, index) => (
								<div
									key={`${nomination?.id}-${pitch.discordId}-${index}`}
									className="rounded-lg border border-gray-700 p-4 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-colors"
								>
									<div className="flex items-center mb-2">
										<div className="text-sm bg-blue-600 px-2 py-0.5 rounded-full">
											{pitch.generatedName}
										</div>
									</div>
									<div className="whitespace-pre-wrap text-sm">
										{pitch.pitch}
									</div>
								</div>
							))
						) : (
							<div className="rounded-lg border border-dashed border-gray-700 p-8 text-center">
								<p className="text-sm text-gray-400">
									No pitches available for this game
								</p>
							</div>
						)}
					</div>
					<div className="mt-6 flex justify-end gap-3">
						<button
							type="button"
							className="px-4 py-2 text-sm font-medium rounded-lg text-gray-300 transition-colors hover:text-gray-100 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
							onClick={onClose}
						>
							Close
						</button>
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	);
}

```
app/components/SplitLayout.tsx
```
import type { ReactNode } from "react";

interface SplitLayoutProps {
    title: string;
    subtitle?: string;
    description?: string;
    children: ReactNode;
}

interface ColumnProps {
    title: string;
    statusBadge?: {
        text: string;
        isSuccess?: boolean;
    };
    action?: ReactNode;
    children: ReactNode;
}

export function Column({ title, statusBadge, action, children }: ColumnProps) {
    return (
        <div className="bg-zinc-900 rounded-lg shadow p-4 space-y-4 ring-1 ring-zinc-800">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-zinc-100">{title}</h2>
                {statusBadge && (
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1.5 text-sm font-medium ${statusBadge.isSuccess
                            ? "bg-green-950 text-green-400 ring-1 ring-inset ring-green-800"
                            : "bg-zinc-800 text-zinc-400 ring-1 ring-inset ring-zinc-700"
                            }`}
                    >
                        {statusBadge.text}
                    </span>
                )}
            </div>
            <div className="py-2">{action}</div>
            {children}
        </div>
    );
}

export default function SplitLayout({
    title,
    subtitle,
    description,
    children,
}: SplitLayoutProps) {
    return (
        <div className="mx-auto">
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-3xl font-bold text-zinc-100">{title}</h1>
                {subtitle && <h2 className="text-xl text-zinc-200">{subtitle}</h2>}
                {description && <p className="text-zinc-400">{description}</p>}
            </div>

            <div className="grid md:grid-cols-2 gap-6">{children}</div>
        </div>
    );
}

```
app/components/ThemeCard.tsx
```
import type { Month } from "~/types";

export default function ThemeCard(month: Month) {
    const monthName = new Date(month.year, month.month - 1).toLocaleString('default', { month: 'long' });

    return (
        <div className="w-full">
            <div className="mx-auto">
                <div className="relative px-8 pt-10 rounded-2xl">
                    <div className="flex flex-col items-center text-center space-y-8">
                        {/* Month and Year */}
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-4xl font-bold tracking-wider">
                                {monthName}
                            </span>
                            <span className="text-xl font-bold">
                                {month.year}
                            </span>
                            <span className="px-4 py-1 rounded-full bg-blue-600">
                                {month.theme.name}
                            </span>
                        </div>

                        {month.theme.description && (
                            <p className="text-lg leading-relaxed whitespace-pre-wrap">
                                {month.theme.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

```
app/components/VotingResultsChart.tsx
```
import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { SankeyChart, type SankeySeriesOption } from "echarts/charts";
import {
	TooltipComponent,
	type TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts, ComposeOption } from "echarts/core";
import type { CallbackDataParams } from "echarts/types/dist/shared";

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);
type ECOption = ComposeOption<SankeySeriesOption | TooltipComponentOption>;

type SankeyDataType = "edge" | "node";

interface SankeyEdgeParams extends Omit<CallbackDataParams, "data"> {
	dataType: SankeyDataType;
	data: {
		source: string;
		target: string;
	};
}

interface SankeyDataPoint {
	source: string;
	target: string;
	weight: string | number;
}

interface VotingResultsChartProps {
	canvasId: string;
	results: SankeyDataPoint[];
	gameUrls?: Record<string, string>;
	showWinner?: boolean;
}

const COLOR_PALETTE = [
	"#60a5fa", // blue-400
	"#4ade80", // green-400
	"#c084fc", // purple-400
	"#fb923c", // orange-400
	"#22d3ee", // cyan-400
	"#f472b6", // pink-400
	"#818cf8", // indigo-400
	"#facc15", // yellow-400
	"#2dd4bf", // teal-400
];

function getBaseGameName(nodeName: string): string {
	return nodeName.replace(/\s*\(\d+\)\s*$/, "").trim();
}

const getWinner = (results: SankeyDataPoint[]): string | null => {
	if (results.length === 0) return null;
	const sourceNodes = new Set(results.map((r) => r.source));
	const targetNodes = new Set(results.map((r) => r.target));
	const finalNodes = [...targetNodes].filter((node) => !sourceNodes.has(node));
	const winnerNode = finalNodes[0] ?? results[results.length - 1]?.target;
	return winnerNode ? getBaseGameName(winnerNode) : null;
};

export function VotingResultsChart({
	canvasId,
	results,
	gameUrls = {},
	showWinner = false,
}: VotingResultsChartProps) {
	const chartRef = useRef<HTMLDivElement | null>(null);
	const chartInstanceRef = useRef<ECharts | null>(null);

	// --- Updated useMemo ---
	const processedData = useMemo(() => {
		if (!results || results.length === 0) return null;
		const filteredResults = results.filter(
			({ weight }) => Number(weight) > 0.01,
		);
		if (filteredResults.length === 0) return null;

		const uniqueNodeNames = new Set<string>();
		for (const { source, target } of filteredResults) {
			uniqueNodeNames.add(source);
			uniqueNodeNames.add(target);
		}

		const uniqueBaseGames = new Set<string>(
			Array.from(uniqueNodeNames).map(getBaseGameName),
		);
		const gameColors = new Map<string, string>();
		Array.from(uniqueBaseGames).forEach((game, index) => {
			gameColors.set(game, COLOR_PALETTE[index % COLOR_PALETTE.length]);
		});

		const allSources = new Set(filteredResults.map((r) => r.source));
		const allTargets = new Set(filteredResults.map((r) => r.target));
		const initialNodes = new Set(
			[...allSources].filter((node) => !allTargets.has(node)),
		);
		const finalNodes = new Set(
			[...allTargets].filter((node) => !allSources.has(node)),
		);

		const echartsNodes = Array.from(uniqueNodeNames).map((nodeName) => {
			const baseGame = getBaseGameName(nodeName);
			const color = gameColors.get(baseGame) || "#94a3b8";
			const isInitialNode = initialNodes.has(nodeName);
			const isFinalNode = finalNodes.has(nodeName);

			let labelPosition = "inside"; // Default to inside for intermediate nodes
			if (isInitialNode) {
				labelPosition = "right"; // Keep initial node names outside to the right
			} else if (isFinalNode) {
				labelPosition = "left"; // Keep final node names outside to the left
			}

			const nodeConfig = {
				name: nodeName,
				itemStyle: { color: color, borderWidth: 0 },
				label: {
					position: labelPosition,
				},
			};
			return nodeConfig;
		});

		const echartsLinks = filteredResults.map(({ source, target, weight }) => ({
			source: source,
			target: target,
			value: Number(weight),
		}));

		return {
			nodes: echartsNodes,
			links: echartsLinks,
			initialNodes,
			finalNodes,
		};
	}, [results]);

	useEffect(() => {
		if (!chartRef.current) return;

		let options: ECOption | null = null;
		if (processedData) {
			const { nodes, links, initialNodes, finalNodes } = processedData;
			options = {
				tooltip: {
					// Tooltip config remains the same
					trigger: "item",
					triggerOn: "mousemove",
					formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
						const param = Array.isArray(params) ? params[0] : params;
						const sankeyParams = param as SankeyEdgeParams;

						if (sankeyParams.dataType === "edge") {
							const sourceBase = getBaseGameName(sankeyParams.data.source);
							const targetBase = getBaseGameName(sankeyParams.data.target);
							const value = Math.round(sankeyParams.value as number);
							return `${targetBase} got ${value} votes from ${sourceBase}`;
						}
						if (sankeyParams.dataType === "node") {
							const baseName = getBaseGameName(sankeyParams.name);
							const nodeValue = Math.round(sankeyParams.value as number);
							return `${sankeyParams.name} - ${baseName}<br/>Total Votes: ${nodeValue}`;
						}
						return "";
					},
				},
				series: [
					{
						type: "sankey",
						data: nodes,
						links: links,
						emphasis: { focus: "adjacency" },
						nodeWidth: 30,
						nodeGap: 30,
						nodeAlign: "justify",
						draggable: false,
						left: 20,
						right: 60,
						top: 20,
						bottom: 20,

						label: {
							show: true,
							color: "white",
							fontSize: 12,
							fontWeight: "bold",
							formatter: (params: CallbackDataParams) => {
								const nodeName = params.name;
								const nodeValue = Math.round(params.value as number);

								// Display full name ONLY for initial and final nodes
								if (initialNodes.has(nodeName) || finalNodes.has(nodeName)) {
									return nodeName;
								}
								return `${nodeValue}`;
							},
						},
						lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.7 },
					},
				],
			};
		}

		if (options) {
			if (!chartInstanceRef.current) {
				chartInstanceRef.current = echarts.init(chartRef.current);
			}
			chartInstanceRef.current.setOption(options, true);
		} else {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.clear();
			}
		}
	}, [processedData]);

	useEffect(() => {
		const chartInstance = chartInstanceRef.current;
		if (!chartInstance) return;
		const handleResize = () => {
			chartInstance.resize();
		};
		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	useEffect(() => {
		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, []);

	const chartTitle = canvasId.startsWith("long") ? "Long" : "Short";
	const winner = useMemo(() => getWinner(results), [results]);
	const winnerUrl = winner ? gameUrls[winner] : null;

	return (
		<div className="rounded-xl bg-zinc-800 p-4 shadow-lg transition-shadow hover:shadow-xl sm:p-6 ring-1 ring-zinc-700">
			<div className="flex items-center justify-between mb-4 sm:mb-6">
				<h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
					{chartTitle}
					{showWinner && winner ? (
						<>
							{" 🏆 "}
							{winnerUrl ? (
								<a
									href={winnerUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-400 hover:text-purple-300 transition-colors"
								>
									{winner}
								</a>
							) : (
								winner
							)}
						</>
					) : null}
				</h2>
			</div>
			<div className="relative h-[24rem] w-full sm:h-[28rem] overflow-x-auto">
				<div className="min-w-[600px] h-full">
					<div ref={chartRef} style={{ width: "100%", height: "100%" }} />
					{!processedData && (
						<div className="absolute inset-0 flex h-full items-center justify-center pointer-events-none">
							<p className="text-base font-medium text-zinc-400 sm:text-lg">
								{results.length === 0
									? "No voting results available yet"
									: "Processing results..."}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

```
app/routes/layout.tsx
```
import { Link, Outlet, useLoaderData, useLocation } from "react-router";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import type { LoaderFunction } from "react-router";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import { getCurrentMonth } from "~/server/month.server";

interface LoaderData {
	monthStatus: string;
	isAdmin: boolean;
}

export const loader: LoaderFunction = async ({ request }) => {
	// Get latest month's status using getCurrentMonth utility
	const currentMonth = await getCurrentMonth();

	// Check if user is a jury member
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	let isAdmin = false;
	if (discordId) {
		const result = await db.execute({
			sql: "SELECT 1 FROM jury_members WHERE discord_id = ? AND is_admin = 1",
			args: [discordId],
		});
		isAdmin = result.rows.length > 0;
	}

	return Response.json({
		monthStatus: currentMonth?.status || "ready",
		isAdmin,
	});
};

export default function Layout() {
	const location = useLocation();
	const { monthStatus, isAdmin } = useLoaderData<LoaderData>();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const getLinkClassName = (path: string, isMobile = false) => {
		const isActive = location.pathname === path;
		return `${
			isMobile ? "block w-full" : "w-[6.5rem] md:w-[7rem] lg:w-[8rem] min-w-max"
		} items-center justify-center gap-2 px-2 sm:px-3 md:px-4 py-2 text-[0.8rem] md:text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden whitespace-nowrap ${
			isActive
				? "text-white shadow-sm shadow-blue-600/50 border border-blue-500/50 bg-blue-600/20 border-blue-500/60 shadow-blue-600/60 after:absolute after:inset-0 after:bg-blue-500/20"
				: "text-white shadow-sm shadow-zinc-500/30 border border-zinc-400/30 hover:bg-zinc-500/20 hover:border-zinc-300/50 hover:shadow-zinc-400/60 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-300/20 after:transition-colors"
		} flex`;
	};

	const getCenterItem = () => {
		switch (monthStatus) {
			case "nominating":
				return { path: "/nominate", label: "Nominate" };
			case "voting":
				return { path: "/voting", label: "Vote" };
			case "jury":
			case "playing":
			case "over":
				return null;
			default:
				return { path: "/", label: "GOTM" };
		}
	};

	const centerItem = getCenterItem();
	const navLinks = [
		{ path: "/", label: "GOTM" },
		{ path: "/history", label: "History" },
		...(centerItem ? [centerItem] : []),
		{ path: "/jury", label: "Jury Members" },
		{ path: "/privacy", label: "Privacy" },
		// Only show admin link for jury members
		...(isAdmin ? [{ path: "/admin", label: "Admin" }] : []),
	];

	const activeTab =
		navLinks.find((link) => link.path === location.pathname)?.label || "GOTM";

	return (
		<div className="min-h-screen flex flex-col bg-zinc-900">
			<nav className="border-b border-zinc-800 bg-zinc-900">
				<div className="w-full px-2 sm:px-4 lg:px-8">
					<div className="flex h-16 justify-between md:justify-center">
						{/* Mobile menu button and active page title */}
						<div className="flex items-center gap-4 md:hidden">
							<button
								type="button"
								className="text-zinc-400 hover:text-zinc-100 focus:outline-none"
								onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
							>
								<span className="sr-only">Open main menu</span>
								{!isMobileMenuOpen ? (
									<Bars3Icon className="h-6 w-6" aria-hidden="true" />
								) : (
									<XMarkIcon className="h-6 w-6" aria-hidden="true" />
								)}
							</button>
							<span className="text-lg font-bold text-zinc-100">
								{activeTab}
							</span>
						</div>

						{/* Desktop navigation */}
						<div className="hidden md:flex md:items-center md:justify-center w-full max-w-full mx-auto overflow-x-auto">
							<div className="flex items-center justify-center flex-nowrap gap-2 sm:gap-3 md:gap-4 lg:gap-8 px-2">
								<div className="flex items-center gap-2 sm:gap-3 md:gap-4">
									{navLinks
										.filter(
											(link) => link.path === "/" || link.path === "/history",
										)
										.map((link) => (
											<Link
												key={link.path}
												to={link.path}
												prefetch="viewport"
												className={getLinkClassName(link.path)}
											>
												<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 transition-transform group-hover/btn:scale-105 text-xs sm:text-sm">
													{link.label}
												</span>
											</Link>
										))}
								</div>

								{centerItem && (
									<div className="flex items-center border-x border-zinc-800 px-2 sm:px-3 md:px-4">
										<Link
											to={centerItem.path}
											className={getLinkClassName(centerItem.path)}
										>
											<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 transition-transform group-hover/btn:scale-105 text-[0.8rem] md:text-sm">
												{centerItem.label}
											</span>
										</Link>
									</div>
								)}

								<div className="flex items-center gap-2 sm:gap-3 md:gap-4">
									{navLinks
										.filter(
											(link) =>
												link.path !== "/" &&
												link.path !== "/history" &&
												link.path !== centerItem?.path,
										)
										.map((link) => (
											<Link
												key={link.path}
												to={link.path}
												className={getLinkClassName(link.path)}
											>
												<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 transition-transform group-hover/btn:scale-105 text-xs sm:text-sm">
													{link.label}
												</span>
											</Link>
										))}
								</div>
							</div>
						</div>

						{/* Placeholder div to maintain centering on desktop */}
						<div className="w-10 md:hidden" />
					</div>
				</div>

				{/* Mobile menu, show/hide based on menu state */}
				<div
					className={`md:hidden fixed top-16 left-0 right-0 bg-zinc-900 border-b border-zinc-800 shadow-lg z-50 transition-all duration-200 ease-in-out ${
						isMobileMenuOpen
							? "opacity-100 translate-y-0"
							: "opacity-0 -translate-y-2"
					}`}
					style={{
						pointerEvents: isMobileMenuOpen ? "auto" : "none",
					}}
				>
					<div className="space-y-1 px-2 pb-3 pt-2">
						{navLinks.map((link) => (
							<Link
								key={link.path}
								to={link.path}
								className={getLinkClassName(link.path, true)}
								onClick={() => setIsMobileMenuOpen(false)}
							>
								{link.label}
							</Link>
						))}
					</div>
				</div>
			</nav>
			<main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex-1">
				<Outlet />
			</main>
			<footer className="py-4 border-t border-zinc-800">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
					<p className="text-center text-sm text-zinc-400">
						Created by{" "}
						<a
							href="https://github.com/sneakingJ"
							className="text-blue-400 hover:text-blue-300 hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							@sneakingJ
						</a>
						. Source code on{" "}
						<a
							href="https://github.com/obviyus/gotm-remix"
							className="text-blue-400 hover:text-blue-300 hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
					</p>
				</div>
			</footer>
		</div>
	);
}

```
app/routes/home/index.tsx
```
import { useLoaderData } from "react-router";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import {
	calculateVotingResults,
	getGameUrls,
	type Result,
} from "~/server/voting.server";
import type { Month, Nomination } from "~/types";
import SplitLayout, { Column } from "~/components/SplitLayout";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";

type LoaderData = {
	month: Month;
	results?: {
		long: Result[];
		short: Result[];
	};
	nominations?: {
		long: Nomination[];
		short: Nomination[];
	};
	gameUrls: Record<string, string>;
};

export const loader = async () => {
	const month = await getCurrentMonth();
	const gameUrls = getGameUrls(month.id);

	if (month.status === "nominating" || month.status === "jury") {
		const nominations = await getNominationsForMonth(month.id);

		// Group nominations by type
		const nominationsByType = nominations.reduce(
			(acc, nom) => {
				const nomination = nom as unknown as Nomination;
				if (nomination.short) {
					acc.short.push(nomination);
				} else {
					acc.long.push(nomination);
				}
				return acc;
			},
			{ short: [] as Nomination[], long: [] as Nomination[] },
		);

		return {
			month,
			nominations: nominationsByType,
			gameUrls,
		};
	}

	if (
		month.status === "voting" ||
		month.status === "over" ||
		month.status === "playing"
	) {
		// Calculate results and get URLs in parallel
		const results = await Promise.all([
			calculateVotingResults(month.id, false),
			calculateVotingResults(month.id, true),
		]).then(([long, short]) => ({ long, short }));

		return {
			month,
			results,
			gameUrls,
		};
	}

	// Default case: just return the month info
	return { month, results: undefined, gameUrls };
};

export default function Index() {
	const { month, results, nominations, gameUrls } = useLoaderData<LoaderData>();
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const longGamesCanvasId = useMemo(
		() => `longGamesChart-${month.month}-${month.year}`,
		[month],
	);
	const shortGamesCanvasId = useMemo(
		() => `shortGamesChart-${month.month}-${month.year}`,
		[month],
	);

	const showWinner =
		month.status === "over" ||
		month.status === "complete" ||
		month.status === "playing";

	const renderNominationsList = (games: Nomination[]) => (
		<div className="space-y-4">
			{games.map((game) => (
				<GameCard
					key={game.id}
					game={game}
					onViewPitches={() => {
						setSelectedNomination(game);
						setIsViewingPitches(true);
					}}
					pitchCount={game.pitches.length}
					showPitchesButton={true}
				/>
			))}
		</div>
	);

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				{month.theme && <ThemeCard {...month} />}
			</div>

			<div>
				{month.status === "nominating" && nominations ? (
					<SplitLayout
						title="Current Nominations"
						description="These games have been nominated for this month's Game of the Month."
					>
						<Column
							title="Long Games"
							statusBadge={{
								text: `${nominations.long.length} nominations`,
								isSuccess: nominations.long.length > 0,
							}}
						>
							{renderNominationsList(nominations.long)}
						</Column>

						<Column
							title="Short Games"
							statusBadge={{
								text: `${nominations.short.length} nominations`,
								isSuccess: nominations.short.length > 0,
							}}
						>
							{renderNominationsList(nominations.short)}
						</Column>
					</SplitLayout>
				) : month.status === "jury" && nominations ? (
					<>
						<div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-6 mb-8 text-center">
							<h2 className="text-xl font-bold text-blue-300 mb-2">
								Jury Selection in Progress
							</h2>
							<p className="text-zinc-200">
								Our jury members are currently reviewing all nominations and
								will select a curated list of games to be included in the voting
								phase.
							</p>
							<p className="text-zinc-300 mt-2">
								Once the jury has made their selections, the voting phase will
								begin and you&apos;ll be able to rank your favorites.
							</p>
						</div>
						<SplitLayout
							title="All Nominations"
							description="These games have been nominated for this month's Game of the Month. The jury is currently selecting which games will advance to the voting phase."
						>
							<Column
								title="Long Games"
								statusBadge={{
									text: `${nominations.long.length} nominations`,
									isSuccess: nominations.long.length > 0,
								}}
							>
								{renderNominationsList(nominations.long)}
							</Column>

							<Column
								title="Short Games"
								statusBadge={{
									text: `${nominations.short.length} nominations`,
									isSuccess: nominations.short.length > 0,
								}}
							>
								{renderNominationsList(nominations.short)}
							</Column>
						</SplitLayout>
					</>
				) : (
					<div className="space-y-6">
						<VotingResultsChart
							canvasId={longGamesCanvasId}a
							results={results?.long || []}
							gameUrls={gameUrls}
							showWinner={showWinner}
						/>
						<VotingResultsChart
							canvasId={shortGamesCanvasId}
							results={results?.short || []}
							gameUrls={gameUrls}
							showWinner={showWinner}
						/>
					</div>
				)}
			</div>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}

```
app/routes/jury/index.tsx
```
import { useLoaderData } from "react-router";
import { db } from "~/server/database.server";

export const loader = async () => {
	const result = await db.execute(
		`SELECT name
         FROM jury_members
         WHERE active = 1
         ORDER BY name;`,
	);

	return { juryMembers: result.rows.map((row) => row.name as string) };
};

export default function Jury() {
	const { juryMembers } = useLoaderData<{ juryMembers: string[] }>();

	return (
		<div className="mx-auto h-full px-4 py-6 sm:px-6 lg:px-8">
			<article className="mx-auto h-full">
				<header className="mb-6">
					<h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
						Jury Members
					</h1>
				</header>

				<ul className="list-disc ml-6 mt-2">
					{juryMembers.map((member) => (
						<li key={member}>{member}</li>
					))}
				</ul>
			</article>
		</div>
	);
}

```
app/routes/privacy/index.tsx
```
export default function Privacy() {
	return (
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<article className="mx-auto">
				<header className="mb-6">
					<h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
						Privacy
					</h1>
				</header>

				<p>
					This website gets the following information from your Discord account
					when you authenticate:
				</p>

				<ul className="list-disc ml-6 mt-2">
					<li>Account ID</li>
				</ul>

				<p className="mt-4">
					All of these are publicly visible to anyone in every server you
					joined.
				</p>

				<p className="mt-4">
					The only data that is used and saved on this site, is the account id
					and ONLY if you nominate or vote for a game. The sole purpose of this
					is to prevent multiple nominations and votings by the same user in one
					month.
				</p>

				<p className="mt-4">No other data is made use of in any way.</p>
			</article>
		</div>
	);
}

```
app/routes/auth/logout.tsx
```
import { type ActionFunction, redirect } from "react-router";
import { destroySession, getSession } from "~/sessions";

export const action: ActionFunction = async ({ request }) => {
	const session = await getSession(request.headers.get("Cookie"));

	return redirect("/", {
		headers: {
			"Set-Cookie": await destroySession(session),
		},
	});
};

```
app/routes/auth/discord/index.tsx
```
import { type LoaderFunction, redirect } from "react-router";

export const loader: LoaderFunction = async () => {
	if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
		throw new Error("Discord client ID and redirect URI must be defined");
	}

	const params = new URLSearchParams({
		client_id: process.env.DISCORD_CLIENT_ID,
		redirect_uri: process.env.DISCORD_REDIRECT_URI,
		response_type: "code",
		scope: "identify",
	});

	return redirect(`https://discord.com/api/oauth2/authorize?${params}`);
};

```
app/routes/auth/discord/callback/index.tsx
```
import { type LoaderFunction, redirect } from "react-router";
import { commitSession, getSession } from "~/sessions";
import { getCurrentMonth } from "~/server/month.server";

type MonthStatus =
	| "ready"
	| "nominating"
	| "jury"
	| "voting"
	| "playing"
	| "over";

export const loader: LoaderFunction = async ({ request }) => {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	if (error === "access_denied") {
		return redirect("/?error=user_denied");
	}

	if (!code) {
		return redirect("/");
	}

	if (
		!process.env.DISCORD_CLIENT_ID ||
		!process.env.DISCORD_CLIENT_SECRET ||
		!process.env.DISCORD_REDIRECT_URI
	) {
		throw new Error("Discord environment variables must be defined");
	}

	try {
		const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: process.env.DISCORD_CLIENT_ID,
				client_secret: process.env.DISCORD_CLIENT_SECRET,
				grant_type: "authorization_code",
				code,
				redirect_uri: process.env.DISCORD_REDIRECT_URI,
			}),
		});

		if (!tokenResponse.ok) {
			throw new Error("Failed to fetch access token");
		}

		const { access_token } = await tokenResponse.json();

		const userResponse = await fetch("https://discord.com/api/users/@me", {
			headers: { Authorization: `Bearer ${access_token}` },
		});

		if (!userResponse.ok) {
			throw new Error("Failed to fetch user data");
		}

		const user = await userResponse.json();
		const session = await getSession(request.headers.get("Cookie"));
		session.set("discordId", user.id);
		session.set("accessToken", access_token);

		// Get current month status and determine redirect path
		const currentMonth = await getCurrentMonth();
		const status = currentMonth.status as MonthStatus;

		// Only redirect to specific pages for nominating and voting phases
		const redirectPath =
			status === "nominating"
				? "/nominate"
				: status === "voting"
					? "/voting"
					: "/"; // Default to home page for all other statuses

		return redirect(redirectPath, {
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		});
	} catch (error) {
		console.error("Discord authentication error:", error);
		return redirect("/?error=auth_failed");
	}
};

```
app/routes/voting/index.tsx
```
import { useFetcher, useLoaderData } from "react-router";
import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { type LoaderFunction, redirect } from "react-router";
import { db } from "~/server/database.server";
import type { Nomination } from "~/types";
import { useState } from "react";
import GameCard from "~/components/GameCard";
import { getSession } from "~/sessions";
import { TrashIcon } from "@heroicons/react/20/solid";
import SplitLayout, { Column } from "~/components/SplitLayout";
import PitchesModal from "~/components/PitchesModal";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationById } from "~/server/nomination.server";

interface LoaderData {
	monthId: number;
	userId: string;
	shortNominations: Nomination[];
	longNominations: Nomination[];
	votedShort: boolean;
	votedLong: boolean;
	shortRankings: Array<{ nomination_id: number; rank: number }>;
	longRankings: Array<{ nomination_id: number; rank: number }>;
}

export const loader: LoaderFunction = async ({ request }) => {
	// Check for authentication
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "voting" ? monthRow.id : undefined;

	if (!monthId) {
		return Response.json({ monthId: undefined });
	}

	// Check if user has already voted
	const shortVoteResult = await db.execute({
		sql: `SELECT id
         FROM votes
         WHERE month_id = ?
           AND discord_id = ?
           AND short = 1`,
		args: [monthId, discordId],
	});

	const longVoteResult = await db.execute({
		sql: `SELECT id
         FROM votes
         WHERE month_id = ?
           AND discord_id = ?
           AND short = 0`,
		args: [monthId, discordId],
	});

	// Fetch nominations
	const shortNomResult = await db.execute({
		sql: `SELECT id
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = 1`,
		args: [monthId],
	});

	const longNomResult = await db.execute({
		sql: `SELECT id
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = 0`,
		args: [monthId],
	});

	const shortNoms = await Promise.all(
		shortNomResult.rows.map(
			async (row) => await getNominationById(row.id as number),
		),
	);
	const longNoms = await Promise.all(
		longNomResult.rows.map(
			async (row) => await getNominationById(row.id as number),
		),
	);

	// Fetch existing rankings if user has voted
	let shortRankings: Array<{ nomination_id: number; rank: number }> = [];
	let longRankings: Array<{ nomination_id: number; rank: number }> = [];

	if (shortVoteResult.rows[0]) {
		const shortRankResult = await db.execute({
			sql: `SELECT nomination_id, rank
             FROM rankings
             WHERE vote_id = ?
             ORDER BY \`rank\``,
			args: [shortVoteResult.rows[0].id],
		});
		shortRankings = shortRankResult.rows.map((row) => ({
			nomination_id: row.nomination_id as number,
			rank: row.rank as number,
		}));
	}

	if (longVoteResult.rows[0]) {
		const longRankResult = await db.execute({
			sql: `SELECT nomination_id, rank
             FROM rankings
             WHERE vote_id = ?
             ORDER BY \`rank\``,
			args: [longVoteResult.rows[0].id],
		});
		longRankings = longRankResult.rows.map((row) => ({
			nomination_id: row.nomination_id as number,
			rank: row.rank as number,
		}));
	}

	return Response.json({
		monthId,
		userId: discordId,
		shortNominations: shortNoms,
		longNominations: longNoms,
		votedShort: Boolean(shortVoteResult.rows[0]),
		votedLong: Boolean(longVoteResult.rows[0]),
		shortRankings,
		longRankings,
	});
};

export default function Voting() {
	const {
		monthId,
		userId,
		shortNominations = [],
		longNominations = [],
		votedShort: initialVotedShort,
		votedLong: initialVotedLong,
		shortRankings = [],
		longRankings = [],
	} = useLoaderData<LoaderData>();

	const voteFetcher = useFetcher();

	// Initialize order based on existing rankings if available
	const [currentOrder, setCurrentOrder] = useState<Record<number, string[]>>(
		() => {
			const initialOrder: Record<number, string[]> = {
				0: ["divider"], // long games
				1: ["divider"], // short games
			};

			// For long games
			if (longRankings?.length > 0) {
				// Add ranked games in order
				const rankedLongIds = longRankings
					.sort((a, b) => a.rank - b.rank)
					.map((r) => String(r.nomination_id));
				initialOrder[0].unshift(...rankedLongIds);

				// Add remaining unranked games below divider
				const unrankedLongIds = longNominations
					.filter((n) => !longRankings.find((r) => r.nomination_id === n.id))
					.map((n) => String(n.id));
				initialOrder[0].push(...unrankedLongIds);
			} else {
				// If no rankings, all games go below divider
				initialOrder[0].push(
					...(longNominations || []).map((n) => String(n.id)),
				);
			}

			// For short games
			if (shortRankings?.length > 0) {
				// Add ranked games in order
				const rankedShortIds = shortRankings
					.sort((a, b) => a.rank - b.rank)
					.map((r) => String(r.nomination_id));
				initialOrder[1].unshift(...rankedShortIds);

				// Add remaining unranked games below divider
				const unrankedShortIds = shortNominations
					.filter((n) => !shortRankings.find((r) => r.nomination_id === n.id))
					.map((n) => String(n.id));
				initialOrder[1].push(...unrankedShortIds);
			} else {
				// If no rankings, all games go below divider
				initialOrder[1].push(
					...(shortNominations || []).map((n) => String(n.id)),
				);
			}

			return initialOrder;
		},
	);

	const [votedLong, setVotedLong] = useState(initialVotedLong);
	const [votedShort, setVotedShort] = useState(initialVotedShort);
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const deleteVote = async (short: boolean) => {
		voteFetcher.submit(
			{ monthId, userId, short },
			{ method: "DELETE", action: "/api/votes" },
		);

		// Update local state
		const shortKey = short ? 1 : 0;
		const games = short ? shortNominations : longNominations;

		setCurrentOrder((prev) => ({
			...prev,
			[shortKey]: ["divider", ...games.map((n) => String(n.id))],
		}));

		if (short) {
			setVotedShort(false);
		} else {
			setVotedLong(false);
		}
	};

	const onDragEnd = async (result: DropResult) => {
		if (!result.destination) return;

		const isShort = result.source.droppableId === "short";
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Handle dragging items
		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		// Update the local state
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));

		// Get items above the divider and save them as votes
		const newDividerIndex = items.indexOf("divider");
		const rankedItems = items.slice(0, newDividerIndex);

		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		} else {
			await deleteVote(isShort);
		}
	};

	const saveVote = async (short: boolean, order: string[]) => {
		const validOrder = order
			.filter((id) => id && id !== "divider")
			.map((id) => Number.parseInt(id));

		if (validOrder.length === 0) {
			await deleteVote(short);
			return;
		}

		voteFetcher.submit(
			{ monthId, userId, short, order: validOrder },
			{
				method: "POST",
				action: "/api/votes",
				encType: "application/json",
			},
		);

		updateVoteStatus(short, true);
	};

	const updateVoteStatus = (short: boolean, voted: boolean) => {
		if (short) {
			setVotedShort(voted);
		} else {
			setVotedLong(voted);
		}
	};

	const moveItemAboveDivider = async (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Remove the item from its current position
		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		// Insert just above the divider
		const newDividerIndex = items.indexOf("divider");
		items.splice(newDividerIndex, 0, itemId);

		// Update state and save
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, items.indexOf("divider"));
		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		}
	};

	const moveItemBelowDivider = async (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Remove the item from its current position
		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		// Insert just below the divider
		const dividerIndex = items.indexOf("divider");
		items.splice(dividerIndex + 1, 0, itemId);

		// Update state and save
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, dividerIndex);
		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		} else {
			await deleteVote(isShort);
		}
	};

	const renderGames = (games: Nomination[], isShort: boolean) => {
		const shortKey = isShort ? 1 : 0;
		const order = currentOrder[shortKey];
		const dividerIndex = order.indexOf("divider");

		// Initialize ranked and unranked games based on the current order
		const rankedGames = games
			.filter(
				(g) =>
					dividerIndex > -1 &&
					order.slice(0, dividerIndex).includes(String(g.id)),
			)
			.sort((a, b) => {
				const aIndex = order.indexOf(String(a.id));
				const bIndex = order.indexOf(String(b.id));
				return aIndex - bIndex;
			});

		const unrankedGames = games
			.filter(
				(g) =>
					dividerIndex === -1 ||
					order.slice(dividerIndex + 1).includes(String(g.id)) ||
					!order.includes(String(g.id)),
			)
			.sort((a, b) => {
				const aIndex = order.indexOf(String(a.id));
				const bIndex = order.indexOf(String(b.id));
				return aIndex - bIndex;
			});

		return (
			<Droppable droppableId={isShort ? "short" : "long"}>
				{(provided) => (
					<div {...provided.droppableProps} ref={provided.innerRef}>
						{/* Ranked Section */}
						<div className="space-y-4">
							{rankedGames.length === 0 && order.length === 0 ? (
								<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
									<p className="text-sm text-gray-500">
										Drag games here to rank them in order of preference
									</p>
								</div>
							) : (
								rankedGames.map((game, index) => (
									<Draggable
										key={game.id}
										draggableId={String(game.id)}
										index={index}
									>
										{(provided) => (
											<GameCard
												game={game}
												draggableProps={provided.draggableProps}
												dragHandleProps={provided.dragHandleProps ?? undefined}
												innerRef={provided.innerRef}
												isRanked={true}
												onUnrank={() =>
													moveItemBelowDivider(isShort, String(game.id))
												}
												onViewPitches={() => {
													setSelectedNomination(game);
													setIsViewingPitches(true);
												}}
												pitchCount={game.pitches?.length || 0}
												showVotingButtons={true}
											/>
										)}
									</Draggable>
								))
							)}
						</div>

						{/* Divider */}
						<Draggable draggableId="divider" index={rankedGames.length}>
							{(provided) => (
								<div
									ref={provided.innerRef}
									{...provided.draggableProps}
									{...provided.dragHandleProps}
									className="border-t-2 border-gray-600/60 my-8 relative max-w-3xl mx-auto w-full"
								>
									<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 px-6 py-1.5 text-sm font-medium text-gray-200 select-none rounded-full border border-gray-600/60">
										Drag above to rank
									</span>
								</div>
							)}
						</Draggable>

						{/* Unranked Section */}
						<div className="space-y-4">
							{unrankedGames.length === 0 ? (
								<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
									<p className="text-sm text-gray-500">No unranked games</p>
								</div>
							) : (
								unrankedGames.map((game, index) => (
									<Draggable
										key={game.id}
										draggableId={String(game.id)}
										index={rankedGames.length + 1 + index}
									>
										{(provided) => (
											<GameCard
												game={game}
												draggableProps={provided.draggableProps}
												dragHandleProps={provided.dragHandleProps ?? undefined}
												innerRef={provided.innerRef}
												isRanked={false}
												onRank={() =>
													moveItemAboveDivider(isShort, String(game.id))
												}
												onViewPitches={() => {
													setSelectedNomination(game);
													setIsViewingPitches(true);
												}}
												pitchCount={game.pitches?.length || 0}
												showVotingButtons={true}
											/>
										)}
									</Draggable>
								))
							)}
						</div>
						{provided.placeholder}
					</div>
				)}
			</Droppable>
		);
	};

	return (
		<SplitLayout
			title="Drag and Drop the games"
			subtitle="to sort them in the priority you want them to win"
			description="Please only vote for games you actually want to play next month :)"
		>
			<Column
				title="Long Games"
				statusBadge={{
					text: votedLong ? "Voted" : "Not Voted",
					isSuccess: votedLong,
				}}
				action={
					votedLong && (
						<button
							type="button"
							className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
							onClick={() => deleteVote(false)}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
								<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
								Clear Vote
							</span>
						</button>
					)
				}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					{renderGames(longNominations, false)}
				</DragDropContext>
			</Column>

			<Column
				title="Short Games"
				statusBadge={{
					text: votedShort ? "Voted" : "Not Voted",
					isSuccess: votedShort,
				}}
				action={
					votedShort && (
						<button
							type="button"
							className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
							onClick={() => deleteVote(true)}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
								<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
								Clear Vote
							</span>
						</button>
					)
				}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					{renderGames(shortNominations, true)}
				</DragDropContext>
			</Column>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</SplitLayout>
	);
}

```
app/routes/admin/index.tsx
```
import { type LoaderFunction, redirect } from "react-router";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import { getCurrentMonth } from "~/server/month.server";

export const loader: LoaderFunction = async ({ request }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Check if user is a jury member
	const result = await db.execute({
		sql: "SELECT 1 FROM jury_members WHERE discord_id = ? AND is_admin = 1",
		args: [discordId],
	});

	if (result.rows.length === 0) {
		throw new Response("Unauthorized", { status: 403 });
	}

	const month = await getCurrentMonth();
	return redirect(`/admin/${month.id}`);
};

```
app/routes/admin/monthId/index.tsx
```
import { Link, useFetcher, useLoaderData, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
	type ActionFunctionArgs,
	type LoaderFunction,
	redirect,
} from "react-router";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import PitchesModal from "~/components/PitchesModal";
import type { Month, Nomination, Pitch, Theme, ThemeCategory } from "~/types";
import { getNominationsForMonth } from "~/server/nomination.server";
import { getMonth, getThemeCategories } from "~/server/month.server";
import type { Row, Value } from "@libsql/client";

interface LoaderData {
	months: Month[];
	selectedMonth: Month | null;
	nominations: Nomination[];
	pitches: Pitch[];
	themeCategories: ThemeCategory[];
	themes: Theme[];
}

interface ActionResponse {
	success?: boolean;
	error?: string;
}

interface DBRow extends Row {
	[key: string]: Value;
}

interface MonthRow extends DBRow {
	id: number;
}

export const loader: LoaderFunction = async ({ request, params }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Check if user is a jury member
	const result = await db.execute({
		sql: "SELECT 1 FROM jury_members WHERE discord_id = ? AND is_admin = 1",
		args: [discordId],
	});

	if (result.rows.length === 0) {
		throw new Response("Unauthorized", { status: 403 });
	}

	// Get all months
	const monthsResult = await db.execute({
		sql: "SELECT id FROM months ORDER BY year DESC, month DESC",
		args: [],
	});

	const selectedMonthId = Number(params.monthId);
	const selectedMonth = await getMonth(selectedMonthId);

	if (!selectedMonth) {
		throw new Response("Month not found", { status: 404 });
	}

	// Get nominations for selected month
	const nominations = await getNominationsForMonth(selectedMonthId);

	return {
		months: await Promise.all(
			(monthsResult.rows as unknown as MonthRow[]).map(async (row) =>
				getMonth(row.id),
			),
		),
		selectedMonth,
		nominations,
		themeCategories: await getThemeCategories(),
	};
};

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	switch (intent) {
		case "createMonth": {
			const year = Number(formData.get("year"));
			const month = Number(formData.get("month"));
			const status = formData.get("status");
			const themeCategoryId = Number(formData.get("themeCategoryId"));
			const themeName = formData.get("themeName");
			const themeDescription = formData.get("themeDescription");

			if (
				!year ||
				!month ||
				!status ||
				!themeCategoryId ||
				!themeName ||
				typeof status !== "string" ||
				typeof themeName !== "string"
			) {
				return Response.json(
					{ error: "Missing required fields" },
					{ status: 400 },
				);
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(status)) {
					const activeMonthsResult = await db.execute({
						sql: `SELECT m.id, m.year, m.month, ms.status 
							  FROM months m 
							  JOIN month_status ms ON m.status_id = ms.id 
							  WHERE ms.status IN ('nominating', 'jury', 'voting')`,
						args: [],
					});

					if (activeMonthsResult.rows.length > 0) {
						return Response.json(
							{
								error:
									"Another month is already active. Only one month can be in nominating / jury / voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				// Get the status_id for the new status
				const statusResult = await db.execute({
					sql: "SELECT id FROM month_status WHERE status = ?",
					args: [status],
				});

				if (statusResult.rows.length === 0) {
					return Response.json(
						{ error: `Invalid status: ${status}` },
						{ status: 400 },
					);
				}

				const statusId = statusResult.rows[0].id;

				// Create theme first
				const themeResult = await db.execute({
					sql: "INSERT INTO themes (theme_category_id, name, description) VALUES (?, ?, ?) RETURNING id",
					args: [
						themeCategoryId,
						themeName,
						themeDescription?.toString() || null,
					],
				});

				const themeId = (themeResult.rows[0] as unknown as MonthRow).id;

				// Then create month with the new theme
				await db.execute({
					sql: "INSERT INTO months (year, month, status_id, theme_id) VALUES (?, ?, ?, ?)",
					args: [year, month, statusId, themeId],
				});

				return Response.json({ success: true });
			} catch (error) {
				// Check for unique constraint violation
				if (
					error instanceof Error &&
					error.message.includes("UNIQUE constraint failed")
				) {
					return Response.json(
						{ error: "This month already exists" },
						{ status: 400 },
					);
				}
				throw error;
			}
		}

		case "updateStatus": {
			const monthId = formData.get("monthId")?.toString();
			const newStatus = formData.get("status");

			if (!monthId || !newStatus || typeof newStatus !== "string") {
				return Response.json(
					{ error: "Missing required fields" },
					{ status: 400 },
				);
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(newStatus)) {
					const activeMonthsResult = await db.execute({
						sql: `SELECT m.id, m.year, m.month, ms.status 
							  FROM months m 
							  JOIN month_status ms ON m.status_id = ms.id 
							  WHERE ms.status IN ('nominating', 'jury', 'voting') AND m.id != ?`,
						args: [monthId],
					});

					if (activeMonthsResult.rows.length > 0) {
						return Response.json(
							{
								error:
									"Another month is already active. Only one month can be in nominating/jury/voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				// First get the status_id for the new status
				const statusResult = await db.execute({
					sql: "SELECT id FROM month_status WHERE status = ?",
					args: [newStatus],
				});

				if (statusResult.rows.length === 0) {
					return Response.json(
						{ error: `Invalid status: ${newStatus}` },
						{ status: 400 },
					);
				}

				const statusId = statusResult.rows[0].id;

				// Update the month with the new status_id
				await db.execute({
					sql: "UPDATE months SET status_id = ? WHERE id = ?",
					args: [statusId, monthId],
				});

				return Response.json({ success: true });
			} catch (error) {
				console.error("Error updating month status:", error);
				return Response.json(
					{ error: "Failed to update month status" },
					{ status: 500 },
				);
			}
		}

		case "toggleJurySelected": {
			const nominationId = formData.get("nominationId")?.toString();
			const selected = formData.get("selected") === "true";

			if (!nominationId) {
				return Response.json(
					{ error: "Missing nomination ID" },
					{ status: 400 },
				);
			}

			await db.execute({
				sql: "UPDATE nominations SET jury_selected = ? WHERE id = ?",
				args: [selected ? 1 : 0, nominationId],
			});

			return Response.json({ success: true });
		}

		default:
			return Response.json({ error: "Invalid action" }, { status: 400 });
	}
}

export default function Admin() {
	const { months, selectedMonth, nominations, themeCategories } =
		useLoaderData<LoaderData>();
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isPitchesModalOpen, setIsPitchesModalOpen] = useState(false);
	const navigate = useNavigate();
	const createMonthFetcher = useFetcher<ActionResponse>();
	const statusUpdateFetcher = useFetcher<ActionResponse>();
	const [error, setError] = useState<string | null>(null);

	// Clear error when submission is successful
	useEffect(() => {
		if (
			createMonthFetcher.state === "idle" &&
			createMonthFetcher.data?.success
		) {
			setError(null);
			navigate(".", { replace: true });
		} else if (createMonthFetcher.data?.error) {
			setError(createMonthFetcher.data.error);
		}
	}, [createMonthFetcher.state, createMonthFetcher.data, navigate]);

	const monthStatuses = [
		"ready",
		"nominating",
		"jury",
		"voting",
		"playing",
		"over",
	] as const;

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			{/* Month Navigation */}
			{selectedMonth && (
				<div className="flex justify-between items-center mb-8">
					<Link
						to={`/admin/${months[months.findIndex((m) => m.id === selectedMonth.id) + 1]?.id}`}
						className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
							months.findIndex((m) => m.id === selectedMonth.id) ===
							months.length - 1
								? "pointer-events-none opacity-50"
								: "text-zinc-200 shadow-sm shadow-zinc-500/20 border border-zinc-400/20 hover:bg-zinc-500/10 hover:border-zinc-400/30 hover:shadow-zinc-500/40 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-400/5 after:transition-colors"
						}`}
					>
						<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
							← Previous Month
						</span>
					</Link>

					<h1 className="text-2xl font-bold flex items-center gap-2 text-zinc-200">
						{new Date(
							selectedMonth.year,
							selectedMonth.month - 1,
						).toLocaleString("default", { month: "long", year: "numeric" })}
						{["nominating", "jury", "voting"].includes(
							selectedMonth.status,
						) && (
							<span className="inline-flex items-center p-2 px-4 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
								Active Month
							</span>
						)}
					</h1>

					<Link
						to={`/admin/${months[months.findIndex((m) => m.id === selectedMonth.id) - 1]?.id}`}
						className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
							months.findIndex((m) => m.id === selectedMonth.id) === 0
								? "pointer-events-none opacity-50"
								: "text-zinc-200 shadow-sm shadow-zinc-500/20 border border-zinc-400/20 hover:bg-zinc-500/10 hover:border-zinc-400/30 hover:shadow-zinc-500/40 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-400/5 after:transition-colors"
						}`}
					>
						<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
							Next Month →
						</span>
					</Link>
				</div>
			)}

			{/* Create New Month Section */}
			<section className="mb-12">
				<h2 className="text-2xl font-semibold mb-4 text-zinc-200">
					Create New Month
				</h2>
				<createMonthFetcher.Form method="POST">
					<input type="hidden" name="intent" value="createMonth" />
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-4">
							<div className="flex-1">
								<label
									htmlFor="year"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Year
								</label>
								<input
									type="number"
									id="year"
									name="year"
									min="2000"
									max="2100"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								/>
							</div>
							<div className="flex-1">
								<label
									htmlFor="month"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Month (1-12)
								</label>
								<input
									type="number"
									id="month"
									name="month"
									min="1"
									max="12"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								/>
							</div>
							<div className="flex-1">
								<label
									htmlFor="status"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Initial Status
								</label>
								<select
									id="status"
									name="status"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								>
									{monthStatuses.map((status) => (
										<option key={status} value={status} className="py-1">
											{status.charAt(0).toUpperCase() + status.slice(1)}
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="flex items-center gap-4">
							<div className="flex-1">
								<label
									htmlFor="themeCategory"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Theme Category
								</label>
								<select
									id="themeCategory"
									name="themeCategoryId"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								>
									<option value="">Select a category</option>
									{themeCategories.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>
							</div>
							<div className="flex-1">
								<label
									htmlFor="themeName"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Theme Name
								</label>
								<input
									type="text"
									id="themeName"
									name="themeName"
									required
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
									placeholder="Enter theme name"
								/>
							</div>
						</div>
						<div>
							<label
								htmlFor="themeDescription"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Theme Description
							</label>
							<textarea
								id="themeDescription"
								name="themeDescription"
								rows={3}
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								placeholder="Enter theme description (optional)"
							/>
						</div>
						<div className="flex justify-end">
							<button
								type="submit"
								disabled={createMonthFetcher.state !== "idle"}
								className={`self-end inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
									createMonthFetcher.state !== "idle"
										? "opacity-50 cursor-not-allowed"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
								}`}
							>
								<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
									{createMonthFetcher.state !== "idle"
										? "Creating..."
										: "Create Month"}
								</span>
							</button>
						</div>
					</div>
					{error && <p className="mt-2 text-sm text-red-400">{error}</p>}
				</createMonthFetcher.Form>
			</section>

			{/* Month Status Section */}
			<section className="mb-12">
				<h2 className="text-2xl font-semibold mb-4 text-zinc-200">
					Month Status
				</h2>
				{selectedMonth && (
					<>
						<statusUpdateFetcher.Form
							method="POST"
							className="flex items-end gap-4"
						>
							<input type="hidden" name="monthId" value={selectedMonth.id} />
							<input type="hidden" name="intent" value="updateStatus" />
							<div className="flex-1">
								<label
									htmlFor="status"
									className="block text-sm font-medium text-zinc-400 mb-2"
								>
									Status for{" "}
									{new Date(
										selectedMonth.year,
										selectedMonth.month - 1,
									).toLocaleString("default", {
										month: "long",
										year: "numeric",
									})}
								</label>
								<select
									id="status"
									name="status"
									value={selectedMonth.status}
									onChange={(e) => {
										const form = e.target.form;
										if (form) {
											form.requestSubmit();
										}
									}}
									className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								>
									{monthStatuses.map((status) => (
										<option key={status} value={status} className="py-1">
											{status.charAt(0).toUpperCase() + status.slice(1)}
										</option>
									))}
								</select>
							</div>
						</statusUpdateFetcher.Form>
						{statusUpdateFetcher.data?.error && (
							<p className="mt-2 text-sm text-red-400">
								{statusUpdateFetcher.data.error}
							</p>
						)}
					</>
				)}
			</section>

			{/* Jury Selection Section */}
			{selectedMonth && nominations.length > 0 && (
				<section>
					<h2 className="text-2xl font-semibold mb-4">Jury Selection</h2>
					<div className="bg-black/10 backdrop-blur-sm rounded-lg shadow overflow-hidden border border-white/10">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-white/10">
								<thead>
									<tr>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Game
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Year
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Type
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Pitches
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
										>
											Selected
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/10">
									{nominations.map((nomination) => (
										<tr
											key={nomination.id}
											className="hover:bg-white/5 transition-colors"
										>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex items-center">
													{nomination.gameCover && (
														<img
															src={nomination.gameCover}
															alt=""
															className="h-10 w-10 object-cover rounded-sm mr-3 border border-white/10"
														/>
													)}
													<div className="text-sm font-medium text-zinc-200">
														{nomination.gameName}
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
												{nomination.gameYear}
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<span
													className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
														nomination.short
															? "bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20"
															: "bg-blue-400/10 text-blue-400 ring-1 ring-inset ring-blue-400/20"
													}`}
												>
													{nomination.short ? "Short" : "Long"}
												</span>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm">
												<button
													type="button"
													onClick={() => {
														setSelectedNomination(nomination);
														setIsPitchesModalOpen(true);
													}}
													className="text-zinc-400 hover:text-zinc-200 transition-colors"
												>
													View Pitches (
													{
														(
															nominations.find((n) => n.id === nomination.id)
																?.pitches || []
														).length
													}
													)
												</button>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<form method="POST">
													<input
														type="hidden"
														name="intent"
														value="toggleJurySelected"
													/>
													<input
														type="hidden"
														name="nominationId"
														value={nomination.id}
													/>
													<input
														type="hidden"
														name="selected"
														value={(!nomination.jurySelected).toString()}
													/>
													<button
														type="submit"
														className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
															nomination.jurySelected
																? "bg-blue-500"
																: "bg-zinc-700"
														}`}
													>
														<span
															className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
																nomination.jurySelected
																	? "translate-x-5"
																	: "translate-x-0"
															}`}
														/>
													</button>
												</form>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			)}

			<PitchesModal
				isOpen={isPitchesModalOpen}
				onClose={() => {
					setIsPitchesModalOpen(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}

```
app/routes/nominate/index.tsx
```
import { useState } from "react";
import {
	Form,
	Link,
	useActionData,
	useFetcher,
	useLoaderData,
	useNavigation,
	useSubmit,
	redirect,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunction } from "react-router";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { searchGames } from "~/server/igdb.server";
import GameCard from "~/components/GameCard";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import type { Nomination, NominationFormData } from "~/types";
import PitchesModal from "~/components/PitchesModal";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";

interface LoaderData {
	games: Nomination[];
	monthId?: number;
	userDiscordId: string;
	monthStatus?: string;
	userNominations: Nomination[];
	allNominations: Nomination[];
	previousWinners: string[];
}

interface NominationResponse {
	error?: string;
	success?: boolean;
	nominationId?: number;
}

export const loader: LoaderFunction = async ({ request }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "nominating" ? monthRow.id : undefined;

	// Fetch all previous GOTM winners
	const result = await db.execute(
		`SELECT DISTINCT game_id 
        FROM winners;`,
	);
	const previousWinners = result.rows.map((w) =>
		(w.game_id as number).toString(),
	);

	// Fetch user's nominations for the current month if in nominating phase
	let userNominations: Nomination[] = [];
	let allNominations: Nomination[] = [];
	if (monthId) {
		// Fetch all nominations for the month
		allNominations = await getNominationsForMonth(monthId);

		// Filter for user's nominations
		userNominations = allNominations.filter((n) => n.discordId === discordId);
	}

	return Response.json({
		games: [],
		monthId,
		monthStatus: monthRow.status,
		userDiscordId: discordId,
		userNominations,
		allNominations,
		previousWinners,
	});
};

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const query = formData.get("query");

	if (typeof query !== "string") {
		return Response.json({ games: [] });
	}

	const games = await searchGames(query);
	return Response.json({ games });
}

export default function Nominate() {
	const {
		games: initialGames,
		monthId,
		monthStatus,
		userNominations,
		allNominations,
		userDiscordId,
		previousWinners,
	} = useLoaderData<LoaderData>();
	const actionData = useActionData<typeof action>();
	const games = actionData?.games || initialGames;
	const submit = useSubmit();
	const [searchTerm, setSearchTerm] = useState("");
	const nominate = useFetcher<NominationResponse>();
	const navigation = useNavigation();
	const isSearching = navigation.formData?.get("query") != null;
	const hasSearched = actionData !== undefined; // Track if a search was performed

	// New state for modal
	const [isOpen, setIsOpen] = useState(false);
	const [selectedGame, setSelectedGame] = useState<Nomination | null>(null);
	const [pitch, setPitch] = useState("");

	// State for edit modal
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editingNomination, setEditingNomination] = useState<Nomination | null>(
		null,
	);
	const [editPitch, setEditPitch] = useState("");

	// Delete confirmation modal state
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [deletingNomination, setDeletingNomination] =
		useState<Nomination | null>(null);

	// Track short and long nominations
	const shortNomination = userNominations.find((n) => n.short);
	const longNomination = userNominations.find((n) => !n.short);
	const hasReachedNominationLimit = shortNomination && longNomination;

	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!searchTerm.trim()) return;
		submit(e.currentTarget);
	};

	const handleGameSelect = (
		game: Nomination,
		existingNomination?: Nomination,
	) => {
		if (hasReachedNominationLimit && !existingNomination) {
			// Don't allow new nominations if limit reached
			return;
		}

		if (existingNomination) {
			// If game is already nominated, go straight to pitch dialog
			setEditingNomination(existingNomination);
			setEditPitch(
				existingNomination.pitches.find((p) => p.discordId === userDiscordId)
					?.pitch || "",
			);
			setIsEditOpen(true);
		} else {
			// Otherwise show the nomination dialog
			setSelectedGame(game);
			setIsOpen(true);
		}
	};

	const handleEdit = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (fullNomination) {
			setEditingNomination(fullNomination);
			setEditPitch(
				fullNomination.pitches.find((p) => p.discordId === userDiscordId)
					?.pitch || "",
			);
			setIsEditOpen(true);
		}
	};

	const handleDelete = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (fullNomination) {
			setDeletingNomination(fullNomination);
			setIsDeleteOpen(true);
		}
	};

	const handleEditSubmit = () => {
		if (!editingNomination) return;

		nominate.submit(
			{
				nominationId: editingNomination.id,
				pitch: editPitch.trim() || null,
			},
			{
				method: "PATCH",
				action: "/api/nominations",
				encType: "application/json",
			},
		);

		setIsEditOpen(false);
		setEditingNomination(null);
		setEditPitch("");
	};

	const handleDeleteConfirm = () => {
		if (!deletingNomination) return;

		nominate.submit(
			{
				nominationId: deletingNomination.id.toString(),
				_action: "delete",
			},
			{
				method: "DELETE",
				action: "/api/nominations",
			},
		);

		setIsDeleteOpen(false);
		setDeletingNomination(null);
	};

	const handleGameLength = (isShort: boolean) => {
		if (!selectedGame) return;

		// Build the nomination data with type checking
		const nominationData: NominationFormData = {
			game: {
				id: Number(selectedGame.gameId),
				name: selectedGame.gameName,
				cover: selectedGame.gameCover,
				gameYear: selectedGame.gameYear,
				url: selectedGame.gameUrl,
			},
			monthId: monthId?.toString() ?? "",
			short: isShort,
			pitch: pitch.trim() || null,
		};

		// Submit as stringified JSON
		nominate.submit(
			{ json: JSON.stringify(nominationData) },
			{
				method: "POST",
				action: "/api/nominations",
				encType: "application/json",
			},
		);

		setIsOpen(false);
		setSelectedGame(null);
		setPitch("");
	};

	if (!monthId || monthStatus !== "nominating") {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 text-center">
				<h1 className="text-3xl font-bold tracking-tight text-zinc-200 mb-4">
					Nominations{" "}
					{monthStatus === "over" ? "haven't started" : "are closed"}
				</h1>

				<div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 p-8 shadow-lg">
					{monthStatus === "ready" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The month is being set up. Check back soon for nominations!
							</p>
							<Link
								to="/history"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
					{monthStatus === "voting" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The nomination phase is over, but you can now vote for your
								favorite games!
							</p>
							<Link
								to="/voting"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Go Vote Now →
							</Link>
						</>
					)}

					{monthStatus === "playing" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								Games have been selected! Check out what we&#39;re playing this
								month.
							</p>
							<Link
								to="/"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								See This Month&#39;s Games →
							</Link>
						</>
					)}

					{monthStatus === "jury" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The jury is currently selecting games from the nominations.
								Check back soon!
							</p>
							<p className="text-zinc-400">
								Once they&#39;re done, you&#39;ll be able to vote on the
								selected games.
							</p>
						</>
					)}

					{monthStatus === "over" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The next month&#39;s nominations haven&#39;t started yet. Check
								back soon!
							</p>
							<Link
								to="/history"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
				</div>
			</div>
		);
	}

	const GameSkeleton = () => (
		<div className="group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl shadow-lg border border-zinc-800/50 flex h-52 min-w-0">
			<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
				<div className="absolute inset-0 bg-zinc-800 animate-pulse" />
			</div>
			<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="min-w-0 space-y-2">
					<div className="flex justify-between items-start gap-2">
						<div className="h-5 bg-zinc-800 rounded w-3/4 animate-pulse" />
						<div className="h-4 bg-zinc-800 rounded w-12 shrink-0 animate-pulse" />
					</div>
				</div>
				<div className="flex flex-col gap-2 mt-auto min-w-0">
					<div className="h-9 bg-zinc-800 rounded w-full animate-pulse" />
				</div>
			</div>
		</div>
	);

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold mb-8">Nominate Games</h1>

			{/* User's nominations */}
			{userNominations.length > 0 && (
				<div className="mb-8">
					<h2 className="text-xl font-semibold mb-4">Your Nominations</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						{userNominations.map((nomination) => (
							<GameCard
								game={nomination}
								key={nomination.id}
								variant="nomination"
								onEdit={handleEdit}
								onDelete={handleDelete}
								onViewPitches={() => {
									setSelectedNomination(nomination);
									setIsViewingPitches(true);
								}}
								pitchCount={nomination.pitches.length}
								showVotingButtons={false}
							/>
						))}
					</div>
				</div>
			)}

			{nominate.data?.error && (
				<div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
					{nominate.data.error}
				</div>
			)}

			{nominate.data?.success && (
				<div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
					Game nominated successfully!
				</div>
			)}

			{!hasReachedNominationLimit && (
				<div>
					<div className="mb-4">
						<h3 className="text-lg font-medium text-zinc-200">
							Nomination Status:
						</h3>
						<ul className="mt-2 space-y-1 text-sm text-zinc-400">
							<li className="flex items-center">
								<span
									className={
										shortNomination ? "text-emerald-400" : "text-zinc-400"
									}
								>
									{shortNomination ? "✓" : "○"} Short Game (
									{shortNomination ? "Nominated" : "Available"})
								</span>
							</li>
							<li className="flex items-center">
								<span
									className={
										longNomination ? "text-emerald-400" : "text-zinc-400"
									}
								>
									{longNomination ? "✓" : "○"} Long Game (
									{longNomination ? "Nominated" : "Available"})
								</span>
							</li>
						</ul>
					</div>

					<Form method="post" onSubmit={handleSearch} className="mb-8">
						<div className="flex gap-4">
							<input
								type="search"
								name="query"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search for games..."
								className="flex-1 rounded-md border-white/10 bg-black/20 text-zinc-200 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
							/>
							<button
								type="submit"
								disabled={isSearching || !searchTerm.trim()}
								className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:border-zinc-400/20"
							>
								<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
									{isSearching ? "Searching..." : "Search"}
								</span>
							</button>
						</div>
					</Form>
					{isSearching ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{Array.from({ length: 10 }).map((_, i) => (
								<GameSkeleton key={`skeleton-${Date.now()}-${i}`} />
							))}
						</div>
					) : games.length > 0 ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{games.map((game: Nomination) => {
								const existingNomination = allNominations.find(
									(n) => n.gameId === game.gameId.toString(),
								);
								const isCurrentUserNomination =
									existingNomination?.discordId === userDiscordId;
								const isPreviousWinner = previousWinners.includes(
									game.id.toString(),
								);

								let buttonText = "Nominate";
								if (isPreviousWinner) {
									buttonText = "Previous GOTM";
								} else if (isCurrentUserNomination) {
									buttonText = "Edit Pitch";
								} else if (existingNomination) {
									buttonText = "Add Pitch";
								}

								return (
									<GameCard
										key={game.id}
										game={game}
										onNominate={() => {
											if (isPreviousWinner) {
												return; // Do nothing for previous winners
											}
											if (existingNomination) {
												// If it's the current user's nomination, open edit modal
												// If it's another user's nomination, allow adding a pitch
												setEditingNomination(existingNomination);
												setEditPitch("");
												setIsEditOpen(true);
											} else {
												handleGameSelect(game);
											}
										}}
										variant="search"
										alreadyNominated={Boolean(existingNomination)}
										isCurrentUserNomination={isCurrentUserNomination}
										isPreviousWinner={isPreviousWinner}
										buttonText={buttonText}
										buttonDisabled={isPreviousWinner}
									/>
								);
							})}
						</div>
					) : hasSearched && searchTerm ? (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								No results found
							</h3>
							<p className="mt-2 text-zinc-400">
								No games found matching &#34;{searchTerm}&#34;. Try a different
								search term.
							</p>
						</div>
					) : (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								Search for games to nominate
							</h3>
							<p className="mt-2 text-zinc-400">
								Type in the search box above to find games. You can nominate one
								short game and one long game.
							</p>
						</div>
					)}
				</div>
			)}

			{/* Game Length Selection Modal */}
			<Dialog
				open={isOpen}
				onClose={() => {
					setIsOpen(false);
					setPitch(""); // Reset pitch when closing modal
				}}
				className="relative z-50"
			>
				<div className="fixed inset-0 bg-black/30" aria-hidden="true" />

				{/* Full-screen container for mobile slide-up and desktop centered modal */}
				<div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
					<DialogPanel className="w-full sm:w-[32rem] rounded-t-lg sm:rounded-lg bg-zinc-900 border border-white/10 p-6 shadow-xl">
						<DialogTitle className="text-lg font-medium leading-6 text-zinc-200 mb-4">
							Nominate {selectedGame?.gameName} ({selectedGame?.gameYear})
						</DialogTitle>

						{/* Game Cover and Summary */}
						<div className="mb-6 flex gap-4">
							{selectedGame?.gameCover && (
								<div className="flex-shrink-0">
									<img
										src={selectedGame.gameCover.replace(
											"/t_thumb/",
											"/t_cover_big/",
										)}
										alt={selectedGame.gameName}
										className="w-32 rounded-lg shadow-lg border border-white/10"
									/>
								</div>
							)}
							{selectedGame?.summary && (
								<div className="flex-1">
									<p className="text-sm text-zinc-400 line-clamp-[12]">
										{selectedGame.summary}
									</p>
								</div>
							)}
						</div>

						{/* Pitch Input */}
						<div className="mb-6">
							<label
								htmlFor="pitch"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Pitch (Optional)
							</label>
							<textarea
								id="pitch"
								name="pitch"
								rows={3}
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								value={pitch}
								onChange={(e) => setPitch(e.target.value)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<button
								type="button"
								onClick={() => handleGameLength(true)}
								disabled={Boolean(shortNomination)}
								className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
									shortNomination
										? "opacity-50 cursor-not-allowed text-zinc-400 border border-zinc-400/20"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
								}`}
							>
								<span className="relative z-10 flex flex-col items-center justify-center gap-1 transition-transform group-hover/btn:scale-105">
									Short Game
									<span className="text-xs opacity-80">(&lt; 12 hours)</span>
									{shortNomination && (
										<span className="text-xs">Already nominated</span>
									)}
								</span>
							</button>
							<button
								type="button"
								onClick={() => handleGameLength(false)}
								disabled={Boolean(longNomination)}
								className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
									longNomination
										? "opacity-50 cursor-not-allowed text-zinc-400 border border-zinc-400/20"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
								}`}
							>
								<span className="relative z-10 flex flex-col items-center justify-center gap-1 transition-transform group-hover/btn:scale-105">
									Long Game
									<span className="text-xs opacity-80">(&gt; 12 hours)</span>
									{longNomination && (
										<span className="text-xs">Already nominated</span>
									)}
								</span>
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>

			{/* Edit Modal */}
			<Dialog
				open={isEditOpen}
				onClose={() => {
					setIsEditOpen(false);
					setEditPitch("");
				}}
				className="relative z-50"
			>
				<div
					className="fixed inset-0 bg-black/80 backdrop-blur-sm"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
					<DialogPanel className="w-full sm:w-[32rem] rounded-t-lg sm:rounded-lg bg-zinc-900 border border-white/10 p-6 shadow-xl">
						<DialogTitle className="text-lg font-medium leading-6 text-zinc-200 mb-4">
							{editingNomination && editingNomination.pitches.length > 0
								? "Edit"
								: "Add"}{" "}
							Pitch: {editingNomination?.gameName}
						</DialogTitle>
						<div className="mb-6">
							<label
								htmlFor="editPitch"
								className="block text-sm font-medium text-zinc-400 mb-2"
							>
								Pitch
							</label>
							<textarea
								id="editPitch"
								rows={3}
								className="block w-full rounded-md border-white/10 bg-black/20 text-zinc-200 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
								value={editPitch}
								onChange={(e) => setEditPitch(e.target.value)}
								placeholder="Write your pitch here..."
							/>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setIsEditOpen(false)}
								className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors border border-white/10"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleEditSubmit}
								className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
							>
								{editingNomination?.pitches ? "Save Changes" : "Add Pitch"}
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog
				open={isDeleteOpen}
				onClose={() => setIsDeleteOpen(false)}
				className="relative z-50"
			>
				<div
					className="fixed inset-0 bg-black/80 backdrop-blur-sm"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="w-full max-w-sm rounded-lg bg-zinc-900 border border-white/10 p-6 shadow-xl">
						<DialogTitle className="text-lg font-medium leading-6 text-zinc-200 mb-4">
							Delete Nomination
						</DialogTitle>
						<p className="text-sm text-zinc-400 mb-6">
							Are you sure you want to delete your nomination for{" "}
							{deletingNomination?.gameName}? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setIsDeleteOpen(false)}
								className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors border border-white/10"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDeleteConfirm}
								className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
							>
								Delete
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>

			{/* Add PitchesModal */}
			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}

```
app/routes/history/index.tsx
```
import { Link, useLoaderData } from "react-router";
import { db } from "~/server/database.server";
import type { Month } from "~/types";
import { getMonth } from "~/server/month.server";
import { getWinner } from "~/server/winner.server";

export const loader = async () => {
	const result = await db.execute(
		`SELECT id FROM months WHERE status_id NOT IN (
			SELECT id FROM month_status WHERE status = 'nominating'
		) ORDER BY id DESC;`,
	);

	const months: Month[] = await Promise.all(
		result.rows.map(async (row) => {
			const month = await getMonth(row.id as number);

			// Only fetch winners for months that have completed voting
			if (month.status === "voting") {
				return month;
			}

			const longWinner = await getWinner(month.id, false);
			const shortWinner = await getWinner(month.id, true);

			if (!longWinner || !shortWinner) {
				return month;
			}

			return {
				...month,
				winners: [longWinner, shortWinner],
			};
		}),
	);

	return { months };
};

export default function History() {
	const { months } = useLoaderData<{ months: Month[] }>();

	// Group months by year
	const monthsByYear = months.reduce(
		(acc, month) => {
			if (!acc[month.year]) {
				acc[month.year] = [];
			}
			acc[month.year].push(month);
			return acc;
		},
		{} as Record<number, Month[]>,
	);

	return (
		<div className="mx-auto max-w-7xl mt-6 px-4 sm:px-6 lg:px-8">
			{Object.entries(monthsByYear)
				.sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
				.map(([year, yearMonths]) => (
					<div key={year}>
						<div className="mb-12">
							<div className="flex items-center gap-4 mb-8">
								<div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
								<h2 className="text-3xl font-bold text-zinc-100">{year}</h2>
								<div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
							</div>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{yearMonths.map((month) => (
									<Link
										key={month.id}
										to={`/history/${month.id}`}
										prefetch="viewport"
										className="group block overflow-hidden rounded-xl border transition-all duration-300 ease-out
                                            bg-zinc-900/50 border-zinc-800 backdrop-blur-sm
                                            hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
									>
										<div className="p-5">
											<h2 className="text-2xl font-semibold text-zinc-100 mb-4">
												{new Date(month.year, month.month - 1).toLocaleString(
													"default",
													{
														month: "long",
													},
												)}
											</h2>
											{month.theme && (
												<div className="mb-4">
													<span className="px-3 py-1 rounded-full text-sm bg-blue-600 text-zinc-100 inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
														{month.theme.name}
													</span>
												</div>
											)}
											{/* Only show winners if voting is completed (not in voting stage) */}
											{month.winners &&
												month.winners.length > 0 &&
												month.status !== "voting" && (
													<div className="space-y-4">
														{month.winners
															.filter((w) => !w.short)
															.map((winner) => (
																<div
																	key={winner.gameId}
																	className="flex items-start space-x-3"
																>
																	{winner.gameCover && (
																		<img
																			src={winner.gameCover.replace(
																				"/t_thumb/",
																				"/t_cover_big/",
																			)}
																			alt={winner.gameName}
																			className="w-12 h-16 object-cover rounded-md group-hover:shadow-md transition-all duration-300"
																		/>
																	)}
																	<div>
																		<div className="text-xs font-medium text-blue-400 mb-1">
																			Long Winner
																		</div>
																		<div className="text-sm font-medium text-zinc-200">
																			{winner.gameName}
																		</div>
																	</div>
																</div>
															))}
														{month.winners
															.filter((w) => w.short)
															.map((winner) => (
																<div
																	key={winner.gameId}
																	className="flex items-start space-x-3"
																>
																	{winner.gameCover && (
																		<img
																			src={winner.gameCover}
																			alt={winner.gameName}
																			className="w-12 h-16 object-cover rounded-md group-hover:shadow-md transition-all duration-300"
																		/>
																	)}
																	<div>
																		<div className="text-xs font-medium text-emerald-400 mb-1">
																			Short Winner
																		</div>
																		<div className="text-sm font-medium text-zinc-200">
																			{winner.gameName}
																		</div>
																	</div>
																</div>
															))}
													</div>
												)}
										</div>
									</Link>
								))}
							</div>
						</div>
					</div>
				))}
		</div>
	);
}

```
app/routes/history/monthId/index.tsx
```
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import type { Result } from "~/server/voting.server";
import { calculateVotingResults, getGameUrls } from "~/server/voting.server";
import ThemeCard from "~/components/ThemeCard";
import type { Month, Nomination } from "~/types";
import { getMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import SplitLayout, { Column } from "~/components/SplitLayout";
import { getWinner } from "~/server/winner.server";

type LoaderData = {
	month: Month;
	results: {
		long: Result[];
		short: Result[];
	};
	gameUrls: Record<string, string>;
	nominations: {
		long: Nomination[];
		short: Nomination[];
	};
	winners: {
		long: Nomination | null;
		short: Nomination | null;
	};
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
	const monthId = Number(params.monthId);
	if (Number.isNaN(monthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}

	// Get theme information along with other data
	const [month, results, gameUrls, allNominations] = await Promise.all([
		getMonth(monthId),
		Promise.all([
			calculateVotingResults(monthId, false),
			calculateVotingResults(monthId, true),
		]).then(([long, short]) => ({ long, short })),
		getGameUrls(monthId),
		getNominationsForMonth(monthId),
	]);

	// Only fetch winners if month status is not "voting"
	let shortWinner = null;
	let longWinner = null;

	if (month.status !== "voting") {
		[shortWinner, longWinner] = await Promise.all([
			getWinner(monthId, true),
			getWinner(monthId, false),
		]);
	}

	// Group nominations by type
	const nominations = allNominations.reduce(
		(acc, nom) => {
			if (nom.short) {
				acc.short.push(nom);
			} else {
				acc.long.push(nom);
			}
			return acc;
		},
		{ short: [] as Nomination[], long: [] as Nomination[] },
	);

	return {
		month,
		results,
		gameUrls,
		nominations,
		winners: {
			short: shortWinner,
			long: longWinner,
		},
	};
};

export default function HistoryMonth() {
	const { month, results, gameUrls, nominations, winners } =
		useLoaderData<LoaderData>();
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const longGamesCanvasId = useMemo(
		() => `longGamesChart-${month.month}-${month.year}`,
		[month],
	);
	const shortGamesCanvasId = useMemo(
		() => `shortGamesChart-${month.month}-${month.year}`,
		[month],
	);

	// Only show winners if month status is not "voting"
	const showWinner =
		month.status !== "voting" &&
		(month.status === "over" ||
			month.status === "complete" ||
			month.status === "playing");

	// Create arrays of winner game IDs for highlighting
	const winnerGameIds = [];
	if (showWinner) {
		if (winners.short?.gameId) winnerGameIds.push(winners.short.gameId);
		if (winners.long?.gameId) winnerGameIds.push(winners.long.gameId);
	}

	const renderNominationsList = (games: Nomination[], isShort: boolean) => {
		// Sort games: winners first, then jury selected, then the rest
		const sortedGames = [...games].sort((a, b) => {
			if (!showWinner) {
				// If not showing winners, just sort by jury selection
				if (a.jurySelected && !b.jurySelected) return -1;
				if (!a.jurySelected && b.jurySelected) return 1;
				return 0;
			}

			const aIsWinner = isShort
				? winners.short?.id === a.id
				: winners.long?.id === a.id;
			const bIsWinner = isShort
				? winners.short?.id === b.id
				: winners.long?.id === b.id;

			if (aIsWinner && !bIsWinner) return -1;
			if (!aIsWinner && bIsWinner) return 1;
			if (a.jurySelected && !b.jurySelected) return -1;
			if (!a.jurySelected && b.jurySelected) return 1;
			return 0;
		});

		return (
			<div className="space-y-4">
				{sortedGames.map((game) => {
					const isWinner =
						showWinner &&
						(isShort
							? winners.short?.id === game.id
							: winners.long?.id === game.id);

					return (
						<GameCard
							key={game.id}
							game={game}
							onViewPitches={() => {
								setSelectedNomination(game);
								setIsViewingPitches(true);
							}}
							pitchCount={game.pitches.length}
							showPitchesButton={true}
							isWinner={isWinner}
							isJurySelected={game.jurySelected}
						/>
					);
				})}
			</div>
		);
	};

	return (
		<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				{month.theme && <ThemeCard {...month} />}
			</div>

			<div className="space-y-6">
				<VotingResultsChart
					canvasId={longGamesCanvasId}
					results={results.long}
					gameUrls={gameUrls}
					showWinner={showWinner}
				/>
				<VotingResultsChart
					canvasId={shortGamesCanvasId}
					results={results.short}
					gameUrls={gameUrls}
					showWinner={showWinner}
				/>
			</div>

			<div className="mt-12">
				<SplitLayout
					title="All Nominations"
					description="These games were nominated for this month's Game of the Month."
				>
					<Column
						title="Long Games"
						statusBadge={{
							text: `${nominations.long.length} nominations`,
							isSuccess: nominations.long.length > 0,
						}}
					>
						{renderNominationsList(nominations.long, false)}
					</Column>

					<Column
						title="Short Games"
						statusBadge={{
							text: `${nominations.short.length} nominations`,
							isSuccess: nominations.short.length > 0,
						}}
					>
						{renderNominationsList(nominations.short, true)}
					</Column>
				</SplitLayout>
			</div>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}

```
app/routes/api/nominations.ts
```typescript
import type { ActionFunctionArgs } from "react-router";
import { db } from "~/server/database.server";
import { getSession } from "~/sessions";
import type { NominationFormData } from "~/types";

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Check for previous GOTM winners
	const winners = await db.execute("SELECT DISTINCT game_id FROM winners");
	const previousWinners = winners.rows.map((w) => (w.game_id ?? "").toString());

	if (request.method === "DELETE") {
		const formData = await request.formData();
		const nominationId = formData.get("nominationId")?.toString();

		if (!nominationId) {
			return Response.json({ error: "Missing nomination ID" }, { status: 400 });
		}

		// Verify the nomination belongs to the user
		const nomination = await db.execute({
			sql: "SELECT id FROM nominations WHERE id = ? AND discord_id = ?",
			args: [nominationId, discordId],
		});

		if (nomination.rows.length === 0) {
			return Response.json(
				{ error: "Nomination not found or unauthorized" },
				{ status: 404 },
			);
		}

		// Delete the nomination (pitches will be cascade deleted)
		await db.execute({
			sql: "DELETE FROM nominations WHERE id = ?",
			args: [nominationId],
		});

		return Response.json({ success: true });
	}

	if (request.method === "PATCH") {
		try {
			const contentType = request.headers.get("Content-Type");
			const data = contentType?.includes("application/json")
				? await request.json()
				: Object.fromEntries(await request.formData());

			const nominationId =
				typeof data.nominationId === "string"
					? Number.parseInt(data.nominationId, 10)
					: typeof data.nominationId === "number"
						? data.nominationId
						: null;

			if (!nominationId || Number.isNaN(nominationId)) {
				return Response.json(
					{ error: "Invalid nomination ID" },
					{ status: 400 },
				);
			}

			const pitch = data.pitch?.toString() || null;

			// Check if the game is a previous winner
			const nomination = await db.execute({
				sql: `SELECT n.*, p.discord_id as pitch_discord_id
					FROM nominations n
					LEFT JOIN pitches p ON n.id = p.nomination_id
					WHERE n.id = ?`,
				args: [nominationId],
			});

			if (nomination.rows.length === 0) {
				return Response.json(
					{ error: "Nomination not found" },
					{ status: 404 },
				);
			}

			// Check if the game is a previous winner
			const gameId = nomination.rows[0].game_id?.toString() ?? "";
			if (previousWinners.includes(gameId)) {
				return Response.json(
					{ error: "Cannot modify nominations for previous GOTM winners" },
					{ status: 400 },
				);
			}

			// Check if the user owns the nomination or is adding a new pitch
			const isOwner = nomination.rows[0].discord_id === discordId;
			const hasExistingPitch =
				nomination.rows[0].pitch_discord_id === discordId;

			if (!isOwner && hasExistingPitch) {
				return Response.json(
					{ error: "You have already added a pitch to this nomination" },
					{ status: 400 },
				);
			}

			if (hasExistingPitch) {
				// Update existing pitch
				await db.execute({
					sql: "UPDATE pitches SET pitch = ?, updated_at = unixepoch() WHERE nomination_id = ? AND discord_id = ?",
					args: [pitch, nominationId, discordId],
				});
			} else {
				// Add new pitch
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nominationId, discordId, pitch],
				});
			}

			return Response.json({ success: true });
		} catch (error) {
			console.error("Error processing edit:", error);
			return Response.json(
				{ error: "Failed to process edit. Please try again." },
				{ status: 500 },
			);
		}
	}

	try {
		let data: NominationFormData;
		const contentType = request.headers.get("Content-Type");

		if (contentType?.includes("application/json")) {
			const body = await request.json();
			data =
				typeof body === "string"
					? JSON.parse(body)
					: body.json
						? JSON.parse(body.json)
						: body;
		} else {
			const formData = await request.formData();
			const jsonStr = formData.get("json")?.toString();
			data = jsonStr
				? JSON.parse(jsonStr)
				: {
						game: JSON.parse(formData.get("game")?.toString() || "{}"),
						monthId: formData.get("monthId")?.toString() || "",
						short: formData.get("short") === "true",
						pitch: formData.get("pitch")?.toString() || null,
					};
		}

		const { game, monthId, short, pitch } = data;

		if (!game || !monthId) {
			return Response.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Check if the game is a previous winner
		if (previousWinners.includes(game.id.toString())) {
			return Response.json(
				{ error: "This game has already won GOTM in a previous month" },
				{ status: 400 },
			);
		}

		// Check if game is already nominated for this month
		const existing = await db.execute({
			sql: "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.month_id = ? AND n.game_id = ? AND p.discord_id = ?",
			args: [monthId, game.id, discordId],
		});

		// If the user has already pitched this game, prevent them from nominating it again
		if (existing.rows.length > 0) {
			return Response.json(
				{
					error:
						"You have already nominated or pitched this game for this month",
				},
				{ status: 400 },
			);
		}

		// Insert the nomination
		const nomination = await db.execute({
			sql: "INSERT INTO nominations (month_id, game_id, discord_id, short, game_name, game_year, game_cover, game_url, jury_selected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())",
			args: [
				monthId,
				game.id,
				discordId,
				short ? 1 : 0,
				game.name,
				game.gameYear || null,
				game.cover?.replace("t_thumb", "t_cover_big") || null,
				game.url || null,
				0, // Not jury selected by default
			],
		});

		// If there's a pitch, insert it
		if (pitch && nomination.lastInsertRowid) {
			await db.execute({
				sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
				args: [nomination.lastInsertRowid, discordId, pitch],
			});
		}

		return Response.json({
			success: true,
			nominationId: nomination.lastInsertRowid
				? Number(nomination.lastInsertRowid)
				: null,
		});
	} catch (error) {
		console.error("Error processing nomination:", error);
		return Response.json(
			{
				error:
					"Failed to process nomination. Please make sure all required fields are provided.",
			},
			{ status: 500 },
		);
	}
}

```
app/routes/api/votes.ts
```typescript
import type { ActionFunctionArgs } from "react-router";
import { db } from "~/server/database.server";
import { invalidateVotingCache } from "~/server/voting.server";

export async function action({ request }: ActionFunctionArgs) {
	const isJson = request.headers
		.get("Content-Type")
		?.includes("application/json");
	let data: {
		monthId: string | null;
		userId: string | null;
		short: boolean;
		order?: number[] | undefined;
	};

	if (isJson) {
		data = await request.json();
	} else {
		const formData = await request.formData();
		data = {
			monthId: formData.get("monthId") as string | null,
			userId: formData.get("userId") as string | null,
			short: formData.get("short") === "true",
			order: formData.get("order")
				? JSON.parse(formData.get("order") as string)
				: undefined,
		};
	}

	const { monthId, userId, short } = data;

	if (!monthId || !userId) {
		return Response.json(
			{ success: false, error: "Missing monthId or userId" },
			{ status: 400 },
		);
	}

	if (request.method === "DELETE") {
		// Delete vote and associated rankings
		await db.execute({
			sql: "DELETE FROM rankings WHERE vote_id IN (SELECT id FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?)",
			args: [monthId, userId, short ? 1 : 0],
		});

		await db.execute({
			sql: "DELETE FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?",
			args: [monthId, userId, short ? 1 : 0],
		});

		// Invalidate cache after deleting vote
		invalidateVotingCache(Number(monthId), short);
		return Response.json({ success: true });
	}

	try {
		// First check if a vote already exists
		const existingVote = await db.execute({
			sql: "SELECT id FROM votes WHERE month_id = ? AND discord_id = ? AND short = ?",
			args: [monthId, userId, short ? 1 : 0],
		});

		let voteId: number;
		const existingVoteId = existingVote.rows[0]?.id;

		if (existingVoteId !== undefined && existingVoteId !== null) {
			voteId = Number(existingVoteId);
			// Delete existing rankings
			await db.execute({
				sql: "DELETE FROM rankings WHERE vote_id = ?",
				args: [voteId],
			});
		} else {
			// Insert new vote
			const insertResult = await db.execute({
				sql: "INSERT INTO votes (month_id, discord_id, short, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
				args: [monthId, userId, short ? 1 : 0],
			});

			if (!insertResult.lastInsertRowid) {
				throw new Error("Failed to create vote - no insert ID returned");
			}
			voteId = Number(insertResult.lastInsertRowid);
		}

		// Insert new rankings if provided
		if (data.order && data.order.length > 0) {
			// SQLite doesn't support multi-value INSERT, so we'll do them one by one
			for (const [index, nominationId] of data.order.entries()) {
				await db.execute({
					sql: "INSERT INTO rankings (vote_id, nomination_id, rank, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [voteId, nominationId, index + 1],
				});
			}
		}

		// Invalidate cache after successful vote
		invalidateVotingCache(Number(monthId), short);

		return Response.json({ success: true, voteId });
	} catch (error) {
		console.error("Error processing vote:", error);
		return Response.json(
			{ success: false, error: "Failed to process vote" },
			{ status: 500 },
		);
	}
}

```
