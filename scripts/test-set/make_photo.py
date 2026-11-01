"""
Turns a clean CV image into something that looks like a phone photo of a printed CV:
a sheet on a desk, slightly tilted, uneven light, a bit soft, saved as JPEG.

    python scripts/test-set/make_photo.py in.jpg out.jpg [seed]
"""
import random
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


def make_photo(src: str, dst: str, seed: int = 0) -> None:
    rnd = random.Random(seed)
    page = Image.open(src).convert("RGB")
    w, h = page.size

    # The sheet on a darker desk, with a margin around it.
    margin = int(w * 0.12)
    canvas = Image.new("RGB", (w + 2 * margin, h + 2 * margin), (96 + rnd.randint(-15, 15), 82, 70))
    canvas.paste(page, (margin, margin))

    # Perspective: the phone is not held perfectly flat.
    cw, ch = canvas.size
    j = lambda k: rnd.uniform(0, k)
    quad = (j(cw * 0.06), j(ch * 0.04), j(cw * 0.04), ch - j(ch * 0.05), cw - j(cw * 0.05), ch - j(ch * 0.03), cw - j(cw * 0.06), j(ch * 0.05))
    photo = canvas.transform((cw, ch), Image.QUAD, quad, resample=Image.BICUBIC)
    photo = photo.rotate(rnd.uniform(-4, 4), resample=Image.BICUBIC, expand=False, fillcolor=(90, 78, 66))

    # Uneven light: a soft shadow from one side.
    shade = Image.new("L", photo.size, 0)
    draw = ImageDraw.Draw(shade)
    side = rnd.choice(["left", "right", "top"])
    for i in range(60):
        alpha = int(90 * (1 - i / 60))
        if side == "left":
            draw.rectangle([0, 0, int(cw * 0.5 * i / 60), ch], fill=alpha)
        elif side == "right":
            draw.rectangle([cw - int(cw * 0.5 * i / 60), 0, cw, ch], fill=alpha)
        else:
            draw.rectangle([0, 0, cw, int(ch * 0.4 * i / 60)], fill=alpha)
    shade = shade.filter(ImageFilter.GaussianBlur(cw // 15))
    photo = Image.composite(Image.new("RGB", photo.size, (20, 20, 25)), photo, shade)

    # Phone camera look: warm tint, a little soft, lower contrast, JPEG.
    photo = ImageEnhance.Color(photo).enhance(0.9)
    photo = ImageEnhance.Contrast(photo).enhance(0.88)
    photo = photo.filter(ImageFilter.GaussianBlur(rnd.uniform(0.6, 1.2)))
    r, g, b = photo.split()
    photo = Image.merge("RGB", (r.point(lambda v: min(255, v + 8)), g, b.point(lambda v: max(0, v - 10))))
    photo.save(dst, "JPEG", quality=rnd.randint(70, 82))


if __name__ == "__main__":
    make_photo(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 0)
