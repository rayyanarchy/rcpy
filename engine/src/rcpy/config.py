"""Settings, read from environment variables or a .env file (cwd or parent)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore", case_sensitive=False
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    strategy: str = "single"  # see rcpy.strategies.STRATEGIES
    max_audio_mb: float = 50
    demo_mode: bool = False

    # API / storage
    data_dir: str = "./data"
    evals_dir: str = "./evals"  # committed eval summaries and pricing.json
    database_url: str = ""  # Postgres (e.g. Neon). Empty = store recipes as JSON files.
    public_base_url: str = ""  # used to build share links; falls back to the request's host

    # CLI --share posts here
    share_url: str = "https://rcpy.vercel.app"


def get_settings() -> Settings:
    return Settings()
