"""
EzAudio text-to-audio wrapper.
Tencent AI Lab + Johns Hopkins, Interspeech 2025 — hyperrealistic sound effects.
24kHz output, purpose-built for text-to-audio generation.
"""

import os
import ssl
import sys
from pathlib import Path

import numpy as np
import torch

from .loader import device

# Enable MPS fallback for unsupported operations
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

# Fix SSL certificate issues on macOS
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass
ssl._create_default_https_context = ssl._create_unverified_context

# Add EzAudio repo to path
TOOL_DIR = Path(__file__).resolve().parent.parent
EZAUDIO_REPO = TOOL_DIR / "ezaudio_repo"
if str(EZAUDIO_REPO) not in sys.path:
    sys.path.insert(0, str(EZAUDIO_REPO))

_ezaudio = None
_available: bool | None = None


def is_available() -> bool:
    """Check if EzAudio can be imported."""
    global _available
    if _available is None:
        try:
            # Must be in ezaudio_repo dir for config paths to resolve
            if EZAUDIO_REPO.exists():
                _available = True
            else:
                _available = False
                print("[EzAudio] Repo not found. Clone with:")
                print(f"  cd {TOOL_DIR} && git clone https://github.com/haidog-yaqub/EzAudio.git ezaudio_repo")
        except Exception:
            _available = False
    return _available


def _load_model():
    """Lazy-load the EzAudio model."""
    global _ezaudio
    if _ezaudio is not None:
        return _ezaudio

    if not is_available():
        raise RuntimeError("EzAudio repo not found")

    # EzAudio resolves config/checkpoint paths relative to CWD
    original_cwd = os.getcwd()
    os.chdir(str(EZAUDIO_REPO))

    try:
        from api.ezaudio import EzAudio

        dev = device()
        # Use MPS if available, fall back to CPU
        dev_str = "mps" if dev.type == "mps" else ("cuda" if dev.type == "cuda" else "cpu")

        print(f"[EzAudio] Loading model s3_xl on {dev_str}...")
        _ezaudio = EzAudio(model_name="s3_xl", device=dev_str)
        print("[EzAudio] Model loaded successfully.")
    finally:
        os.chdir(original_cwd)

    return _ezaudio


def generate_audio(
    prompt: str,
    duration: float = 10.0,
    guidance_scale: float = 5.0,
    ddim_steps: int = 50,
    seed: int | None = None,
    negative_prompt: str = "",
) -> tuple[np.ndarray, int]:
    """Generate audio from a text prompt.

    Returns:
        (audio_array, sample_rate) — audio as float32 numpy array, shape (channels, samples)
    """
    model = _load_model()

    # EzAudio needs to run from its repo dir for internal path resolution
    original_cwd = os.getcwd()
    os.chdir(str(EZAUDIO_REPO))

    try:
        if seed is not None and seed >= 0:
            torch.manual_seed(seed)

        kwargs = {
            "guidance_scale": guidance_scale,
            "ddim_steps": ddim_steps,
        }
        if negative_prompt:
            kwargs["negative_prompt"] = negative_prompt

        sr, audio = model.generate_audio(prompt, **kwargs)

        # audio shape is (samples,) — normalize to (1, samples) for consistency
        if isinstance(audio, torch.Tensor):
            audio = audio.cpu().float().numpy()

        if audio.ndim == 1:
            audio = audio[np.newaxis, :]

        return audio, sr
    finally:
        os.chdir(original_cwd)


def generate_audio_simple(
    prompt: str,
    duration: float = 10.0,
    seed: int | None = None,
) -> tuple[np.ndarray, int]:
    """Simplified generation interface matching other wrappers."""
    return generate_audio(prompt, duration=duration, seed=seed)
