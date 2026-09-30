"""Cut the flat background out of generated beast art and export it for the game.

Usage:
    python tools/cutout.py <beast_key> <base_image> [<evolved_image> [<final_image>]]

Example:
    python tools/cutout.py ashwing ~/Downloads/ashwing1.png ~/Downloads/ashwing2.png ~/Downloads/ashwing3.png

Writes art/<beast_key>_0.webp, _1.webp and _2.webp. Afterwards, add the beast
to ART_FILES near the top of the script in index.html, for example:
    const ART_FILES={cindermaw:[0,1,2], ashwing:[0,1,2]};

How it works: the background colour is sampled from the image border. Pixels
close to that colour AND connected to the image edge are made transparent,
with a soft ramp so glows and smoke fade out naturally. Dark areas inside the
creature stay solid even when they match the background colour.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

LOW, HIGH = 0.035, 0.16   # colour distance: fully transparent below LOW, fully opaque above HIGH
MAX_SIZE = 640            # longest side of the exported image, in pixels


def cutout(src: Path, dst: Path, max_size: int = MAX_SIZE) -> tuple[int, int]:
    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
                             a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    soft = np.clip((dist - LOW) / (HIGH - LOW), 0, 1)

    # Only background-coloured regions that touch the edge count as background.
    labels, _ = ndimage.label(dist < HIGH)
    edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    outside = np.isin(labels, list(edge_labels))

    alpha = np.where(outside, soft, 1.0)
    alpha = np.where(outside, ndimage.uniform_filter(alpha, 3), alpha)
    al = np.maximum(alpha, 1e-3)[..., None]
    colour = np.where(outside[..., None], np.clip((a - bg * (1 - al)) / al, 0, 1), a)

    img = Image.fromarray((np.dstack([colour, alpha]) * 255).astype(np.uint8), "RGBA")
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bbox)
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "WEBP", quality=88, method=6)
    return img.size


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    key, images = sys.argv[1], sys.argv[2:5]
    art_dir = Path(__file__).resolve().parent.parent / "art"
    for form, path in enumerate(images):
        out = art_dir / f"{key}_{form}.webp"
        w, h = cutout(Path(path).expanduser(), out)
        print(f"{out.relative_to(art_dir.parent)}  {w}x{h}")
    forms = ",".join(str(i) for i in range(len(images)))
    print(f"\nNow add  {key}:[{forms}]  to ART_FILES in index.html.")


if __name__ == "__main__":
    main()
