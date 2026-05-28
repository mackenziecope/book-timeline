const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";
const CHARACTERS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=1645073460&single=true&output=csv";
const FACTIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=805785660&single=true&output=csv";
const LOCATIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=1557750733&single=true&output=csv";

const container = document.getElementById("timeline-map");
const NON_LOCATION_FIELDS = ["Book", "step_id", "Order", "Notes", "Dead"];

/* --- Factions --- */
let FACTIONS = {};
let LOCATION_DEFAULT_FACTIONS = {};

const DEFAULT_FACTION = {};
const FACTION_OVERRIDES = {};
function getFaction(character, stepId) {
  return (
    FACTION_OVERRIDES[stepId]?.[character] ||
    DEFAULT_FACTION[character] ||
    "neutral"
  );
}

/* --- Track RIP badges --- */
const renderedDeaths = new Set();

/* --- Character ordering --- */
const characterOrderMap = {};

/* --- Book labels --- */
const BOOK_LABELS = {
  0: "0 - Assassin's Blade",
  1: "1 - Throne of Glass",
  2: "2 - Crown of Midnight",
  3: "3 - Heir of Fire",
  4: "4 - Queen of Shadows",
  5.5: "5.5 - Empire of Storms / Tower of Dawn",
  7: "7 - Kingdom of Ash"
};

/* --- Track first step per book --- */
const firstStepPerBook = {};

/* --- Track previous step's location content --- */
let prevStepLocations = {};

/* --- Load CSVs --- */
document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    fetch(SHEET_CSV_URL).then(res => res.text()),
    fetch(CHARACTERS_CSV_URL).then(res => res.text()),
    fetch(FACTIONS_CSV_URL).then(res => res.text()),
    fetch(LOCATIONS_CSV_URL).then(res => res.text())
  ]).then(([timelineText, characterText, factionsText, locationsText]) => {
    const timelineParsed = Papa.parse(timelineText, { header: true, skipEmptyLines: true });
    const characterParsed = Papa.parse(characterText, { header: true, skipEmptyLines: true });
    const factionsParsed = Papa.parse(factionsText, { header: true, skipEmptyLines: true });
    const locationsParsed = Papa.parse(locationsText, { header: true, skipEmptyLines: true });

    // Load factions with hex colors
    factionsParsed.data.forEach(row => {
      if (row.default_faction && row.hex) {
        FACTIONS[row.default_faction.trim().toLowerCase()] = {
          color: "#" + row.hex.trim()
        };
      }
    });

    // Load location default factions
    locationsParsed.data.forEach(row => {
      if (row.Location && row.default_faction) {
        LOCATION_DEFAULT_FACTIONS[row.Location.trim()] = row.default_faction.trim().toLowerCase();
      }
    });

    // Load character order
    characterParsed.data.forEach(row => {
      if (!row.code) return;
      characterOrderMap[row.code.trim()] = Number(row.order) || 999;
    });

    renderTimeline(timelineParsed.data);
  });
});

/* --- Render timeline --- */
function renderTimeline(data) {
  data.forEach((step, stepIndex) => {
    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    // Book label only at first step of each book
    const bookNum = step.Book;
    if (bookNum !== "" && !firstStepPerBook[bookNum]) {
      const labelText = BOOK_LABELS[bookNum] || `Book ${bookNum}`;
      stepEl.innerHTML = `<div class="step-label">${labelText}</div>`;
      firstStepPerBook[bookNum] = true;
    }

    const row = document.createElement("div");
    row.className = "location-row";

    const currentStepLocations = {};

    Object.entries(step).forEach(([field, value]) => {
      if (NON_LOCATION_FIELDS.includes(field)) return;

      // Raw entries including blank spaces
      const rawEntries = value ? value.replace(/"/g, "").split(",") : [];
      const chars = rawEntries.map(v => v.trim()).filter(Boolean);

      // Sort characters using characterOrderMap
      const sortedChars = [...chars].sort(
        (a, b) => (characterOrderMap[a] ?? 999) - (characterOrderMap[b] ?? 999)
      );

      // Merge sorted characters with blanks to preserve spacing
      const finalEntries = [];
      let charIndex = 0;
      rawEntries.forEach(e => {
        if (!e.trim()) {
          finalEntries.push(""); // blank spacer
        } else {
          finalEntries.push(sortedChars[charIndex]);
          charIndex++;
        }
      });

      // Track current step
      currentStepLocations[field] = { chars: [...chars].sort() };

      // Skip empty box
      if (chars.length === 0) return;

      const prev = prevStepLocations[field] || { chars: [] };
      const charsChanged = prev.chars.join(",") !== chars.join(",");
      const isFirstAppearance = !prevStepLocations[field];
      if (!isFirstAppearance && !charsChanged) return;

      // --- Render location box ---
      const box = document.createElement("div");
      box.className = "location-box";
      box.dataset.location = field;
      box.innerHTML = `<div class="location-title">${field}</div>`;

      // Get location's default faction for box color
      const locationFaction = LOCATION_DEFAULT_FACTIONS[field] || "neutral";
      const boxColor = FACTIONS[locationFaction]?.color || "#999";
      box.style.borderColor = boxColor;

      // --- Normal badges ---
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
          badge.style.backgroundColor = FACTIONS[factionKey]?.color || "#999";
          badges.appendChild(badge);
        });
        box.appendChild(badges);
      }

      // --- RIP badges in the same box ---
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

    // Notes field
    if (step.Notes && step.Notes.trim() !== "") {
      const notesEl = document.createElement("div");
      notesEl.className = "step-notes";
      notesEl.textContent = step.Notes.trim();
      stepEl.appendChild(notesEl);
    }

    container.appendChild(stepEl);
  });
}
