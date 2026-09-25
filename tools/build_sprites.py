"""Turn the AI-generated green-screen sheets in assets/source into game sprite sheets.

Each sheet is a grid of poses on a #00FF00 background. We key out the green,
find each pose, shrink it to game size and pack all poses into a uniform
strip (feet at the bottom, centered), written to assets/<name>.png.

Usage: python3 tools/build_sprites.py
"""
import numpy as np
from PIL import Image

TARGET_H = 56          # height of a normal standing pose, in game pixels
FRAME_W, FRAME_H = 40, 60


def green_mask(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (g > 110) & (g > r + 45) & (g > b + 45)


def bands(proj, gap=6, minsize=8):
    idx = np.where(proj)[0]
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap:
            out.append((start, prev))
            start = i
        prev = i
    out.append((start, prev))
    return [(s, e + 1) for s, e in out if e - s >= minsize]


def cut_cells(a):
    fg = ~green_mask(a)
    cells = []
    for r0, r1 in bands(fg.sum(1) > 2):
        row = [(r0, r1, c0, c1) for c0, c1 in bands(fg[r0:r1].sum(0) > 1)]
        cells.append(row)
    return cells


def to_sprite(a, box, scale):
    r0, r1, c0, c1 = box
    crop = a[r0:r1, c0:c1].astype(float)
    alpha = (~green_mask(crop.astype(np.uint8))).astype(float)
    # Remove green spill on edge pixels.
    g = crop[..., 1]
    crop[..., 1] = np.minimum(g, np.maximum(crop[..., 0], crop[..., 2]) + 30)
    rgba = np.dstack([crop * alpha[..., None], alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    w = max(1, round(im.width * scale))
    h = max(1, round(im.height * scale))
    im = im.resize((w, h), Image.BOX)
    arr = np.array(im).astype(float)
    al = arr[..., 3:4] / 255
    rgb = np.where(al > 0, arr[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.dstack([np.clip(rgb, 0, 255), np.where(al[..., 0] > 0.5, 255, 0)])
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def build(src, dst):
    a = np.array(Image.open(src).convert('RGB'))
    cells = cut_cells(a)
    heights = sorted(r1 - r0 for row in cells[:3] for r0, r1, _, _ in row)
    scale = TARGET_H / heights[len(heights) // 2]
    ncols = max(len(r) for r in cells)
    sheet = Image.new('RGBA', (FRAME_W * ncols, FRAME_H * len(cells)))
    for ri, row in enumerate(cells):
        for ci, box in enumerate(row):
            sp = to_sprite(a, box, scale)
            x = ci * FRAME_W + (FRAME_W - sp.width) // 2
            y = ri * FRAME_H + FRAME_H - sp.height
            sheet.alpha_composite(sp, (x, y))
    sheet.save(dst)
    print(dst, sheet.size, 'scale', round(scale, 3))


build('assets/source/girl-sheet.jpg', 'assets/girl.png')
build('assets/source/boy-sheet.jpg', 'assets/boy.png')
