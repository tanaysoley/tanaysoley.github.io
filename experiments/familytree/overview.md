# FamilyTree

FamilyTree is a web app which is used to visualize family trees. The tool is just a visualizer and takes the family input from a config file, the url of which is passed as a URL parameter.

## Tree visualization

- The tree is visualized from left to right (left being earlier in time and right being later).
- The user shuold be able to pan and zoom in the tree.
- There is a timeline at the top of the vis (and at the bottom too)
- Each row represents one human. The card of that human is shown in the row. There is a horizontal line / ribbon which is shown behind the card of the person. The ribbon starts on the date of birth and ends on the date of death. The card is shown near the date of birth with some buffer on the left to see the ribbon.
- The cards of men are blue, women are pink and others are green
- Each card shows the name (in multiple scripts e.g. rman, devanagri etc), a picture (or a placeholder if a picture is not available), the date of birth and the date of death. It also has a notes section which is visible only if a note is added
- If 2 names are joined by a double line, that represents a marriage.
- If a double line is joined by a single line to another card, that represents a child of the marriage
- The lines are always horizontal or vertical, never any other angle
- There should be one horizontal line which then branches into multiple horizontal line using a vertical line to represent multiple children from a marriage
- Each marriage line shuold have an option to collapse/expand the family tree under it

## The config file

- The config should have a section to represent a single person, the person representation shuold contain
  - unique id, increasing integers
  - The name (multiple versions of it, name in different scripts, nick names, abbreviations etc)
  - date of birth
  - date of death (optional)
  - date of birth approximation flag (represents if the dob is approximate)
  - date of death approximation flag (represents if the dod is approximate)
  - url to a picture (optional)
  - notes
- The config file should have a section which represents marriages and children of marriage relationships

## Implementation notes

PHP + HTML + CSS + JS + File storage
