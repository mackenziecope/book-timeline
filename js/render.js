const container = document.getElementById("timeline-map");
const NON_LOCATION_FIELDS = ["Book", "step_id", "Order", "Notes", "Dead"];

/* --- Resolve active story from ?story=<key> --- */
const params = new URLSearchParams(window.location.search);
const storyKey = params.get("story") || DEFAULT_STORY_KEY;
const activeStory = STORIES[storyKey] || STORIES[DEFAULT_STORY_KEY];

/* --- State --- */
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
let legendObserver = null;
const characterOrderMap = {};
const CHARACTER_NAMES = {};
const CHARACTER_FACTIONS = {};
const firstStepPerBook = {};
let prevStepLocations = {};

function getFaction(character, stepId) {
  return (
    FACTION_OVERRIDES[stepId]?.[character] ||
    CHARACTER_FACTIONS[character] ||
    DEFAULT_FACTION[character] ||
    "neutral"
  );
}

function generatedColor(index, saturation, lightness) {
  // Golden-angle spacing keeps neighboring entries visually distinct.
  const hue = (index * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
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
  return fetch(url)
    .then(res => (res.ok ? res.text() : ""))
    .catch(() => "");
}

function applyStoryMetadata() {
  document.title = activeStory.title + " | Story Atlas";
  const headingEl = document.getElementById("timeline-heading");
  if (headingEl) headingEl.textContent = activeStory.heading;

  const stylesheetEl = document.getElementById("story-stylesheet");
  if (stylesheetEl && activeStory.stylesheet) {
    stylesheetEl.href = activeStory.stylesheet;
  }

  // Render accessible story switcher links
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

/* --- Load CSVs --- */
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

    // Load factions with hex colors
    factionsParsed.data.forEach(row => {
      if (row.default_faction && row.hex) {
        const key = row.default_faction.trim().toLowerCase();
        FACTIONS[key] = {
          color: "#" + row.hex.trim().replace(/^#/, ""),
          label: (row.name || row.default_faction).trim()
        };
      }
    });

    // Load location default factions
    locationsParsed.data.forEach(row => {
      if (!row.Location) return;
      const name = row.Location.trim();
      if (row.default_faction) LOCATION_DEFAULT_FACTIONS[name] = row.default_faction.trim().toLowerCase();
      const suppliedColor = (row.hex || row.color || "").trim();
      if (/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(suppliedColor)) {
        locationColorMap[name] = suppliedColor.startsWith("#") ? suppliedColor : "#" + suppliedColor;
      }
    });

    // Load character order
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

/* --- Render timeline --- */
function renderTimeline(data) {
  data.forEach((step, stepIndex) => {
    // Skip separator rows (like "-" in step_id with no Book)
    if (!step.Book || step.Book.trim() === "") return;

    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    // Book/Movie label only at first step of each entry
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

      const sortedChars = [...chars].sort(
        (a, b) => (characterOrderMap[a] ?? 999) - (characterOrderMap[b] ?? 999)
      );

      const finalEntries = [];
      let charIndex = 0;
      rawEntries.forEach(e => {
        if (!e.trim()) {
          finalEntries.push("");
        } else {
          finalEntries.push(sortedChars[charIndex]);
          charIndex++;
        }
      });

      currentStepLocations[field] = { chars: [...chars].sort() };

      if (chars.length === 0) return;

      const prev = prevStepLocations[field] || { chars: [] };
      const charsChanged = prev.chars.join(",") !== chars.join(",");
      const isFirstAppearance = !prevStepLocations[field];
      if (!isFirstAppearance && !charsChanged) return;

      const box = document.createElement("div");
      box.className = "location-box";
      box.dataset.location = field;
      const locationTitle = document.createElement("div");
      locationTitle.className = "location-title";
      locationTitle.textContent = field;
      box.appendChild(locationTitle);

      const boxColor = getLocationColor(field);
      box.style.borderColor = boxColor;
      box.style.setProperty("--location-color", boxColor);
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
          ripDiv.innerHTML = `<span>RIP:</span>`;
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


/* --- Dynamic field guide for locations and characters in view --- */
function initializeDynamicLegend() {
  const legend = document.getElementById("timeline-legend");
  const locationsEl = document.getElementById("legend-locations");
  const charactersEl = document.getElementById("legend-characters");
  const countEl = document.getElementById("legend-count");
  if (!legend || !locationsEl || !charactersEl || !countEl) return;

  const isVisible = element => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 88 && rect.top < window.innerHeight;
  };

  const addLegendItem = (parent, label, detail, color, shape = "square") => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("i");
    swatch.className = "legend-swatch" + (shape === "hex" ? " legend-hex" : "");
    swatch.style.backgroundColor = color;
    const copy = document.createElement("span");
    copy.className = "legend-copy";
    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = label;
    copy.appendChild(name);
    if (detail) {
      const meta = document.createElement("small");
      meta.className = "legend-detail";
      meta.textContent = detail;
      copy.appendChild(meta);
    }
    item.append(swatch, copy);
    parent.appendChild(item);
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
      const heading = document.createElement("h3");
      heading.textContent = "Locations";
      locationsEl.appendChild(heading);
      locations.forEach(el => addLegendItem(locationsEl, el.dataset.location, "", el.dataset.locationColor));
    }

    charactersEl.replaceChildren();
    if (characters.length) {
      const heading = document.createElement("h3");
      heading.textContent = "Characters";
      charactersEl.appendChild(heading);
      characters.forEach(([code, el]) => {
        const factionKey = el.dataset.faction || "neutral";
        const factionLabel = FACTIONS[factionKey]?.label || (factionKey === "neutral" ? "No faction assigned" : factionKey);
        addLegendItem(
          charactersEl,
          el.dataset.characterName || CHARACTER_NAMES[code] || code,
          code + " · " + factionLabel,
          el.style.backgroundColor,
          "hex"
        );
      });
    }
  };

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateLegend();
    });
  };
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  if ("IntersectionObserver" in window) {
    legendObserver = new IntersectionObserver(scheduleUpdate, { rootMargin: "88px 0px 0px 0px" });
    document.querySelectorAll(".location-box, .location-box .hex:not(.rip)").forEach(el => legendObserver.observe(el));
  }
  updateLegend();
}
