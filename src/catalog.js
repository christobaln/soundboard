export function setupCatalog({ addSound, toast }) {
  const dialog = document.createElement("dialog");
  dialog.id = "catalog";
  dialog.className = "catalog-dialog";
  const saved = Number(localStorage.getItem("library-clip-seconds") || 15);
  dialog.innerHTML = `<h2>Soundboard clips, not long recordings</h2><p class="help">Myinstants specializes in short meme sounds, reactions, and soundboard buttons. It opens inside Waveform. On a sound's page, choose Download MP3 and the clip is added here automatically.</p><form class="catalog-form"><input id="catalogQuery" class="search" type="search" maxlength="120" placeholder="Try vine boom, bruh, metal pipe…" aria-label="Search online sounds"><button class="primary" type="submit">Search soundboards</button></form><div class="catalog-chips">${["vine boom", "bruh", "metal pipe", "air horn", "fart"].map((query) => `<button class="secondary" data-query="${query}">${query}</button>`).join("")}</div><div class="field"><label for="libraryClipSeconds">MAXIMUM ONLINE CLIP LENGTH</label><select id="libraryClipSeconds">${[5, 10, 15, 30].map((seconds) => `<option value="${seconds}" ${seconds === saved ? "selected" : ""}>First ${seconds} seconds</option>`).join("")}</select></div><p id="catalogStatus" class="status" role="status">Downloaded clips are capped at your chosen length. Your own file imports keep their full length, up to 10 minutes.</p><p class="help">Community uploads have varying rights; the original page stays linked in each clip's credits. Clips saved here work offline.</p><div class="actions"><button id="catalogTrending" class="secondary">Browse popular sounds</button><button id="catalogClose" class="primary">Done</button></div>`;
  document.body.append(dialog);
  const $ = (selector) => dialog.querySelector(selector);
  const open = async (query) => {
    if (!window.desktop?.browseSoundboards) {
      $("#catalogStatus").textContent =
        "Online soundboard browsing requires the desktop app. You can still import local audio files in this preview.";
      return;
    }
    $("#catalogStatus").textContent = "Opening Myinstants inside Waveform…";
    try {
      await window.desktop.browseSoundboards(
        query,
        Number($("#libraryClipSeconds").value),
      );
      $("#catalogStatus").textContent =
        "On a sound page, choose Download MP3. Waveform saves the clip automatically.";
    } catch (error) {
      $("#catalogStatus").textContent =
        `Could not open the soundboard library: ${error.message}`;
    }
  };
  dialog.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    open($("#catalogQuery").value.trim());
  };
  dialog.querySelectorAll("[data-query]").forEach(
    (button) =>
      (button.onclick = () => {
        $("#catalogQuery").value = button.dataset.query;
        open(button.dataset.query);
      }),
  );
  $("#catalogTrending").onclick = () => open("");
  $("#catalogClose").onclick = () => dialog.close();
  $("#libraryClipSeconds").onchange = (event) =>
    localStorage.setItem("library-clip-seconds", event.target.value);
  window.desktop?.onLibraryStatus?.((message) => {
    $("#catalogStatus").textContent = message;
  });
  window.desktop?.onLibraryClip?.(async (data) => {
    try {
      await addSound(
        new Blob([data.bytes], { type: data.mime }),
        data.name,
        data.source,
      );
      const message = `${data.name} saved to your soundboard (maximum ${$("#libraryClipSeconds").value}s).`;
      $("#catalogStatus").textContent = message;
      toast(message);
    } catch (error) {
      $("#catalogStatus").textContent = `Import failed: ${error.message}`;
      toast(`${data.name}: ${error.message}`);
    }
  });
  return () => dialog.showModal();
}
