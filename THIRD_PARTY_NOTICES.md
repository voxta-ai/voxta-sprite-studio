# Third-Party Notices

Voxta Sprite Studio is distributed under the MIT License (see `LICENSE`).
It bundles or downloads the following third-party components, each under its own
license.

## FFmpeg (bundled)

The Windows FFmpeg binary is bundled via the `ffmpeg-static` package. These builds
include GPL-licensed components (e.g. x264), so the **FFmpeg binary is licensed
under the GNU General Public License, version 3 (GPLv3)**.

- FFmpeg project & license: https://ffmpeg.org/legal.html
- FFmpeg source code: https://ffmpeg.org/download.html
- Binary provenance (`ffmpeg-static`): https://github.com/eugeneware/ffmpeg-static

In accordance with the GPL, the complete corresponding source code for FFmpeg is
available at the links above. FFmpeg is invoked as a separate executable; Voxta
Sprite Studio's own code remains under the MIT License.

## transparent-background / InSPyReNet (downloaded on first run)

Background removal uses the `transparent-background` package (InSPyReNet model),
installed into an isolated environment on first use.

- transparent-background: https://github.com/plemeri/transparent-background (MIT)
- InSPyReNet: https://github.com/plemeri/InSPyReNet (MIT)

## Python runtime (downloaded on first run)

- `uv` (Astral): https://github.com/astral-sh/uv (Apache-2.0 / MIT)
- python-build-standalone (CPython): https://github.com/astral-sh/python-build-standalone
- PyTorch: https://github.com/pytorch/pytorch (BSD-3-Clause)

## Application stack

- Electron: https://github.com/electron/electron (MIT)
- SolidJS: https://github.com/solidjs/solid (MIT)
- Bootstrap: https://github.com/twbs/bootstrap (MIT)
- lucide-solid: https://github.com/lucide-icons/lucide (ISC)
