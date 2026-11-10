#!/usr/bin/env python3
"""Offline V6 source audit. Pillow is a QA dependency, never a game dependency.

Metrics describe source pixels; they do not establish aesthetic acceptance or
clean compositing in the real Canvas. Run the browser A/B review separately.
"""
import hashlib
import itertools
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "assets/kernelfall-art-v6"
OUT = ROOT / "docs/art/kernelfall-v6/evidence/assets-audit.json"


def ratio(n, total):
    return round(n / total, 6)


def pixels(im):
    # Pillow 13 renamed this API; keep the QA script usable on older Pillow.
    return list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())


def audit():
    manifest = json.loads((PACKAGE / "manifest.json").read_text())
    records, failures = [], []
    seen = set()
    groups = defaultdict(list)
    rgba_hashes = defaultdict(list)
    for entry in manifest["files"]:
        rel = entry["path"]
        file = ROOT / rel
        if rel in seen:
            failures.append(f"duplicate manifest path: {rel}")
        seen.add(rel)
        if not file.is_file() or PACKAGE not in file.parents:
            failures.append(f"missing or out-of-package path: {rel}")
            continue
        data = file.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            failures.append(f"PNG signature: {rel}")
        with Image.open(file) as source:
            source.load()
            if source.format != "PNG":
                failures.append(f"PNG decoder format: {rel}")
            original_mode = source.mode
            im = source.convert("RGBA")
        w, h = im.size
        alpha = im.getchannel("A")
        hist = alpha.histogram()
        n = w * h
        coverage = sum(hist[1:]) / n
        coverage_ge13 = sum(hist[13:]) / n
        sha = hashlib.sha256(data).hexdigest()
        expected = {
            "width": w, "height": h, "bytes": len(data), "sha256": sha,
            "alpha_min": alpha.getextrema()[0], "alpha_max": alpha.getextrema()[1],
        }
        for field, value in expected.items():
            if entry[field] != value:
                failures.append(f"{field}: {rel}: manifest={entry[field]}, actual={value}")
        border = pixels(alpha.crop((0, 0, w, 1)))
        border += pixels(alpha.crop((0, h - 1, w, h)))
        border += pixels(alpha.crop((0, 1, 1, h - 1)))
        border += pixels(alpha.crop((w - 1, 1, w, h - 1)))
        record = {
            "path": rel, "status": "PASS", **expected,
            "mode": original_mode, "decoded_rgba_bytes": n * 4,
            "manifest_alpha_coverage": entry["alpha_coverage"],
            "alpha_coverage_gt0": round(coverage, 6),
            "alpha_coverage_ge13": round(coverage_ge13, 6),
            "manifest_coverage_matches_ge13_rounded": abs(entry["alpha_coverage"] - coverage_ge13) <= 0.0005001,
            "opaque_coverage": ratio(hist[255], n),
            "partial_alpha_coverage": ratio(sum(hist[1:255]), n),
            "low_alpha_1_to_31_coverage": ratio(sum(hist[1:32]), n),
            "alpha_bounds_nonzero": alpha.getbbox(),
            "alpha_bounds_ge_128": alpha.point(lambda a: 255 if a >= 128 else 0).getbbox(),
            "outer_border_visible_pixels": sum(a > 0 for a in border),
            "outer_border_opaque_pixels": sum(a == 255 for a in border),
            "source_review_group": str(Path(rel).relative_to("assets/kernelfall-art-v6").parts[0]),
            "source_recommendation": "KEEP_V3_PENDING_CANVAS_AB" if "/brand/" not in rel else "COPIED_V3_NO_VISUAL_GAIN",
            "actually_drawn_v6": "NOT VERIFIED BY OFFLINE AUDIT: see browser draw inventory",
        }
        if "/modules/" in rel:
            inside = sum(alpha.crop((28, 28, 232, 232)).histogram()[1:])
            record["visible_pixels_outside_v3_crop_28_28_232_232"] = sum(hist[1:]) - inside
            record["visible_fraction_outside_v3_crop"] = ratio(sum(hist[1:]) - inside, sum(hist[1:]))
        if "/drones/" in rel:
            # Source coordinates on the apparent backdrop, exposed for repeatable
            # manual inspection. Alpha=255 proves that a pixel is opaque only;
            # whether it belongs to the ship is a visual judgment.
            record["backdrop_inspection_samples_rgba"] = {
                f"{x},{y}": list(im.getpixel((x, y)))
                for x, y in [(175, 45), (215, 75), (210, 185), (80, 200)]
            }
        records.append(record)
        rgba_hashes[hashlib.sha256(im.tobytes()).hexdigest()].append(rel)
        if "/modules/" in rel or "/bosses/" in rel:
            key = rel.rsplit("_", 2)[0]
            groups[key].append((rel, im))

    actual = {str(p.relative_to(ROOT)) for p in PACKAGE.rglob("*.png")}
    svg = [str(p.relative_to(ROOT)) for p in PACKAGE.rglob("*") if p.is_file() and p.suffix.lower() == ".svg"]
    if len(manifest["files"]) != 92 or len(actual) != 92:
        failures.append(f"expected 92 PNG: manifest={len(manifest['files'])}, actual={len(actual)}")
    if actual != seen:
        failures.append(f"manifest/file set mismatch: extra={sorted(actual - seen)}, missing={sorted(seen - actual)}")
    if svg:
        failures.append(f"SVG present: {svg}")
    comparisons = []
    for key, states in groups.items():
        for (pa, a), (pb, b) in itertools.combinations(states, 2):
            pixels_a, pixels_b = pixels(a), pixels(b)
            changed = sum(x != y for x, y in zip(pixels_a, pixels_b))
            alpha_changed = sum(x[3] != y[3] for x, y in zip(pixels_a, pixels_b))
            rgb_delta = sum(sum(abs(x[c] - y[c]) for c in range(3)) for x, y in zip(pixels_a, pixels_b))
            comparisons.append({"a": pa, "b": pb,
                                "different_rgba_pixel_fraction": ratio(changed, len(pixels_a)),
                                "different_alpha_pixel_fraction": ratio(alpha_changed, len(pixels_a)),
                                "mean_absolute_rgb_channel_delta_0_to_255": round(rgb_delta / (len(pixels_a) * 3), 4)})

    report = {
        "status": "FAIL" if failures else "PASS",
        "scope": "source integrity and pixel measurements; aesthetic and runtime acceptance NOT VERIFIED by this script",
        "manifest_files": len(manifest["files"]), "actual_png_files": len(actual),
        "svg_files": svg, "failures": failures,
        "compressed_bytes": sum(r["bytes"] for r in records),
        "decoded_rgba_bytes_all_92": sum(r["decoded_rgba_bytes"] for r in records),
        "decoded_rgba_bytes_excluding_brand": sum(r["decoded_rgba_bytes"] for r in records if "/brand/" not in r["path"]),
        "identical_decoded_images": [paths for paths in rgba_hashes.values() if len(paths) > 1],
        "manifest_coverage_matches_ge13_rounded_count": sum(r["manifest_coverage_matches_ge13_rounded"] for r in records),
        "manifest_alpha_coverage_definition": "NOT VERIFIED: manifest does not define an alpha threshold. All entries observationally match fraction alpha>=13 rounded to 3 decimals. This inferred convention is separate from the PASS checksum/signature/dimensions/bytes checks.",
        "pixel_metrics_limit": "Partial alpha and border occupancy are measurements, not a fringing detector. Compare over the real game floor. Identical alpha among damage states can be intentional.",
        "files": records, "state_comparisons": comparisons,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k not in ("files", "state_comparisons")}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(audit())
