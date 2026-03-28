# Audio Generator Tool

A standalone Python/Gradio application for generating game sound effects and ambient audio using AI models running locally on your Mac. Generated audio is exported to `public/audio/` where the in-game spatial audio engine picks it up automatically.

---

## Prerequisites

- **Python 3.10+** (3.12 recommended)
- **macOS with Apple Silicon** (M1/M2/M3/M4) for GPU acceleration, or any OS with CPU fallback
- **~6 GB free disk space** for model downloads (cached after first run)
- **ffmpeg** (optional, for OGG conversion — falls back to pydub if unavailable)

Check your Python version:

```bash
python3 --version
```

Install ffmpeg (recommended):

```bash
brew install ffmpeg
```

---

## Installation

```bash
# Navigate to the tool directory
cd tools/audio-generator

# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Installing EzAudio (Primary Model)

EzAudio is the recommended model for sound effects (Tencent AI Lab, Interspeech 2025, hyperrealistic quality). Clone from GitHub:

```bash
cd tools/audio-generator
git clone https://github.com/haidog-yaqub/EzAudio.git ezaudio_repo
pip install -r ezaudio_repo/requirements.txt
```

Weights auto-download from HuggingFace (`OpenSound/EzAudio`) on first use.

### Model Downloads

Models are downloaded automatically on first use from Hugging Face. Expected sizes:

| Model | Hugging Face Repo | Download Size |
|-------|-------------------|---------------|
| EzAudio | `OpenSound/EzAudio` | ~500 MB |
| MusicGen Small | `facebook/musicgen-small` | ~1.2 GB |

You only need to install the model(s) you plan to use. EzAudio alone covers most sound effect needs.

---

## Quick Start

```bash
cd tools/audio-generator
source venv/bin/activate   # if using venv
python app.py
```

Opens the Gradio UI at **http://localhost:7860**.

---

## User Interface

The tool has 4 tabs:

### Tab 1: Catalog Browser

Browse the pre-filled catalog of ~100 game audio entries organized by category.

**Workflow:**
1. Select a sound from the dropdown (e.g., `buildings/sawmill_production`)
2. Review/edit the prompt, duration, model, and loop settings
3. Click **Generate** to create the audio
4. Listen to the preview
5. Click **Accept** to save, or **Reject** to discard and regenerate

**Batch generation:** Select a category prefix (buildings, units, ambient, etc.) and click **Batch Generate All Pending** to generate every pending entry in that category. Use the model override dropdown to force a specific model for the batch.

**Status badges:**
- `pending` — not yet generated
- `generated` — audio created, awaiting review
- `accepted` — approved for export
- `exported` — already exported to game

### Tab 2: Custom Generator

Generate audio from any text prompt, not limited to catalog entries.

**Workflow:**
1. Type a descriptive prompt (e.g., "medieval church bell ringing, stone cathedral echo")
2. Set duration, model, and number of variations (1-4)
3. Click **Generate**
4. Preview all variations
5. Optionally click **Add to Catalog** with a sound ID to save it

**Tips for good prompts:**
- Be specific about the sound source: "circular saw cutting timber" > "sawmill"
- Include texture/material: "hammer on iron anvil, sparks" > "hammering"
- Add ambience cues: "underground mine echo" helps models add reverb
- For loops, describe continuous sounds: "bubbling molten metal, forge bellows pumping"

### Tab 3: Audio Library

Table view of all entries showing sound ID, category, duration, model, status, and loop flag. Use this to track overall progress.

### Tab 4: Export

Export all accepted audio to the game.

**Workflow:**
1. Review the export preview (lists all accepted files by category)
2. Click **Export All Accepted**
3. Files are converted to OGG (Vorbis) and written to `public/audio/`
4. A `manifest.json` is generated with metadata for the game engine

---

## Audio Catalog

The catalog lives at `tools/audio-generator/data/audio_catalog.json`. It contains ~100 pre-filled entries organized into categories:

| Category | Count | Description |
|----------|-------|-------------|
| Building production | 38 | Sawmill, smelter, bakery, windmill, mines, etc. |
| Building ambient | 12 | Castle courtyard, tavern, market, stable, etc. |
| Unit work | 10 | Woodcutter, miner, farmer, builder, hunter, etc. |
| Unit combat | 4 | Knight, archer, cavalry, siege operator |
| Animals | 8 | Donkey, horse, deer, bees, goats, birds, etc. |
| Ambient environment | 12 | Wind, birds, water, crickets, forest, rain, snow |
| Music | 2 | Medieval day/night ambient music |
| SFX | 6 | Construction, demolish, coins, horns, fanfare |

### Catalog Entry Schema

```json
{
  "buildings/sawmill_production": {
    "prompt": "circular saw cutting timber, wood sawing in workshop",
    "duration": 4.0,
    "loop": true,
    "model": "ezaudio",
    "category": "building_production",
    "gameType": "sawmill",
    "gameTypeKind": "building",
    "status": "pending"
  }
}
```

Key fields:
- **prompt** — Text description for the AI model
- **duration** — Target length in seconds
- **loop** — Whether the sound should loop seamlessly (applies crossfade processing)
- **model** — Which AI model to use (`ezaudio` or `musicgen`)
- **gameType** — Must match the BuildingType or UnitType string in game code
- **gameTypeKind** — Either `"building"` or `"unit"` (used by the game engine to index sounds)
- **status** — Lifecycle state: `pending` / `generated` / `accepted` / `exported`

### Adding a New Sound

To add audio for a new building or unit:

1. Open `tools/audio-generator/data/audio_catalog.json`
2. Add a new entry with the correct `gameType` matching the game's BuildingType/UnitType value
3. Run the tool, generate, accept, and export
4. The game's `SpatialAudioEngine` auto-discovers it from `manifest.json` — **zero code changes needed**

Example — adding sound for a hypothetical "Glassblower" building:

```json
"buildings/glassblower_production": {
  "prompt": "glassblowing workshop, molten glass being blown, furnace crackling, glass shaping",
  "duration": 5.0,
  "loop": true,
  "model": "ezaudio",
  "category": "building_production",
  "gameType": "glassblower",
  "gameTypeKind": "building",
  "status": "pending"
}
```

---

## AI Models

### EzAudio (Recommended)

- **Best for:** Sound effects, game audio, hyperrealistic environmental sounds
- **Model:** `s3_xl` (Tencent AI Lab + Johns Hopkins, Interspeech 2025)
- **Speed:** ~5-15s for 10s clip on Apple Silicon MPS
- **Quality:** 24 kHz, approaches real recording quality
- **License:** MIT
- **Download:** ~500 MB (auto-downloaded on first use)
- **Memory:** ~4 GB GPU

Use for all building production sounds, unit work sounds, animal sounds, and most SFX. The `guidance_scale` parameter (default 5.0) controls text adherence — higher values produce sounds more closely matching the prompt.

### MusicGen Small (Ambient/Music)

- **Best for:** Background music loops, ambient melodies
- **Parameters:** 300M
- **Speed:** ~10s per clip (CPU-only on Mac)
- **Quality:** 32 kHz
- **License:** CC-BY-NC

Use for the `ambient/medieval_background` and `ambient/medieval_night` entries.

---

## Export Format

The export produces:

```
public/audio/
  manifest.json                    # Metadata for the game engine
  buildings/
    sawmill_production.ogg
    iron_smelter_production.ogg
    ...
  units/
    woodcutter_work.ogg
    miner_work.ogg
    ...
  ambient/
    wind_light.ogg
    birds_daytime.ogg
    ...
  animals/
    bees_buzzing.ogg
    ...
  sfx/
    victory_fanfare.ogg
    ...
```

### manifest.json

```json
{
  "version": 1,
  "files": {
    "buildings/sawmill_production": {
      "file": "buildings/sawmill_production.ogg",
      "duration": 4.0,
      "loop": true,
      "category": "building_production",
      "gameType": "sawmill",
      "gameTypeKind": "building"
    }
  }
}
```

The game's `SpatialAudioEngine` reads this manifest at startup and builds indexes by `gameType`. No TypeScript mapping files are needed.

---

## Audio Processing Pipeline

Generated audio goes through automatic processing before export:

1. **Trim silence** — removes leading/trailing silence below -40 dB
2. **Normalize** — peaks normalized to -3 dB
3. **Loop crossfade** (if `loop: true`) — 300ms crossfade between end and beginning for seamless looping
4. **Fade in/out** (if `loop: false`) — 30ms fade in, 30ms fade out for one-shot sounds
5. **OGG conversion** — WAV converted to OGG Vorbis (quality 5) for web delivery (~20-100 KB per file)

---

## In-Game Audio System

Once audio files are exported, the in-game spatial audio system handles everything automatically:

### How It Works

1. `SpatialAudioEngine` loads `manifest.json` at game start
2. Every ~10 frames, it scans buildings and units near the camera (15-hex range on desktop, 10 on mobile)
3. For each entity with a mapped sound in the manifest:
   - If the building is active and producing → starts the looping sound via a `PannerNode`
   - Volume follows quadratic distance falloff from the camera
   - At night, building volumes reduce by 25% (matching production slowdown)
4. `AmbientSoundscape` cross-fades environmental sounds based on time of day and weather
5. Sounds fade out when entities go out of range or the game is paused

### Performance

| Platform | Max Sources | Range | Panning Model |
|----------|-------------|-------|---------------|
| Desktop | 48 | 15 hex | HRTF (binaural) |
| Mobile | 24 | 10 hex | equalpower (simple) |

Memory: ~10-20 MB for 50 loaded sounds. Audio buffers are LRU-cached with a 50 MB ceiling.

### Settings

Two new volume sliders in the Settings menu:
- **Spatial Audio** — volume of positioned building/unit sounds (default 60%)
- **Ambient Audio** — volume of environmental soundscape (default 40%)

### Graceful Degradation

The game works identically with zero audio files. If `manifest.json` is missing or empty, the spatial audio engine becomes a no-op. Existing procedural SFX (building placed, combat clash, etc.) continue independently.

---

## Troubleshooting

### "EzAudio repo not found"
```bash
cd tools/audio-generator
git clone https://github.com/haidog-yaqub/EzAudio.git ezaudio_repo
pip install -r ezaudio_repo/requirements.txt
```

### Slow generation on Mac
- Ensure PyTorch has MPS support: `python -c "import torch; print(torch.backends.mps.is_available())"`
- If MPS is unavailable, the tool falls back to CPU (slower but works)
- For ambient music, use MusicGen (CPU-only but adequate for long loops)

### OGG conversion fails
```bash
brew install ffmpeg
```
If ffmpeg is unavailable, the tool falls back to pydub. If both fail, WAV files are copied directly (the game can play WAV too, just larger file sizes).

### No sound in game
1. Check `public/audio/manifest.json` exists and has entries
2. Check browser console for fetch errors
3. Ensure spatial audio volume slider is above 0%
4. Verify `AudioContext` is running: open browser console → `audioManager.getContext().state` should be `"running"`
5. Audio requires a user gesture (click/tap) before the browser allows playback

### Model download stuck
Models download from Hugging Face on first use. If the download stalls:
- Check internet connection
- Try setting `HF_HUB_OFFLINE=1` after models are cached
- Models cache in `~/.cache/huggingface/` — delete this folder to force re-download

---

## Directory Structure

```
tools/audio-generator/
  app.py                          # Gradio UI entry point
  requirements.txt                # Python dependencies
  models/
    __init__.py
    loader.py                     # Device detection (MPS/CPU), dtype selection
    ezaudio_wrapper.py            # EzAudio pipeline (sound effects)
    musicgen_wrapper.py           # MusicGen pipeline (ambient music)
  ezaudio_repo/                   # Cloned EzAudio repository (git-ignored)
  data/
    audio_catalog.json            # 100+ entries with prompts and metadata
  generated/                      # Working directory for raw WAVs
  accepted/                       # Accepted WAVs ready for export
  utils/
    __init__.py
    audio_processing.py           # Trim, normalize, fade, loop crossfade
    exporter.py                   # WAV→OGG conversion + manifest.json
```
