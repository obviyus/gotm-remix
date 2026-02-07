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
				client_id: Bun.env.TWITCH_CLIENT_ID,
				client_secret: Bun.env.TWITCH_CLIENT_SECRET,
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
			throw new Error(`Twitch auth error: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as TwitchAuth;
		cachedToken = data.access_token;
		// Store expiry as absolute timestamp
		tokenExpiry = Date.now() + data.expires_in * 1000;

		return cachedToken;
	} catch (error) {
		console.error("Failed to get IGDB token:", error);
		throw new Error("Failed to authenticate with IGDB", {
			cause: error,
		});
	}
}

export async function searchGames(query: string): Promise<Nomination[]> {
	if (!Bun.env.TWITCH_CLIENT_ID) {
		throw new Error("TWITCH_CLIENT_ID must be defined");
	}

	const token = await getIGDBToken();

	const response = await fetch("https://api.igdb.com/v4/games", {
		method: "POST",
		headers: {
			"Client-ID": Bun.env.TWITCH_CLIENT_ID,
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
		throw new Error(`IGDB API error: ${response.status} ${response.statusText}`);
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
			gameCover: game.cover ? game.cover.url.replace("t_thumb", "t_cover_big") : undefined,
			gameYear: new Date(game.first_release_date * 1000).getFullYear().toString(),
			summary: game.summary,
			gameUrl: game.url,
		}));
}
