# FamilyTree: Feedback & Questions (Round 1)

## Feedback

1. **PHP won't run on GitHub Pages.** This repo is `tanaysoley.github.io`, which only serves static files. Since the app is a read-only visualizer that loads a config from a URL, plain HTML/CSS/JS is enough. PHP + file storage only makes sense if you want in-app editing that saves on a server you host somewhere else (see Q1).
2. **Gender is missing from the person schema**, but card colours depend on it. I'll add a `gender` field (`male` / `female` / `other`).
3. **The marriage section needs more fields.** To draw a marriage line at the right point on the timeline, I need a marriage date (plus an approximate flag), and an optional end date or reason (divorce/death).
4. **Approximate dates need a defined format.** Family data often only has a year ("1920"), a year and month, or a range ("1915–1925"). I'd suggest accepting `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, plus the `approx` flag. Approximate dates could be drawn as a faded or gradient edge on the ribbon.
5. **"Increasing integer IDs" is fragile if you edit by hand.** Inserting people later works fine, but merging two branches can cause ID collisions. Short string IDs (e.g. `"ramesh-1950"`) are easier to read in the relationships section. Integers are fine if you prefer them.
6. **Security.** Because the config URL comes from a query parameter, anyone can craft a link that loads arbitrary content. Notes and names must be rendered as text, not HTML, to avoid script injection. Markdown in notes is possible if it's sanitized.
7. **CORS.** The config URL must be served with CORS headers. GitHub raw files, Gists and files in this same repo work. Many other hosts (e.g. Google Drive links) don't. Images don't have this problem.
8. **Privacy.** A public site showing living people's full birth dates and photos is a privacy concern, so consider an option to hide details for living people.

### My reading of the layout (please correct me)

```
            1920        1940        1960        1980        2000      today
Person A    [card]=========================================|
                         ‖
Person B         [card]===‖====================================|
                         ‖
                         ╚════┬──────────────────────
                              │
Child 1                       ├─[card]=====================================>
                              │
Child 2                       └────────[card]==============================>
```

- The marriage is a **vertical double line** between the two spouses' rows, placed at the marriage date.
- The children's line leaves the marriage line as a **single horizontal line**. A vertical "bus" then branches to each child's row, entering at their birth date.
- Living people's ribbons extend to "today" (shown with an arrow or open end).

**Answer / corrections:**

To avoid privacy concerns lit this just be an editor, where the website only hosts an editor and the config is pasted into the editor to generate a visualization (which is downloadable as JPEG/PNG/PDF etc) the config can be saved locally and be edited to see live updates in the tree

---

## Questions

### Hosting & architecture

**Q1.** Is the app read-only (you edit the config file by hand), or do you want to add and edit people inside the app? This decides whether we need a backend at all.

**Answer:** Update, this should just be a visualizer where the data is provided after loading/stored locally, not hosted on the web just like the vscode.dev website

**Q2.** If a backend is needed, where would it run (shared PHP host, etc.)? If not, is pure static HTML/JS on GitHub Pages OK?

**Answer:** NBo backend is needed i believe with the recent update

**Q3.** Are third-party libraries OK (e.g. D3 for pan/zoom, loaded from a CDN), or should it be vanilla JS like your other experiments?

**Answer:** I will leave the implementationt to you, if you want 3rd party libs you can have them

**Q4.** What should the page show when there's no `?config=` parameter: a sample tree, an error, or an input box for pasting a URL?

**Answer:** The config should not be a url parameter, there should be an editor which shows a JSON/YAML config which can be edited. By default it should show a dummy family tree

**Q5.** Which config format: JSON (strict, no comments) or YAML (easier to hand-edit, supports comments, needs a parser library)?

**Answer:** YAML

### Data model

**Q6.** How many people do you expect in your tree: tens, hundreds, or thousands? This affects the choice between SVG/DOM and canvas rendering.

**Answer:** in the range of 100

**Q7.** Names in multiple scripts: should each name be tagged with its script/language (e.g. `{ "latn": "Tanay", "deva": "तनय" }`)? Which one is primary and shown largest? Should nicknames and abbreviations appear on the card or only in the notes/tooltip?

**Answer:** All names should be shown, the first one in the list should be considered primary. Should it be a list instead of a map

**Q8.** What if the date of birth is completely unknown, not just approximate? Should the date be estimated from parents/children, should the person go in a separate "undated" area, or is DOB required?

**Answer:** The config should contain an approximate year

**Q9.** Do you need to handle these cases? Please mark the ones that apply:

- [ ] Multiple marriages (remarriage after death/divorce)
- [ ] Divorce / separation
- [ ] A child with only one known parent
- [ ] Adopted / step children (drawn differently?)
- [ ] Marriages within the family (e.g. cousins). Here lines will have to cross or loop back, since each person has exactly one row.
- [ ] Twins

**Answer:** Yes to all

**Q10.** Should notes be plain text or Markdown (links, bold, etc.)? Long or short?

**Answer:** Markdown

### Layout

**Q11.** How should rows be ordered top to bottom? My proposal: depth-first, so each person is followed by their spouse(s), then their children in birth order, and so on recursively. Spouses who married in would sit next to their partner. Does that work?

**Answer:** Yes, just figure out how multiple marriages work here. And how you will you order to make sure that the lines do not overlap / cross (of the crossing is minimum)

**Q12.** Where do a married-in spouse's own parents and siblings go? Should they also be shown (making the tree a graph, not a single tree), or should the tree only follow one root ancestor's descendants?

**Answer:** Married in souse's own parents and sibilings should be handeled.

**Q13.** When zooming, should the cards scale with the zoom, or stay a fixed readable size while only the timeline stretches? A fixed-size card covers more years when zoomed out.

**Answer:** Card size stays fixed

**Q14.** When a marriage is collapsed, should it hide all descendants plus their spouses, with the rows below moving up to fill the gap? Should anything mark that it's collapsed (e.g. "+12 people")?

**Answer:** Yes. yes something like +12 people would be helpful

**Q15.** Should the timeline end at today, at the latest event, or at the latest event plus some padding?

**Answer:** End today

### Features & UX

**Q16.** Should it work well on mobile (pinch-zoom, touch pan), or is desktop the priority?

**Answer:** Only desktop is fine to begin with

**Q17.** Any of these extras wanted now or later?

- [ ] Search for a person and jump to them
- [ ] Deep link to a specific person (`?config=...&focus=12`)
- [ ] Click a card to open a detail panel (full notes, all names, larger photo)
- [ ] Highlight one person's ancestors/descendants
- [ ] Export as PNG/PDF for printing
- [ ] Dark mode

**Answer:** out of these only "Export as PNG/PDF for printing" is needed

**Q18.** Photo placeholder: a generic silhouette, initials, or something else? Should the photos be round or square?

**Answer:** generic silhouette, round

**Q19.** Should living people's details (DOB, photo) be hidden, or is that not a concern for you?

**Answer:** Since this is local only now, this is no more a concern

**Q20.** Can you share a small real (or realistic) sample of your data, about 3 generations? I'd use it to check the schema and layout against the real thing.

**Answer:** generate a sample tree with a couple having 4 cildren 2 boys and 2 girls and each of them having 2 children each (randomly boys and girls)

---

## Proposed config sketch (for reference, will update based on answers)

```json
{
  "people": [
    {
      "id": 1,
      "gender": "male",
      "names": {
        "primary": "Ramesh Soley",
        "deva": "रमेश सोले",
        "nick": ["Ramu"]
      },
      "birth": { "date": "1920", "approx": true },
      "death": { "date": "1995-03-12", "approx": false },
      "photo": "https://...",
      "notes": "Moved to Pune in 1950."
    }
  ],
  "marriages": [
    {
      "spouses": [1, 2],
      "date": { "date": "1945", "approx": true },
      "end": null,
      "children": [3, 4, 5]
    }
  ]
}
```

Marriage date should not be needed. Make sure that the spouses are aligned together vertically. Only the ribbon needs to match the timeline.
