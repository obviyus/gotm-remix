const GOTM_JURY_WEBHOOK_URL = Bun.env.GOTM_JURY_WEBHOOK_URL;

interface DiscordEmbed {
	title?: string;
	description?: string;
	color?: number;
	timestamp?: string;
	footer?: {
		text: string;
		icon_url?: string;
	};
	thumbnail?: {
		url: string;
	};
	image?: {
		url: string;
	};
	author?: {
		name: string;
		url?: string;
		icon_url?: string;
	};
	fields?: Array<{
		name: string;
		value: string;
		inline?: boolean;
	}>;
}

interface DiscordWebhookPayload {
	content?: string;
	username?: string;
	avatar_url?: string;
	embeds?: DiscordEmbed[];
}

export async function sendDiscordWebhook(
	message: string,
	options?: {
		title?: string;
		color?: "success" | "warning" | "error" | "info" | number;
		urgent?: boolean;
		fields?: Array<{ name: string; value: string; inline?: boolean }>;
		image?: string;
		thumbnail?: string;
	},
) {
	const embed: DiscordEmbed = {
		title: options?.title || "🎮 Game of the Month Update",
		description: message,
		color: 0x00ff00,
		timestamp: new Date().toISOString(),
		footer: {
			text: "GoTM Notifications",
		},
	};

	if (options?.fields) {
		embed.fields = options.fields;
	}

	if (options?.image) {
		embed.image = { url: options.image };
	}

	if (options?.thumbnail) {
		embed.thumbnail = { url: options.thumbnail };
	}

	const payload: DiscordWebhookPayload = {
		username: "GOTM Bot",
		embeds: [embed],
	};

	try {
		if (!GOTM_JURY_WEBHOOK_URL) {
			throw new Error("GOTM_JURY_WEBHOOK_URL is not defined");
		}

		const response = await fetch(GOTM_JURY_WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`Discord webhook failed: ${response.status}`);
		}

		return { success: true };
	} catch (error) {
		console.error("Failed to send Discord webhook:", error);
		return { success: false, error };
	}
}
