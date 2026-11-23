#!/usr/bin/env python3
"""Run a reproducible BiRefNet matting benchmark on one product photo."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageSegmentation


DEFAULT_MODEL = "ZhengPeng7/BiRefNet_HR-matting"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", type=int, default=2048)
    return parser.parse_args()


def composite(foreground: Image.Image, background: tuple[int, int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", foreground.size, background)
    return Image.alpha_composite(canvas, foreground).convert("RGB")


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.input).convert("RGB")
    original_size = source.size
    preprocess = transforms.Compose(
        [
            transforms.Resize((args.size, args.size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    started = time.perf_counter()
    model = AutoModelForImageSegmentation.from_pretrained(
        args.model,
        trust_remote_code=True,
    ).float().eval()
    loaded = time.perf_counter()

    with torch.inference_mode():
        prediction = model(preprocess(source).unsqueeze(0))[-1].sigmoid().cpu()[0].squeeze()
    inferred = time.perf_counter()

    alpha = transforms.ToPILImage()(prediction).resize(original_size, Image.Resampling.LANCZOS)
    rgba = source.convert("RGBA")
    rgba.putalpha(alpha)

    rgba.save(args.output_dir / "transparent.png")
    composite(rgba, (255, 255, 255, 255)).save(
        args.output_dir / "white.jpg", quality=95, subsampling=0
    )
    composite(rgba, (32, 32, 32, 255)).save(
        args.output_dir / "dark.jpg", quality=95, subsampling=0
    )
    alpha.save(args.output_dir / "alpha.png")

    alpha_values = np.asarray(alpha, dtype=np.uint8)
    report = {
        "model": args.model,
        "input": str(args.input),
        "original_size": list(original_size),
        "inference_size": [args.size, args.size],
        "load_seconds": round(loaded - started, 3),
        "inference_seconds": round(inferred - loaded, 3),
        "alpha": {
            "transparent_pixels": int(np.count_nonzero(alpha_values <= 5)),
            "opaque_pixels": int(np.count_nonzero(alpha_values >= 250)),
            "transition_pixels": int(np.count_nonzero((alpha_values > 5) & (alpha_values < 250))),
        },
    }
    (args.output_dir / "report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
