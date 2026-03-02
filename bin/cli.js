#!/usr/bin/env node

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const APP_NAME = "Flying Lobster.app";
const INSTALL_PATH = "/Applications";

function log(msg) {
  console.log(`🦞 ${msg}`);
}

function error(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function runCommand(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    child.on("error", reject);
  });
}

function findBuiltApp(projectRoot) {
  const distDir = path.join(projectRoot, "dist");

  // Check possible build output directories in order of preference
  const possibleDirs = ["mac-universal", "mac-arm64", "mac-x64", "mac"];

  for (const dir of possibleDirs) {
    const appPath = path.join(distDir, dir, APP_NAME);
    if (fs.existsSync(appPath)) {
      return appPath;
    }
  }

  return null;
}

function findBuiltDmg(projectRoot) {
  const distDir = path.join(projectRoot, "dist");

  // Look for the most recent .dmg file in dist
  if (fs.existsSync(distDir)) {
    const files = fs
      .readdirSync(distDir)
      .filter((f) => f.endsWith(".dmg") && !f.endsWith(".blockmap"))
      .map((f) => ({
        name: f,
        path: path.join(distDir, f),
        mtime: fs.statSync(path.join(distDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    if (files.length > 0) {
      return files[0].path;
    }
  }

  return null;
}

async function install() {
  const projectRoot = path.resolve(__dirname, "..");

  log("Building Flying Lobster...");

  // Always run npm install to ensure devDependencies are present
  // (npx may not install them properly in cache mode)
  const electronBuilderPath = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    "electron-builder",
  );
  if (!fs.existsSync(electronBuilderPath)) {
    log("Installing dependencies...");
    await runCommand("npm", ["install", "--include=dev"], { cwd: projectRoot });
  }

  // Clean up old DMGs to avoid confusion
  const distDir = path.join(projectRoot, "dist");
  if (fs.existsSync(distDir)) {
    const oldDmgs = fs.readdirSync(distDir).filter((f) => f.endsWith(".dmg"));
    oldDmgs.forEach((f) => {
      try {
        fs.unlinkSync(path.join(distDir, f));
      } catch (e) {}
    });
  }

  // Build the DMG (standard Mac installer experience)
  try {
    await runCommand("npm", ["run", "build"], { cwd: projectRoot });
  } catch (e) {
    error(
      "Build failed. Make sure you have the right permissions and dependencies.",
    );
  }

  // Find the built DMG
  const dmgPath = findBuiltDmg(projectRoot);
  if (!dmgPath) {
    error("DMG not found. Build may have failed.");
  }

  log(`Built: ${path.basename(dmgPath)}`);
  log("Opening installer...");

  // Open the DMG - this mounts it and shows the drag-to-install window
  spawn("open", [dmgPath], { detached: true, stdio: "ignore" }).unref();

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("  🦞 Drag Flying Lobster to Applications to install!");
  console.log("");
  console.log("  After installing:");
  console.log("  • Press Cmd+Shift+L to toggle the chat window");
  console.log("  • Click the 🦞 tray icon to show/hide");
  console.log("  • Add your OpenClaw gateway in Settings");
  console.log("  • Cmd+Shift+Left/Right to switch gateways");
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
}

async function uninstall() {
  const destPath = path.join(INSTALL_PATH, APP_NAME);

  if (!fs.existsSync(destPath)) {
    log("Flying Lobster is not installed.");
    return;
  }

  log("Uninstalling Flying Lobster...");

  // Quit the app if running
  try {
    execSync("osascript -e 'quit app \"Flying Lobster\"' 2>/dev/null || true");
  } catch (e) {
    // Ignore errors
  }

  // Remove the app
  try {
    execSync(`rm -rf "${destPath}"`);
    log("Successfully uninstalled Flying Lobster.");
  } catch (e) {
    error(`Failed to remove app. Try: sudo rm -rf "${destPath}"`);
  }
}

function showHelp() {
  console.log(`
🦞 Flying Lobster CLI

Usage:
  flying-lobster <command>

Commands:
  install     Build and install Flying Lobster to /Applications
  uninstall   Remove Flying Lobster from /Applications
  help        Show this help message

Examples:
  npx flying-lobster install
  flying-lobster uninstall
`);
}

async function main() {
  const command = process.argv[2];

  if (os.platform() !== "darwin") {
    error("Flying Lobster CLI install is currently macOS only.");
  }

  switch (command) {
    case "install":
      await install();
      break;
    case "uninstall":
      await uninstall();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
