import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { builtinModules } from "node:module";

const ReactCompilerConfig = {
	/* ... */
};

export default defineConfig(({ command }) => ({
	optimizeDeps: {
		exclude: [...builtinModules],
	},
	plugins: [
		reactRouter(),
		tsconfigPaths(),
		babel({
			include: /\.[jt]sx?$/,
			exclude: /node_modules/,
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
