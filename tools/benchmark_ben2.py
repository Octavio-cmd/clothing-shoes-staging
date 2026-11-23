#!/usr/bin/env python3
"""Run a reproducible BEN2 background-removal benchmark."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
from ben2 import AutoModel
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--refine", action="store_true")
    return parser.parse_args()


def composite(foreground: Image.Image, background: tuple[int, int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", foreground.size, background)
    return Image.alpha_composite(canvas, foreground).convert("RGB")


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(args.input).convert("RGB")

    started = time.perf_counter()
    model = AutoModel.from_pretrained("PramaLLC/BEN2").eval()
    loaded = time.perf_counter()
    foreground = model.inference(source, refine_foreground=args.refine)
    inferred = time.perf_counter()

    foreground.save(args.output_dir / "transparent.png")
    composite(foreground, (255, 255, 255, 255)).save(
        args.output_dir / "white.jpg", quality=95, subsampling=0
    )
    composite(foreground, (32, 32, 32, 255)).save(
        args.output_dir / "dark.jpg", quality=95, subsampling=0
    )
    alpha = foreground.getchannel("A")
    alpha.save(args.output_dir / "alpha.png")
    values = np.asarray(alpha, dtype=np.uint8)
    report = {
        "model": "PramaLLC/BEN2",
        "input": str(args.input),
        "original_size": list(source.size),
        "refine_foreground": args.refine,
        "load_seconds": round(loaded - started, 3),
        "inference_seconds": round(inferred - loaded, 3),
        "alpha": {
            "transparent_pixels": int(np.count_nonzero(values <= 5)),
            "opaque_pixels": int(np.count_nonzero(values >= 250)),
            "transition_pixels": int(np.count_nonzero((values > 5) & (values < 250))),
        },
    }
    (args.output_dir / "report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
