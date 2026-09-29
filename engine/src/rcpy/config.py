"""Settings, read from environment variables or a .env file (cwd or parent)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore", case_sensitive=False
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    max_audio_mb: float = 50
    demo_mode: bool = False


def get_settings() -> Settings:
    return Settings()
