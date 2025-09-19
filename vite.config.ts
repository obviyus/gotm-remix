import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
// biome-ignore lint/style/useNodejsImportProtocol: using bun
import { builtinModules } from "module";

export default defineConfig({
	optimizeDeps: {
		exclude: [...builtinModules],
	},
	plugins: [reactRouter(), tsconfigPaths()],
	resolve: {
		alias: {
			'react-dom/server': 'react-dom/server.node',
		},
	},
});
