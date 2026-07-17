from __future__ import annotations

import uvicorn

from .config import Settings
from .factory import create_app


def main() -> None:
    settings = Settings.from_env()
    uvicorn.run(
        create_app(settings),
        host=settings.bind_host,
        port=settings.bind_port,
        loop="asyncio",
        http="h11",
        ws="websockets",
        ws_max_size=16 * 1024,
        workers=1,
    )


if __name__ == "__main__":
    main()
