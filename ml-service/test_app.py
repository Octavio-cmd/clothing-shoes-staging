from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image

import app as service
from engine import CutoutResult


client = TestClient(service.app)


def sample_jpeg() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (8, 6), (245, 245, 245)).save(output, format="JPEG")
    return output.getvalue()


def sample_png() -> bytes:
    output = io.BytesIO()
    Image.new("RGBA", (8, 6), (245, 245, 245, 255)).save(output, format="PNG")
    return output.getvalue()


def test_health_does_not_force_model_download() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["engine"] == "PramaLLC/BEN2"


def test_remove_bg_returns_rgba_png_and_metadata(monkeypatch) -> None:
    captured = {}

    def fake_remove(source: bytes, refine_foreground: bool = False) -> CutoutResult:
        captured["source"] = source
        captured["refine"] = refine_foreground
        return CutoutResult(sample_png(), 8, 6)

    monkeypatch.setattr(service.engine, "remove", fake_remove)
    response = client.post(
        "/remove-bg?refine=true",
        files={"file": ("product.jpg", sample_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["x-savvy-engine"] == "PramaLLC/BEN2"
    assert response.headers["x-savvy-source-width"] == "8"
    assert response.headers["x-savvy-source-height"] == "6"
    assert captured["refine"] is True
    assert captured["source"]


def test_remove_bg_rejects_unsupported_media_type() -> None:
    response = client.post(
        "/remove-bg",
        files={"file": ("product.gif", b"GIF89a", "image/gif")},
    )
    assert response.status_code == 415


def test_remove_bg_rejects_empty_file() -> None:
    response = client.post(
        "/remove-bg",
        files={"file": ("product.png", b"", "image/png")},
    )
    assert response.status_code == 400

