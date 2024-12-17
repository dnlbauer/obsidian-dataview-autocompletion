import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import typescript2 from "rollup-plugin-typescript2";

const createBaseConfig = (outdir) => ({
    input: "src/main.ts",
    external: ["obsidian"],
    plugins: getRollupPlugins(
        undefined,
        copy({
            targets: [
                {
                    src: "manifest.json",
                    dest: outdir,
                },
            ],
        }),
    ),
});

const getRollupPlugins = (tsconfig, ...plugins) =>
    [typescript2(tsconfig), nodeResolve({ browser: true }), commonjs()].concat(plugins);

const DEV_PLUGIN_CONFIG = {
    ...createBaseConfig("test-vault/.obsidian/plugins/dataview-suggester"),
    output: {
        dir: "test-vault/.obsidian/plugins/dataview-suggester",
        sourcemap: "inline",
        format: "cjs",
        exports: "default",
        name: "Dataview Suggester (Development)",
    },
};

const PROD_PLUGIN_CONFIG = {
    ...createBaseConfig("build"),
    output: {
        dir: "build",
        sourcemap: "inline",
        sourcemapExcludeSources: true,
        format: "cjs",
        exports: "default",
        name: "Dataview Suggester (Production)",
    },
};

let configs = [];
if (process.env.BUILD === "production") {
    configs.push(PROD_PLUGIN_CONFIG);
} else if (process.env.BUILD === "dev") {
    configs.push(DEV_PLUGIN_CONFIG);
} else {
    configs.push(DEV_PLUGIN_CONFIG);
}

export default configs;
