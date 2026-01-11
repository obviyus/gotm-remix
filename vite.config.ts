import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
// biome-ignore lint/style/useNodejsImportProtocol: using bun
import { builtinModules } from "module";

const ReactCompilerConfig = { /* ... */ };
const babelFilter = (id: string) =>
	!id.includes("node_modules") && /\.[jt]sx?$/.test(id);


export default defineConfig((config) => ({
	optimizeDeps: {
		exclude: [...builtinModules],
	},
	plugins: [reactRouter(), tsconfigPaths(), babel({
		filter: babelFilter,
		babelConfig: {
			presets: ["@babel/preset-typescript"],
			plugins: [
				["babel-plugin-react-compiler", ReactCompilerConfig],
			],
		},
	}),
	],
	resolve:
		config.command === "build"
			? {
				alias: {
					"react-dom/server": "react-dom/server.node",
				},
			}
			: undefined,

}));
