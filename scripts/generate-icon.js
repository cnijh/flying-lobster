const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const HTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    body {
      width: 1024px;
      height: 1024px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 180px;
    }
    .lobster {
      font-size: 512px;
      line-height: 1;
    }
  </style>
</head>
<body>
  <div class="lobster">🦞</div>
</body>
</html>
`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    webPreferences: {
      offscreen: true,
    },
  });

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(HTML)}`);

  // Wait for render
  await new Promise((r) => setTimeout(r, 500));

  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();

  const outPath = path.join(__dirname, "..", "assets", "icon.png");
  fs.writeFileSync(outPath, pngBuffer);
  console.log("Saved icon.png to", outPath);

  app.quit();
});
