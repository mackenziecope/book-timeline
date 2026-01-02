const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";

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

/* --- Load data --- */
document.addEventListener("DOMContentLoaded", () => {
  fetch(SHEET_CSV_URL)
    .then(res => res.text())
    .then(text => {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      renderTimeline(parsed.data);
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

    Object.entries(step).forEach(([field, value]) => {
      if (NON_LOCATION_FIELDS.includes(field)) return;

      const chars = value
        ? value.replace(/"/g, "").split(",").map(v => v.trim()).filter(Boolean)
        : [];

      const deadChars = step.Dead
        ? step.Dead.replace(/"/g, "").split(",").map(v => v.trim()).filter(Boolean)
        : [];

      const newDead = deadChars.filter(code => !renderedDeaths.has(code));
      const shouldRenderBox = chars.length > 0 || newDead.length > 0;
      if (!shouldRenderBox) return;

      const box = document.createElement("div");
      box.className = "location-box";
      box.dataset.location = field;
      box.innerHTML = `<div class="location-title">${field}</div>`;

      // Normal badges
      if (chars.length) {
        const badges = document.createElement("div");
        badges.className = "badges";

        chars.forEach(code => {
          const badge = document.createElement("div");
          badge.className = "hex";
          badge.textContent = code;
          badge.style.backgroundColor = FACTIONS[getFaction(code, stepIndex)].color;
          badges.appendChild(badge);
        });

        box.appendChild(badges);
      }

      // RIP badges
      if (newDead.length) {
        const ripDiv = document.createElement("div");
        ripDiv.className = "rip-line";
        ripDiv.innerHTML = `<span>RIP:</span>`;

        newDead.forEach(code => {
          const ripBadge = document.createElement("div");
          ripBadge.className = "hex rip";
          ripBadge.textContent = code;
          ripDiv.appendChild(ripBadge);
          renderedDeaths.add(code);
        });

        box.appendChild(ripDiv);
      }

      row.appendChild(box);
    });

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
