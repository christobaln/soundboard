import "./style.css";
import { storage, demoSound } from "./storage.js";
import { Mixer } from "./audio.js";
import { voicePresets, presetFor } from "./presets.js";
import { setupCatalog } from "./catalog.js";
const defaults = {
  master: 85,
  outputBoost: 0,
  micBoost: 0,
  soundBoost: 0,
  echoCancellation: true,
  gateEnabled: false,
  gateThreshold: -50,
  voicePitch: null,
  voiceDrive: null,
  voiceBody: null,
  voiceRing: null,
  reduceMotion: false,
  sortSounds: "name",
  soundVolume: 80,
  micVolume: 100,
  monitorVolume: 65,
  monitor: true,
  routing: false,
  mic: false,
  input: "",
  output: "",
  effect: "clean",
  delay: 180,
  delayWet: 0,
  noiseSuppression: true,
  exclusive: false,
  compact: false,
  accent: "#b7f76b",
  autoConnect: true,
  stopKey: "CommandOrControl+Shift+S",
  muteKey: "CommandOrControl+Shift+M",
};
let savedSettings = {};
try {
  savedSettings = JSON.parse(localStorage.getItem("waveform-settings") || "{}");
} catch {
  localStorage.removeItem("waveform-settings");
}
let settings = { ...defaults, ...savedSettings };
if (!window.desktop || !settings.autoConnect) {
  settings.mic = false;
  settings.routing = false;
}
let sounds = [],
  view = "all",
  query = "",
  devices = [],
  editId = null,
  shortcutFailures = new Set();
const mixer = new Mixer(
  () => {
    renderCards();
    renderNow();
  },
  () => {
    settings.mic = false;
    $("#mic").checked = false;
    saveSettings();
    renderNow();
    toast(
      "Your microphone disconnected. Select a microphone and enable it again.",
    );
  },
);
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const wave = (seed = 0) =>
  Array.from(
    { length: 17 },
    (_, i) => `<i style="height:${12 + ((i * 19 + seed * 13) % 49)}px"></i>`,
  ).join("");
function toast(message) {
  $(".toast")?.remove();
  const element = document.createElement("div");
  element.className = "toast";
  element.setAttribute("role", "status");
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 7000);
}
function saveSettings() {
  localStorage.setItem("waveform-settings", JSON.stringify(settings));
  document.documentElement.style.setProperty("--accent", settings.accent);
  document.body.classList.toggle("compact", settings.compact);
  document.body.classList.toggle("reduce-motion", settings.reduceMotion);
}
const slider = (id, label, value) =>
  `<div class="labelrow"><label for="${id}">${label}</label><span id="${id}Value">${value}%</span></div><input id="${id}" type="range" min="0" max="100" value="${value}">`;
const toggle = (id, label, checked) =>
  `<label class="toggle" for="${id}">${label}<input id="${id}" type="checkbox" ${checked ? "checked" : ""}></label>`;
const knob = (id, label, value, min, max, unit) =>
  `<div class="studio-control"><div class="labelrow"><label for="${id}">${label}</label><span id="${id}Value">${value} ${unit}</span></div><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" data-unit="${unit}"></div>`;
$("#app").innerHTML = `
<aside class="sidebar"><div class="logo"><span>≋</span> waveform<span style="font-size:9px;color:#708267;align-self:start">BETA</span></div><div><p class="eyebrow">Your space</p><nav class="nav"><button class="active" data-view="all">▦ &nbsp; Sound library <span id="totalCount">0</span></button><button data-view="favorites">♡ &nbsp; Favorites <span id="favoriteCount">0</span></button><button data-view="recent">◷ &nbsp; Recently played</button></nav></div><div><p class="eyebrow">Make it yours</p><nav class="nav"><button id="browseSounds">⌕ &nbsp; Find new sounds</button><button id="customize">◉ &nbsp; Settings</button><button id="shortcuts">⌘ &nbsp; Global shortcuts</button><button id="routingHelp">↗ &nbsp; Audio routing guide</button></nav></div><div class="note"><strong>Built for your next session.</strong>Keep playing. Your shortcuts work while Waveform runs in the background.<br><br><span id="desktopStatus"></span></div></aside>
<main class="main"><header class="top"><input id="search" class="search" type="search" placeholder="Search your sounds…" aria-label="Search sounds"><span class="pill" id="routeBadge">● Local playback</span></header><section class="hero"><div class="cover" aria-hidden="true">${wave(4)}</div><div><span class="eyebrow" style="color:#b4ce9d">Your personal sound collection</span><h1>A little louder.<br>A lot more you.</h1><p>Every reaction, perfectly timed.<br>Your sounds. Your voice. Your rules.</p></div></section><div id="browserWarning"></div><div class="toolbar"><div style="display:flex;gap:8px"><button class="primary" id="import">＋ &nbsp; Add sounds</button><button class="secondary" id="catalogButton">Search online</button></div><button class="secondary" id="stopAll">■ &nbsp; Stop all sounds</button></div><div class="sectionhead"><h2 id="viewTitle">Your library</h2><span id="librarySummary"></span></div><section id="cards" class="grid" aria-label="Sound library"></section><input id="files" type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a" multiple hidden><p class="help" style="margin-top:24px">Click a sound to play. Click it again to stop. Import your own clips, then use ⋯ to assign a shortcut, adjust volume, or loop it.</p></main>
<aside class="right"><h2>Session mixer <span style="color:var(--accent);float:right">≋</span></h2><div class="field"><label for="input">MICROPHONE INPUT</label><select id="input"><option value="">System default microphone</option></select><label for="output">SEND MIX TO</label><select id="output"><option value="">System default output</option></select></div><button class="secondary" id="refreshDevices" style="margin-top:12px;width:100%">Refresh audio devices</button>${toggle("routing", "Send audio to selected output", settings.routing)}${toggle("mic", "Include microphone", settings.mic)}<div class="status" id="audioStatus" role="status">Ready for local playback. Enable routing after selecting your virtual cable.</div>${slider("soundVolume", "Soundboard", settings.soundVolume)}${slider("micVolume", "Microphone", settings.micVolume)}<hr><h2 style="margin-bottom:15px">Voice studio</h2><div class="effects">${[
  ["clean", "◉ Clean"],
  ["radio", "▥ Radio"],
  ["dark", "☾ Dark"],
  ["robot", "▦ Distorted"],
]
  .map(
    ([id, name]) =>
      `<button data-effect="${id}" class="${settings.effect === id ? "active" : ""}">${name}</button>`,
  )
  .join(
    "",
  )}</div><div class="labelrow"><label for="delay">Echo delay</label><span id="delayValue">${settings.delay} ms</span></div><input id="delay" type="range" min="40" max="800" value="${settings.delay}">${slider("delayWet", "Echo mix", settings.delayWet)}${toggle("noiseSuppression", "Noise suppression", settings.noiseSuppression)}<div class="field"><label for="voicePreset">CHARACTER & STUDIO PRESETS</label><select id="voicePreset">${Object.entries(
  voicePresets,
)
  .map(
    ([id, preset]) =>
      `<option value="${id}" ${settings.effect === id ? "selected" : ""}>${escape(preset.name)}</option>`,
  )
  .join(
    "",
  )}</select></div>${knob("voicePitch", "Voice pitch", presetFor(settings).pitch, -12, 12, "semitones")}${knob("voiceDrive", "Distortion", presetFor(settings).drive, 0, 40, "%")}${knob("voiceBody", "Bass / body", presetFor(settings).body, -12, 12, "dB")}${knob("voiceRing", "Synthetic texture", Math.round(presetFor(settings).ring * 100), 0, 70, "%")}<p class="help">Character presets are fan-inspired pitch and tone effects, not official or cloned voices. Pitch processing adds approximately 40–100 ms of delay. Echo mix stays separate.</p><hr><h2 style="margin-bottom:12px">Playback preferences</h2>${toggle("monitor", "Hear sounds locally", settings.monitor)}${slider("monitorVolume", "Local monitor", settings.monitorVolume)}${toggle("exclusive", "One sound at a time", settings.exclusive)}${toggle("autoConnect", "Restore audio session on launch", settings.autoConnect)}</aside>
<footer class="bottom"><div class="now"><div class="nowicon">♫</div><div><strong id="nowTitle">Nothing playing</strong><small id="nowSubtitle">Your next great reaction awaits</small></div></div><div class="transport"><button id="mute" class="secondary">◉ Mic off</button><div><button id="panic" class="stop" aria-label="Stop all sounds">■</button></div></div><div class="master">${slider("master", "Master output", settings.master)}</div></footer>
<dialog id="editor"><h2>Make this sound yours</h2><div class="field"><label for="soundName">NAME</label><input id="soundName" type="text" maxlength="80"><label for="soundCategory">COLLECTION</label><input id="soundCategory" type="text" maxlength="40"><p id="clipAttribution" class="help"></p><label for="soundKey">GLOBAL SHORTCUT</label><input id="soundKey" type="text" placeholder="Click, then press Ctrl + Shift + a key" readonly><p class="help" id="keyStatus">Use Ctrl / ⌘, Alt, or Shift with a letter, number, or function key.</p></div><button id="clearKey" class="secondary">Clear shortcut</button>${slider("clipVolume", "Clip volume", 100)}<div class="labelrow"><label for="clipSpeed">Playback speed (also changes clip pitch)</label><span id="clipSpeedValue">100%</span></div><input id="clipSpeed" type="range" min="50" max="200" value="100">${toggle("clipLoop", "Loop this sound", false)}<div class="actions"><button id="deleteClip" class="secondary">Delete</button><button id="closeEditor" class="secondary">Cancel</button><button id="saveClip" class="primary">Save sound</button></div></dialog>
<dialog id="preferences"><h2>Settings that fit your session</h2><h3>Appearance & library</h3><label class="toggle">Accent color <input id="accent" type="color" value="${settings.accent}"></label>${toggle("compact", "Compact sound cards", settings.compact)}${toggle("reduceMotion", "Reduce animations", settings.reduceMotion)}<div class="field"><label for="sortSounds">LIBRARY ORDER</label><select id="sortSounds"><option value="name">Name A–Z</option><option value="newest">Newest first</option><option value="recent">Last played</option></select></div><hr><h3>Audio boosts</h3><p class="help">Boost quiet clips or microphones above 100%. Large boosts can increase noise or distortion; the mix compressor reduces peaks.</p><div class="preferences-grid">${knob("micBoost", "Microphone boost", settings.micBoost, 0, 24, "dB")}${knob("soundBoost", "Sound boost", settings.soundBoost, 0, 24, "dB")}${knob("outputBoost", "Output boost", settings.outputBoost, 0, 18, "dB")}</div><hr><h3>Microphone cleanup</h3>${toggle("echoCancellation", "Request microphone echo cancellation", settings.echoCancellation)}${toggle("gateEnabled", "Enable noise gate", settings.gateEnabled)}${knob("gateThreshold", "Gate threshold", settings.gateThreshold, -80, -10, "dB")}<p class="help">The gate quiets your mic below this threshold. Echo cancellation depends on your microphone and audio driver; keep Discord output on headphones.</p><hr><h3>Desktop & startup</h3>${toggle("minimizeToTray", "Close window to system tray", false)}${toggle("startMinimized", "Start in the system tray", false)}${toggle("launchAtLogin", "Launch when Windows starts", false)}<p id="desktopPreferencesStatus" class="help">Startup controls require the installed desktop app.</p><p class="help">Changes are saved automatically on this computer.</p><div class="actions"><button class="primary" data-close="preferences">Done</button></div></dialog>
<dialog id="keysDialog"><h2>Always within reach</h2><div class="field"><label for="stopKey">STOP ALL SOUNDS</label><input id="stopKey" readonly value="${escape(settings.stopKey)}"><label for="muteKey">TOGGLE MICROPHONE MUTE</label><input id="muteKey" readonly value="${escape(settings.muteKey)}"></div><p class="help">Click a field and press your shortcut. Per-sound shortcuts are configured with ⋯. Shortcuts work globally in the desktop app while it is running. Games may reserve some keys; choose a different combination if registration fails. Elevated games may restrict shortcuts.</p><p id="shortcutReport" class="help"></p><div class="actions"><button class="primary" data-close="keysDialog">Done</button></div></dialog>
<dialog id="helpDialog"><h2>One mix. Every conversation.</h2><p class="help" id="platformHelp"></p><div id="cableSetup" hidden><button id="downloadCable" class="secondary">Download official VB-CABLE</button> <button id="installCable" class="primary">Launch driver installer</button><p class="help" id="cableStatus">Download and extract the official ZIP, then select VBCABLE_Setup_x64.exe. Windows will ask for administrator approval.</p></div><ol class="help"><li>Install a trusted virtual audio cable for your operating system.</li><li>Choose your real microphone as input here.</li><li>Choose the cable’s playback device under “Send mix to.”</li><li>Enable routing and Include microphone.</li><li>In Discord → Voice & Video, choose the cable’s recording device as Input Device.</li><li>Test a clip using Discord’s mic test. If clips are suppressed, disable Discord noise suppression and automatic input sensitivity, then tune the input threshold.</li></ol><p class="help">Keep your real headphones as the system default output. The local monitor plays clips to that default; your microphone is sent only to the routed mix. The guided setup launches the official driver installer with your approval. Waveform does not change system defaults. Discord bots must be connected to your voice channel and support receiving audio.</p><div class="actions"><button class="primary" data-close="helpDialog">Got it</button></div></dialog>`;
function renderCards() {
  let list = sounds.filter(
    (s) =>
      (view !== "favorites" || s.favorite) &&
      (view !== "recent" || s.lastPlayed) &&
      `${s.name} ${s.category}`.toLowerCase().includes(query),
  );
  if (view === "recent" || settings.sortSounds === "recent")
    list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  else if (settings.sortSounds === "newest")
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  else list.sort((a, b) => a.name.localeCompare(b.name));
  $("#totalCount").textContent = sounds.length;
  $("#favoriteCount").textContent = sounds.filter((s) => s.favorite).length;
  $("#librarySummary").textContent =
    `${list.length} sounds · saved on this device`;
  $("#viewTitle").textContent = {
    all: "Your library",
    favorites: "On repeat",
    recent: "Recently played",
  }[view];
  $("#cards").innerHTML = list.length
    ? list
        .map(
          (s) =>
            `<article class="card ${mixer.active.has(s.id) ? "playing" : ""}"><button class="art" data-play="${s.id}" aria-label="${mixer.active.has(s.id) ? "Stop" : "Play"} ${escape(s.name)}" style="--tile:${escape(s.color)}">${wave(s.seed)}</button><button class="details" data-edit="${s.id}" aria-label="Edit ${escape(s.name)}">⋯</button><h3>${escape(s.name)}</h3><p>${escape(s.category || "My sounds")}${s.loop ? " · Loop" : ""}</p><div class="cardbottom"><span class="key" title="${escape(s.key || "No shortcut assigned")}">${shortcutFailures.has(s.id) ? "⚠ " : ""}${escape(s.key?.replace("CommandOrControl", "Ctrl/⌘") || "NO SHORTCUT")}</span><button class="favorite ${s.favorite ? "on" : ""}" data-favorite="${s.id}" aria-label="${s.favorite ? "Unfavorite" : "Favorite"} ${escape(s.name)}">${s.favorite ? "♥" : "♡"}</button></div></article>`,
        )
        .join("")
    : '<div class="empty">No sounds here yet. Add a clip to make this space yours.</div>';
}
function renderNow() {
  $("#mute").textContent = !mixer.stream
    ? "◉ Mic off"
    : mixer.muted
      ? "◉ Mic muted"
      : "◉ Mic live";
  const playing = sounds.filter((s) => mixer.active.has(s.id));
  $("#nowTitle").textContent = playing.length
    ? playing.map((s) => s.name).join(" + ")
    : "Nothing playing";
  $("#nowSubtitle").textContent = playing.length
    ? `${playing.length} playing · ${settings.routing ? "sending to selected output" : "local playback"}`
    : "Your next great reaction awaits";
}
async function play(id) {
  const sound = sounds.find((s) => s.id === id);
  if (!sound) return;
  try {
    await mixer.configure(settings);
    await mixer.play(sound);
    sound.lastPlayed = Date.now();
    await storage("put", sound);
  } catch (e) {
    toast(`Could not play sound: ${e.message}`);
  }
}
async function registerKeys() {
  if (!window.desktop) {
    $("#shortcutReport").textContent =
      "Browser preview: shortcuts work only while this tab is focused.";
    return;
  }
  const entries = [
    ...sounds.filter((s) => s.key).map((s) => ({ id: s.id, key: s.key })),
    { id: "stop", key: settings.stopKey },
    { id: "mute", key: settings.muteKey },
  ];
  const result = await window.desktop.setShortcuts(entries);
  shortcutFailures = new Set(result.filter((r) => !r.ok).map((r) => r.id));
  $("#shortcutReport").textContent = shortcutFailures.size
    ? `${shortcutFailures.size} shortcut(s) unavailable. Choose another key combination.`
    : "All assigned shortcuts registered.";
  if (shortcutFailures.size)
    toast(
      "Some shortcuts are already in use or unsupported. Check Global shortcuts.",
    );
  renderCards();
}
async function refreshDevices(requestPermission = false) {
  try {
    if (requestPermission) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    }
    devices = await navigator.mediaDevices.enumerateDevices();
    for (const [id, kind, label] of [
      ["input", "audioinput", "System default microphone"],
      ["output", "audiooutput", "System default output"],
    ]) {
      const select = $(`#${id}`);
      select.innerHTML =
        `<option value="">${label}</option>` +
        devices
          .filter(
            (d) =>
              d.kind === kind &&
              d.deviceId !== "default" &&
              d.deviceId !== "communications",
          )
          .map(
            (d, i) =>
              `<option value="${escape(d.deviceId)}">${escape(d.label || `${kind === "audioinput" ? "Microphone" : "Output"} ${i + 1}`)}</option>`,
          )
          .join("");
      select.value = settings[id];
      if (!select.value && settings[id]) {
        $("#audioStatus").textContent =
          "A saved device is unavailable. Choose a replacement before enabling routing.";
        settings.routing = false;
        settings[id] = "";
        $("#routing").checked = false;
        if (id === "input") {
          settings.mic = false;
          $("#mic").checked = false;
          mixer.stopMic();
          renderNow();
        }
        saveSettings();
      }
    }
  } catch (e) {
    toast(`Audio device access: ${e.message}`);
  }
}
async function applyAudio() {
  try {
    await mixer.configure(settings);
    $("#routeBadge").textContent = settings.routing
      ? "● Routing enabled"
      : "● Local playback";
    $("#audioStatus").textContent = settings.routing
      ? `Mix output active${settings.mic ? " · microphone included" : ""}. Confirm Discord uses the matching recording device.`
      : "Local playback active. Routing is off.";
    renderNow();
    return true;
  } catch (e) {
    settings.routing = false;
    $("#routing").checked = false;
    $("#routeBadge").textContent = "● Routing unavailable";
    $("#audioStatus").textContent = `Audio configuration failed: ${e.message}`;
    saveSettings();
    return false;
  }
}
async function setMicrophone() {
  try {
    await mixer.configure(settings);
    await mixer.microphone(settings.mic, settings.input);
    if (settings.mic) await refreshDevices();
    await applyAudio();
  } catch (e) {
    settings.mic = false;
    $("#mic").checked = false;
    toast(`Microphone unavailable: ${e.message}`);
  }
  saveSettings();
}
function keyFromEvent(e) {
  const key =
    e.key.length === 1
      ? e.key.toUpperCase()
      : {
          " ": "Space",
          ArrowUp: "Up",
          ArrowDown: "Down",
          ArrowLeft: "Left",
          ArrowRight: "Right",
          Escape: "Escape",
        }[e.key] || e.key;
  if (
    !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Escape|Up|Down|Left|Right)$/.test(
      key,
    )
  )
    return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  return parts.length ? [...parts, key].join("+") : null;
}
function usedKey(key, exclude) {
  return (
    sounds.some((s) => s.id !== exclude && s.key === key) ||
    (exclude !== "stop" && settings.stopKey === key) ||
    (exclude !== "mute" && settings.muteKey === key)
  );
}
for (const id of ["soundKey", "stopKey", "muteKey"])
  $(`#${id}`).addEventListener("keydown", async (e) => {
    e.preventDefault();
    const key = keyFromEvent(e);
    if (!key) return;
    if (
      usedKey(
        key,
        id === "soundKey" ? editId : id === "stopKey" ? "stop" : "mute",
      )
    ) {
      toast(
        "That shortcut is already assigned. Choose a different combination.",
      );
      return;
    }
    $(`#${id}`).value = key;
    if (id !== "soundKey") {
      settings[id] = key;
      saveSettings();
      await registerKeys();
    }
  });
document.addEventListener("keydown", (e) => {
  if (
    window.desktop ||
    e.repeat ||
    $("dialog[open]") ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)
  )
    return;
  const key = keyFromEvent(e);
  if (key === settings.stopKey) {
    e.preventDefault();
    mixer.stopAll();
  } else if (key === settings.muteKey) {
    e.preventDefault();
    toggleMute();
  } else {
    const s = sounds.find((s) => s.key === key);
    if (s) {
      e.preventDefault();
      play(s.id);
    }
  }
});
function toggleMute() {
  if (!mixer.stream) {
    toast("Enable Include microphone to use mic mute.");
    return;
  }
  const muted = mixer.mute();
  $("#mute").textContent = muted ? "◉ Mic muted" : "◉ Mic live";
  $("#mute").style.color = muted ? "#f2ba94" : "";
}
window.desktop?.onShortcut((id) => {
  if (id === "stop") mixer.stopAll();
  else if (id === "mute") toggleMute();
  else play(id);
});
$("#cards").addEventListener("click", async (e) => {
  const target = e.target.closest("button");
  if (!target) return;
  if (target.dataset.play) play(target.dataset.play);
  if (target.dataset.favorite) {
    const s = sounds.find((s) => s.id === target.dataset.favorite);
    s.favorite = !s.favorite;
    await storage("put", s);
    renderCards();
  }
  if (target.dataset.edit) {
    editId = target.dataset.edit;
    const s = sounds.find((s) => s.id === editId);
    $("#clipAttribution").textContent = s.source
      ? `Source: Wikimedia Commons · ${s.source.license} · ${s.source.author} · ${s.source.url}`
      : "";
    $("#soundName").value = s.name;
    $("#soundCategory").value = s.category;
    $("#soundKey").value = s.key || "";
    $("#clipVolume").value = s.volume ?? 100;
    $("#clipVolumeValue").textContent = `${s.volume ?? 100}%`;
    $("#clipSpeed").value = s.speed || 100;
    $("#clipSpeedValue").textContent = `${s.speed || 100}%`;
    $("#clipLoop").checked = s.loop;
    $("#editor").showModal();
  }
});
$("#saveClip").onclick = async () => {
  const s = sounds.find((s) => s.id === editId);
  const name = $("#soundName").value.trim();
  if (!name) {
    toast("Give your sound a name.");
    return;
  }
  const key = $("#soundKey").value;
  if (key && usedKey(key, editId)) {
    toast("That shortcut is already in use.");
    return;
  }
  mixer.stop(s.id);
  Object.assign(s, {
    name,
    category: $("#soundCategory").value.trim() || "My sounds",
    key,
    volume: Number($("#clipVolume").value),
    speed: Number($("#clipSpeed").value),
    loop: $("#clipLoop").checked,
  });
  await storage("put", s);
  $("#editor").close();
  await registerKeys();
  renderCards();
};
$("#deleteClip").onclick = async () => {
  mixer.stop(editId);
  await storage("delete", editId);
  mixer.cache.delete(editId);
  sounds = sounds.filter((s) => s.id !== editId);
  $("#editor").close();
  await registerKeys();
  renderCards();
};
$("#clearKey").onclick = () => ($("#soundKey").value = "");
$("#closeEditor").onclick = () => $("#editor").close();
$("#import").onclick = () => $("#files").click();
$("#files").onchange = async (e) => {
  const colors = [
    "#795779",
    "#6c8954",
    "#ac824b",
    "#496e89",
    "#896053",
    "#557d76",
  ];
  let count = 0;
  for (const file of e.target.files) {
    if (file.size > 50 * 1024 * 1024) {
      toast(`${file.name}: maximum size is 50 MB.`);
      continue;
    }
    try {
      await mixer.init();
      const data = await mixer.ctx.decodeAudioData(await file.arrayBuffer());
      if (data.duration > 600) {
        toast(`${file.name}: maximum clip length is 10 minutes.`);
        continue;
      }
      const s = {
        createdAt: Date.now(),
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        category: "My sounds",
        blob: file,
        key: "",
        volume: 100,
        speed: 100,
        loop: false,
        favorite: false,
        color: colors[sounds.length % colors.length],
        seed: sounds.length,
      };
      await storage("put", s);
      sounds.push(s);
      count++;
    } catch (error) {
      toast(`${file.name}: import failed (${error.message}).`);
    }
  }
  e.target.value = "";
  renderCards();
  if (count)
    toast(`${count} sound${count === 1 ? "" : "s"} saved to your library.`);
};
$("#search").oninput = (e) => {
  query = e.target.value.toLowerCase();
  renderCards();
};
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      document
        .querySelectorAll("[data-view]")
        .forEach((x) => x.classList.toggle("active", x === b));
      renderCards();
    }),
);
for (const id of ["stopAll", "panic"])
  $(`#${id}`).onclick = () => mixer.stopAll();
$("#mute").onclick = toggleMute;
$("#customize").onclick = () => $("#preferences").showModal();
$("#shortcuts").onclick = () => $("#keysDialog").showModal();
$("#routingHelp").onclick = () => $("#helpDialog").showModal();
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => $(`#${b.dataset.close}`).close()));
$("#platformHelp").textContent =
  window.desktop?.platform === "darwin"
    ? "On macOS, a virtual device such as BlackHole provides the routing. Grant Waveform microphone permission in System Settings."
    : window.desktop?.platform === "linux"
      ? "On Linux, use a PipeWire or PulseAudio virtual sink and its monitor source. Device availability depends on your audio server."
      : "On Windows, a virtual cable such as VB-CABLE provides the routing: choose “CABLE Input” here and “CABLE Output” as Discord’s input. Install the driver separately from its official provider.";
$("#desktopStatus").textContent = window.desktop
  ? "Desktop shortcuts enabled"
  : "Browser preview · focused shortcuts only";
if (!window.desktop)
  $("#browserWarning").innerHTML =
    '<div class="warning">Browser preview. Launch the desktop app for shortcuts while gaming. Microphone routing requires a virtual audio device on your computer.</div>';
for (const id of [
  "master",
  "soundVolume",
  "micVolume",
  "monitorVolume",
  "delay",
  "delayWet",
])
  $(`#${id}`).oninput = async (e) => {
    settings[id] = Number(e.target.value);
    $(`#${id}Value`).textContent =
      `${settings[id]}${id === "delay" ? " ms" : "%"}`;
    saveSettings();
    await applyAudio();
  };
for (const id of ["clipVolume", "clipSpeed"])
  $(`#${id}`).oninput = (e) =>
    ($(`#${id}Value`).textContent = `${e.target.value}%`);
for (const id of [
  "routing",
  "monitor",
  "exclusive",
  "noiseSuppression",
  "mic",
  "autoConnect",
  "echoCancellation",
  "gateEnabled",
])
  $(`#${id}`).onchange = async (e) => {
    settings[id] = e.target.checked;
    saveSettings();
    if (
      id === "mic" ||
      (["noiseSuppression", "echoCancellation"].includes(id) && settings.mic)
    )
      await setMicrophone();
    else await applyAudio();
  };
$("#input").onchange = async (e) => {
  settings.input = e.target.value;
  saveSettings();
  if (settings.mic) await setMicrophone();
};
$("#output").onchange = async (e) => {
  settings.output = e.target.value;
  saveSettings();
  await applyAudio();
};
$("#refreshDevices").onclick = () => refreshDevices(true);
navigator.mediaDevices?.addEventListener("devicechange", async () => {
  await refreshDevices();
  if (mixer.ctx) await applyAudio();
});
async function choosePreset(id) {
  settings.effect = id;
  settings.voicePitch = null;
  settings.voiceDrive = null;
  settings.voiceBody = null;
  settings.voiceRing = null;
  $("#voicePreset").value = id;
  const preset = presetFor(settings);
  for (const [control, value] of [
    ["voicePitch", preset.pitch],
    ["voiceDrive", preset.drive],
    ["voiceBody", preset.body],
    ["voiceRing", Math.round(preset.ring * 100)],
  ]) {
    $(`#${control}`).value = value;
    $(`#${control}Value`).textContent =
      `${value} ${$(`#${control}`).dataset.unit}`;
  }
  document
    .querySelectorAll("[data-effect]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.effect === id),
    );
  saveSettings();
  await applyAudio();
}
document
  .querySelectorAll("[data-effect]")
  .forEach(
    (button) => (button.onclick = () => choosePreset(button.dataset.effect)),
  );
$("#voicePreset").onchange = (event) => choosePreset(event.target.value);
for (const id of [
  "voicePitch",
  "voiceDrive",
  "voiceBody",
  "voiceRing",
  "micBoost",
  "soundBoost",
  "outputBoost",
  "gateThreshold",
]) {
  $(`#${id}`).oninput = async (event) => {
    settings[id] = Number(event.target.value);
    $(`#${id}Value`).textContent =
      `${settings[id]} ${event.target.dataset.unit}`;
    saveSettings();
    await applyAudio();
  };
}
$("#sortSounds").value = settings.sortSounds;
$("#sortSounds").onchange = (event) => {
  settings.sortSounds = event.target.value;
  saveSettings();
  renderCards();
};
$("#reduceMotion").onchange = (event) => {
  settings.reduceMotion = event.target.checked;
  saveSettings();
};
let desktopPreferences = {};
async function loadDesktopPreferences() {
  if (!window.desktop?.preferences) {
    for (const id of ["minimizeToTray", "startMinimized", "launchAtLogin"])
      $(`#${id}`).disabled = true;
    return;
  }
  try {
    desktopPreferences = await window.desktop.preferences();
    for (const id of ["minimizeToTray", "startMinimized", "launchAtLogin"])
      $(`#${id}`).checked = desktopPreferences[id];
    $("#launchAtLogin").disabled = !desktopPreferences.canAutoStart;
    $("#desktopPreferencesStatus").textContent = desktopPreferences.canAutoStart
      ? "Desktop choices are saved automatically. Quit from the tray menu when closing to tray is enabled."
      : "Tray settings are available; automatic Windows startup requires the installed EXE.";
  } catch (error) {
    toast(error.message);
  }
}
for (const id of ["minimizeToTray", "startMinimized", "launchAtLogin"])
  $(`#${id}`).onchange = async (event) => {
    try {
      desktopPreferences = await window.desktop.setPreferences({
        ...desktopPreferences,
        [id]: event.target.checked,
      });
    } catch (error) {
      event.target.checked = !event.target.checked;
      toast(error.message);
    }
  };
loadDesktopPreferences();
async function addDownloadedSound(blob, name, source) {
  if (sounds.some((sound) => sound.source?.downloadURL === source.downloadURL))
    throw new Error("This sound is already in your library.");
  await mixer.init();
  const data = await mixer.ctx.decodeAudioData(await blob.arrayBuffer());
  if (data.duration > 600)
    throw new Error("This clip is longer than 10 minutes.");
  const sound = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    name: name.replace(/\.[^.]+$/, ""),
    category: "Online finds",
    blob,
    source,
    key: "",
    volume: 100,
    speed: 100,
    loop: false,
    favorite: false,
    color: "#527d76",
    seed: sounds.length,
  };
  await storage("put", sound);
  sounds.push(sound);
  renderCards();
}
const openCatalog = setupCatalog({ addSound: addDownloadedSound, toast });
$("#browseSounds").onclick = openCatalog;
$("#catalogButton").onclick = openCatalog;
$("#accent").oninput = (e) => {
  settings.accent = e.target.value;
  saveSettings();
};
$("#compact").onchange = (e) => {
  settings.compact = e.target.checked;
  saveSettings();
};
async function start() {
  try {
    sounds = await storage("all");
    if (!localStorage.getItem("waveform-initialized")) {
      for (const [i, name] of [
        "Level up",
        "Bass hit",
        "Good vibes",
      ].entries()) {
        const s = {
          id: crypto.randomUUID(),
          name,
          category: "Starter sounds",
          blob: demoSound(i),
          key: `CommandOrControl+Shift+${i + 1}`,
          volume: 80,
          speed: 100,
          loop: false,
          favorite: i === 0,
          color: ["#627d4e", "#805474", "#a18245"][i],
          seed: i,
        };
        await storage("put", s);
        sounds.push(s);
      }
      localStorage.setItem("waveform-initialized", "yes");
    }
    saveSettings();
    renderCards();
    await refreshDevices();
    await registerKeys();
    if (
      window.desktop &&
      settings.autoConnect &&
      (settings.routing || settings.mic)
    ) {
      await applyAudio();
      if (settings.mic) await setMicrophone();
    }
  } catch (e) {
    toast(`Library could not load: ${e.message}`);
  }
}
window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  toast(`Operation failed: ${event.reason?.message || "Please try again."}`);
});
start();

if (window.desktop?.platform === "win32") {
  $("#cableSetup").hidden = false;
  $("#downloadCable").onclick = async () => {
    try {
      await window.desktop.downloadCable();
    } catch (e) {
      toast(e.message);
    }
  };
  $("#installCable").onclick = async () => {
    const button = $("#installCable");
    button.disabled = true;
    try {
      const result = await window.desktop.installCable();
      $("#cableStatus").textContent =
        result.status === "launched"
          ? "Driver installer launched. Complete its setup, restart Windows if requested, then refresh audio devices and select CABLE Input."
          : "Setup cancelled. Your audio settings were not changed.";
    } catch (e) {
      $("#cableStatus").textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}
