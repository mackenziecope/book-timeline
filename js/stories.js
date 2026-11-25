const STORIES = {
  "throne-of-glass": {
    title: "Throne of Glass Timeline",
    heading: "A Logistical Record of Throne of Glass",
    stylesheet: "css/throne-of-glass.css",
    sheets: {
      timeline:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=0&single=true&output=csv",
      characters:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=1645073460&single=true&output=csv",
      factions:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=805785660&single=true&output=csv",
      locations:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub?gid=1557750733&single=true&output=csv"
    },
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
  }
};

const DEFAULT_STORY_KEY = "throne-of-glass";

"potc": {
    title: "Pirates of the Caribbean Timeline",
    heading: "A Logistical Record of Pirates of the Caribbean",
    stylesheet: "css/potc.css",
    sheets: {
      timeline:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRm2A7AjU24PenOMYQ6Zokr3qIsBqQjJFcbkvLfPX2Bm3Ir6GTcs9V6YgpQ0nG3btyKX3H4dIWkPK57/pub?gid=0&single=true&output=csv",
      // Optional: update these gids once you add/format Characters, Factions, or Locations tabs
      characters: "",
      factions: "",
      locations: ""
    },
    bookLabels: {
      1: "1 - The Curse of the Black Pearl",
      2: "2 - Dead Man's Chest",
      3: "3 - At World's End"
    },
    defaultFactions: {},
    factionOverrides: {}
  }
