from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    port: int = 8002
    environment: str = "development"
    log_level: str = "info"

    # TTS engines
    tts_indicf5_enabled: bool = False
    tts_indicf5_device: str = "cpu"
    tts_piper_enabled: bool = True
    tts_piper_model_path: str = "./models"

    # Redis
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 3600

    model_config = {"env_prefix": "", "case_sensitive": False}

settings = Settings()
