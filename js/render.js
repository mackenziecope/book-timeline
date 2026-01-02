const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv";
const container = document.getElementById("timeline-map");

/* 
  1. Fetch the Google Sheet
*/
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

    /* 
      2. Now that data exists, render it
    */
    renderTimeline(timelineData);
  });

/*
  3. ALL your old rendering logic lives here
*/
function renderTimeline(TIMELINE_DATA) {

  const knownDead = new Set();
  const lastSeenLocation = {};

  TIMELINE_DATA.forEach(step => {

    const stepEl = document.createElement("section");
    stepEl.className = "timeline-step";

    stepEl.innerHTML = `
      <div class="step-label">Step ${step.step_id}</div>
    `;

    const row = document.createElement("div");
    row.className = "location-row";

    const newlyDead = step.Dead
      ? step.Dead.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    newlyDead.forEach(d => knownDead.add(d));

    Object.entries(step).forEach(([location, value]) => {
      if (["step_id", "Dead"].includes(location)) return;
      if (!value) return;

      const characters = value.split(",").map(s => s.trim());
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
        badges.appendChild(hex);
      });

      loc.appendChild(badges);

      const ripHere = newlyDead.filter(d => lastSeenLocation[d] === location);

      if (ripHere.length) {
        const rip = document.createElement("div");
        rip.className = "rip";

        rip.innerHTML = `<div class="rip-label">RIP:</div>`;

        const ripBadges = document.createElement("div");
        ripBadges.className = "badges";

        ripHere.forEach(d => {
          const hex = document.createElement("div");
          hex.className = "hex";
          hex.textContent = d;
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
