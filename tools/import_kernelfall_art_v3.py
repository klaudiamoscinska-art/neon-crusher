#!/usr/bin/env python3
"""Import KERNELFALL V3 visual assets, validating the exact archive before writing PNG files.
Usage: python tools/import_kernelfall_art_v3.py /path/to/KERNELFALL_ART_V3_REPO.zip
No dependencies beyond Python 3 stdlib. Does NOT modify game.js, main, or deployment.
"""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
import hashlib, json, shutil, sys

EXPECTED_ZIP_SHA256 = "77b263f53de0bc3754c607e91c24d32fa2793cabd8bf8cf1c7e46c1c65ca832d"
EXPECTED_PNG_COUNT = 100
PREFIX = "assets/kernelfall-v3/"
ROOT = Path(__file__).resolve().parents[1]

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Podaj ścieżkę ZIP, np.: python tools/import_kernelfall_art_v3.py /tmp/KERNELFALL_ART_V3_REPO.zip")
    source = Path(sys.argv[1]).resolve()
    if not source.is_file():
        raise SystemExit(f"Brak ZIP: {source}")
    data = source.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != EXPECTED_ZIP_SHA256:
        raise SystemExit(f"Niepoprawne SHA256 ZIP: {actual}. Oczekiwane: {EXPECTED_ZIP_SHA256}")
    with ZipFile(source) as z:
        if z.testzip() is not None:
            raise SystemExit("Uszkodzony ZIP")
        manifest_path = PREFIX + "manifest.json"
        manifest = json.loads(z.read(manifest_path))
        items = manifest.get("files", [])
        if len(items) != EXPECTED_PNG_COUNT:
            raise SystemExit(f"Niepoprawna liczba PNG: {len(items)}")
        for asset in items:
            rel = asset["path"]
            relative = PurePosixPath(rel)
            if relative.is_absolute() or ".." in relative.parts or relative.suffix.lower() != ".png":
                raise SystemExit(f"Niedozwolona ścieżka: {rel}")
            payload = z.read(PREFIX + rel)
            if hashlib.sha256(payload).hexdigest() != asset["sha256"]:
                raise SystemExit(f"Niezgodny SHA256: {rel}")
            if len(payload) != asset["bytes"] or payload[:8] != bytes([137, 80, 78, 71, 13, 10, 26, 10]):
                raise SystemExit(f"Niezgodne bajty PNG: {rel}")
        # Writes only after full validation of all inputs.
        for asset in items:
            dest = ROOT / PREFIX / asset["path"]
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(z.read(PREFIX + asset["path"]))
        (ROOT / PREFIX / "manifest.json").write_bytes(z.read(manifest_path))
    print(f"OK: imported {len(items)} files into {PREFIX}; archive SHA256 confirmed.")
    print("NEXT: git add assets/kernelfall-v3 && git status; do not merge or deploy.")

if __name__ == "__main__":
    main()
