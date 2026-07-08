"""Test environment isolation.

Tests must be deterministic and free regardless of what the developer's
.env contains — force the fake embedder and the scripted evaluator BEFORE
app.settings is imported (env vars outrank the .env file in
pydantic-settings). Live-provider runs are a manual, deliberate act
(seed_demo.py), never a side effect of running pytest.
"""

import os

os.environ["EMBEDDINGS_PROVIDER"] = "fake"
os.environ["LLM_PROVIDER"] = "scripted"
