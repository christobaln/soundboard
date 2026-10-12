const modifiers = new Set([
  "CommandOrControl",
  "Control",
  "Command",
  "Alt",
  "Shift",
  "Super",
]);
function validAccelerator(value) {
  if (typeof value !== "string" || value.length > 80) return false;
  const parts = value.split("+");
  return (
    parts.length >= 2 &&
    parts.slice(0, -1).every((p) => modifiers.has(p)) &&
    /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Escape|Up|Down|Left|Right)$/.test(
      parts.at(-1),
    )
  );
}
module.exports = { validAccelerator };
