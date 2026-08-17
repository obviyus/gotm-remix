import { builtinModules } from "node:module";
import { reactRouter } from "@react-router/dev/vite";
import stylex from "@stylexjs/unplugin/vite";
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
		// StyleX must run before framework plugins to preserve Fast Refresh.
		stylex({
			devMode: "css-only",
			devPersistToDisk: true,
			// The compiler resolves `.stylex.ts` imports itself, so it needs the
			// same `~/` alias tsconfig gives the rest of the app.
			aliases: {
				"~/*": [`${import.meta.dirname}/app/*`],
			},
			unstable_moduleResolution: {
				type: "commonJS",
				rootDir: import.meta.dirname,
			},
		}),
		reactRouter(),
		babel({
			include: /\.[jt]sx?$/,
			// app/server is never rendered by React. Satori invokes those components
			// directly, so React Compiler's useMemoCache has no dispatcher to reach.
			exclude: [/node_modules/, /app\/server\//],
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
