function buildSheetUrls(pubBaseUrl, gids) {
  const build = gid =>
    gid !== undefined && gid !== null && String(gid).trim() !== ""
      ? `${pubBaseUrl}?gid=${String(gid).trim()}&single=true&output=csv`
      : "";

  return {
    timeline: build(gids.places),
    characters: build(gids.characters),
    locations: build(gids.locations),
    factions: build(gids.factions)
  };
}

const STORIES = {
  "throne-of-glass": {
    title: "Throne of Glass Timeline",
    heading: "A Logistical Record of Throne of Glass",
    stylesheet: "css/throne-of-glass.css",
    map: {
      title: "Erilea",
      image: "assets/maps/erilea-map.png",
      attribution: "Temporary map image for development only. Replace with an appropriately licensed or permission-cleared map before public release.",
      locations: [
        { name: "Allsbrook", x: 67.5, y: 9.5 },
        { name: "Orynth", x: 76.5, y: 11.5 },
        { name: "Perranth", x: 71.5, y: 19.5 },
        { name: "Endovier", x: 62.5, y: 26.5 },
        { name: "Rifthold", x: 77.5, y: 35.5 },
        { name: "Anielle", x: 65.5, y: 34 },
        { name: "Doranelle", x: 65, y: 45 },
        { name: "Bellhaven", x: 81, y: 43 },
        { name: "Skull's Bay", x: 87, y: 48 },
        { name: "Calaculla", x: 74.5, y: 65 },
        { name: "Eyllwe", x: 78, y: 78 },
        { name: "Briarcliff", x: 38, y: 29 },
        { name: "Gulf of Oro", x: 42, y: 67 },
        { name: "Xandria", x: 36.5, y: 84 },
        { name: "Noll", x: 17, y: 83 }
      ]
    },
    sheets: buildSheetUrls(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub",
      { places: 0, characters: 1645073460, factions: 805785660, locations: 1557750733 }
    ),
    bookLabels: {
      0: "0 - Assassin's Blade",
      1: "1 - Throne of Glass",
      2: "2 - Crown of Midnight",
      3: "3 - Heir of Fire",
      4: "4 - Queen of Shadows",
      5.5: "5.5 - Empire of Storms / Tower of Dawn",
      7: "7 - Kingdom of Ash"
    },
    defaultFactions: {},
    factionOverrides: {}
  },

  "potc": {
    title: "Pirates of the Caribbean Timeline",
    heading: "A Logistical Record of Pirates of the Caribbean",
    stylesheet: "css/potc.css",
    sheets: buildSheetUrls(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRm2A7AjU24PenOMYQ6Zokr3qIsBqQjJFcbkvLfPX2Bm3Ir6GTcs9V6YgpQ0nG3btyKX3H4dIWkPK57/pub",
      { places: 0, characters: 1987949162, locations: 80064090, factions: 871614265 }
    ),
    bookLabels: {
      1: "1 - The Curse of the Black Pearl",
      2: "2 - Dead Man's Chest",
      3: "3 - At World's End"
    },
    defaultFactions: {},
    factionOverrides: {}
  }
};

const DEFAULT_STORY_KEY = "throne-of-glass";