"""
Generate square extension icons from the portrait master logo.
Source: public/logo-source.png (or public/icon.png if source missing).
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"

SOURCE_CANDIDATES = [PUBLIC / "logo-source.png", PUBLIC / "icon.png"]


def load_source() -> Image.Image:
    for path in SOURCE_CANDIDATES:
        if path.is_file():
            img = Image.open(path).convert("RGBA")
            print(f"Using source: {path.relative_to(ROOT)} ({img.width}x{img.height})")
            return img
    raise SystemExit("No logo source found. Add public/logo-source.png or public/icon.png")


def center_square_crop(img: Image.Image, vertical_bias: float = 0.42) -> Image.Image:
    """Crop a square centered on the mark; bias < 0.5 shifts crop upward (hand logo)."""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = int((h - side) * vertical_bias)
    top = max(0, min(top, h - side))
    return img.crop((left, top, left + side, top + side))


def fit_on_canvas(square: Image.Image, size: int, padding_ratio: float = 0.08) -> Image.Image:
    pad = max(1, int(size * padding_ratio))
    inner = size - 2 * pad
    resized = square.copy()
    resized.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (226, 245, 182, 255))  # #E2F5B6
    ox = (size - resized.width) // 2
    oy = (size - resized.height) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def main() -> None:
    source = load_source()
    # Preserve portrait master for future regenerations
    master_path = PUBLIC / "logo-source.png"
    if not master_path.is_file() and source.size[1] > source.size[0]:
        source.save(master_path)
        print(f"Saved master copy: {master_path.relative_to(ROOT)}")

    square = center_square_crop(source)
    ICONS.mkdir(parents=True, exist_ok=True)

    outputs = {
        PUBLIC / "logo-mark.png": 512,
        PUBLIC / "icon.png": 512,
        PUBLIC / "favicon.png": 32,
        ICONS / "16.png": 16,
        ICONS / "32.png": 32,
        ICONS / "48.png": 48,
        ICONS / "128.png": 128,
    }

    for path, size in outputs.items():
        out = fit_on_canvas(square, size)
        out.save(path, optimize=True)
        print(f"Wrote {path.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
