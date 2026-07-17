from __future__ import annotations

import os
from pathlib import Path

import uvicorn

from .campaign import CampaignCatalog
from .config import Settings
from .factory import create_app


def _catalog_from_env() -> CampaignCatalog | None:
    manifest_value = os.getenv("CAOS_VTT_CAMPAIGN_MANIFEST", "").strip()
    root_value = os.getenv("CAOS_VTT_CAMPAIGN_ROOT", "").strip()
    if bool(manifest_value) != bool(root_value):
        raise RuntimeError(
            "CAOS_VTT_CAMPAIGN_MANIFEST e CAOS_VTT_CAMPAIGN_ROOT precisam ser definidos juntos"
        )
    if not manifest_value:
        return None
    return CampaignCatalog.load(
        Path(manifest_value),
        {"mnemosyne": Path(root_value)},
    )


def main() -> None:
    settings = Settings.from_env()
    catalog = _catalog_from_env()
    uvicorn.run(
        create_app(settings, catalog=catalog),
        host=settings.bind_host,
        port=settings.bind_port,
        loop="asyncio",
        http="h11",
        ws="auto",
        ws_max_size=16 * 1024,
        workers=1,
    )


if __name__ == "__main__":
    main()
