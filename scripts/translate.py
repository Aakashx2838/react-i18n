#!/usr/bin/env python3
"""
intl translate <lang> [--mode soft|hard]

Translates English locale keys into the target language.
  soft (default): only new/changed keys since last migration
  hard:           retranslate every key
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from googletrans import Translator
except ImportError:
    print("ERROR: googletrans is not installed.")
    print("Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

LOCALES_DIR = Path(__file__).resolve().parent.parent / "src" / "intl" / "locales"
EN_JSON = LOCALES_DIR / "en" / "en.json"
MIGRATIONS_DIR = LOCALES_DIR / "migrations"

PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def load_json(filepath: Path) -> dict[str, str]:
    if not filepath.exists():
        return {}
    content = filepath.read_text("utf-8").strip()
    if not content:
        return {}
    return json.loads(content)


def save_json(filepath: Path, data: dict[str, str]) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", "utf-8")


def get_migration_path(lang: str) -> Path:
    return MIGRATIONS_DIR / f"{lang}.json"


def load_migration(lang: str) -> dict[str, str]:
    """Load the last-known English snapshot for this language."""
    path = get_migration_path(lang)
    return load_json(path)


def save_migration(lang: str, en_snapshot: dict[str, str]) -> None:
    """Save the current English keys as the migration snapshot for this language."""
    MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = get_migration_path(lang)
    save_json(path, en_snapshot)


def protect_placeholders(text: str) -> tuple[str, list[str]]:
    """Replace {{var}} with numbered tokens so Google Translate won't mangle them."""
    placeholders: list[str] = []

    def replacer(match: re.Match) -> str:
        placeholders.append(match.group(0))
        idx = len(placeholders) - 1
        return f"__PH{idx}__"

    protected = PLACEHOLDER_RE.sub(replacer, text)
    return protected, placeholders


def restore_placeholders(text: str, placeholders: list[str]) -> str:
    """Restore numbered tokens back to {{var}} placeholders."""
    for idx, ph in enumerate(placeholders):
        # Handle potential spacing/casing changes from translation
        pattern = re.compile(rf"__\s*PH\s*{idx}\s*__", re.IGNORECASE)
        text = pattern.sub(ph, text)
    return text


def translate_texts(
    translator: Translator, texts: list[str], dest: str
) -> list[str]:
    """Translate a list of texts, preserving {{var}} placeholders."""
    if not texts:
        return []

    translated = []
    for text in texts:
        protected, placeholders = protect_placeholders(text)
        result = translator.translate(protected, src="en", dest=dest)
        restored = restore_placeholders(result.text, placeholders)
        translated.append(restored)

    return translated


def get_keys_to_translate(
    en_data: dict[str, str],
    target_data: dict[str, str],
    last_snapshot: dict[str, str],
    mode: str,
) -> list[str]:
    """Determine which keys need translation."""
    if mode == "hard":
        return list(en_data.keys())

    keys: list[str] = []
    for key, value in en_data.items():
        # New key: not in target at all
        if key not in target_data:
            keys.append(key)
            continue

        # Changed key: English value differs from last migration snapshot
        if key in last_snapshot and last_snapshot[key] != value:
            keys.append(key)
            continue

        # Key exists in target but no migration history — treat as already translated
        # (skip it in soft mode)

    return keys


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="intl translate",
        description="Translate English locale keys into a target language.",
    )
    parser.add_argument("lang", help="Target language code (e.g., fr, es, de, ja)")
    parser.add_argument(
        "--mode",
        choices=["soft", "hard"],
        default="soft",
        help="soft (default): only new/changed keys. hard: retranslate all keys.",
    )
    args = parser.parse_args()

    lang: str = args.lang
    mode: str = args.mode

    if lang == "en":
        print("ERROR: Cannot translate English to English.")
        sys.exit(1)

    # Load source
    en_data = load_json(EN_JSON)
    if not en_data:
        print("ERROR: English locale file is empty or missing.")
        print(f"  Expected at: {EN_JSON}")
        sys.exit(1)

    # Load target
    target_dir = LOCALES_DIR / lang
    target_json = target_dir / f"{lang}.json"
    target_data = load_json(target_json)

    # Load migration snapshot
    last_snapshot = load_migration(lang)

    # Determine keys to translate
    keys_to_translate = get_keys_to_translate(en_data, target_data, last_snapshot, mode)

    if not keys_to_translate:
        print(f"Nothing to translate for '{lang}' (mode={mode}).")
        print(f"  Target file: {target_json}")
        sys.exit(0)

    print(f"Translating {len(keys_to_translate)} key(s) to '{lang}' (mode={mode})...")

    # Collect texts in order
    texts_to_translate = [en_data[key] for key in keys_to_translate]

    # Translate
    translator = Translator()
    translated_texts = translate_texts(translator, texts_to_translate, lang)

    # Merge into target
    for key, translated in zip(keys_to_translate, translated_texts):
        target_data[key] = translated

    # Remove keys no longer in English
    for key in list(target_data.keys()):
        if key not in en_data:
            del target_data[key]

    # Sort keys to match English file order
    sorted_target = {key: target_data[key] for key in en_data if key in target_data}
    save_json(target_json, sorted_target)

    # Save migration snapshot (English values at time of translation)
    save_migration(lang, en_data)

    print(f"Done! Translated {len(keys_to_translate)} key(s).")
    print(f"  Output: {target_json}")
    print(f"  Migration: {get_migration_path(lang)}")

    # Print summary
    for key, translated in zip(keys_to_translate, translated_texts):
        print(f"  {key}: {en_data[key]!r} -> {translated!r}")


if __name__ == "__main__":
    main()
