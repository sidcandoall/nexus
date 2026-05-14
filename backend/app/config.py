from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        extra="ignore",
    )

    MONGODB_URL: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGODB_URI", "MONGODB_URL"),
    )
    DATABASE_NAME: str = Field(
        default="mind_mirror",
        validation_alias=AliasChoices("MONGODB_DATABASE", "DATABASE_NAME"),
    )
    MONGODB_REQUIRE_ATLAS: bool = Field(
        default=True,
        validation_alias=AliasChoices("MONGODB_REQUIRE_ATLAS"),
    )


settings = Settings()
