const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const images = [];
    for (const size of [16, 32, 48, 64, 128, 256]) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<style>body{margin:0;background:transparent}svg{width:100vw;height:100vh}</style>${fs.readFileSync("assets/icon.svg", "utf8")}`,
      );
      const bytes = await page.screenshot({ omitBackground: true });
      images.push({ size, bytes });
      if (size === 256) fs.writeFileSync("assets/icon.png", bytes);
      await page.close();
    }
    const header = Buffer.alloc(6 + 16 * images.length);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach(({ size, bytes }, i) => {
      const entry = 6 + i * 16;
      header.writeUInt8(size === 256 ? 0 : size, entry);
      header.writeUInt8(size === 256 ? 0 : size, entry + 1);
      header.writeUInt16LE(1, entry + 4);
      header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(bytes.length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      offset += bytes.length;
    });
    fs.writeFileSync(
      "assets/icon.ico",
      Buffer.concat([header, ...images.map((image) => image.bytes)]),
    );
    console.log("Generated Windows icon at six sizes.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
