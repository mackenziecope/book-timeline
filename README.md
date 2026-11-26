# Story Atlas

Story Atlas is an interactive timeline viewer for exploring where characters appear throughout a story. Each story is configured in `js/stories.js` and uses published Google Sheets tabs as its data source.

## Projects and Google Sheets index

The spreadsheet IDs below identify the published Google Sheets used by each project. The GIDs identify the individual tabs.

| Project | Spreadsheet | Places (timeline) | Characters | Factions | Locations |
|---|---|---:|---:|---:|---:|
| Throne of Glass | [Published spreadsheet](https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4mIQNaRGqy8JbMyAHjDnQH-BbAry72Mtqrt3oxVvp8buPELwwgfHXlb7eBRHBOsAZ010z8Sl5Vd5/pub) | `0` | `1645073460` | `805785660` | `1557750733` |
| Pirates of the Caribbean | [Published spreadsheet](https://docs.google.com/spreadsheets/d/e/2PACX-1vRm2A7AjU24PenOMYQ6Zokr3qIsBqQjJFcbkvLfPX2Bm3Ir6GTcs9V6YgpQ0nG3btyKX3H4dIWkPK57/pub) | `0` | `1987949162` | `871614265` | `80064090` |

### What each tab contains

| Tab | Purpose |
|---|---|
| **Places** | Main timeline data. Each row represents a story step, and the place columns contain the character codes present at that point. |
| **Characters** | Character codes, display names, ordering, and faction assignments. |
| **Factions** | Faction names and colors used to style character and place information. |
| **Locations** | Place metadata, including display name, faction, and optional ordering/color information. |

## Adding or updating a project

1. Create or update the project's Google spreadsheet and publish the required tabs as CSV.
2. In `js/stories.js`, add or update the project entry in `STORIES`.
3. Set the published spreadsheet URL and the four tab GIDs in `buildSheetUrls()`'s `gids` object:
   - `places`: main timeline tab
   - `characters`: character metadata tab
   - `factions`: faction metadata tab
   - `locations`: location metadata tab
4. Add the project's title, heading, stylesheet, book labels, and any story-specific faction configuration.
5. Update the index above whenever a spreadsheet URL, tab, or GID changes.

The project key is used in the URL to select a non-default story. The default project is configured by `DEFAULT_STORY_KEY` in `js/stories.js`.

## Data loading

The app reads the published CSV tabs when a story is loaded. It does not run a periodic background refresh. Keep the spreadsheet tab names, column headers, and character codes consistent with the fields expected by `js/render.js`.

## Repository structure

- `index.html`: application shell and Field Guide interface.
- `js/stories.js`: story definitions, spreadsheet URLs/GIDs, labels, and story-specific configuration.
- `js/render.js`: CSV loading, timeline rendering, selection behavior, sorting, and Field Guide logic.
- `css/timeline.css`: shared application layout and components.
- `css/throne-of-glass.css`, `css/potc.css`: story-specific visual themes.
- `assets/`: logos and other image assets.
