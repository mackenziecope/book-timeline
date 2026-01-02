const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";
const container = document.getElementById("timeline-map");

const skipColumns = ["step_id", "Dead", "Book", "Order", "Notes"];
const codeColors = {};
const colorPalette = [
  "#FF6B6B","#4ECDC4","#FFD93D","#6A4C93",
  "#FFA500","#00CED1","#FF69B4","#32CD32"
];
let colorIndex = 0;

function getColorForCode(code) {
  if (!codeColors[code]) {
    codeColors[code] = colorPalette[colorIndex % colorPalette.length];
    colorIndex++;
  }
  return codeColors[code];
}

/* Ensure DOM exists before running */
document.addEventListener("DOMContentLoaded", () => {

  fetch(SHEET_CSV_URL)
    .then(res => res.text())
    .then(text => {
      const rows = text.trim().split("\n");
      const headers = rows.shift().split(",");

      const timelineData = rows.map(row => {
        const values = row.split(",");
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] ? values[i].trim() : "";
        });
        return obj;
      });

      renderTimeline(timelineData);
    })
    .catch(err => console.error("Failed to load timeline data:", err));
});

function renderTimeline(TIMELINE_DATA) {
  const knownDead = new Set();
  const lastSeenLocation = {};

  TIMELINE_DATA.forEach(step => {

    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";
    stepEl.innerHTML = `<div class="step-label">Step ${step.step_id}</div>`;

    const row = document.createElement("div");
    row.className = "location-row";

    const newlyDead = step.Dead
      ? step.Dead.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    newlyDead.forEach(d => knownDead.add(d));

    Object.entries(step).forEach(([location, value]) => {
      if (skipColumns.includes(location)) return;
      if (!value) return;

      const characters = value.split(",").map(s => s.trim()).filter(Boolean);
      characters.forEach(c => lastSeenLocation[c] = location);

      const living = characters.filter(c => !knownDead.has(c));
      if (living.length === 0) return;

      const loc = document.createElement("div");
      loc.className = "location-box";
      loc.innerHTML = `<div class="location-title">${location}</div>`;

      const badges = document.createElement("div");
      badges.className = "badges";

      living.forEach(c => {
        const hex = document.createElement("div");
        hex.className = "hex";
        hex.textContent = c;
        hex.style.backgroundColor = getColorForCode(c);
        badges.appendChild(hex);
      });

      loc.appendChild(badges);

      const ripHere = newlyDead.filter(d => lastSeenLocation[d] === location);
      if (ripHere.length > 0) {
        const rip = document.createElement("div");
        rip.className = "rip";
        rip.innerHTML = `<div class="rip-label">RIP:</div>`;
        const ripBadges = document.createElement("div");
        ripBadges.className = "badges";

        ripHere.forEach(d => {
          const hex = document.createElement("div");
          hex.className = "hex";
          hex.textContent = d;
          hex.style.backgroundColor = "#6b6f8f"; // gray
          ripBadges.appendChild(hex);
        });

        rip.appendChild(ripBadges);
        loc.appendChild(rip);
      }

      row.appendChild(loc);
    });

    stepEl.appendChild(row);
    container.appendChild(stepEl);
  });
}
