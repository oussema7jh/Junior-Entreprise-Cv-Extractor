"""
Turns a clean CV image into a black-and-white office scan: grey, slightly rotated,
speckles and a darker edge, saved as a low-quality JPEG.
"""
import random

from PIL import Image, ImageEnhance, ImageFilter


def make_scan(src: str, dst: str, seed: int = 7) -> None:
    rnd = random.Random(seed)
    img = Image.open(src).convert("L")
    img = img.rotate(rnd.uniform(-1.5, 1.5), resample=Image.BICUBIC, expand=True, fillcolor=255)
    img = ImageEnhance.Contrast(img).enhance(1.3)
    px = img.load()
    w, h = img.size
    for _ in range(w * h // 900):  # dust and toner speckles
        x, y = rnd.randrange(w), rnd.randrange(h)
        px[x, y] = rnd.randint(0, 90)
    for x in range(min(18, w)):  # scanner lid shadow on the left edge
        for y in range(h):
            px[x, y] = min(px[x, y], 120 + x * 7)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    img.save(dst, "JPEG", quality=60)
