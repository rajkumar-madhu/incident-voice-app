"""Entry point for Santhira Web Voice Interface.

Usage:
    python run_webvoice.py

Opens a browser-based voice interface at http://localhost:5000
"""

import uvicorn

from config import settings


def main() -> None:
    uvicorn.run(
        "webvoice.server:app",
        host="0.0.0.0",
        port=settings.webvoice_port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
