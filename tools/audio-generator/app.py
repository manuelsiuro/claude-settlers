"""
Audio Generator Tool — Gradio UI for generating game sound effects.
Supports EzAudio (sound effects) and MusicGen (ambient music) models.

Run: python app.py
Opens Gradio on http://localhost:7860
"""

import json
import os
import random
import tempfile
import time
from pathlib import Path

import gradio as gr
import numpy as np
import soundfile as sf

from utils.audio_processing import process_for_export
from utils.exporter import ACCEPTED_DIR, EXPORT_DIR, export_all, save_accepted_wav

# Paths
TOOL_DIR = Path(__file__).resolve().parent
CATALOG_PATH = TOOL_DIR / "data" / "audio_catalog.json"
GENERATED_DIR = TOOL_DIR / "generated"
GENERATED_DIR.mkdir(exist_ok=True)
ACCEPTED_DIR.mkdir(exist_ok=True)

# Model state
_loaded_models: dict = {}


def load_catalog() -> dict:
    """Load the audio catalog from disk."""
    with open(CATALOG_PATH) as f:
        return json.load(f)


def save_catalog(catalog: dict):
    """Save the audio catalog to disk."""
    with open(CATALOG_PATH, "w") as f:
        json.dump(catalog, f, indent=2)


def get_model_wrapper(model_name: str):
    """Get or load a model wrapper by name."""
    if model_name in _loaded_models:
        return _loaded_models[model_name]

    if model_name == "ezaudio":
        from models.ezaudio_wrapper import generate_audio_simple, is_available
        if not is_available():
            return None
        _loaded_models[model_name] = generate_audio_simple
        return generate_audio_simple
    elif model_name == "musicgen":
        from models.musicgen_wrapper import generate_audio_simple
        _loaded_models[model_name] = generate_audio_simple
        return generate_audio_simple
    else:
        raise ValueError(f"Unknown model: {model_name}")


def generate_single(
    prompt: str,
    duration: float,
    model_name: str,
    seed: int | None = None,
) -> tuple[np.ndarray, int] | None:
    """Generate audio from a prompt using the specified model."""
    gen_fn = get_model_wrapper(model_name)
    if gen_fn is None:
        raise RuntimeError(f"Model {model_name} is not available. Install it first.")

    actual_seed = seed if seed and seed > 0 else random.randint(0, 2**31)
    audio, sr = gen_fn(prompt, duration=duration, seed=actual_seed)
    return audio, sr


def audio_to_wav_path(audio: np.ndarray, sr: int, name: str) -> str:
    """Save audio array to a temporary WAV file and return path."""
    # Ensure (samples, channels) for soundfile
    if audio.ndim == 2:
        write_audio = audio.T
    else:
        write_audio = audio

    path = GENERATED_DIR / f"{name}_{int(time.time())}.wav"
    sf.write(str(path), write_audio, sr)
    return str(path)


# ============================================================
# Tab 1: Catalog Browser
# ============================================================

def get_catalog_entries_by_category():
    """Get catalog entries grouped by category for display."""
    catalog = load_catalog()
    entries = catalog.get("entries", {})

    categories = {}
    for sound_id, entry in sorted(entries.items()):
        cat = sound_id.split("/")[0] if "/" in sound_id else "other"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append((sound_id, entry))

    return categories


def get_catalog_choices():
    """Get flat list of sound IDs for dropdown."""
    catalog = load_catalog()
    entries = catalog.get("entries", {})
    return sorted(entries.keys())


def get_entry_details(sound_id: str) -> tuple:
    """Get details of a catalog entry for display."""
    catalog = load_catalog()
    entry = catalog.get("entries", {}).get(sound_id, {})
    return (
        entry.get("prompt", ""),
        entry.get("duration", 5.0),
        entry.get("model", "mmaudio"),
        entry.get("loop", False),
        entry.get("status", "pending"),
        entry.get("category", "unknown"),
        entry.get("gameType", ""),
        entry.get("gameTypeKind", ""),
    )


def generate_catalog_entry(
    sound_id: str,
    prompt: str,
    duration: float,
    model_name: str,
    loop: bool,
    seed: int,
    progress=gr.Progress(),
):
    """Generate audio for a catalog entry."""
    if not sound_id:
        return None, "Select an entry first"

    progress(0.1, desc=f"Loading {model_name}...")

    try:
        audio, sr = generate_single(prompt, duration, model_name, seed if seed > 0 else None)
    except Exception as e:
        return None, f"Error: {e}"

    progress(0.8, desc="Processing...")

    # Process audio
    audio = process_for_export(audio, sr, loop=loop)

    # Save to generated/
    wav_path = audio_to_wav_path(audio, sr, sound_id.replace("/", "_"))

    # Update catalog status
    catalog = load_catalog()
    if sound_id in catalog["entries"]:
        catalog["entries"][sound_id]["status"] = "generated"
        catalog["entries"][sound_id]["prompt"] = prompt
        catalog["entries"][sound_id]["duration"] = duration
        catalog["entries"][sound_id]["model"] = model_name
        catalog["entries"][sound_id]["loop"] = loop
        catalog["entries"][sound_id]["_generated_path"] = wav_path
        save_catalog(catalog)

    progress(1.0, desc="Done!")
    return wav_path, f"Generated: {sound_id} ({duration}s, {model_name})"


def accept_catalog_entry(sound_id: str):
    """Accept a generated catalog entry."""
    catalog = load_catalog()
    entry = catalog.get("entries", {}).get(sound_id)
    if not entry:
        return "Entry not found"

    gen_path = entry.get("_generated_path")
    if not gen_path or not Path(gen_path).exists():
        return "No generated audio to accept. Generate first."

    # Read the generated audio
    audio, sr = sf.read(gen_path)
    if audio.ndim == 1:
        audio = audio[:, np.newaxis]
    audio = audio.T  # (channels, samples)

    # Save to accepted/
    save_accepted_wav(sound_id, audio, sr)

    # Update status
    catalog["entries"][sound_id]["status"] = "accepted"
    save_catalog(catalog)

    return f"Accepted: {sound_id}"


def reject_catalog_entry(sound_id: str):
    """Reject a generated catalog entry."""
    catalog = load_catalog()
    if sound_id in catalog.get("entries", {}):
        catalog["entries"][sound_id]["status"] = "pending"
        catalog["entries"][sound_id].pop("_generated_path", None)
        save_catalog(catalog)
    return f"Rejected: {sound_id} — ready for regeneration"


def get_catalog_summary():
    """Get summary statistics of the catalog."""
    catalog = load_catalog()
    entries = catalog.get("entries", {})

    total = len(entries)
    pending = sum(1 for e in entries.values() if e.get("status") == "pending")
    generated = sum(1 for e in entries.values() if e.get("status") == "generated")
    accepted = sum(1 for e in entries.values() if e.get("status") == "accepted")

    return f"Total: {total} | Pending: {pending} | Generated: {generated} | Accepted: {accepted}"


def batch_generate_category(
    category_prefix: str,
    model_override: str,
    progress=gr.Progress(),
):
    """Generate all pending entries in a category."""
    catalog = load_catalog()
    entries = catalog.get("entries", {})

    # Filter pending entries in category
    pending = [
        (sid, e) for sid, e in entries.items()
        if sid.startswith(category_prefix + "/") and e.get("status") == "pending"
    ]

    if not pending:
        return f"No pending entries in {category_prefix}/"

    results = []
    for i, (sound_id, entry) in enumerate(pending):
        progress((i + 1) / len(pending), desc=f"Generating {sound_id}...")

        model = model_override if model_override != "auto" else entry.get("model", "mmaudio")
        prompt = entry.get("prompt", "")
        duration = entry.get("duration", 5.0)
        loop = entry.get("loop", False)

        try:
            audio, sr = generate_single(prompt, duration, model)
            audio = process_for_export(audio, sr, loop=loop)
            wav_path = audio_to_wav_path(audio, sr, sound_id.replace("/", "_"))

            catalog["entries"][sound_id]["status"] = "generated"
            catalog["entries"][sound_id]["_generated_path"] = wav_path
            results.append(f"OK: {sound_id}")
        except Exception as e:
            results.append(f"FAIL: {sound_id} — {e}")

    save_catalog(catalog)
    return "\n".join(results)


# ============================================================
# Tab 2: Custom Generator
# ============================================================

def generate_custom(
    prompt: str,
    duration: float,
    model_name: str,
    num_variations: int,
    seed: int,
    progress=gr.Progress(),
):
    """Generate custom audio with multiple variations."""
    if not prompt.strip():
        return [], "Enter a prompt"

    results = []
    for i in range(num_variations):
        progress((i + 1) / num_variations, desc=f"Variation {i + 1}/{num_variations}...")

        var_seed = (seed + i) if seed > 0 else random.randint(0, 2**31)
        try:
            audio, sr = generate_single(prompt, duration, model_name, var_seed)
            audio = process_for_export(audio, sr, loop=False)
            wav_path = audio_to_wav_path(audio, sr, f"custom_{i}")
            results.append(wav_path)
        except Exception as e:
            results.append(None)

    msg = f"Generated {len([r for r in results if r])} of {num_variations} variations"
    return results, msg


def add_custom_to_catalog(
    sound_id: str,
    prompt: str,
    duration: float,
    model_name: str,
    loop: bool,
    category: str,
    game_type: str,
    game_type_kind: str,
):
    """Add a custom generation to the catalog."""
    if not sound_id.strip():
        return "Enter a sound ID (e.g., 'buildings/my_new_sound')"

    catalog = load_catalog()
    catalog["entries"][sound_id] = {
        "prompt": prompt,
        "duration": duration,
        "model": model_name,
        "loop": loop,
        "category": category,
        "status": "pending",
    }
    if game_type:
        catalog["entries"][sound_id]["gameType"] = game_type
    if game_type_kind:
        catalog["entries"][sound_id]["gameTypeKind"] = game_type_kind

    save_catalog(catalog)
    return f"Added to catalog: {sound_id}"


# ============================================================
# Tab 3: Audio Library
# ============================================================

def get_library_data():
    """Get library data for the table view."""
    catalog = load_catalog()
    entries = catalog.get("entries", {})

    rows = []
    for sound_id, entry in sorted(entries.items()):
        status = entry.get("status", "pending")
        rows.append([
            sound_id,
            entry.get("category", ""),
            f"{entry.get('duration', 0):.1f}s",
            entry.get("model", ""),
            status,
            "Yes" if entry.get("loop", False) else "No",
        ])

    return rows


# ============================================================
# Tab 4: Export
# ============================================================

def run_export():
    """Export all accepted audio to public/audio/."""
    catalog = load_catalog()
    manifest = export_all(catalog)

    # Update status to exported
    for sound_id in manifest.get("files", {}):
        if sound_id in catalog.get("entries", {}):
            catalog["entries"][sound_id]["status"] = "exported"
    save_catalog(catalog)

    n_files = len(manifest.get("files", {}))
    return f"Exported {n_files} files to {EXPORT_DIR}\nManifest: {EXPORT_DIR / 'manifest.json'}"


def get_export_preview():
    """Preview what will be exported."""
    catalog = load_catalog()
    entries = catalog.get("entries", {})

    accepted = [
        (sid, e) for sid, e in sorted(entries.items())
        if e.get("status") in ("accepted", "exported")
    ]

    if not accepted:
        return "No accepted audio to export. Generate and accept sounds first."

    lines = [f"**{len(accepted)} files ready for export:**\n"]
    current_cat = ""
    for sound_id, entry in accepted:
        cat = sound_id.split("/")[0] if "/" in sound_id else "other"
        if cat != current_cat:
            current_cat = cat
            lines.append(f"\n### {cat}/")
        lines.append(
            f"- `{sound_id}.ogg` ({entry.get('duration', 0):.1f}s, "
            f"{'loop' if entry.get('loop') else 'one-shot'})"
        )

    return "\n".join(lines)


# ============================================================
# Build Gradio UI
# ============================================================

def build_ui():
    """Build the Gradio interface."""

    with gr.Blocks(
        title="Feudal Audio Generator",
        theme=gr.themes.Soft(),
    ) as demo:

        gr.Markdown("# Feudal Realm Audio Generator")
        gr.Markdown("Generate sound effects and ambient audio for the game using AI models.")

        summary = gr.Markdown(get_catalog_summary)

        with gr.Tabs():
            # ----------------------------------------
            # Tab 1: Catalog Browser
            # ----------------------------------------
            with gr.Tab("Catalog Browser"):
                gr.Markdown("Browse and generate audio for all game sounds.")

                with gr.Row():
                    with gr.Column(scale=1):
                        catalog_dropdown = gr.Dropdown(
                            choices=get_catalog_choices(),
                            label="Sound Entry",
                            interactive=True,
                        )
                        refresh_btn = gr.Button("Refresh List", size="sm")

                    with gr.Column(scale=2):
                        cat_prompt = gr.Textbox(
                            label="Prompt",
                            lines=2,
                            interactive=True,
                        )
                        with gr.Row():
                            cat_duration = gr.Slider(
                                minimum=1.0, maximum=15.0, value=5.0, step=0.5,
                                label="Duration (seconds)",
                            )
                            cat_model = gr.Dropdown(
                                choices=["ezaudio", "musicgen"],
                                value="ezaudio",
                                label="Model",
                            )
                        with gr.Row():
                            cat_loop = gr.Checkbox(label="Loop", value=False)
                            cat_seed = gr.Number(
                                label="Seed (0=random)", value=0, precision=0,
                            )
                        with gr.Row():
                            cat_status = gr.Textbox(label="Status", interactive=False)
                            cat_category = gr.Textbox(label="Category", interactive=False)
                        with gr.Row():
                            cat_game_type = gr.Textbox(label="Game Type", interactive=False)
                            cat_game_kind = gr.Textbox(label="Type Kind", interactive=False)

                with gr.Row():
                    gen_btn = gr.Button("Generate", variant="primary")
                    accept_btn = gr.Button("Accept", variant="secondary")
                    reject_btn = gr.Button("Reject")

                cat_audio = gr.Audio(label="Generated Audio", type="filepath")
                cat_message = gr.Textbox(label="Status", interactive=False)

                gr.Markdown("### Batch Generate")
                with gr.Row():
                    batch_prefix = gr.Dropdown(
                        choices=["buildings", "units", "animals", "ambient", "sfx"],
                        label="Category",
                        value="buildings",
                    )
                    batch_model = gr.Dropdown(
                        choices=["auto", "ezaudio", "musicgen"],
                        value="auto",
                        label="Model Override",
                    )
                    batch_btn = gr.Button("Batch Generate All Pending", variant="primary")
                batch_output = gr.Textbox(label="Batch Results", lines=10, interactive=False)

                # Event handlers
                def on_select(sound_id):
                    if not sound_id:
                        return ("", 5.0, "mmaudio", False, "pending", "", "", "")
                    return get_entry_details(sound_id)

                catalog_dropdown.change(
                    on_select,
                    inputs=[catalog_dropdown],
                    outputs=[
                        cat_prompt, cat_duration, cat_model, cat_loop,
                        cat_status, cat_category, cat_game_type, cat_game_kind,
                    ],
                )

                refresh_btn.click(
                    lambda: gr.update(choices=get_catalog_choices()),
                    outputs=[catalog_dropdown],
                )

                gen_btn.click(
                    generate_catalog_entry,
                    inputs=[catalog_dropdown, cat_prompt, cat_duration, cat_model, cat_loop, cat_seed],
                    outputs=[cat_audio, cat_message],
                )

                accept_btn.click(
                    accept_catalog_entry,
                    inputs=[catalog_dropdown],
                    outputs=[cat_message],
                )

                reject_btn.click(
                    reject_catalog_entry,
                    inputs=[catalog_dropdown],
                    outputs=[cat_message],
                )

                batch_btn.click(
                    batch_generate_category,
                    inputs=[batch_prefix, batch_model],
                    outputs=[batch_output],
                )

            # ----------------------------------------
            # Tab 2: Custom Generator
            # ----------------------------------------
            with gr.Tab("Custom Generator"):
                gr.Markdown("Generate audio from any text prompt.")

                custom_prompt = gr.Textbox(
                    label="Prompt",
                    lines=3,
                    placeholder="Describe the sound you want to generate...",
                )
                with gr.Row():
                    custom_duration = gr.Slider(
                        minimum=1.0, maximum=15.0, value=5.0, step=0.5,
                        label="Duration (seconds)",
                    )
                    custom_model = gr.Dropdown(
                        choices=["ezaudio", "musicgen"],
                        value="ezaudio",
                        label="Model",
                    )
                with gr.Row():
                    custom_variations = gr.Slider(
                        minimum=1, maximum=4, value=1, step=1,
                        label="Number of Variations",
                    )
                    custom_seed = gr.Number(
                        label="Seed (0=random)", value=0, precision=0,
                    )

                custom_gen_btn = gr.Button("Generate", variant="primary")
                custom_audio_1 = gr.Audio(label="Variation 1", type="filepath")
                custom_audio_2 = gr.Audio(label="Variation 2", type="filepath", visible=False)
                custom_audio_3 = gr.Audio(label="Variation 3", type="filepath", visible=False)
                custom_audio_4 = gr.Audio(label="Variation 4", type="filepath", visible=False)
                custom_message = gr.Textbox(label="Status", interactive=False)

                gr.Markdown("### Add to Catalog")
                with gr.Row():
                    add_sound_id = gr.Textbox(
                        label="Sound ID",
                        placeholder="e.g., buildings/my_sound",
                    )
                    add_category = gr.Dropdown(
                        choices=[
                            "building_production", "building_ambient", "unit_work",
                            "unit_combat", "animal", "animal_wild", "environment",
                            "weather", "music", "sfx",
                        ],
                        label="Category",
                        value="sfx",
                    )
                with gr.Row():
                    add_game_type = gr.Textbox(label="Game Type (optional)")
                    add_game_kind = gr.Dropdown(
                        choices=["", "building", "unit"],
                        label="Game Type Kind",
                        value="",
                    )
                    add_loop = gr.Checkbox(label="Loop", value=False)
                add_btn = gr.Button("Add to Catalog")
                add_message = gr.Textbox(label="Status", interactive=False)

                def on_custom_generate(prompt, duration, model, variations, seed):
                    results, msg = generate_custom(prompt, duration, model, variations, seed)
                    # Pad results to 4
                    while len(results) < 4:
                        results.append(None)
                    return (
                        results[0], results[1], results[2], results[3],
                        gr.update(visible=True),
                        gr.update(visible=variations >= 2),
                        gr.update(visible=variations >= 3),
                        gr.update(visible=variations >= 4),
                        msg,
                    )

                custom_gen_btn.click(
                    on_custom_generate,
                    inputs=[custom_prompt, custom_duration, custom_model, custom_variations, custom_seed],
                    outputs=[
                        custom_audio_1, custom_audio_2, custom_audio_3, custom_audio_4,
                        custom_audio_1, custom_audio_2, custom_audio_3, custom_audio_4,
                        custom_message,
                    ],
                )

                add_btn.click(
                    add_custom_to_catalog,
                    inputs=[
                        add_sound_id, custom_prompt, custom_duration, custom_model,
                        add_loop, add_category, add_game_type, add_game_kind,
                    ],
                    outputs=[add_message],
                )

            # ----------------------------------------
            # Tab 3: Audio Library
            # ----------------------------------------
            with gr.Tab("Audio Library"):
                gr.Markdown("View and manage all generated audio files.")

                lib_refresh = gr.Button("Refresh", size="sm")
                lib_table = gr.Dataframe(
                    headers=["Sound ID", "Category", "Duration", "Model", "Status", "Loop"],
                    datatype=["str", "str", "str", "str", "str", "str"],
                    value=get_library_data,
                    interactive=False,
                )

                lib_refresh.click(get_library_data, outputs=[lib_table])

                gr.Markdown(get_catalog_summary)

            # ----------------------------------------
            # Tab 4: Export
            # ----------------------------------------
            with gr.Tab("Export"):
                gr.Markdown("Export accepted audio to the game's `public/audio/` directory.")
                gr.Markdown(f"**Export directory:** `{EXPORT_DIR}`")

                export_preview = gr.Markdown(get_export_preview)
                refresh_preview_btn = gr.Button("Refresh Preview", size="sm")
                export_btn = gr.Button("Export All Accepted", variant="primary", size="lg")
                export_result = gr.Textbox(label="Export Result", lines=3, interactive=False)

                refresh_preview_btn.click(get_export_preview, outputs=[export_preview])
                export_btn.click(run_export, outputs=[export_result])

    return demo


if __name__ == "__main__":
    demo = build_ui()
    demo.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
    )
