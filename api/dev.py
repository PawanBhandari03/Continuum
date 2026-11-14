"""Run the API locally with no database, no AI key and no network: everything in memory, CampusKart preloaded.
Usage (any shell):  python dev.py            -> http://localhost:8000
                    python dev.py --ai        -> same, but uses Gemini from api/.env when available (falls back to rules)
Then run the web app with NEXT_PUBLIC_USE_MOCKS=false NEXT_PUBLIC_API_URL=http://localhost:8000."""
import os
import sys

import uvicorn

os.environ.setdefault("CONTINUUM_STORE", "memory")
if "--ai" not in sys.argv:
    os.environ.setdefault("LLM_MODE", "rules")
port = int(os.environ.get("PORT", "8000"))
uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)
