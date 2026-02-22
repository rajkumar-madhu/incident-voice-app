from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    port: int = 8003
    environment: str = "development"
    log_level: str = "info"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/voice_saas"

    # Embedding
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # Chunking
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Retrieval
    default_top_k: int = 5
    similarity_threshold: float = 0.3

    # Redis
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 300

    model_config = {"env_prefix": "", "case_sensitive": False}

settings = Settings()
