const container = document.getElementById("timeline-map");
const NON_LOCATION_FIELDS = ["Book", "step_id", "Order", "Notes", "Dead"];
const params = new URLSearchParams(window.location.search);
const storyKey = params.get("story") || DEFAULT_STORY_KEY;
const activeStory = STORIES[storyKey] || STORIES[DEFAULT_STORY_KEY];

let FACTIONS = {};
const DEFAULT_FACTION = activeStory.defaultFactions || {};
const FACTION_OVERRIDES = activeStory.factionOverrides || {};
const BOOK_LABELS = activeStory.bookLabels || {};
const renderedDeaths = new Set();
const locationColorOrder = [];
const characterColorOrder = [];
const locationColorMap = {};
const locationFactionMap = {};
const locationFactionColorIndex = {};
const characterColorMap = {};
const activeCharacterSelections = new Set();
let activeLocationSelection = null;
const characterOrderMap = {};
const locationOrderMap = {};
const locationRowOrderMap = {};
const locationCharacterCountMap = {};
const factionOrderMap = {};
const normalizeLocationKey = location => String(location || "").trim().toLowerCase();
const getCsvField = (row, field) => Object.entries(row).find(([key]) => key.trim().toLowerCase() === field.toLowerCase())?.[1];
const CHARACTER_NAMES = {};
const CHARACTER_FACTIONS = {};
const firstStepPerBook = {};
let prevStepLocations = {};

function getFaction(character, stepId) {
  return FACTION_OVERRIDES[stepId]?.[character] || CHARACTER_FACTIONS[character] || DEFAULT_FACTION[character] || "neutral";
}
function generatedColor(index, saturation, lightness) {
  return `hsl(${((index * 137.508) % 360).toFixed(1)} ${saturation}% ${lightness}%)`;
}
function getLocationColor(location) {
  if (!locationColorMap[location]) {
    const factionKey = locationFactionMap[normalizeLocationKey(location)];
    const factionHue = hexToHue(FACTIONS[factionKey]?.color);
    if (factionKey && factionHue !== null) {
      const index = locationFactionColorIndex[factionKey] || 0;
      locationFactionColorIndex[factionKey] = index + 1;
      const saturation = 48 + (index % 3) * 6;
      const lightness = 48 + (index % 4) * 7;
      locationColorMap[location] = `hsl(${factionHue.toFixed(1)} ${saturation}% ${lightness}%)`;
    } else {
      locationColorOrder.push(location);
      locationColorMap[location] = generatedColor(locationColorOrder.length - 1, 42, 82);
    }
  }
  return locationColorMap[location];
}
function hexToHue(hex) {
  const normalized = String(hex || "").replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return null;
  const full = normalized.length === 3 ? normalized.split("").map(value => value + value).join("") : normalized;
  const [r, g, b] = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return 0;
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}
function getCharacterColor(character, factionKey = CHARACTER_FACTIONS[character] || "neutral") {
  const key = factionKey + ":" + character;
  if (!characterColorMap[key]) {
    const members = Object.keys(CHARACTER_NAMES)
      .filter(code => (CHARACTER_FACTIONS[code] || "neutral") === factionKey)
      .sort((a, b) => (characterOrderMap[a] ?? 999) - (characterOrderMap[b] ?? 999) || a.localeCompare(b));
    const index = Math.max(0, members.indexOf(character));
    const factionHue = hexToHue(FACTIONS[factionKey]?.color);
    characterColorMap[key] = factionHue === null
      ? generatedColor(index, 58, 30 + (index % 4) * 4)
      : `hsl(${factionHue.toFixed(1)} ${58 + (index % 3) * 7}% ${27 + (index % 5) * 4}%)`;
  }
  return characterColorMap[key];
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
    factionsParsed.data.forEach((row, index) => {
      if (row.default_faction && row.hex) {
        const key = row.default_faction.trim().toLowerCase();
        FACTIONS[key] = { color: "#" + row.hex.trim().replace(/^#/, ""), label: (row.name || row.default_faction).trim() };
        factionOrderMap[key] = index;
      }
    });
    locationsParsed.data.forEach((row, rowIndex) => {
      const rawName = getCsvField(row, "name");
      if (!rawName || !String(rawName).trim()) return;
      const name = String(rawName).trim();
      const key = normalizeLocationKey(name);
      locationRowOrderMap[key] = rowIndex;
      const rawFaction = getCsvField(row, "default_faction")
        || getCsvField(row, "default faction")
        || getCsvField(row, "faction");
      const factionKey = String(rawFaction || "").trim().toLowerCase();
      if (factionKey) locationFactionMap[key] = factionKey;
      const suppliedColor = String(getCsvField(row, "hex") || getCsvField(row, "color") || "").trim();
      const hasFactionColor = factionKey && hexToHue(FACTIONS[factionKey]?.color) !== null;
      if (!hasFactionColor && /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(suppliedColor)) {
        locationColorMap[name] = suppliedColor.startsWith("#") ? suppliedColor : "#" + suppliedColor;
      }
      const suppliedOrder = String(getCsvField(row, "order") ?? "").trim();
      if (suppliedOrder !== "" && Number.isFinite(Number(suppliedOrder))) {
        locationOrderMap[key] = Number(suppliedOrder);
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
    const locationEntries = Object.entries(step)
      .filter(([field]) => !NON_LOCATION_FIELDS.includes(field))
      .map(([field, value], index) => ({ field, value, index }))
      .sort((a, b) => {
        const aKey = normalizeLocationKey(a.field);
        const bKey = normalizeLocationKey(b.field);
        const aOrder = locationOrderMap[aKey];
        const bOrder = locationOrderMap[bKey];
        const aRowOrder = locationRowOrderMap[aKey];
        const bRowOrder = locationRowOrderMap[bKey];
        if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) return aOrder - bOrder;
        if (aOrder !== undefined && bOrder === undefined) return -1;
        if (bOrder !== undefined && aOrder === undefined) return 1;
        if (aRowOrder !== undefined && bRowOrder !== undefined) return aRowOrder - bRowOrder || a.index - b.index;
        if (aRowOrder !== undefined) return -1;
        if (bRowOrder !== undefined) return 1;
        return a.index - b.index;
      });
    locationEntries.forEach(({ field, value }) => {
      const rawEntries = value ? value.replace(/"/g, "").split(",") : [];
      const chars = rawEntries.map(v => v.trim()).filter(Boolean);
      locationCharacterCountMap[field] = (locationCharacterCountMap[field] || 0) + chars.length;
      const sortedChars = [...chars].sort((a, b) => (characterOrderMap[a] ?? 999) - (characterOrderMap[b] ?? 999));
      const finalEntries = [];
      let charIndex = 0;
      rawEntries.forEach(e => {
        if (!e.trim()) finalEntries.push("");
        else finalEntries.push(sortedChars[charIndex++]);
      });
      const normalizedChars = [...chars].sort();
      currentStepLocations[field] = { chars: normalizedChars };
      if (!chars.length) return;
      const prev = prevStepLocations[field] || { chars: [] };
      const charsChanged = prev.chars.join(",") !== normalizedChars.join(",");
      const isFirstAppearance = !prevStepLocations[field];

      const box = document.createElement("div");
      box.className = "location-box";
      if (!isFirstAppearance && !charsChanged) box.classList.add("is-unchanged");
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
          badge.style.backgroundColor = getCharacterColor(code, factionKey);
          badge.dataset.character = code;
          badge.dataset.characterName = CHARACTER_NAMES[code] || code;
          badge.dataset.faction = factionKey;
          badge.tabIndex = 0;
          badge.setAttribute("role", "button");
          badge.setAttribute("aria-label", "Select character " + (CHARACTER_NAMES[code] || code));
          badge.setAttribute("aria-pressed", "false");
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

function initializeDynamicLegend() {
  const legend = document.getElementById("timeline-legend");
  const locationsEl = document.getElementById("legend-locations");
  const charactersEl = document.getElementById("legend-characters");
  const countEl = document.getElementById("legend-count");
  if (!legend || !locationsEl || !charactersEl || !countEl) return;
  const header = document.querySelector(".site-header");
  const updateHeaderOffset = () => {
    const height = header?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--site-header-height", height + "px");
  };
  updateHeaderOffset();
  if (header && "ResizeObserver" in window) new ResizeObserver(updateHeaderOffset).observe(header);
  window.addEventListener("resize", updateHeaderOffset, { passive: true });
  const isVisible = element => {
    const rect = element.getBoundingClientRect();
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    return rect.bottom > headerBottom + 12 && rect.top < window.innerHeight;
  };
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
  const locationSort = document.getElementById("location-sort");
  const characterSort = document.getElementById("character-sort");
  const showLocationList = document.getElementById("show-location-list");
  const showCharacterList = document.getElementById("show-character-list");
  const settingsKey = "story-atlas-layout-" + storyKey;
  let savedLayout = {};
  try { savedLayout = JSON.parse(localStorage.getItem(settingsKey) || "{}"); } catch {}
  if (locationSort) locationSort.value = savedLayout.locationSort || "plot";
  if (characterSort) characterSort.value = savedLayout.characterSort || "plot";
  if (showLocationList) showLocationList.checked = savedLayout.showLocationList === true;
  if (showCharacterList) showCharacterList.checked = savedLayout.showCharacterList === true;
  const saveLayout = () => {
    savedLayout = {
      ...savedLayout,
      locationSort: locationSort?.value || "plot",
      characterSort: characterSort?.value || "plot",
      showLocationList: !!showLocationList?.checked,
      showCharacterList: !!showCharacterList?.checked,
      hideUnchanged: !!hideUnchangedToggle?.checked
    };
    localStorage.setItem(settingsKey, JSON.stringify(savedLayout));
  };
  const factionLabel = key => FACTIONS[key]?.label || key || "Unaligned";
  const compareFaction = (a, b) => {
    const aKey = (locationFactionMap[normalizeLocationKey(a.dataset.location)] || "").toLowerCase();
    const bKey = (locationFactionMap[normalizeLocationKey(b.dataset.location)] || "").toLowerCase();
    return factionLabel(aKey).localeCompare(factionLabel(bKey)) || a.dataset.location.localeCompare(b.dataset.location);
  };
  const sortLocations = locations => {
    const mode = locationSort?.value || "plot";
    return locations.sort((a, b) => {
      if (mode === "alphabetical") return a.dataset.location.localeCompare(b.dataset.location);
      if (mode === "faction") return compareFaction(a, b);
      if (mode === "count") return (locationCharacterCountMap[b.dataset.location] || 0) - (locationCharacterCountMap[a.dataset.location] || 0)
        || (locationOrderMap[normalizeLocationKey(a.dataset.location)] ?? 999999) - (locationOrderMap[normalizeLocationKey(b.dataset.location)] ?? 999999)
        || a.dataset.location.localeCompare(b.dataset.location);
      return (locationOrderMap[normalizeLocationKey(a.dataset.location)] ?? locationRowOrderMap[normalizeLocationKey(a.dataset.location)] ?? 999999)
        - (locationOrderMap[normalizeLocationKey(b.dataset.location)] ?? locationRowOrderMap[normalizeLocationKey(b.dataset.location)] ?? 999999)
        || a.dataset.location.localeCompare(b.dataset.location);
    });
  };
  const sortCharacters = characters => {
    const mode = characterSort?.value || "plot";
    return characters.sort(([codeA, elA], [codeB, elB]) => {
      if (mode === "alphabetical") return (elA.dataset.characterName || codeA).localeCompare(elB.dataset.characterName || codeB);
      if (mode === "faction") return factionLabel(elA.dataset.faction).localeCompare(factionLabel(elB.dataset.faction))
        || (characterOrderMap[codeA] ?? 999999) - (characterOrderMap[codeB] ?? 999999)
        || codeA.localeCompare(codeB);
      return (characterOrderMap[codeA] ?? 999999) - (characterOrderMap[codeB] ?? 999999) || codeA.localeCompare(codeB);
    });
  };
  const updateLegend = () => {
    const visibleBoxes = [...document.querySelectorAll(".location-box:not([hidden])")].filter(isVisible);
    const visibleBadges = [...document.querySelectorAll(".location-box:not([hidden]) .hex:not(.rip)")].filter(isVisible);
    const locations = sortLocations([...new Map(visibleBoxes.map(el => [el.dataset.location, el])).values()]);
    const characters = sortCharacters([...new Map(visibleBadges.map(el => [el.dataset.character, el])).entries()]);
    legend.hidden = locations.length === 0 && characters.length === 0;
    countEl.textContent = locations.length + " places · " + characters.length + " people";
    locationsEl.replaceChildren();
    locationsEl.hidden = !showLocationList?.checked;
    if (locations.length && !locationsEl.hidden) {
      const heading = document.createElement("h3"); heading.textContent = "Locations"; locationsEl.appendChild(heading);
      locations.forEach(el => addLegendItem(locationsEl, el.dataset.location, "", el.dataset.locationColor, "square", "location", el.dataset.location));
    }
    charactersEl.replaceChildren();
    charactersEl.hidden = !showCharacterList?.checked;
    if (characters.length && !charactersEl.hidden) {
      const heading = document.createElement("h3"); heading.textContent = "Characters"; charactersEl.appendChild(heading);
      characters.forEach(([code, el]) => {
        addLegendItem(charactersEl, el.dataset.characterName || CHARACTER_NAMES[code] || code, code, el.style.backgroundColor, "hex", "character", code);
      });
    }
    updateSelectionHighlights();
  };
  const updateSelectionHighlights = () => {
    document.querySelectorAll(".location-box").forEach(box => box.classList.toggle("is-selected-location", box.dataset.location === activeLocationSelection));
    document.querySelectorAll(".location-box .hex:not(.rip)").forEach(badge => {
      const selected = activeCharacterSelections.has(badge.dataset.character);
      badge.classList.toggle("is-selected-character", selected);
      badge.classList.toggle("is-dimmed-character", activeCharacterSelections.size > 0 && !selected);
      badge.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll(".legend-item[data-type]").forEach(item => {
      const selected = item.dataset.type === "character" ? activeCharacterSelections.has(item.dataset.key) : activeLocationSelection === item.dataset.key;
      item.classList.toggle("is-selected", selected); item.setAttribute("aria-pressed", String(selected));
    });
    const clearButton = document.getElementById("clear-selection");
    if (clearButton) clearButton.hidden = activeCharacterSelections.size === 0 && !activeLocationSelection;
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
    const badge = event.target.closest(".location-box .hex:not(.rip)");
    if (badge) {
      const code = badge.dataset.character;
      if (activeCharacterSelections.has(code)) activeCharacterSelections.delete(code);
      else activeCharacterSelections.add(code);
      activeLocationSelection = null;
      updateSelectionHighlights();
      return;
    }
    const box = event.target.closest(".location-box");
    if (!box) return;
    activeLocationSelection = activeLocationSelection === box.dataset.location ? null : box.dataset.location;
    activeCharacterSelections.clear(); updateSelectionHighlights();
  });
  document.getElementById("timeline-map").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.matches(".location-box .hex:not(.rip)")) {
      event.preventDefault();
      event.stopPropagation();
      event.target.click();
      return;
    }
    if (event.target.matches(".location-box")) {
      event.preventDefault();
      event.target.click();
    }
  });


  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const savedTheme = localStorage.getItem("story-atlas-theme");
  document.body.classList.toggle("dark-mode", savedTheme === "dark");
  if (darkModeToggle) darkModeToggle.checked = savedTheme === "dark";
  darkModeToggle?.addEventListener("change", () => {
    document.body.classList.toggle("dark-mode", darkModeToggle.checked);
    localStorage.setItem("story-atlas-theme", darkModeToggle.checked ? "dark" : "light");
  });
  const hideUnchangedToggle = document.getElementById("hide-unchanged-locations");
  const applyUnchangedFilter = () => {
    document.querySelectorAll(".location-row").forEach(row => {
      const boxes = [...row.querySelectorAll(".location-box")];
      boxes.forEach(box => { box.hidden = !hideUnchangedToggle?.checked && box.classList.contains("is-unchanged"); });
      row.hidden = boxes.length > 0 && boxes.every(box => box.hidden);
    });
    updateLegend();
  };
  if (hideUnchangedToggle) {
    hideUnchangedToggle.checked = savedLayout.hideUnchanged !== false;
    applyUnchangedFilter();
    hideUnchangedToggle.addEventListener("change", () => { saveLayout(); applyUnchangedFilter(); });
  }
  [locationSort, characterSort, showLocationList, showCharacterList].forEach(control => {
    control?.addEventListener("change", () => { saveLayout(); updateLegend(); });
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