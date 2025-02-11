import stringSimilarity from 'string-similarity';
import type { Game } from '~/types';

type TwitchAuth = {
	access_token: string;
	expires_in: number;
	token_type: string;
};

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

async function getIGDBToken() {
	if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
		return cachedToken;
	}

	const response = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_id: process.env.TWITCH_CLIENT_ID,
			client_secret: process.env.TWITCH_CLIENT_SECRET,
			grant_type: "client_credentials",
		}),
	});

	const data = (await response.json()) as TwitchAuth;
	cachedToken = data.access_token;
	tokenExpiry = Date.now() + data.expires_in * 1000;

	return cachedToken;
}

export async function searchGames(query: string): Promise<Game[]> {
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

	const games = (await response.json()) as Array<{
		id: number;
		name: string;
		cover?: { url: string };
		first_release_date?: number;
		summary?: string;
		url?: string;
	}>;

	// Sort games by name similarity to the search query and return top 10
	return games
		.sort((a, b) => {
			const similarityA = stringSimilarity.compareTwoStrings(query.toLowerCase(), a.name.toLowerCase());
			const similarityB = stringSimilarity.compareTwoStrings(query.toLowerCase(), b.name.toLowerCase());
			return similarityB - similarityA;
		})
		.slice(0, 10)
		.map((game) => ({
			id: game.id,
			name: game.name,
			cover: game.cover ? { url: game.cover.url.replace("t_thumb", "t_cover_big") } : undefined,
			first_release_date: game.first_release_date,
			game_year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear().toString() : undefined,
			summary: game.summary,
			game_url: game.url,
		}));
}
