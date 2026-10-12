import { searchSounds, downloadSound, sourceURL } from "../shared/commons.mjs";
export function setupCatalog({ addSound, toast }) {
  const dialog = document.createElement("dialog");
  dialog.id = "catalog";
  dialog.className = "catalog-dialog";
  dialog.innerHTML = `<h2>Find your next sound</h2><p class="help">Search Wikimedia Commons' openly licensed audio library. Credits and license information stay with each clip you save.</p><form class="catalog-form"><input id="catalogQuery" class="search" type="search" maxlength="120" minlength="2" required placeholder="Try applause, thunder, birds…" aria-label="Search online sounds"><button class="primary" type="submit">Search library</button></form><p id="catalogStatus" class="status" role="status">No API key needed. Downloaded clips are saved locally for offline playback.</p><div id="catalogResults"></div><div class="actions"><button id="catalogMore" class="secondary" hidden>More results</button><button id="catalogClose" class="primary">Done</button></div>`;
  document.body.append(dialog);
  let results = [],
    nextOffset = null,
    requestId = 0,
    currentQuery = "",
    preview = new Audio(),
    previewURL;
  const $ = (id) => dialog.querySelector(id);
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const stopPreview = () => {
    preview.pause();
    preview.removeAttribute("src");
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
  };
  const search = async (offset) => {
    const id = ++requestId;
    stopPreview();
    $("#catalogStatus").textContent = "Searching the sound library…";
    $("#catalogMore").hidden = true;
    try {
      const response = window.desktop?.searchSounds
        ? await window.desktop.searchSounds(currentQuery, offset)
        : await searchSounds(currentQuery, offset);
      if (id !== requestId) return;
      results = offset ? [...results, ...response.sounds] : response.sounds;
      nextOffset = response.nextOffset;
      $("#catalogStatus").textContent = results.length
        ? `${results.length} audio files found. Preview uses your default speakers/headphones, never the Discord mix.`
        : "No audio matched. Try a broader search.";
      $("#catalogResults").innerHTML = results
        .map(
          (sound, i) =>
            `<article class="catalog-result"><div><h3>${escape(sound.name)}</h3><p>${escape(sound.license)} · ${Math.round(sound.size / 1024)} KB</p><p>${escape(sound.author)}</p></div><div class="catalog-actions"><button class="secondary" data-preview="${i}">Preview</button><button class="secondary" data-source="${i}">Source / license</button><button class="primary" data-add="${i}">Add to library</button></div></article>`,
        )
        .join("");
      $("#catalogMore").hidden = nextOffset == null;
    } catch (error) {
      if (id === requestId)
        $("#catalogStatus").textContent =
          `Search unavailable: ${error.message}. Your saved clips still work offline.`;
    }
  };
  dialog.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    currentQuery = $("#catalogQuery").value.trim();
    results = [];
    $("#catalogResults").replaceChildren();
    search(0);
  };
  $("#catalogMore").onclick = () => search(nextOffset);
  $("#catalogClose").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    requestId++;
    stopPreview();
  });
  $("#catalogResults").onclick = async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(
      button.dataset.add ?? button.dataset.preview ?? button.dataset.source,
    );
    const sound = results[index];
    if (!sound) return;
    button.disabled = true;
    try {
      if (button.dataset.source != null) {
        if (window.desktop?.openSource)
          await window.desktop.openSource(sound.source);
        else window.open(sourceURL(sound.source), "_blank", "noopener");
        return;
      }
      const data = window.desktop?.downloadSound
        ? await window.desktop.downloadSound(sound.url)
        : await downloadSound(sound.url);
      const blob = new Blob([data.bytes], { type: data.mime });
      if (button.dataset.preview != null) {
        if (!dialog.open) return;
        stopPreview();
        previewURL = URL.createObjectURL(blob);
        preview.src = previewURL;
        preview.volume = 0.5;
        await preview.play();
        $("#catalogStatus").textContent =
          `Previewing ${sound.name} locally. Close this window to stop.`;
      } else {
        await addSound(blob, sound.name, {
          url: sound.source,
          downloadURL: sound.url,
          author: sound.author,
          license: sound.license,
          licenseURL: sound.licenseURL,
        });
        button.textContent = "Added ✓";
        toast(`${sound.name} added to your sound library.`);
      }
    } catch (error) {
      $("#catalogStatus").textContent =
        `Could not ${button.dataset.add != null ? "save" : "preview"} this sound: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  };
  return () => dialog.showModal();
}
