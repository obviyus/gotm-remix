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
