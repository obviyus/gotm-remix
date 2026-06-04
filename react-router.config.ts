import type { Config } from "@react-router/dev/config";

export default {
	future: {
		v8_splitRouteModules: true,
	},
	ssr: true,
} satisfies Config;
