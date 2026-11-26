const container = document.getElementById("timeline-map");
const NON_LOCATION_FIELDS = ["Book", "step_id", "Order", "Notes", "Dead"];
const params = new URLSearchParams(window.location.search);
const storyKey = params.get("story") || DEFAULT_STORY_KEY;
const activeStory = STORIES[storyKey] || STORIES[DEFAULT_STORY_KEY];

let FACTIONS = {};
let LOCATION_DEFAULT_FACTIONS = {};
const DEFAULT_FACTION = activeStory.defaultFactions || {};
const FACTION_OVERRIDES = activeStory.factionOverrides || {};
const BOOK_LABELS = activeStory.bookLabels || {};
const renderedDeaths = new Set();
const locationColorOrder = [];
const characterColorOrder = [];
const locationColorMap = {};
const characterColorMap = {};
const activeCharacterSelections = new Set();
let activeLocationSelection = null;
const characterOrderMap = {};
const CHARACTER_NAMES = {};
const CHARACTER_FACTIONS = {};
const firstStepPerBook = {};
let prevStepLocations = {};
const locationCharacters = {};
let refreshMapSelection = () => {};

function getFaction(character, stepId) {
  return FACTION_OVERRIDES[stepId]?.[character] || CHARACTER_FACTIONS[character] || DEFAULT_FACTION[character] || "neutral";
}
function generatedColor(index, saturation, lightness) {
  return `hsl(${((index * 137.508) % 360).toFixed(1)} ${saturation}% ${lightness}%)`;
}
function getLocationColor(location) {
  if (!locationColorMap[location]) {
    locationColorOrder.push(location);
    locationColorMap[location] = generatedColor(locationColorOrder.length - 1, 42, 82);
  }
  return locationColorMap[location];
}
function getCharacterColor(character) {
  if (!characterColorMap[character]) {
    characterColorOrder.push(character);
    characterColorMap[character] = generatedColor(characterColorOrder.length - 1, 48, 34);
  }
  return characterColorMap[character];
}
function fetchOptionalCsv(url) {
  if (!url) return Promise.resolve("");
  return fetch(url).then(res => res.ok ? res.text() : "").catch(() => "");
}
function applyStoryMetadata() {
  document.title = activeStory.title + " | Story Atlas";
  const headingEl = document.getElementById("timeline-heading");
  if (headingEl) headingEl.textContent = activeStory.heading;
  const stylesheetEl = document.getElementById("story-stylesheet");
  if (stylesheetEl && activeStory.stylesheet) stylesheetEl.href = activeStory.stylesheet;
  const navEl = document.getElementById("story-nav");
  if (navEl && Object.keys(STORIES).length > 1) {
    navEl.replaceChildren();
    Object.entries(STORIES).forEach(([key, cfg]) => {
      const link = document.createElement("a");
      link.href = key === DEFAULT_STORY_KEY ? "./" : "?story=" + encodeURIComponent(key);
      link.textContent = cfg.title.replace(/ Timeline$/, "");
      if (key === storyKey) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
      navEl.appendChild(link);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  applyStoryMetadata();
  initializeStoryMap();
  const { timeline, characters, factions, locations } = activeStory.sheets;
  Promise.all([
    fetch(timeline).then(res => res.text()),
    fetchOptionalCsv(characters),
    fetchOptionalCsv(factions),
    fetchOptionalCsv(locations)
  ]).then(([timelineText, characterText, factionsText, locationsText]) => {
    const timelineParsed = Papa.parse(timelineText, { header: true, skipEmptyLines: true });
    const characterParsed = Papa.parse(characterText, { header: true, skipEmptyLines: true });
    const factionsParsed = Papa.parse(factionsText, { header: true, skipEmptyLines: true });
    const locationsParsed = Papa.parse(locationsText, { header: true, skipEmptyLines: true });
    factionsParsed.data.forEach(row => {
      if (row.default_faction && row.hex) {
        const key = row.default_faction.trim().toLowerCase();
        FACTIONS[key] = { color: "#" + row.hex.trim().replace(/^#/, ""), label: (row.name || row.default_faction).trim() };
      }
    });
    locationsParsed.data.forEach(row => {
      if (!row.Location) return;
      const name = row.Location.trim();
      if (row.default_faction) LOCATION_DEFAULT_FACTIONS[name] = row.default_faction.trim().toLowerCase();
      const suppliedColor = (row.hex || row.color || "").trim();
      if (/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(suppliedColor)) {
        locationColorMap[name] = suppliedColor.startsWith("#") ? suppliedColor : "#" + suppliedColor;
      }
    });
    characterParsed.data.forEach(row => {
      if (!row.code) return;
      const code = row.code.trim();
      characterOrderMap[code] = Number(row.order) || 999;
      if (row.name) CHARACTER_NAMES[code] = row.name.trim();
      const faction = row.faction || row.default_faction || row.Faction;
      if (faction) CHARACTER_FACTIONS[code] = faction.trim().toLowerCase();
    });
    renderTimeline(timelineParsed.data);
    renderMapCharacterBadges();
    initializeDynamicLegend();
  });
});

function renderTimeline(data) {
  data.forEach((step, stepIndex) => {
    if (!step.Book || step.Book.trim() === "") return;
    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";
    const bookNum = step.Book.trim();
    if (!firstStepPerBook[bookNum]) {
      const labelText = BOOK_LABELS[bookNum] || `Part ${bookNum}`;
      stepEl.innerHTML = `<div class="step-label">${labelText}</div>`;
      firstStepPerBook[bookNum] = true;
    }
    const row = document.createElement("div");
    row.className = "location-row";
    const currentStepLocations = {};
    Object.entries(step).forEach(([field, value]) => {
      if (NON_LOCATION_FIELDS.includes(field)) return;
      const rawEntries = value ? value.replace(/"/g, "").split(",") : [];
      const chars = rawEntries.map(v => v.trim()).filter(Boolean);
      const sortedChars = [...chars].sort((a, b) => (characterOrderMap[a] ?? 999) - (characterOrderMap[b] ?? 999));
      const finalEntries = [];
      let charIndex = 0;
      rawEntries.forEach(e => {
        if (!e.trim()) finalEntries.push("");
        else finalEntries.push(sortedChars[charIndex++]);
      });
      currentStepLocations[field] = { chars: [...chars].sort() };
      if (!chars.length) return;
      if (!locationCharacters[field]) locationCharacters[field] = new Set();
      chars.forEach(code => locationCharacters[field].add(code));
      const prev = prevStepLocations[field] || { chars: [] };
      const charsChanged = prev.chars.join(",") !== chars.join(",");
      const isFirstAppearance = !prevStepLocations[field];
      if (!isFirstAppearance && !charsChanged) return;

      const box = document.createElement("div");
      box.className = "location-box";
      box.dataset.location = field;
      box.tabIndex = 0;
      box.setAttribute("role", "button");
      box.setAttribute("aria-label", "Select location " + field);
      const locationTitle = document.createElement("div");
      locationTitle.className = "location-title";
      locationTitle.textContent = field;
      box.appendChild(locationTitle);
      const boxColor = getLocationColor(field);
      box.style.borderColor = boxColor;
      box.style.setProperty("--location-color", boxColor);
      box.style.backgroundColor = `color-mix(in srgb, ${boxColor} 13%, white)`;
      box.dataset.locationColor = boxColor;

      if (finalEntries.length) {
        const badges = document.createElement("div");
        badges.className = "badges";
        finalEntries.forEach(code => {
          if (!code) {
            const spacer = document.createElement("div");
            spacer.className = "badge-spacer";
            badges.appendChild(spacer);
            return;
          }
          const badge = document.createElement("div");
          badge.className = "hex";
          badge.textContent = code;
          const factionKey = getFaction(code, stepIndex);
          badge.style.backgroundColor = FACTIONS[factionKey]?.color || getCharacterColor(code);
          badge.dataset.character = code;
          badge.dataset.characterName = CHARACTER_NAMES[code] || code;
          badge.dataset.faction = factionKey;
          badge.title = (CHARACTER_NAMES[code] || code) + " · " + (FACTIONS[factionKey]?.label || factionKey);
          badges.appendChild(badge);
        });
        box.appendChild(badges);
      }
      if (step.Dead && step.Dead.trim() !== "") {
        const deadChars = step.Dead.replace(/"/g, "").split(",").map(c => c.trim());
        const deadInThisBox = chars.filter(c => deadChars.includes(c) && !renderedDeaths.has(c));
        if (deadInThisBox.length) {
          const ripDiv = document.createElement("div");
          ripDiv.className = "rip-line";
          ripDiv.innerHTML = "<span>RIP:</span>";
          deadInThisBox.forEach(code => {
            const ripBadge = document.createElement("div");
            ripBadge.className = "hex rip";
            ripBadge.textContent = code;
            ripDiv.appendChild(ripBadge);
            renderedDeaths.add(code);
          });
          box.appendChild(ripDiv);
        }
      }
      row.appendChild(box);
    });
    prevStepLocations = currentStepLocations;
    stepEl.appendChild(row);
    if (step.Notes && step.Notes.trim() !== "") {
      const notesEl = document.createElement("div");
      notesEl.className = "step-notes";
      notesEl.textContent = step.Notes.trim();
      stepEl.appendChild(notesEl);
    }
    container.appendChild(stepEl);
  });
}

function initializeStoryMap() {
  const config = activeStory.map;
  const panel = document.getElementById("story-map-panel");
  if (!config || !panel) return;
  panel.hidden = false;
  document.body.classList.add("has-story-map");
  document.getElementById("story-map-title").textContent = config.title || "Story map";
  const creditEl = document.getElementById("story-map-credit");
  if (creditEl) creditEl.textContent = config.attribution || "";
  const image = document.getElementById("story-map-image");
  image.src = config.image;
  image.alt = "Map of " + (config.title || "the story world");
  image.addEventListener("error", () => {
    panel.classList.add("map-image-missing");
    document.getElementById("story-map-help").textContent = "The configured map image could not be loaded. The interactive location layer is still available once the image path is corrected.";
  }, { once: true });

  const viewport = document.getElementById("story-map-viewport");
  const canvas = document.getElementById("story-map-canvas");
  const markerLayer = document.getElementById("story-map-markers");
  let scale = 1, offsetX = 0, offsetY = 0, dragging = false, startX = 0, startY = 0, originX = 0, originY = 0;
  const applyTransform = () => { canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`; };
  const zoom = factor => { scale = Math.max(1, Math.min(4, scale * factor)); if (scale === 1) offsetX = offsetY = 0; applyTransform(); };
  document.getElementById("map-zoom-in").addEventListener("click", () => zoom(1.35));
  document.getElementById("map-zoom-out").addEventListener("click", () => zoom(1 / 1.35));
  document.getElementById("map-reset").addEventListener("click", () => { scale = 1; offsetX = offsetY = 0; applyTransform(); });
  viewport.addEventListener("wheel", event => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  viewport.addEventListener("pointerdown", event => {
    if (event.target.closest(".map-location-marker, .map-character-badge")) return;
    dragging = true; startX = event.clientX; startY = event.clientY; originX = offsetX; originY = offsetY;
    viewport.classList.add("is-dragging"); viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", event => {
    if (!dragging) return;
    offsetX = originX + event.clientX - startX; offsetY = originY + event.clientY - startY; applyTransform();
  });
  const stopDrag = () => { dragging = false; viewport.classList.remove("is-dragging"); };
  viewport.addEventListener("pointerup", stopDrag);
  viewport.addEventListener("pointercancel", stopDrag);
  config.locations.forEach(location => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "map-location-marker";
    marker.dataset.location = location.name;
    marker.style.left = location.x + "%";
    marker.style.top = location.y + "%";
    marker.style.setProperty("--marker-color", getLocationColor(location.name));
    marker.title = location.name;
    marker.setAttribute("aria-label", "Select " + location.name);
    const label = document.createElement("span");
    label.className = "map-marker-label";
    label.textContent = location.name;
    marker.appendChild(label);
    marker.addEventListener("click", () => selectLocation(location.name));
    markerLayer.appendChild(marker);
  });
  refreshMapSelection = () => {
    markerLayer.querySelectorAll(".map-location-marker").forEach(marker => {
      const selected = marker.dataset.location === activeLocationSelection;
      marker.classList.toggle("is-selected", selected);
      marker.setAttribute("aria-pressed", String(selected));
    });
  };
  function selectLocation(name) {
    activeLocationSelection = activeLocationSelection === name ? null : name;
    activeCharacterSelections.clear();
    updateSelectionHighlights();
  }
  function updateSelectionHighlights() {
    document.querySelectorAll(".location-box").forEach(box => box.classList.toggle("is-selected-location", box.dataset.location === activeLocationSelection));
    document.querySelectorAll(".location-box .hex:not(.rip)").forEach(badge => {
      badge.classList.toggle("is-selected-character", activeCharacterSelections.has(badge.dataset.character));
      badge.classList.toggle("is-dimmed-character", activeCharacterSelections.size > 0 && !activeCharacterSelections.has(badge.dataset.character));
    });
    document.querySelectorAll(".legend-item[data-type]").forEach(item => {
      const selected = item.dataset.type === "character" ? activeCharacterSelections.has(item.dataset.key) : activeLocationSelection === item.dataset.key;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    document.getElementById("clear-selection").hidden = activeCharacterSelections.size === 0 && !activeLocationSelection;
    refreshMapSelection();
  }
  window.updateStoryMapSelection = updateSelectionHighlights;
}

function renderMapCharacterBadges() {
  const layer = document.getElementById("story-map-markers");
  if (!layer) return;
  layer.querySelectorAll(".map-location-marker").forEach(marker => {
    const people = [...(locationCharacters[marker.dataset.location] || [])];
    if (!people.length) return;
    const cluster = document.createElement("span");
    cluster.className = "map-character-cluster";
    people.slice(0, 5).forEach(code => {
      const badge = document.createElement("span");
      badge.className = "map-character-badge";
      badge.textContent = code;
      badge.style.backgroundColor = FACTIONS[getFaction(code)]?.color || getCharacterColor(code);
      badge.title = CHARACTER_NAMES[code] || code;
      cluster.appendChild(badge);
    });
    if (people.length > 5) {
      const more = document.createElement("span");
      more.className = "map-character-more";
      more.textContent = "+" + (people.length - 5);
      cluster.appendChild(more);
    }
    marker.appendChild(cluster);
  });
}

function initializeDynamicLegend() {
  const legend = document.getElementById("timeline-legend");
  const locationsEl = document.getElementById("legend-locations");
  const charactersEl = document.getElementById("legend-characters");
  const countEl = document.getElementById("legend-count");
  if (!legend || !locationsEl || !charactersEl || !countEl) return;
  const isVisible = element => { const rect = element.getBoundingClientRect(); return rect.bottom > 88 && rect.top < window.innerHeight; };
  const addLegendItem = (parent, label, detail, color, shape = "square", type = "", key = "") => {
    const item = document.createElement("button");
    item.type = "button"; item.className = "legend-item"; item.dataset.type = type; item.dataset.key = key;
    item.setAttribute("aria-pressed", String(type === "character" ? activeCharacterSelections.has(key) : activeLocationSelection === key));
    const swatch = document.createElement("i"); swatch.className = "legend-swatch" + (shape === "hex" ? " legend-hex" : ""); swatch.style.backgroundColor = color;
    const copy = document.createElement("span"); copy.className = "legend-copy";
    const name = document.createElement("span"); name.className = "legend-name"; name.textContent = label; copy.appendChild(name);
    if (detail) { const meta = document.createElement("small"); meta.className = "legend-detail"; meta.textContent = detail; copy.appendChild(meta); }
    item.append(swatch, copy); parent.appendChild(item);
  };
  const updateLegend = () => {
    const visibleBoxes = [...document.querySelectorAll(".location-box")].filter(isVisible);
    const visibleBadges = [...document.querySelectorAll(".location-box .hex:not(.rip)")].filter(isVisible);
    const locations = [...new Map(visibleBoxes.map(el => [el.dataset.location, el])).values()];
    const characters = [...new Map(visibleBadges.map(el => [el.dataset.character, el])).entries()];
    legend.hidden = locations.length === 0 && characters.length === 0;
    countEl.textContent = locations.length + " places · " + characters.length + " people";
    locationsEl.replaceChildren();
    if (locations.length) {
      const heading = document.createElement("h3"); heading.textContent = "Locations"; locationsEl.appendChild(heading);
      locations.forEach(el => addLegendItem(locationsEl, el.dataset.location, "", el.dataset.locationColor, "square", "location", el.dataset.location));
    }
    charactersEl.replaceChildren();
    if (characters.length) {
      const heading = document.createElement("h3"); heading.textContent = "Characters"; charactersEl.appendChild(heading);
      characters.forEach(([code, el]) => {
        const factionKey = el.dataset.faction || "neutral";
        const factionLabel = FACTIONS[factionKey]?.label || (factionKey === "neutral" ? "No faction assigned" : factionKey);
        addLegendItem(charactersEl, el.dataset.characterName || CHARACTER_NAMES[code] || code, code + " · " + factionLabel, el.style.backgroundColor, "hex", "character", code);
      });
    }
    updateSelectionHighlights();
  };
  const updateSelectionHighlights = () => {
    document.querySelectorAll(".location-box").forEach(box => box.classList.toggle("is-selected-location", box.dataset.location === activeLocationSelection));
    document.querySelectorAll(".location-box .hex:not(.rip)").forEach(badge => {
      badge.classList.toggle("is-selected-character", activeCharacterSelections.has(badge.dataset.character));
      badge.classList.toggle("is-dimmed-character", activeCharacterSelections.size > 0 && !activeCharacterSelections.has(badge.dataset.character));
    });
    document.querySelectorAll(".legend-item[data-type]").forEach(item => {
      const selected = item.dataset.type === "character" ? activeCharacterSelections.has(item.dataset.key) : activeLocationSelection === item.dataset.key;
      item.classList.toggle("is-selected", selected); item.setAttribute("aria-pressed", String(selected));
    });
    const clearButton = document.getElementById("clear-selection");
    if (clearButton) clearButton.hidden = activeCharacterSelections.size === 0 && !activeLocationSelection;
    refreshMapSelection();
  };
  legend.addEventListener("click", event => {
    const item = event.target.closest(".legend-item[data-type]");
    if (!item) return;
    if (item.dataset.type === "character") {
      const code = item.dataset.key;
      if (activeCharacterSelections.has(code)) activeCharacterSelections.delete(code); else activeCharacterSelections.add(code);
      activeLocationSelection = null;
    } else {
      activeLocationSelection = activeLocationSelection === item.dataset.key ? null : item.dataset.key;
      activeCharacterSelections.clear();
    }
    updateSelectionHighlights();
  });
  document.getElementById("clear-selection")?.addEventListener("click", () => {
    activeCharacterSelections.clear(); activeLocationSelection = null; updateSelectionHighlights();
  });
  document.getElementById("timeline-map").addEventListener("click", event => {
    const box = event.target.closest(".location-box");
    if (!box) return;
    activeLocationSelection = activeLocationSelection === box.dataset.location ? null : box.dataset.location;
    activeCharacterSelections.clear(); updateSelectionHighlights();
  });
  document.getElementById("timeline-map").addEventListener("keydown", event => {
    if ((event.key !== "Enter" && event.key !== " ") || !event.target.matches(".location-box")) return;
    event.preventDefault(); event.target.click();
  });
  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return; scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updateLegend(); });
  };
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(scheduleUpdate, { rootMargin: "88px 0px 0px 0px" });
    document.querySelectorAll(".location-box, .location-box .hex:not(.rip)").forEach(el => observer.observe(el));
  }
  updateLegend();
}