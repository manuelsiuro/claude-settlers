"""
Export accepted audio files to the game's public/audio/ directory.
Converts WAV to OGG (Vorbis) and generates manifest.json.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf


# Project root relative to this file
TOOL_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = TOOL_DIR.parent.parent
EXPORT_DIR = PROJECT_ROOT / "public" / "audio"
ACCEPTED_DIR = TOOL_DIR / "accepted"


def wav_to_ogg(wav_path: Path, ogg_path: Path, quality: int = 5) -> bool:
    """Convert WAV to OGG using ffmpeg or pydub fallback.

    Args:
        wav_path: Path to input WAV file
        ogg_path: Path to output OGG file
        quality: OGG quality (0-10, default 5)

    Returns:
        True if conversion succeeded
    """
    ogg_path.parent.mkdir(parents=True, exist_ok=True)

    # Try ffmpeg first (best quality/speed)
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(wav_path),
                "-c:a", "libvorbis", "-q:a", str(quality),
                str(ogg_path),
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0:
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Fallback: pydub
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_wav(str(wav_path))
        audio.export(str(ogg_path), format="ogg", codec="libvorbis")
        return True
    except Exception as e:
        print(f"[Exporter] Failed to convert {wav_path}: {e}")

    # Last resort: copy as WAV (game can still play it)
    shutil.copy2(wav_path, ogg_path.with_suffix(".wav"))
    return False


def export_all(catalog: dict) -> dict:
    """Export all accepted audio to public/audio/ and generate manifest.json.

    Args:
        catalog: The audio_catalog dict with entries

    Returns:
        The generated manifest dict
    """
    entries = catalog.get("entries", {})
    manifest = {"version": 1, "files": {}}

    exported_count = 0

    for sound_id, entry in entries.items():
        if entry.get("status") != "accepted":
            continue

        # Source WAV in accepted/
        wav_path = ACCEPTED_DIR / f"{sound_id.replace('/', '_')}.wav"
        if not wav_path.exists():
            print(f"[Exporter] Skipping {sound_id}: WAV not found at {wav_path}")
            continue

        # Target OGG in public/audio/
        ogg_relative = f"{sound_id}.ogg"
        ogg_path = EXPORT_DIR / ogg_relative

        success = wav_to_ogg(wav_path, ogg_path)

        # Build manifest entry
        manifest_entry = {
            "file": ogg_relative if success else f"{sound_id}.wav",
            "duration": entry.get("duration", 5.0),
            "loop": entry.get("loop", False),
            "category": entry.get("category", "unknown"),
        }

        # Add game type mapping if present
        if "gameType" in entry:
            manifest_entry["gameType"] = entry["gameType"]
        if "gameTypeKind" in entry:
            manifest_entry["gameTypeKind"] = entry["gameTypeKind"]
        if "timeOfDay" in entry:
            manifest_entry["timeOfDay"] = entry["timeOfDay"]
        if "terrain" in entry:
            manifest_entry["terrain"] = entry["terrain"]

        manifest["files"][sound_id] = manifest_entry
        exported_count += 1

    # Write manifest
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = EXPORT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"[Exporter] Exported {exported_count} files to {EXPORT_DIR}")
    print(f"[Exporter] Manifest written to {manifest_path}")

    return manifest


def save_accepted_wav(
    sound_id: str,
    audio: np.ndarray,
    sr: int,
) -> Path:
    """Save an accepted audio file as WAV in the accepted/ directory.

    Args:
        sound_id: e.g. "buildings/sawmill_production"
        audio: Audio array (channels, samples) or (samples,)
        sr: Sample rate

    Returns:
        Path to saved WAV file
    """
    filename = f"{sound_id.replace('/', '_')}.wav"
    wav_path = ACCEPTED_DIR / filename
    wav_path.parent.mkdir(parents=True, exist_ok=True)

    # Ensure (samples, channels) for soundfile
    if audio.ndim == 2:
        audio = audio.T  # (channels, samples) -> (samples, channels)

    sf.write(str(wav_path), audio, sr)
    return wav_path
