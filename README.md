# Voxta Sprite Studio

A small desktop app (Electron + SolidJS) that turns a plain character image into a
transparent WebM ready for Voxta's stage / visual-novel view.

The workflow (image generation and video generation happen elsewhere):

| Step | Input | Output | Engine |
|------|-------|--------|--------|
| 1. Remove Image BG | your character image | transparent PNG | InSPyReNet (`transparent-background`) |
| 2. Add Backdrop | transparent PNG | green/black PNG (feed to your video generator) | canvas composite |
| 3. Video → WebM | green/black video | transparent `.webm` | ffmpeg chroma/black key |

Each step's output carries into the next.

## Requirements

- **Node.js** (for the app itself)
- **Python** on PATH with `transparent-background` installed - Step 1 only
  ```bash
  pip install transparent-background
  ```
  If your Python isn't `python` on PATH, set `SPRITE_STUDIO_PYTHON` to its full path.
- **ffmpeg** on PATH - Step 3 only

## Run (development)

```bash
npm install
npm run electron:dev   # starts Vite + Electron together
```

## Build a portable .exe

```bash
npm run electron:build   # output in dist_electron/
```
