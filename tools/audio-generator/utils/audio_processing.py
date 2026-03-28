"""
Audio processing utilities: trim, normalize, fade in/out, loop crossfade.
"""

import numpy as np


def normalize(audio: np.ndarray, target_db: float = -3.0) -> np.ndarray:
    """Normalize audio to a target peak dB level."""
    peak = np.max(np.abs(audio))
    if peak < 1e-8:
        return audio
    target_linear = 10 ** (target_db / 20.0)
    return audio * (target_linear / peak)


def trim_silence(
    audio: np.ndarray,
    sr: int,
    threshold_db: float = -40.0,
    min_silence_ms: int = 100,
) -> np.ndarray:
    """Trim leading and trailing silence from audio.
    Audio shape: (channels, samples) or (samples,).
    """
    mono = audio.mean(axis=0) if audio.ndim == 2 else audio
    threshold = 10 ** (threshold_db / 20.0)
    above = np.abs(mono) > threshold

    if not np.any(above):
        return audio

    # Find first and last non-silent sample
    indices = np.where(above)[0]
    start = max(0, indices[0] - int(sr * min_silence_ms / 1000))
    end = min(len(mono), indices[-1] + int(sr * min_silence_ms / 1000))

    if audio.ndim == 2:
        return audio[:, start:end]
    return audio[start:end]


def fade(
    audio: np.ndarray,
    sr: int,
    fade_in_ms: float = 50.0,
    fade_out_ms: float = 50.0,
) -> np.ndarray:
    """Apply fade in and fade out to audio.
    Audio shape: (channels, samples) or (samples,).
    """
    is_2d = audio.ndim == 2
    if not is_2d:
        audio = audio[np.newaxis, :]

    n_samples = audio.shape[1]
    fade_in_samples = int(sr * fade_in_ms / 1000)
    fade_out_samples = int(sr * fade_out_ms / 1000)

    result = audio.copy()

    if fade_in_samples > 0 and fade_in_samples < n_samples:
        fade_in_curve = np.linspace(0.0, 1.0, fade_in_samples)
        result[:, :fade_in_samples] *= fade_in_curve

    if fade_out_samples > 0 and fade_out_samples < n_samples:
        fade_out_curve = np.linspace(1.0, 0.0, fade_out_samples)
        result[:, -fade_out_samples:] *= fade_out_curve

    return result if is_2d else result[0]


def loop_crossfade(
    audio: np.ndarray,
    sr: int,
    crossfade_ms: float = 500.0,
) -> np.ndarray:
    """Create a seamless loop by crossfading the end into the beginning.
    Audio shape: (channels, samples) or (samples,).
    """
    is_2d = audio.ndim == 2
    if not is_2d:
        audio = audio[np.newaxis, :]

    n_samples = audio.shape[1]
    crossfade_samples = min(int(sr * crossfade_ms / 1000), n_samples // 4)

    if crossfade_samples < 2:
        return audio if is_2d else audio[0]

    # Extract crossfade regions
    end_region = audio[:, -crossfade_samples:]
    start_region = audio[:, :crossfade_samples]

    # Create crossfade curves
    fade_out = np.linspace(1.0, 0.0, crossfade_samples)
    fade_in = np.linspace(0.0, 1.0, crossfade_samples)

    # Blend
    blended = end_region * fade_out + start_region * fade_in

    # Build result: blended start + middle + trimmed end
    result = np.concatenate([
        blended,
        audio[:, crossfade_samples:-crossfade_samples],
    ], axis=1)

    return result if is_2d else result[0]


def process_for_export(
    audio: np.ndarray,
    sr: int,
    loop: bool = False,
    fade_in_ms: float = 30.0,
    fade_out_ms: float = 30.0,
    crossfade_ms: float = 300.0,
    target_db: float = -3.0,
) -> np.ndarray:
    """Full processing pipeline for export-ready audio."""
    audio = trim_silence(audio, sr)
    audio = normalize(audio, target_db)

    if loop:
        audio = loop_crossfade(audio, sr, crossfade_ms)
    else:
        audio = fade(audio, sr, fade_in_ms, fade_out_ms)

    return audio
