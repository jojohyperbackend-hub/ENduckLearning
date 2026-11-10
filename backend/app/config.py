import sys
from pathlib import Path

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE_PATH = Path(__file__).resolve().parent.parent / ".env.local"

REQUIRED_FIELDS = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENROUTER_API_KEY",
    "JWT_SECRET",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    OPENROUTER_API_KEY: str
    JWT_SECRET: str
    ENVIRONMENT: str = "development"

    @field_validator(*REQUIRED_FIELDS)
    @classmethod
    def validate_not_empty(cls, value: str, info: ValidationInfo) -> str:
        if value is None or value.strip() == "":
            raise ValueError(
                f"Variabel environment '{info.field_name}' wajib diisi di backend/.env.local, tidak boleh kosong"
            )
        return value


def _load_settings() -> Settings:
    try:
        return Settings()
    except Exception as exc:
        sys.stderr.write(
            "Server gagal nyala: konfigurasi environment tidak valid.\n"
            f"Pastikan semua variabel berikut sudah diisi di {ENV_FILE_PATH}: {', '.join(REQUIRED_FIELDS)}\n"
            f"Detail error: {exc}\n"
        )
        raise SystemExit(1) from exc


settings = _load_settings()
