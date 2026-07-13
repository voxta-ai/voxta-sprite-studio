"""
One-shot background removal. Loads InSPyReNet via the transparent-background
package and writes a transparent RGBA PNG to the output path.

Protocol:
  Args:   --input <image> --output <png> [--mode base|fast] [--threshold <float>] [--jit true|false]
  Stdout: final line is JSON - {"ok": true} or {"error": ...}
  Stderr: free-form log output
  Exit:   0 success, non-zero failure
"""

import argparse
import json
import logging
import sys
import traceback

logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("voxta.background_removal")


def _parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="Path to the input image")
    p.add_argument("--output", required=True, help="Path to write the transparent PNG")
    p.add_argument("--mode", default="base", choices=["base", "fast"], help="InSPyReNet model variant")
    p.add_argument("--threshold", type=float, default=0.0, help="0 keeps soft alpha; >0 binarizes the mask")
    p.add_argument("--jit", default="false", help="Compile the remover with TorchScript JIT (true/false)")
    return p.parse_args()


def _emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")
    sys.stdout.flush()


def main():
    args = _parse_args()

    try:
        from PIL import Image
    except ImportError as exc:
        _emit({"error": f"Pillow is not installed: {exc}"})
        return 2

    try:
        from transparent_background import Remover
    except ImportError as exc:
        _emit({"error": f"transparent-background is not installed: {exc}"})
        return 2

    try:
        jit = str(args.jit).strip().lower() == "true"
        image = Image.open(args.input).convert("RGB")
        logger.info("Initializing background remover (InSPyReNet, mode=%s, jit=%s)...", args.mode, jit)
        remover = Remover(mode=args.mode, jit=jit)
        threshold = args.threshold if args.threshold > 0 else None
        result = remover.process(image, type="rgba", threshold=threshold)
        result.save(args.output, format="PNG")
        _emit({"ok": True})
        return 0
    except Exception as exc:
        logger.error("Background removal failed: %s", exc)
        logger.error(traceback.format_exc())
        _emit({"error": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
