import { builtinModules } from "node:module";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";

const ReactCompilerConfig = {
	/* ... */
};
const bunExternalModules = [
	"bun",
	...builtinModules,
	...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig(({ command }) => ({
	build: {
		rolldownOptions: {
			external: ["bun"],
		},
	},
	optimizeDeps: {
		exclude: bunExternalModules,
	},
	ssr: {
		external: bunExternalModules,
	},
	plugins: [
		tailwindcss(),
		reactRouter(),
		babel({
			include: /\.[jt]sx?$/,
			exclude: /node_modules/,
			babelConfig: {
				presets: ["@babel/preset-typescript"],
				plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
			},
		}),
	],
	resolve: {
		tsconfigPaths: true,
		...(command === "build"
			? {
					alias: {
						"react-dom/server": "react-dom/server.node",
					},
				}
			: {}),
	},
}));
