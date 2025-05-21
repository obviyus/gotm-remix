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
		index("./routes/home.tsx"),

		// Simple pages
		route("privacy", "./routes/privacy.tsx"),
		route("voting", "./routes/voting.tsx"),
		route("nominate", "./routes/nominate.tsx"),
		route("jury", "./routes/jury.tsx"),

		// History routes
		...prefix("history", [
			index("./routes/history.tsx"),
			route(":monthId", "./routes/history.$monthId.tsx"),
		]),

		// Admin routes
		...prefix("admin", [
			index("./routes/admin.tsx"),
			route(":monthId", "./routes/admin.$monthId.tsx"),
		]),

		// Stats routes
		route("stats", "./routes/stats.tsx"),
	]),

	// Auth routes
	...prefix("auth", [
		route("logout", "./routes/auth.logout.tsx"),

		// Discord auth routes
		...prefix("discord", [
			index("./routes/auth.discord.tsx"),
			route("callback", "./routes/auth.discord.callback.tsx"),
		]),
	]),

	// API routes
	...prefix("api", [
		route("votes", "./routes/api.votes.ts"),
		route("nominations", "./routes/api.nominations.ts"),
	]),
] satisfies RouteConfig;
