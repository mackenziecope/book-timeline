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

const renderedBooks = new Set();
const renderedDeaths = new Set();

function renderTimeline(TIMELINE_DATA) {
  const knownDead = new Set();
  const lastSeenLocation = {};

  TIMELINE_DATA.forEach(step => {
    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    // Step label based on Book column
    let bookLabel = "";
    if (step.Book && !renderedBooks.has(step.Book)) {
      const bookNames = {
        "0": "Assassin's Blade",
        "1": "Throne of Glass",
        "2": "Crown of Midnight",
        "3": "Heir of Fire",
        "4": "Queen of Shadows",
        "5.5": "Empire of Storms / Tower of Dawn",
        "7": "Kingdom of Ash"
      };
      bookLabel = bookNames[step.Book] || step.Book;
      renderedBooks.add(step.Book);
    }
    stepEl.innerHTML = bookLabel ? `<div class="step-label">${bookLabel}</div>` : "";

    const row = document.createElement("div");
    row.className = "location-row";

    // Dead logic (only display RIP once per character)
    const allDeadInStep = step.Dead
      ? step.Dead.replace(/^"|"$/g, "").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const deathsToRender = allDeadInStep.filter(d => !renderedDeaths.has(d));
    deathsToRender.forEach(d => renderedDeaths.add(d));

    Object.entries(step).forEach(([location, value]) => {
      if (skipColumns.includes(location)) return;
      if (!value) return;

      const characters = value
        .replace(/^"|"$/g, "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

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
        hex.style.backgroundColor = getColorForCode(c);  // fallback
        hex.dataset.character = c;                        // dataset-specific CSS can target
        badges.appendChild(hex);
      });

      loc.appendChild(badges);

      // RIP badges (only once per death)
      const ripHere = deathsToRender.filter(d => lastSeenLocation[d] === location);
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
          hex.style.backgroundColor = "#6b6f8f";
          hex.dataset.character = d;
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
