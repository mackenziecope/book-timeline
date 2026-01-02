const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";

const container = document.getElementById("timeline-map");
const svg = document.getElementById("flow-layer");

const NON_LOCATION_FIELDS = ["Book", "step_id", "Order", "Notes", "Dead"];

/* --- Factions (starter set) --- */
const FACTIONS = {
  terrasen: { color: "#4CAF50" },
  adarlan: { color: "#C62828" },
  neutral: { color: "#777" }
};

/* Optional: default faction per character */
const DEFAULT_FACTION = {
  // AL: "terrasen",
  // CHA: "adarlan"
};

/* Optional: step-specific overrides */
const FACTION_OVERRIDES = {
  // 42: { CHA: "terrasen" }
};

function getFaction(character, stepId) {
  return (
    FACTION_OVERRIDES[stepId]?.[character] ||
    DEFAULT_FACTION[character] ||
    "neutral"
  );
}

/* --- Data stores --- */
const characterHistory = {};      // { AL: [{ step, location, boxEl }] }
const renderedDeaths = new Set();

/* --- Load data --- */
document.addEventListener("DOMContentLoaded", () => {
  fetch(SHEET_CSV_URL)
    .then(res => res.text())
    .then(text => {
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
      });

      renderTimeline(parsed.data);
      drawHybridFlowLines();
    });
});

/* --- Render timeline --- */
function renderTimeline(data) {
  data.forEach((step, stepIndex) => {
    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    if (step.Book) {
      stepEl.innerHTML = `<div class="step-label">${step.Book}</div>`;
    }

    const row = document.createElement("div");
    row.className = "location-row";

    Object.entries(step).forEach(([field, value]) => {
      if (NON_LOCATION_FIELDS.includes(field)) return;
      if (!value) return;

      const chars = value.split(",").map(v => v.trim()).filter(Boolean);
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

        if (!characterHistory[code]) {
          characterHistory[code] = [];
        }

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
    container.appendChild(stepEl);
  });
}

/* --- Draw hybrid flow lines --- */
function drawHybridFlowLines() {
  svg.setAttribute("height", document.body.scrollHeight);

  const transitions = {};

  Object.entries(characterHistory).forEach(([code, entries]) => {
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];

      const key = `${prev.location}→${curr.location}|${i}`;

      if (!transitions[key]) {
        transitions[key] = {
          fromBox: prev.boxEl,
          toBox: curr.boxEl,
          count: 0,
          faction: getFaction(code, i)
        };
      }
      transitions[key].count++;
    }
  });

  Object.values(transitions).forEach(t => {
    drawCurve(
      t.fromBox,
      t.toBox,
      FACTIONS[t.faction].color,
      2 + t.count
    );
  });
}

/* --- SVG curve helper --- */
function drawCurve(fromEl, toEl, color, width) {
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
  path.setAttribute("opacity", "0.7");

  svg.appendChild(path);
}
