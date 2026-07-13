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

## Requirements (end users)

Nothing to install - the app is self-contained:

- **ffmpeg** is bundled (static binary).
- **Background removal** provisions its own isolated Python environment on first
  use. On the first background removal, the app downloads `uv`, a standalone
  CPython, and `transparent-background` (InSPyReNet) into its data folder
  (`%APPDATA%/Voxta Sprite Studio/runtime`). This is a one-time, few-minute setup
  and needs an internet connection. Nothing touches the system Python.

## Run (development)

```bash
npm install
npm run electron:dev   # starts Vite + Electron together
```

To skip the first-run Python provisioning during development and reuse an existing
Python that already has `transparent-background` installed, set:

```bash
# PowerShell
$env:SPRITE_STUDIO_PYTHON = "C:\path\to\python.exe"
```

## Build a portable .exe

```bash
npm run electron:build   # output in dist_electron/
```
