import { db } from "./database.server";
import type { Nomination } from "~/types";

type TwitchAuth = {
	access_token: string;
	expires_in: number;
	token_type: string;
};

type IGDBGame = {
	id: number;
	name: string;
	summary?: string;
	url?: string;
	cover?: { url: string };
	platforms?: { name: string }[];
	first_release_date: number;
};

export type Release = Nomination;

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

async function getIGDBToken(): Promise<string> {
	if (cachedToken && tokenExpiry && Date.now() + 300000 < tokenExpiry) {
		return cachedToken;
	}

	const response = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_id: Bun.env.TWITCH_CLIENT_ID,
			client_secret: Bun.env.TWITCH_CLIENT_SECRET,
			grant_type: "client_credentials",
		}),
	});

	if (!response.ok) {
		throw new Error(`Twitch auth error: ${response.status}`);
	}

	const data = (await response.json()) as TwitchAuth;
	cachedToken = data.access_token;
	tokenExpiry = Date.now() + data.expires_in * 1000;

	return cachedToken;
}

type IGDBGameWithPopularity = IGDBGame & {
	total_rating_count?: number;
	hypes?: number;
	follows?: number;
};

async function fetchReleasesFromIGDB(date: string): Promise<IGDBGameWithPopularity[]> {
	const token = await getIGDBToken();
	const clientId = Bun.env.TWITCH_CLIENT_ID;

	if (!clientId) {
		throw new Error("TWITCH_CLIENT_ID must be defined");
	}

	// Parse YYYY-MM-DD and get timestamps for that day
	const targetDate = new Date(`${date}T00:00:00Z`);
	const startTimestamp = Math.floor(targetDate.getTime() / 1000);
	const endTimestamp = startTimestamp + 86400;

	const allGames: IGDBGameWithPopularity[] = [];
	let offset = 0;
	const limit = 500; // IGDB max

	// Paginate until we have all games
	while (true) {
		const response = await fetch("https://api.igdb.com/v4/games", {
			method: "POST",
			headers: {
				"Client-ID": clientId,
				Authorization: `Bearer ${token}`,
				"Content-Type": "text/plain",
			},
			body: `
				fields name, summary, url, cover.url, first_release_date, total_rating_count, hypes, follows;
				where first_release_date >= ${startTimestamp}
					& first_release_date < ${endTimestamp}
					& cover != null
					& themes != (42);
				sort total_rating_count desc;
				limit ${limit};
				offset ${offset};
			`,
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`IGDB API error ${response.status}: ${text}`);
		}

		const games = await response.json();
		if (!Array.isArray(games)) {
			throw new Error("IGDB API returned invalid response");
		}

		allGames.push(...games);

		// If we got fewer than limit, we've fetched everything
		if (games.length < limit) {
			break;
		}

		offset += limit;
	}

	// Sort by popularity (total_rating_count > hypes > follows)
	return allGames.sort((a, b) => {
		const scoreA = (a.total_rating_count ?? 0) * 100 + (a.hypes ?? 0) + (a.follows ?? 0);
		const scoreB = (b.total_rating_count ?? 0) * 100 + (b.hypes ?? 0) + (b.follows ?? 0);
		return scoreB - scoreA;
	});
}

function igdbGameToNomination(game: IGDBGameWithPopularity): Nomination {
	const year = new Date(game.first_release_date * 1000).getFullYear().toString();
	return {
		id: game.id,
		gameId: game.id.toString(),
		gameName: game.name,
		gameCover: game.cover?.url?.replace("t_thumb", "t_cover_big"),
		summary: game.summary,
		gameYear: year,
		gameUrl: game.url || `https://www.igdb.com/games/${game.name.toLowerCase().replace(/\s+/g, "-")}`,
		short: false,
		jurySelected: false,
		monthId: 0,
		discordId: "",
		pitches: [],
	};
}

async function cacheReleases(date: string, games: IGDBGameWithPopularity[]): Promise<void> {
	for (const game of games) {
		const cover = game.cover?.url?.replace("t_thumb", "t_cover_big") || null;
		const year = new Date(game.first_release_date * 1000).getFullYear().toString();
		const popularityScore = (game.total_rating_count ?? 0) * 100 + (game.hypes ?? 0) + (game.follows ?? 0);

		await db.execute({
			sql: `INSERT OR IGNORE INTO igdb_releases (release_date, game_id, game_name, game_cover, game_summary, game_year, game_url, popularity_score)
				  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [date, game.id, game.name, cover, game.summary || null, year, game.url || null, popularityScore],
		});
	}
}

async function getCachedReleases(date: string): Promise<Release[] | null> {
	const result = await db.execute({
		sql: `SELECT id, game_id, game_name, game_cover, game_summary, game_year, game_url
			  FROM igdb_releases WHERE release_date = ? ORDER BY popularity_score DESC`,
		args: [date],
	});

	if (result.rows.length === 0) {
		return null;
	}

	return result.rows.map((row): Nomination => ({
		id: row.id as number,
		gameId: (row.game_id as number).toString(),
		gameName: row.game_name as string,
		gameCover: (row.game_cover as string) || undefined,
		summary: (row.game_summary as string) || undefined,
		gameYear: (row.game_year as string) || "",
		gameUrl: (row.game_url as string) || "",
		short: false,
		jurySelected: false,
		monthId: 0,
		discordId: "",
		pitches: [],
	}));
}

export async function getReleasesForDate(date: string): Promise<Release[]> {
	// Check cache first
	const cached = await getCachedReleases(date);
	if (cached !== null) {
		return cached;
	}

	// Fetch from IGDB and cache
	const games = await fetchReleasesFromIGDB(date);
	await cacheReleases(date, games);

	return games.map(igdbGameToNomination);
}

export function isValidDate(date: string): boolean {
	const regex = /^\d{4}-\d{2}-\d{2}$/;
	if (!regex.test(date)) return false;

	const parsed = new Date(date);
	return !Number.isNaN(parsed.getTime());
}
