const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";

const container = document.getElementById("timeline-map");
const svg = document.getElementById("flow-layer");

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

/* --- Character tracking --- */
const characterHistory = {};
const renderedDeaths = new Set();

/* --- Book labels table --- */
const BOOK_LABELS = {
  0: "0 - Assassin's Blade",
  1: "1 - Throne of Glass",
  2: "2 - Crown of Midnight",
  3: "3 - Heir of Fire",
  4: "4 - Queen of Shadows",
  5.5: "5.5 - Empire of Storms / Tower of Dawn",
  7: "7 - Kingdom of Ash"
};

/* --- Keep track of first step per book --- */
const firstStepPerBook = {};

/* --- Load data --- */
document.addEventListener("DOMContentLoaded", () => {
  fetch(SHEET_CSV_URL)
    .then(res => res.text())
    .then(text => {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      renderTimeline(parsed.data);
      drawHybridFlowLines();
    });
});

/* --- Render timeline --- */
function renderTimeline(data) {
  data.forEach((step, stepIndex) => {
    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    // Book label logic
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
      if (!value || !value.trim()) return;

      // Robust splitting: remove quotes and extra spaces
      const chars = value
        .replace(/"/g, "")
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
      if (!chars.length) return;

      const box = document.createElement("div");
      box.className = "location-box";
      box.dataset.location = field;

      box.innerHTML = `<div class="location-title">${field}</div>`;

      const badges = document.createElement("div");
      badges.className = "badges";

      chars.forEach(code => {
        const badge = document.createElement("div");
        badge.className = "hex";
        badge.textContent = code;
        badges.appendChild(badge);

        if (!characterHistory[code]) characterHistory[code] = [];
        characterHistory[code].push({
          step: stepIndex,
          location: field,
          boxEl: box
        });
      });

      box.appendChild(badges);
      row.appendChild(box);
    });

    stepEl.appendChild(row);

    // Add Notes if present
    if (step.Notes && step.Notes.trim() !== "") {
      const notesEl = document.createElement("div");
      notesEl.className = "step-notes";
      notesEl.textContent = step.Notes.trim();
      stepEl.appendChild(notesEl);
    }

    container.appendChild(stepEl);
  });
}

/* --- Hybrid flow lines --- */
function drawHybridFlowLines() {
  svg.setAttribute("height", document.body.scrollHeight);

  Object.entries(characterHistory).forEach(([code, entries]) => {
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      const faction = getFaction(code, i);

      if (prev.location !== curr.location) {
        drawCurve(prev.boxEl, curr.boxEl, FACTIONS[faction].color, 2.5, 0.8);
      } else {
        // vertical continuation, faded
        drawVerticalLine(prev.boxEl, curr.boxEl, FACTIONS[faction].color, 1.2, 0.25);
      }
    }
  });
}

/* --- Movement curve --- */
function drawCurve(fromEl, toEl, color, width, opacity = 0.7) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const s = svg.getBoundingClientRect();

  const x1 = a.left + a.width / 2 - s.left;
  const y1 = a.bottom - s.top;
  const x2 = b.left + b.width / 2 - s.left;
  const y2 = b.top - s.top;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M ${x1} ${y1} C ${x1} ${y1 + 40}, ${x2} ${y2 - 40}, ${x2} ${y2}`
  );
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", width);
  path.setAttribute("fill", "none");
  path.setAttribute("opacity", opacity);

  svg.appendChild(path);
}

/* --- Vertical continuation --- */
function drawVerticalLine(fromEl, toEl, color, width, opacity = 0.25) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const s = svg.getBoundingClientRect();

  const x = a.left + a.width / 2 - s.left;
  const y1 = a.bottom - s.top;
  const y2 = b.top - s.top;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x} ${y1} L ${x} ${y2}`);
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", width);
  path.setAttribute("fill", "none");
  path.setAttribute("opacity", opacity);

  svg.appendChild(path);
}
