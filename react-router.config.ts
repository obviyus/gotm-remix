import type { Config } from "@react-router/dev/config";

export default {
	splitRouteModules: "enforce",
	ssr: true,
	subResourceIntegrity: true,
} satisfies Config;
