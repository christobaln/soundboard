const fs = require("node:fs");
const path = require("node:path");
const DEFAULTS = { minimizeToTray: false, startMinimized: false };
function readPreferences(app) {
  try {
    const value = JSON.parse(
      fs.readFileSync(
        path.join(app.getPath("userData"), "desktop-settings.json"),
        "utf8",
      ),
    );
    return {
      ...DEFAULTS,
      minimizeToTray: value.minimizeToTray === true,
      startMinimized: value.startMinimized === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
function writePreferences(app, values) {
  const value = {
    minimizeToTray: values.minimizeToTray === true,
    startMinimized: values.startMinimized === true,
  };
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(
    path.join(app.getPath("userData"), "desktop-settings.json"),
    JSON.stringify(value),
  );
  return value;
}
module.exports = { readPreferences, writePreferences };
