"""Configuration for Santhira Voice Agent (OpenAI-only mode)."""

import sys

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    openai_api_key: str

    # LinkedEye voice pipeline services
    stt_service_url: str = "http://localhost:8001"
    tts_service_url: str = "http://localhost:8002"
    rag_service_url: str = "http://localhost:8003"
    orchestrator_url: str = "http://localhost:4002"

    # ITSM
    itsm_api_url: str = "http://localhost:9000"
    itsm_api_key: str = ""
    default_tenant_id: str = "default"

    # OpenAI model config
    openai_chat_model: str = "gpt-4.1"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_tts_model: str = "tts-1"
    openai_tts_voice: str = "alloy"
    openai_stt_model: str = "whisper-1"

    # Webvoice
    webvoice_port: int = 5000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "env_file_override": True}


try:
    settings = Settings()
except Exception as e:
    print(f"Configuration error: {e}", file=sys.stderr)
    print("Create a .env file based on .env.example", file=sys.stderr)
    sys.exit(1)
