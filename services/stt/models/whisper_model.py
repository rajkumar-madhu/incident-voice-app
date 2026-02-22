import structlog
from typing import Optional
from config import settings

logger = structlog.get_logger(service="stt")

class WhisperModel:
    _instance: Optional["WhisperModel"] = None
    _model = None
    _loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def load(self) -> bool:
        try:
            from faster_whisper import WhisperModel as FWModel

            logger.info(
                "Loading Whisper model",
                model=settings.stt_whisper_model,
                device=settings.stt_whisper_device,
                compute_type=settings.stt_whisper_compute_type,
            )

            self._model = FWModel(
                settings.stt_whisper_model,
                device=settings.stt_whisper_device,
                compute_type=settings.stt_whisper_compute_type,
            )
            self._loaded = True
            logger.info("Whisper model loaded successfully")
            return True
        except Exception as e:
            logger.error("Failed to load Whisper model", error=str(e))
            self._loaded = False
            return False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def transcribe(self, audio_path: str, language: Optional[str] = None):
        if not self._loaded or self._model is None:
            raise RuntimeError("Whisper model not loaded")

        kwargs = {"beam_size": settings.stt_whisper_beam_size}
        if language:
            kwargs["language"] = language

        segments, info = self._model.transcribe(audio_path, **kwargs)
        segments_list = list(segments)

        text = " ".join([s.text.strip() for s in segments_list])

        return {
            "text": text,
            "language": info.language,
            "confidence": round(info.language_probability, 4),
            "duration_seconds": round(info.duration, 2),
            "segments": [
                {
                    "start": round(s.start, 2),
                    "end": round(s.end, 2),
                    "text": s.text.strip(),
                    "confidence": round(s.avg_logprob, 4) if s.avg_logprob else None,
                }
                for s in segments_list
            ],
        }

whisper_model = WhisperModel()
