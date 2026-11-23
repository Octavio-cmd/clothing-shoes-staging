"""HTTP API for the isolated Savvy background-removal BETA service."""

from __future__ import annotations

import os
import time
import base64
import binascii

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image, UnidentifiedImageError

from engine import MODEL_REVISION, BackgroundEngine


MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 20 * 1024 * 1024))
MAX_PIXELS = int(os.environ.get("MAX_PIXELS", 40_000_000))
ALLOWED_ORIGINS = [
    item.strip()
    for item in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://octavio-cmd.github.io,https://savvy-photo-app-v2-beta-production.up.railway.app,http://localhost:3000",
    ).split(",")
    if item.strip()
]

Image.MAX_IMAGE_PIXELS = MAX_PIXELS
engine = BackgroundEngine()
app = FastAPI(title="Savvy Background Engine", version="3.0.0-beta")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    expose_headers=[
        "X-Savvy-Engine",
        "X-Savvy-Processing-Ms",
        "X-Savvy-Source-Width",
        "X-Savvy-Source-Height",
    ],
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "version": app.version,
        "engine": engine.model_id,
        "model_revision": MODEL_REVISION,
        "model_loaded": engine.loaded,
    }


@app.post("/remove-bg")
async def remove_background(
    request: Request,
    file: UploadFile | None = File(None),
    refine: bool = Query(False),
) -> Response:
    wants_json = file is None
    if file is not None:
        content_type = (file.content_type or "").lower()
        if content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(415, "Supported formats: JPEG, PNG, or WebP")
        source = await file.read(MAX_UPLOAD_BYTES + 1)
    else:
        try:
            payload = await request.json()
            encoded = payload.get("image", "")
            if not isinstance(encoded, str):
                raise ValueError
            if encoded.startswith("data:"):
                encoded = encoded.split(",", 1)[1]
            source = base64.b64decode(encoded, validate=True)
        except (ValueError, KeyError, binascii.Error, UnicodeError) as exc:
            raise HTTPException(400, "A valid base64 image is required") from exc

    if len(source) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image exceeds the upload limit")
    if not source:
        raise HTTPException(400, "Empty image")

    started = time.perf_counter()
    try:
        result = engine.remove(source, refine_foreground=refine)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(400, "Invalid or unsupported image") from exc

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    headers = {
            "Cache-Control": "no-store",
            "X-Savvy-Engine": engine.model_id,
            "X-Savvy-Processing-Ms": str(elapsed_ms),
            "X-Savvy-Source-Width": str(result.width),
            "X-Savvy-Source-Height": str(result.height),
        }
    if wants_json:
        return JSONResponse(
            {"success": True, "image": base64.b64encode(result.png).decode("ascii"), "mime": "image/png", "format": "png"},
            headers=headers,
        )
    return Response(content=result.png, media_type="image/png", headers=headers)

