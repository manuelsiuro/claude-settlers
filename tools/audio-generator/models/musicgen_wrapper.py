"""
MusicGen Small wrapper via HuggingFace transformers.
300M params, best for ambient music loops. CPU-based on Mac.
"""

import numpy as np
import torch

from .loader import device, dtype

_model = None
_processor = None


def _load_pipeline():
    """Lazy-load the MusicGen model and processor."""
    global _model, _processor
    if _model is not None:
        return _model, _processor

    from transformers import AutoProcessor, MusicgenForConditionalGeneration

    model_id = "facebook/musicgen-small"
    print(f"[MusicGen] Loading model {model_id}...")

    _processor = AutoProcessor.from_pretrained(model_id)
    _model = MusicgenForConditionalGeneration.from_pretrained(model_id)

    # MusicGen works best on CPU for Apple Silicon (no native MPS support)
    dev = device()
    if dev.type == "mps":
        # MusicGen doesn't have great MPS support, use CPU
        _model = _model.to("cpu")
    else:
        _model = _model.to(dev)

    print("[MusicGen] Model loaded.")
    return _model, _processor


def generate_audio(
    prompt: str,
    duration: float = 10.0,
    seed: int | None = None,
) -> tuple[np.ndarray, int]:
    """Generate music/ambient audio from a text prompt.

    Returns:
        (audio_array, sample_rate) — audio as float32 numpy array
    """
    model, processor = _load_pipeline()

    if seed is not None:
        torch.manual_seed(seed)

    inputs = processor(
        text=[prompt],
        padding=True,
        return_tensors="pt",
    )

    # Move inputs to same device as model
    model_device = next(model.parameters()).device
    inputs = {k: v.to(model_device) for k, v in inputs.items()}

    # Calculate max_new_tokens from duration
    # MusicGen generates at 50 tokens/sec for the codec
    sr = model.config.audio_encoder.sampling_rate  # Usually 32000
    tokens_per_second = 50
    max_tokens = int(duration * tokens_per_second)

    with torch.no_grad():
        audio_values = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
        )

    audio = audio_values[0, 0].cpu().float().numpy()  # (samples,)

    if audio.ndim == 1:
        audio = audio[np.newaxis, :]

    return audio, sr


def generate_audio_simple(
    prompt: str,
    duration: float = 10.0,
    seed: int | None = None,
) -> tuple[np.ndarray, int]:
    """Simplified generation interface."""
    return generate_audio(prompt, duration=duration, seed=seed)
