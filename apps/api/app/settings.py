from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://citera:citera@localhost:5433/citera"
    # Locked at table-creation time; changing it requires re-creating the
    # chunks table (acceptable pre-seed, see implementation-plan.md M0 risks).
    embedding_dim: int = 1024
    cors_origins: list[str] = ["http://localhost:5173"]

    anthropic_api_key: str = ""
    voyage_api_key: str = ""

    # Embedding provider is ALWAYS explicit — no probing, no hidden runtime
    # behavior. Startup fails fast when the configured provider is
    # unavailable. (EMBEDDINGS_PROVIDER accepted as a legacy alias.)
    embedding_provider: str = Field(
        default="fake",
        validation_alias=AliasChoices("EMBEDDING_PROVIDER", "EMBEDDINGS_PROVIDER"),
    )
    # Provider and model are deliberately separate concerns.
    embedding_model: str = ""
    # Overrides the provider's preset base URL (openai-compatible providers).
    embedding_base_url: str = ""
    embedding_api_key: str = ""

    # auto → claude when ANTHROPIC_API_KEY is present, else scripted demo
    llm_provider: str = "auto"
    claude_model: str = "claude-sonnet-5"


settings = Settings()
