#!/usr/bin/env node
/**
 * OpenKode Build Script
 * =====================
 *
 * Uses esbuild for fast bundling of the VSCode extension.
 * Supports both production and development builds.
 */

// Use regular esbuild (faster and more reliable on Node.js)
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

// ============================================================================
// CONFIGURATION
// ============================================================================

const PRODUCTION = process.env.NODE_ENV === "production";
const WATCH = process.argv.includes("--watch");
const ANALYZE = process.argv.includes("--analyze");

const OUT_DIR = path.join(__dirname, "out");
const SRC_DIR = path.join(__dirname, "src");

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// ============================================================================
// BUILD CONFIGURATION
// ============================================================================

/**
 * Base esbuild configuration
 */
const baseConfig = {
  // Entry point
  entryPoints: [path.join(SRC_DIR, "extension.ts")],

  // Output
  outfile: path.join(OUT_DIR, "extension.js"),

  // Bundle settings
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",

  // External dependencies (don't bundle these)
  external: [
    "vscode",
    "fs",
    "path",
    "os",
    "crypto",
    "child_process",
    "stream",
    "util",
    "events",
    "url",
    "http",
    "https",
    "net",
    "tls",
    "zlib",
    "buffer",
    "string_decoder",
    "querystring",
    "vm",
    "module",
    "process",
    "v8",
    "async_hooks",
    "perf_hooks",
    "worker_threads",
    "repl",
    "readline",
    "punycode",
    "domain",
    "constants",
    "console",
    "cluster",
    "dgram",
    "dns",
    "inspector",
    "sys",
    // Node modules that don't bundle well
    "openai",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "mongodb",
    "bson",
  ],

  // TypeScript settings
  tsconfig: path.join(__dirname, "tsconfig.json"),

  // Source maps
  sourcemap: !PRODUCTION,

  // Minification (production only)
  minify: PRODUCTION,

  // Tree shaking
  treeShaking: PRODUCTION,

  // Legal comments
  legalComments: PRODUCTION ? "none" : "inline",

  // Metafile for analysis
  metafile: ANALYZE,

  // Define constants
  define: {
    "process.env.NODE_ENV": PRODUCTION ? '"production"' : '"development"',
    "process.env.EXTENSION_VERSION": `"${getPackageVersion()}"`,
  },

  // Banner
  banner: {
    js: `/**
 * OpenKode - AI Development Orchestration
 * Version: ${getPackageVersion()}
 * Build: ${new Date().toISOString()}
 * Environment: ${PRODUCTION ? "production" : "development"}
 */`,
  },

  // Plugins
  plugins: [
    // Clean output directory plugin
    cleanOutDirPlugin(),

    // Copy non-TS assets plugin
    copyAssetsPlugin(),

    // Type checking plugin (runs in parallel)
    typeCheckPlugin(),
  ],
};

// ============================================================================
// PLUGINS
// ============================================================================

/**
 * Plugin to clean output directory before build
 */
function cleanOutDirPlugin() {
  return {
    name: "clean-out-dir",
    setup(build) {
      build.onStart(() => {
        try {
          const files = fs.readdirSync(OUT_DIR);
          for (const file of files) {
            const filePath = path.join(OUT_DIR, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              fs.unlinkSync(filePath);
            }
          }
          console.log("Cleaned output directory");
        } catch (error) {
          console.error("Failed to clean output directory:", error.message);
        }
      });
    },
  };
}

/**
 * Plugin to copy non-TypeScript assets
 */
function copyAssetsPlugin() {
  const assetsToCopy = [
    { from: path.join(__dirname, "package.json"), to: path.join(OUT_DIR, "package.json") },
    { from: path.join(__dirname, "README.md"), to: path.join(OUT_DIR, "README.md") },
    { from: path.join(__dirname, "LICENSE"), to: path.join(OUT_DIR, "LICENSE") },
    { from: path.join(__dirname, "src/assets/logo/img/openkode.png"), to: path.join(OUT_DIR, "openkode.png") },
  ];

  return {
    name: "copy-assets",
    setup(build) {
      build.onEnd(() => {
        for (const asset of assetsToCopy) {
          try {
            if (fs.existsSync(asset.from)) {
              fs.copyFileSync(asset.from, asset.to);
              console.log(`Copied: ${path.basename(asset.from)}`);
            }
          } catch (error) {
            console.warn(`Failed to copy ${asset.from}:`, error.message);
          }
        }
      });
    },
  };
}

/**
 * Plugin to run TypeScript type checking in parallel
 */
function typeCheckPlugin() {
  return {
    name: "type-check",
    setup(build) {
      let typeCheckProcess = null;

      build.onStart(() => {
        // Run type checking in background
        const { spawn } = require("child_process");

        console.log("Running TypeScript type check...");

        typeCheckProcess = spawn("npx", ["tsc", "--noEmit", "-p", "."], {
          cwd: __dirname,
          stdio: "pipe",
          shell: true,
        });

        typeCheckProcess.stdout?.on("data", (data) => {
          const output = data.toString().trim();
          if (output) {
            console.log("[TypeScript]", output);
          }
        });

        typeCheckProcess.stderr?.on("data", (data) => {
          const output = data.toString().trim();
          if (output) {
            console.error("[TypeScript]", output);
          }
        });

        typeCheckProcess.on("close", (code) => {
          if (code === 0) {
            console.log("TypeScript type check passed");
          } else {
            console.warn(`TypeScript type check completed with code ${code}`);
          }
        });
      });

      build.onEnd(() => {
        // Don't kill type check process, let it complete
      });
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get package version from package.json
 */
function getPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"));
    return packageJson.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Format build time
 */
function formatBuildTime(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print build analysis
 */
async function printAnalysis(result) {
  if (!result.metafile) return;

  console.log("\n=== Build Analysis ===\n");

  const outputs = Object.entries(result.metafile.outputs);
  let totalSize = 0;

  for (const [filePath, info] of outputs) {
    const sizeKB = (info.bytes / 1024).toFixed(2);
    totalSize += info.bytes;
    console.log(`${path.basename(filePath)}: ${sizeKB} KB`);
  }

  console.log(`\nTotal size: ${(totalSize / 1024).toFixed(2)} KB`);

  // Write metafile for detailed analysis
  const metaPath = path.join(OUT_DIR, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(result.metafile, null, 2));
  console.log(`\nDetailed analysis written to: ${metaPath}`);
}

// ============================================================================
// MAIN BUILD FUNCTION
// ============================================================================

async function build() {
  console.log(`\n=== OpenKode Build ===`);
  console.log(`Mode: ${PRODUCTION ? "production" : "development"}`);
  console.log(`Watch: ${WATCH ? "enabled" : "disabled"}`);
  console.log(`Analyze: ${ANALYZE ? "enabled" : "disabled"}`);
  console.log("");

  const startTime = Date.now();

  try {
    if (WATCH) {
      // Watch mode
      const ctx = await esbuild.context(baseConfig);

      await ctx.watch();

      console.log("Watching for changes...");
      console.log("Press Ctrl+C to stop\n");

      // Keep process alive
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", async (data) => {
        if (data.toString() === "\u0003") {
          // Ctrl+C
          console.log("\nStopping watch mode...");
          await ctx.dispose();
          process.exit(0);
        }
      });
    } else {
      // Single build
      const result = await esbuild.build(baseConfig);

      const buildTime = Date.now() - startTime;
      console.log(`\nBuild completed in ${formatBuildTime(buildTime)}`);

      // Print warnings
      if (result.warnings.length > 0) {
        console.log(`\nWarnings (${result.warnings.length}):`);
        for (const warning of result.warnings) {
          console.log(`  - ${warning.text}`);
          if (warning.location) {
            console.log(`    at ${warning.location.file}:${warning.location.line}:${warning.location.column}`);
          }
        }
      }

      // Print analysis
      if (ANALYZE) {
        await printAnalysis(result);
      }

      console.log(`\nOutput: ${baseConfig.outfile}`);
      console.log("Build successful!\n");
    }
  } catch (error) {
    console.error("\nBuild failed:");
    console.error(error.message);

    if (error.errors) {
      for (const err of error.errors) {
        console.error(`\n  ${err.text}`);
        if (err.location) {
          console.error(`  at ${err.location.file}:${err.location.line}:${err.location.column}`);
        }
      }
    }

    process.exit(1);
  }
}

// ============================================================================
// RUN BUILD
// ============================================================================

build();
