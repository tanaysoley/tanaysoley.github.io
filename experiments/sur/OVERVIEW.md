# SUR

Sur is a tool to check your pitch when you are singing. It offers 2 modes.

1. Listens to your voice and tells which note you are singing (or if you are not singing any note, it shows a scale of frequencies with all the notes there and where your voice lands on that). The marker for the frequency is green when very close to the actual note, red when very far and somewhere between red and green in between.

2. Notes pop up and you try to sing them as accurately as possible.

3. [will build later] notes pop up with a beat, making you sing a sing

Notes are in hindi (devanagri) Sa Re Ga Ma etc. komal swar are depicted by a line under them, teevra swars are depicted by a line over them. Higher and lower octaves are depicted by a superscript or subscript of 1,2 etc. our main octave is sub and super script 0 and therefore no sub or super script is displayed.

any questions?

## Decisions (from Q&A)

- **Sa** is picked by hand (note + octave). Default C#3 (Kali 1). No detection.
- **Swars to use**: all 12, a thaat, or a raag. The tuner snaps to the nearest allowed swar; a swar outside the set reads as off pitch.
- **Colour**: deep green on the swar, deep red halfway to the next semitone. The curve is 4th order (`1 / (1 + (d/d0)^4)`, normalised) with the steep drop at a configurable distance, default 10% of a semitone (10 cents).
- **Silence**: the pointer and the big swar grey out and blink.
- **No pitch history** for now.
- **Note buttons** for every swar sit at the bottom (with an octave switch), next to a tanpura on/off toggle and volume. The tanpura's first string is Pa, or shuddh Ma / Ni if the scale has no Pa.
- **Practice**: you pass a swar by holding it within the tolerance for the hold time (default 1s). At the end there's a session summary: hits, skips, time to hit, and average offset per swar (sharp/flat).
- **Practice patterns** walk the raag's aroha/avaroha: aroha–avaroha, alankars (pairs, groups of 3, groups of 4, skip one, step and return) and random swars. The current pattern is described on screen.
- **Octave digits** are Western (1, 2): subscript for lower, superscript for higher.
- **Letters**: Devanagari by default, with a toggle for Roman.
- Plain HTML/JS (ES modules), mobile friendly.

## Game tab: Sur Samraat (सुर सम्राट)

- 3D runner (three.js, loaded from a CDN when the tab is first played). The runner is a small crowned figure running over the sea at sunset.
- Each level is a song in sargam, relative to the player's Sa (`js/songs.js`). Tokens are `swar:beats`, plus `-:beats` for rests and `~:beats` for glides. How fast the bridges come is the song's tempo and beats.
  - **Swar** → a bridge at that swar's sideways position, as long as the note lasts. Your pitch moves the runner sideways.
  - **Rest** → a sandy island. Quiet zone: nothing happens there.
  - **Glide (meend)** → a diagonal bridge from one swar to the next.
  - **Change where the path doesn't matter** → a wide wooden deck with the two swars as opposite corners (the last moment of the first swar).
  - Off the bridge (a wrong swar, or silent) you are waist-deep in the water and health drains gradually (20/s). If health runs out, the song ends.
- **Bridge width = difficulty:** Easy ±40¢, Medium ±25¢, Hard ±12¢.
- Scoring: % of time on the bridge. Stars at 60/80/92% if the song is cleared. The best score is saved per song and difficulty, and the results list the swars to work on (sharp/flat).
- Levels: Meend warm-up (original, teaches glides), Twinkle Twinkle Little Star, Für Elise (opening; F becomes Sa so it sits between mandra Pa and Ni). All are public domain.
- Optional guide melody (headphones recommended, or the mic hears it), and a "Listen" button per song.
