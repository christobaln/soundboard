import { libraryURL } from "../shared/soundboards.mjs";
const response = await fetch(libraryURL("vine boom"), {
  signal: AbortSignal.timeout(30000),
});
if (!response.ok)
  throw new Error(`Myinstants search unavailable (${response.status}).`);
const html = await response.text();
if (!/\/media\/sounds\//.test(html))
  throw new Error("Search page contains no soundboard clips.");
console.log("Live Myinstants search returned soundboard clips.");
