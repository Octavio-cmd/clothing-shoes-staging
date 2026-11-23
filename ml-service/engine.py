"""BEN2 inference engine used by the Savvy background-removal service."""

from __future__ import annotations

import io
import threading
from dataclasses import dataclass

import torch
from ben2 import AutoModel
from PIL import Image, ImageOps


MODEL_ID = "PramaLLC/BEN2"
MODEL_REVISION = "e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f"


@dataclass(frozen=True)
class CutoutResult:
    png: bytes
    width: int
    height: int


class BackgroundEngine:
    """Loads one model instance and serializes inference to cap memory use."""

    def __init__(self, model_id: str = MODEL_ID) -> None:
        self.model_id = model_id
        self._model = None
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def _get_model(self):
        if self._model is None:
            with self._load_lock:
                if self._model is None:
                    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                    self._model = AutoModel.from_pretrained(
                        self.model_id,
                        revision=MODEL_REVISION,
                    ).to(device).eval()
        return self._model

    def remove(self, source: bytes, refine_foreground: bool = False) -> CutoutResult:
        with Image.open(io.BytesIO(source)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
        width, height = image.size

        with self._inference_lock:
            foreground = self._get_model().inference(
                image,
                refine_foreground=refine_foreground,
            )

        output = io.BytesIO()
        foreground.save(output, format="PNG", optimize=True)
        return CutoutResult(output.getvalue(), width, height)

