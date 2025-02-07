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

export async function searchGames(query: string) {
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
              fields name, cover.url, first_release_date, summary;
              limit 10;
              where version_parent = null;`,
	});

	return response.json();
}
