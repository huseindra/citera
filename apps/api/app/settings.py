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


settings = Settings()
