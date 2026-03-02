const fs = require("fs");
const os = require("os");
const path = require("path");

// GoatCounter configuration
const GOAT_COUNTER_URL = "https://cnijh.goatcounter.com/count";

// Telemetry flag file path (in user's home directory)
const TELEMETRY_FLAG_FILE = path.join(
  os.homedir(),
  ".flying-lobster-telemetry",
);

// Current version (will be injected from package.json)
function getCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, "..", "..", "package.json");
    const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return packageData.version;
  } catch (error) {
    console.error("[Telemetry] Failed to read version:", error.message);
    return "unknown";
  }
}

// Check if telemetry is disabled via environment variable
function isTelemetryDisabled() {
  return (
    process.env.FL_NO_TELEMETRY === "true" ||
    process.env.FL_NO_TELEMETRY === "1"
  );
}

// Check if this is the first launch
function isFirstLaunch() {
  return !fs.existsSync(TELEMETRY_FLAG_FILE);
}

// Mark that telemetry has been sent
function markTelemetrySent() {
  try {
    fs.writeFileSync(TELEMETRY_FLAG_FILE, new Date().toISOString());
  } catch (error) {
    console.error("[Telemetry] Failed to create flag file:", error.message);
  }
}

// Get platform and architecture info
function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    version: getCurrentVersion(),
  };
}

// Send telemetry to GoatCounter
async function sendTelemetry() {
  if (isTelemetryDisabled()) {
    console.log("[Telemetry] Disabled via FL_NO_TELEMETRY");
    return;
  }

  if (!isFirstLaunch()) {
    console.log("[Telemetry] Not first launch, skipping");
    return;
  }

  try {
    const systemInfo = getSystemInfo();

    const eventPath = `flying-lobster/install`;
    const query = `version=${systemInfo.version}&platform=${systemInfo.platform}&arch=${systemInfo.arch}`;
    const url = `${GOAT_COUNTER_URL}?p=${encodeURIComponent(eventPath)}&t=${encodeURIComponent("Flying Lobster Install")}&e=true&q=${encodeURIComponent(query)}`;

    console.log("[Telemetry] Sending install analytics...");

    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": `FlyingLobster/${systemInfo.version}` },
    });

    if (response.ok) {
      console.log("[Telemetry] Analytics sent successfully");
      markTelemetrySent();
    } else {
      console.log(
        "[Telemetry] Failed to send analytics:",
        response.status,
        response.statusText,
      );
    }
  } catch (error) {
    console.error("[Telemetry] Error sending analytics:", error.message);
  }
}

// Fire-and-forget telemetry on app startup
function initTelemetry() {
  // Send telemetry in the background without blocking startup
  setImmediate(() => {
    sendTelemetry().catch((error) => {
      // Silently fail - telemetry should never break the app
      console.error("[Telemetry] Background send failed:", error.message);
    });
  });
}

module.exports = {
  initTelemetry,
  sendTelemetry,
  isFirstLaunch,
  isTelemetryDisabled,
};
