# Surang sprite themes

A theme is a folder here, `sprites/<theme>/`, with a `theme.json` and the PNGs it provides. Load it with
`/experiments/sur/?theme=<theme>`. Any file a theme leaves out is drawn in code (the built-in
`placeholder` look), so a theme can be filled in one sprite at a time.

```json
{
  "files": ["rock.png", "passage.png", "edge.png", "ball-idle.png"],
  "config": { "tile": 160, "edge": 12, "padTop": 0, "ballFill": 0.7 }
}
```

`config` is optional. Defaults are in `js/sprites.js`:

| Key | Meaning |
|---|---|
| `tile` | CSS px that one `rock` or `passage` tile covers on screen |
| `edge` | CSS px thickness of the wall trim (and the size the corners are drawn at) |
| `padTop` | Fraction of `pad.png`'s height that sits above the surface the ball rests on |
| `ballFill` | Fraction of the ball sprite's width the ball itself fills |
| `lane`, `laneLine`, `laneTarget`, `label`, `labelTarget`, `gutter`, `trail`, `fail` | CSS colours for the lanes, labels, trail and fail flash |

## Files

Exact pixel sizes don't matter; everything is scaled. The sizes below are what to ask an image
generator for (2× is fine).

| File | Size | Notes |
|---|---|---|
| `rock.png` | 512×512 | Seamless tile: the solid mass the tunnels are carved into |
| `passage.png` | 512×512 | Seamless tile: the back wall inside the tunnel. Darker than rock |
| `edge.png` | 512×48 | Wall trim, seamless left to right. **Rock is at the top, the open passage below; the bottom edge is the crisp one.** Code rotates it for floors and side walls |
| `corner-out.png` | 96×96 | Trim wrapping around a corner of the rock. The corner point is the image's **bottom-right** corner and the rock fills the image: the trim runs along the **bottom and right** edges |
| `corner-in.png` | 96×96 | The inside corner of a room. The corner point is the image's **bottom-right** corner, with open passage beyond it (down and to the right); the image is rock with the two trims meeting at that point |
| `ball-idle.png` | 256×256 | Ball at rest, centred, filling about 70% |
| `ball-sing.png` | 256×256 | Ball while you sing (brighter, glowing) |
| `ball-hit.png` | 256×256 | Ball after hitting a wall |
| `pad.png` | 384×96 | Ledge between tunnels. Its top edge is the surface the ball rests on (see `padTop`) |
| `exit.png` | 256×384 | Gateway at the end of the level, standing on the last pad |
| `spark.png` | 64×64 | One white spark particle (added with the "lighter" blend) |
| `bg-sky.png` | 1080×1920 | Portrait sky, scaled to cover the screen |
| `bg-far.png` | 2048×768 | Distant silhouettes, transparent above, seamless left to right |
| `bg-near.png` | 2048×512 | Nearer silhouettes, transparent above, seamless left to right |

All sprites are drawn in their canonical orientation above and rotated in code: trim and corners
by 90° steps, nothing else.
