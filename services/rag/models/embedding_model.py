import structlog
from typing import Optional, List
from config import settings

logger = structlog.get_logger(service="rag")

class EmbeddingModel:
    _instance: Optional["EmbeddingModel"] = None
    _model = None
    _loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def load(self) -> bool:
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model", model=settings.embedding_model)
            self._model = SentenceTransformer(settings.embedding_model)
            self._loaded = True
            logger.info("Embedding model loaded", dimension=settings.embedding_dimension)
            return True
        except Exception as e:
            logger.error("Failed to load embedding model", error=str(e))
            self._loaded = False
            return False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not self._loaded or self._model is None:
            raise RuntimeError("Embedding model not loaded")

        embeddings = self._model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def embed_single(self, text: str) -> List[float]:
        return self.embed([text])[0]

embedding_model = EmbeddingModel()
