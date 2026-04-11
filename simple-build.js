#!/usr/bin/env node
/**
 * Simple Build Script for OpenKode
 *
 * Compiles TypeScript without needing esbuild
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "out");
const SRC_DIR = path.join(__dirname, "src");

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Copy assets
const assetsToCopy = [
  { src: path.join(SRC_DIR, "assets", "logo", "img", "openkode.png"), dest: path.join(OUT_DIR, "openkode.png") },
  { src: path.join(SRC_DIR, "assets", "logo", "openkode-icon.svg"), dest: path.join(OUT_DIR, "openkode-icon.svg") },
];
for (const { src, dest } of assetsToCopy) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[Build] ✓ Copied ${path.basename(src)}`);
  } else {
    console.warn(`[Build] ⚠ Asset not found: ${src}`);
  }
}

console.log("[Build] Compiling TypeScript...");

try {
  // Use -p tsconfig.json so include/exclude patterns are respected; avoids
  // scanning node_modules on WSL→Windows drives which causes a very long hang.
  execSync("node node_modules/typescript/bin/tsc -p tsconfig.json --skipLibCheck", {
    cwd: __dirname,
    stdio: "inherit",
  });
  console.log("[Build] ✓ TypeScript compilation complete");
} catch (error) {
  console.error("[Build] ✗ Compilation failed:", error.message);
  process.exit(1);
}

console.log("[Build] ✓ Build complete!");
