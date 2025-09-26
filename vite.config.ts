import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
// biome-ignore lint/style/useNodejsImportProtocol: using bun
import { builtinModules } from "module";

export default defineConfig((config) => ({
	optimizeDeps: {
		exclude: [...builtinModules],
	},
	plugins: [reactRouter(), tsconfigPaths()],
	resolve:
		config.command === "build"
			? {
					alias: {
						"react-dom/server": "react-dom/server.node",
					},
				}
			: undefined,

}));
