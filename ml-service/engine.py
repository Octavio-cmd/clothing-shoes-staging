"""BiRefNet HR matting engine used by the isolated Savvy BETA service."""

from __future__ import annotations

import io
import threading
from dataclasses import dataclass

import torch
from PIL import Image, ImageOps
from torchvision import transforms
from transformers import AutoModelForImageSegmentation


MODEL_ID = "ZhengPeng7/BiRefNet_HR-matting"
MODEL_REVISION = "5d6b6f8"
INFERENCE_SIZE = 1024


@dataclass(frozen=True)
class CutoutResult:
    png: bytes
    width: int
    height: int


class BackgroundEngine:
    """Loads one pinned model instance and serializes inference to cap memory."""

    def __init__(self, model_id: str = MODEL_ID) -> None:
        self.model_id = model_id
        self._model = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._preprocess = transforms.Compose(
            [
                transforms.Resize((INFERENCE_SIZE, INFERENCE_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def _get_model(self):
        if self._model is None:
            with self._load_lock:
                if self._model is None:
                    self._model = AutoModelForImageSegmentation.from_pretrained(
                        self.model_id,
                        revision=MODEL_REVISION,
                        trust_remote_code=True,
                    ).to(self._device).float().eval()
        return self._model

    def remove(self, source: bytes, refine_foreground: bool = False) -> CutoutResult:
        del refine_foreground  # Kept for API compatibility with the BEN2 BETA.
        with Image.open(io.BytesIO(source)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
        width, height = image.size

        tensor = self._preprocess(image).unsqueeze(0).to(
            device=self._device, dtype=torch.float32
        )
        with self._inference_lock, torch.inference_mode():
            prediction = self._get_model()(tensor)[-1].sigmoid().cpu()[0].squeeze()

        alpha = transforms.ToPILImage()(prediction).resize(
            (width, height), Image.Resampling.LANCZOS
        )
        foreground = image.convert("RGBA")
        foreground.putalpha(alpha)
        output = io.BytesIO()
        foreground.save(output, format="PNG", optimize=True)
        return CutoutResult(output.getvalue(), width, height)
