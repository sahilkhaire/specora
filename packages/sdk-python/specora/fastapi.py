"""Mount Specora docs on a FastAPI app (delegates to Node embed-core via subprocess or static stub)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse


def _read_spec(spec_path: str) -> dict[str, Any]:
    path = Path(spec_path)
    raw = path.read_text(encoding="utf-8")
    if raw.strip().startswith("{"):
        return json.loads(raw)
    import yaml  # type: ignore

    return yaml.safe_load(raw)


def mount_specora(app: FastAPI, spec_path: str, path: str = "/api-docs") -> None:
    """Register public docs routes on the given FastAPI application."""
    router = APIRouter()
    mount = path.rstrip("/")
    spec_file = spec_path

    @router.get(f"{mount}/openapi.json")
    async def openapi_json() -> JSONResponse:
        return JSONResponse(_read_spec(spec_file))

    @router.get(mount)
    @router.get(f"{mount}/")
    async def docs_ui(request: Request) -> HTMLResponse:
        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Specora Docs</title></head>
<body>
  <p>Specora Python mount is active. Install <code>@specora/node</code> for full CDN UI, or load embed bundle manually.</p>
  <p>Spec URL: <a href="{mount}/openapi.json">{mount}/openapi.json</a></p>
  <script>window.__SPECORA_EMBED__={{surface:"embed",specUrl:"{mount}/openapi.json",mountPath:"{mount}"}};</script>
</body></html>"""
        return HTMLResponse(html)

    app.include_router(router)
