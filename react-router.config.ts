import type { Config } from "@react-router/dev/config";

const doNotPrerender = ["/admin", "/auth/discord", "/auth/discord/callback"];

export default {
	ssr: true,
	prerender: async ({ getStaticPaths }) => {
		const paths = await getStaticPaths();

		// Filter out loader only routes
		return paths.filter((path) => !doNotPrerender.includes(path));
	},
} satisfies Config;
