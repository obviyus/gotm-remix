import { reactRouter } from "@react-router/dev/vite";
import { transformAsync } from "@babel/core";
import { defineConfig, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { builtinModules } from "node:module";

const ReactCompilerConfig = {
	/* ... */
};

function reactCompiler(): PluginOption {
	return {
		name: "react-compiler",
		enforce: "pre",
		async transform(code, id) {
			if (!/\.[jt]sx?$/.test(id) || id.includes("/node_modules/")) {
				return;
			}

			const result = await transformAsync(code, {
				filename: id,
				presets: ["@babel/preset-typescript"],
				plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
				sourceMaps: true,
			});

			return result
				? {
						code: result.code ?? code,
						map: result.map,
					}
				: undefined;
		},
	};
}

export default defineConfig(({ command }) => ({
	optimizeDeps: {
		exclude: [...builtinModules],
	},
	plugins: [reactRouter(), tsconfigPaths(), reactCompiler()],
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
