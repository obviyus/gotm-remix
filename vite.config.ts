import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { builtinModules } from "node:module";

const ReactCompilerConfig = {
	/* ... */
};
const babelFilter = (id: string) => !id.includes("node_modules") && /\.[jt]sx?$/.test(id);

export default defineConfig(({ command }) => ({
	optimizeDeps: {
		exclude: [...builtinModules],
	},
	plugins: [
		reactRouter(),
		tsconfigPaths(),
		babel({
			filter: babelFilter,
			babelConfig: {
				presets: ["@babel/preset-typescript"],
				plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
			},
		}),
	],
	...(command === "build"
		? {
				resolve: {
					alias: {
						"react-dom/server": "react-dom/server.node",
					},
				},
			}
		: {}),
}));
