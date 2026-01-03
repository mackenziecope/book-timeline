const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";
const CHARACTERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=1645073460&single=true&output=csv";

const container = document.getElementById("timeline-map");
const NON_LOCATION_FIELDS = ["Book", "step_id", "Order", "Notes", "Dead"];

/* --- Factions --- */
const FACTIONS = {
  terrasen: { color: "#4CAF50" },
  adarlan: { color: "#C62828" },
  neutral: { color: "#777" }
};
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
const firstStepPerBook = {};
let prevStepLocations = {};

/* --- Load data --- */
document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    fetch(SHEET_CSV_URL).then(res => res.text()),
    fetch(CHARACTERS_CSV_URL).then(res => res.text())
  ]).then(([timelineText, characterText]) => {
    const timelineParsed = Papa.parse(timelineText, { header: true, skipEmptyLines: true });
    const characterParsed = Papa.parse(characterText, { header: true, skipEmptyLines: true });

    // Build character ordering map
    characterParsed.data.forEach(row => {
      if (!row.code) return;
      characterOrderMap[row.code.trim()] = Number(row.order) || 999;
    });

    renderTimeline(timelineParsed.data);
  });
});

/* --- Render timeline --- */
function renderTimeline(data) {
  const lastLocationBoxMap = {};

  data.forEach((step, stepIndex) => {
    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    /* --- Book label --- */
    const bookNum = step.Book;
    if (bookNum !== "" && !firstStepPerBook[bookNum]) {
      const labelText = BOOK_LABELS[bookNum] || `Book ${bookNum}`;
      stepEl.innerHTML = `<div class="step-label">${labelText}</div>`;
      firstStepPerBook[bookNum] = true;
    }

    const row = document.createElement("div");
    row.className = "location-row";

    const currentStepLocations = {};

    /* --- Locations --- */
    Object.entries(step).forEach(([field, value]) => {
      if (NON_LOCATION_FIELDS.includes(field)) return;

      // Prepare raw entries, preserve empty spaces
      const rawEntries = value ? value.replace(/"/g, "").split(",") : [];
      const entriesTrimmed = rawEntries.map(v => v.trim());

      // Separate non-empty characters and sort by order
      const characters = entriesTrimmed
        .filter(v => v)
        .sort((a, b) => (characterOrderMap[a] ?? 999) - (characterOrderMap[b] ?? 999));

      // Rebuild sortedEntries with spacers intact
      const sortedEntries = [];
      let charIndex = 0;
      entriesTrimmed.forEach(entry => {
        if (!entry) {
          sortedEntries.push(""); // spacer
        } else {
          sortedEntries.push(characters[charIndex]);
          charIndex++;
        }
      });

      // Track current step for change detection
      const charsOnly = entriesTrimmed.filter(v => v);
      currentStepLocations[field] = { chars: [...charsOnly].sort() };

      // Skip rendering empty locations
      if (charsOnly.length === 0) return;

      // Compare with previous step
      const prev = prevStepLocations[field] || { chars: [] };
      const charsChanged = prev.chars.join(",") !== currentStepLocations[field].chars.join(",");

      if (!charsChanged && stepIndex !== 0) return; // only show if changed or first step

      // Render box
      const box = document.createElement("div");
      box.className = "location-box";
      box.dataset.location = field;
      box.innerHTML = `<div class="location-title">${field}</div>`;

      // Render badges
      const badges = document.createElement("div");
      badges.className = "badges";

      sortedEntries.forEach(code => {
        if (!code) {
          const spacer = document.createElement("div");
          spacer.className = "badge-spacer";
          badges.appendChild(spacer);
          return;
        }

        const badge = document.createElement("div");
        badge.className = "hex";
        badge.textContent = code;
        badge.style.backgroundColor = FACTIONS[getFaction(code, stepIndex)].color;
        badges.appendChild(badge);

        // Track last box for RIP
        lastLocationBoxMap[code] = box;
      });

      box.appendChild(badges);
      row.appendChild(box);
    });

    /* --- RIP badges --- */
    if (step.Dead && step.Dead.trim() !== "") {
      const deadChars = step.Dead.replace(/"/g, "").split(",").map(v => v.trim()).filter(Boolean);
      deadChars.forEach(code => {
        if (renderedDeaths.has(code)) return;

        const lastBox = lastLocationBoxMap[code];
        if (!lastBox) return;

        let ripDiv = lastBox.querySelector(".rip-line");
        if (!ripDiv) {
          ripDiv = document.createElement("div");
          ripDiv.className = "rip-line";
          ripDiv.innerHTML = `<span>RIP:</span>`;
          lastBox.appendChild(ripDiv);
        }

        const ripBadge = document.createElement("div");
        ripBadge.className = "hex rip";
        ripBadge.textContent = code;
        ripDiv.appendChild(ripBadge);

        renderedDeaths.add(code);
      });
    }

    prevStepLocations = currentStepLocations;

    stepEl.appendChild(row);

    /* --- Notes --- */
    if (step.Notes && step.Notes.trim() !== "") {
      const notesEl = document.createElement("div");
      notesEl.className = "step-notes";
      notesEl.textContent = step.Notes.trim();
      stepEl.appendChild(notesEl);
    }

    container.appendChild(stepEl);
  });
}
