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
const LOCATION_COLORS = ["#dce9f2", "#e8dfef", "#dcece3", "#f2e5d5", "#f3dfe1", "#e4e8d4", "#dce8e8", "#eee2d2"];
const BADGE_COLORS = ["#355c7d", "#6c4f7d", "#39735b", "#a45c35", "#8a4b5e", "#65733d", "#35717a", "#765b3c"];
const locationColorMap = {};
const characterColorMap = {};
let legendObserver = null;
const characterOrderMap = {};
const firstStepPerBook = {};
let prevStepLocations = {};

function getFaction(character, stepId) {
  return (
    FACTION_OVERRIDES[stepId]?.[character] ||
    DEFAULT_FACTION[character] ||
    "neutral"
  );
}

function stableColor(value, palette) {
  const key = String(value || "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function getLocationColor(location) {
  if (!locationColorMap[location]) {
    locationColorMap[location] = stableColor(location, LOCATION_COLORS);
  }
  return locationColorMap[location];
}

function getCharacterColor(character) {
  if (!characterColorMap[character]) {
    characterColorMap[character] = stableColor(character, BADGE_COLORS);
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
  document.title = activeStory.title;
  const headingEl = document.getElementById("timeline-heading");
  if (headingEl) headingEl.textContent = activeStory.heading;

  const stylesheetEl = document.getElementById("story-stylesheet");
  if (stylesheetEl && activeStory.stylesheet) {
    stylesheetEl.href = activeStory.stylesheet;
  }

  // Render quick switcher links for all registered stories
  const navEl = document.getElementById("story-nav");
  if (navEl && Object.keys(STORIES).length > 1) {
    navEl.innerHTML = Object.entries(STORIES)
      .map(([key, cfg]) => {
        const activeClass = key === storyKey ? "active" : "";
        return `<a href="?story=${encodeURIComponent(key)}" class="${activeClass}" ${key === storyKey ? 'aria-current="page"' : ""}>${cfg.title}</a>`;
      })
      .join("");
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
        FACTIONS[row.default_faction.trim().toLowerCase()] = {
          color: "#" + row.hex.trim().replace(/^#/, "")
        };
      }
    });

    // Load location default factions
    locationsParsed.data.forEach(row => {
      if (!row.Location) return;
      const name = row.Location.trim();
      if (row.default_faction) LOCATION_DEFAULT_FACTIONS[name] = row.default_faction.trim().toLowerCase();
      const suppliedColor = (row.hex || row.color || "").trim();
      if (suppliedColor) {
        locationColorMap[name] = suppliedColor.startsWith("#") ? suppliedColor : "#" + suppliedColor;
      }
    });

    // Load character order
    characterParsed.data.forEach(row => {
      if (!row.code) return;
      characterOrderMap[row.code.trim()] = Number(row.order) || 999;
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
      box.innerHTML = `<div class="location-title">${field}</div>`;

      const boxColor = getLocationColor(field);
      box.style.borderColor = boxColor;
      box.style.backgroundColor = boxColor + "22";
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


/* --- Dynamic legend for the location boxes and character badges in view --- */
function initializeDynamicLegend() {
  const legend = document.getElementById("timeline-legend");
  const locationsEl = document.getElementById("legend-locations");
  const charactersEl = document.getElementById("legend-characters");
  const countEl = document.getElementById("legend-count");
  if (!legend || !locationsEl || !charactersEl || !countEl) return;

  const updateLegend = () => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 72 && rect.top < window.innerHeight;
    };
    const visibleBoxes = [...document.querySelectorAll(".location-box")].filter(visible);
    const visibleBadges = [...document.querySelectorAll(".location-box .hex:not(.rip)")].filter(visible);
    const locations = [...new Map(visibleBoxes.map(el => [el.dataset.location, el])).values()];
    const characters = [...new Map(visibleBadges.map(el => [el.dataset.character, el])).entries()];

    legend.hidden = locations.length === 0 && characters.length === 0;
    countEl.textContent = locations.length + " locations · " + characters.length + " characters";
    locationsEl.innerHTML = locations.length
      ? "<h3>Locations</h3>" + locations.map(el =>
          `<span class="legend-item"><i class="legend-swatch" style="background:${el.dataset.locationColor}"></i>${el.dataset.location}</span>`
        ).join("")
      : "";
    charactersEl.innerHTML = characters.length
      ? "<h3>Characters</h3>" + characters.map(([code, el]) =>
          `<span class="legend-item"><i class="legend-swatch legend-badge" style="background:${el.style.backgroundColor}"></i>${code}</span>`
        ).join("")
      : "";
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
    legendObserver = new IntersectionObserver(scheduleUpdate, { rootMargin: "72px 0px 0px 0px" });
    document.querySelectorAll(".location-box, .location-box .hex:not(.rip)").forEach(el => legendObserver.observe(el));
  }
  updateLegend();
}
