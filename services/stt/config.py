from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Server
    port: int = 8001
    environment: str = "development"
    log_level: str = "info"

    # Whisper
    stt_whisper_model: str = "large-v3"
    stt_whisper_device: str = "cpu"
    stt_whisper_compute_type: str = "int8"
    stt_whisper_beam_size: int = 5

    # Redis
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 3600

    model_config = {"env_prefix": "", "case_sensitive": False}

settings = Settings()
