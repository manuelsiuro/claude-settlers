"""
Device detection and model loading utilities.
Auto-detects MPS (Apple Silicon) or falls back to CPU.
"""

import os
import torch

# Enable MPS fallback for unsupported operations
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


def get_device() -> torch.device:
    """Auto-detect the best available device."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        return torch.device("mps")
    return torch.device("cpu")


def get_dtype(device: torch.device) -> torch.dtype:
    """Get the appropriate dtype for the device.
    MPS requires float32 for audio models (float16 produces NaN/garbage).
    """
    if device.type == "cuda":
        return torch.float16
    return torch.float32


# Cached singletons
_device: torch.device | None = None
_dtype: torch.dtype | None = None


def device() -> torch.device:
    global _device
    if _device is None:
        _device = get_device()
        print(f"[AudioGen] Using device: {_device}")
    return _device


def dtype() -> torch.dtype:
    global _dtype
    if _dtype is None:
        _dtype = get_dtype(device())
        print(f"[AudioGen] Using dtype: {_dtype}")
    return _dtype
