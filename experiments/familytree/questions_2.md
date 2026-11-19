# FamilyTree: Questions (Round 2)

Thanks for the answers. Below is the updated plan, followed by the few questions still open. If a default in the plan is wrong, say so in the space under it; otherwise leave it blank.

## Updated plan (based on round 1)

- **A static page that runs entirely in the browser,** with no backend and no URL parameter, like vscode.dev. It's a single page at `experiments/familytree/index.html`.
- **Split screen.** A YAML editor on the left (with syntax highlighting and inline error messages) and the tree on the right, updating live as you type.
- **On first load, a sample tree is shown:** a couple with 4 children (2 boys, 2 girls). Each child has a spouse and 2 children of random gender. One spouse also has their own parents and a sibling, to show in-law handling.
- **Saving.** Edits are auto-saved in the browser, plus buttons for **Open .yaml file**, **Save .yaml file** and **Reset to sample**.
- **Export to PNG and PDF.** The export covers the whole tree (not just the visible area) and keeps the current collapsed/expanded state.
- **Libraries.** `js-yaml` (parser), CodeMirror (editor), `marked` + DOMPurify (Markdown notes), and a small export library. All are loaded from a CDN. Pan/zoom is my own code.
- **Desktop only** for now. Light theme only. Photos are round, with a generic silhouette when missing.

**Overrides:**

## Proposed YAML schema

```yaml
people:
  - id: 1
    gender: male # male | female | other
    names: # list; first entry is primary, all are shown
      - Ramesh Soley
      - रमेश सोले
      - Ramu
    birth: 1920-03-12 # YYYY, YYYY-MM or YYYY-MM-DD
    death: ~1995 # leading ~ means approximate; omit if living
    photo: https://... # optional (see Q2)
    notes: | # optional, Markdown
      Moved to **Pune** in 1950.

families:
  - parents: [1, 2] # 1 or 2 ids (1 = single known parent)
    status: married # married | divorced | separated
    children: [3, 4, 5]
    adopted: [6] # optional; drawn with a dashed line
```

Notes on the schema:

- **Approximate dates use a `~` prefix** (`~1920`) instead of a separate flag, which keeps things short. Birth is required (an approximate year is fine).
- **Multiple marriages are separate `families` entries** for the same person. Step-children then appear naturally under their own parent's other family.
- **Twins need nothing special.** They are siblings with the same birth date.
- **IDs can be any unique number or string.** Integers are not enforced.

**Feedback on schema:**

## Layout approach (for multiple marriages, in-laws, crossings)

- **Rows** are ordered depth-first from the oldest root couple. Each person is followed by their spouse(s), then their children in birth order.
- **Multiple marriages.** For a person P with spouses S1 and S2, the row order is `S1, P, S2`, so both spouses sit right next to P. The children of P+S1 and P+S2 follow below in that order. Lines are routed so the two children's lines don't cross each other.
- **In-laws.** A spouse who married in and has their own parents in the data gets their birth family (parents, siblings, and the siblings' descendants) placed as a block directly above them. The spouse stays at the edge of that block, next to their partner.
- **Marriages within the family** (e.g. cousins). A person still has exactly one row, so one extra connector will cross other lines there. I'll keep it to a single crossing and draw a small "hop" where lines cross so it stays readable.
- **Collapse/expand.** A toggle on each marriage line hides all descendants plus their spouses and in-law blocks, and shows "+N people".

**Feedback:** Sounds good, can you load the photos from local instead of a url?

---

## Open questions

**Q1. Card position.** You said spouses should be aligned vertically and only the ribbon needs to match the timeline. My reading:

- Spouses are on adjacent rows, and **both cards sit in the same column**, at the later of the two birth dates. That way neither card hides the start of the other's ribbon.
- The **double marriage line joins the two cards directly**, connecting card edge to card edge, with no marriage date needed.
- The children's line leaves the middle of the double line, runs right, and drops to each child's card. **Children's cards (and unmarried people's cards) sit at their own birth date.**
- If a child marries, their card shifts right to line up with their spouse when the spouse is younger.

Is that right? Or should cards be placed differently (e.g. one column per generation)?

**Answer:** Correct

**Q2. Photos.** Since everything is local, how will photos be supplied?

- (a) **URLs only.** Simple, but images from many sites won't appear in PNG/PDF exports because of browser security rules (CORS).
- (b) **Drag a photo onto a card** to attach it. The image is stored in the browser, and the YAML references it by person id. Exports always work, but the photos aren't inside the .yaml file.
- (c) **Both:** URLs, plus an option to embed photos (as base64) in the YAML on save, so one file carries everything. The file gets large.

**Answer:** C

**Q3. Deceased with unknown death date.** For someone you know has died but whose death date is unknown, is "give an approximate year (`~1990`)" OK, the same rule as for birth? Or do you want a `deceased: true` option, where the ribbon fades out instead of ending at a specific point?

**Answer:** approximate year works

**Q4. Divorce / separation visual.** Should a divorced couple's double line look different, e.g. dashed, or with a small break or slash through it? Anything in mind?

**Answer:** Keep it same for now

**Q5. Card contents with many names.** Since all names are shown, a person with 4–5 names gets a tall card. Is that OK, or should the card show at most about 3 names and put the rest under a "more" toggle?

**Answer:** That is okay
