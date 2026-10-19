# Запуск: python3 scripts/android-icons.py android/app/src/main/res (нужен Pillow).
# Иконка и заставка Android: фирменный градиент и гантель из favicon.svg.
import os, sys
from PIL import Image, ImageDraw

RES = sys.argv[1]
BLUE, VIOLET, PINK = (0x35, 0x63, 0xE9), (0x7C, 0x3A, 0xED), (0xDB, 0x27, 0x77)
# Гантель в координатах favicon (48×48): x, y, w, h, r
DUMBBELL = [
    (11.5, 22.3, 25, 3.4, 1.5),
    (9.6, 15.8, 3.8, 16.4, 1.7),
    (34.6, 15.8, 3.8, 16.4, 1.7),
    (6.2, 18.7, 2.9, 10.6, 1.4),
    (38.9, 18.7, 2.9, 10.6, 1.4),
]

def rects(size, cx, cy, scale):
    for x, y, w, h, r in DUMBBELL:
        yield (cx + (x - 24) * scale, cy + (y - 24) * scale, w * scale, h * scale, r * scale)

def rr_path(x, y, w, h, r):
    f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')
    return (f'M{f(x + r)},{f(y)}h{f(w - 2 * r)}a{f(r)},{f(r)} 0,0 1,{f(r)},{f(r)}'
            f'v{f(h - 2 * r)}a{f(r)},{f(r)} 0,0 1,-{f(r)},{f(r)}h-{f(w - 2 * r)}'
            f'a{f(r)},{f(r)} 0,0 1,-{f(r)},-{f(r)}v-{f(h - 2 * r)}a{f(r)},{f(r)} 0,0 1,{f(r)},-{f(r)}z')

# Гантель в слое 108×108: шириной ~52, внутри безопасного круга (диаметр 66)
FG_SCALE = 1.46
fg_path = ''.join(rr_path(*r) for r in rects(108, 54, 54, FG_SCALE))

def vector(paths):
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    xmlns:aapt="http://schemas.android.com/aapt"\n'
            '    android:width="108dp"\n    android:height="108dp"\n'
            '    android:viewportWidth="108"\n    android:viewportHeight="108">\n'
            + paths + '</vector>\n')

hexc = lambda c: '#FF%02X%02X%02X' % c
bg = vector(
    '    <path android:pathData="M0,0h108v108h-108z">\n'
    '        <aapt:attr name="android:fillColor">\n'
    '            <gradient android:type="linear" android:startX="0" android:startY="0"\n'
    '                android:endX="108" android:endY="76">\n'
    f'                <item android:offset="0" android:color="{hexc(BLUE)}" />\n'
    f'                <item android:offset="0.5" android:color="{hexc(VIOLET)}" />\n'
    f'                <item android:offset="1" android:color="{hexc(PINK)}" />\n'
    '            </gradient>\n        </aapt:attr>\n    </path>\n')
fg = vector(f'    <path android:fillColor="#FFFFFFFF" android:pathData="{fg_path}" />\n')

draw = os.path.join(RES, 'drawable')
open(os.path.join(draw, 'ic_launcher_background.xml'), 'w').write(bg)
open(os.path.join(draw, 'ic_launcher_fg.xml'), 'w').write(fg)

# --- PNG: градиент как в CSS (по диагонали, три цвета) ---
def gradient(w, h):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for yy in range(h):
        for xx in range(w):
            # направление (1, 0.7), как x2=1 y2=0.7 в favicon
            t = (xx / w + 0.7 * yy / h) / 1.7
            a, b, u = (BLUE, VIOLET, t / 0.5) if t < 0.5 else (VIOLET, PINK, (t - 0.5) / 0.5)
            px[xx, yy] = tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3))
    return im

def dumbbell(im, cx, cy, scale):
    d = ImageDraw.Draw(im)
    for x, y, w, h, r in rects(0, cx, cy, scale):
        box = tuple(round(v) for v in (x, y, x + w, y + h))
        d.rounded_rectangle(box, radius=int(min(r, w / 2, h / 2)), fill='white')

SS = 4  # рисуем крупнее и уменьшаем — края гладкие
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENS.items():
    d = os.path.join(RES, f'mipmap-{name}')
    # Старая квадратная иконка 48dp и круглая
    n = round(48 * k) * SS
    sq = gradient(n, n).convert('RGBA')
    dumbbell(sq, n / 2, n / 2, n / 48 * 0.82)
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, n - 1, n - 1), radius=n * 0.23, fill=255)
    sq.putalpha(mask)
    sq.resize((n // SS, n // SS), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
    rd = gradient(n, n).convert('RGBA')
    dumbbell(rd, n / 2, n / 2, n / 48 * 0.72)
    m2 = Image.new('L', (n, n), 0)
    ImageDraw.Draw(m2).ellipse((0, 0, n - 1, n - 1), fill=255)
    rd.putalpha(m2)
    rd.resize((n // SS, n // SS), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_round.png'))
    # Передний слой 108dp — для старых путей, где он ещё указан
    n = round(108 * k) * SS
    fgp = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    dumbbell(fgp, n / 2, n / 2, n / 108 * FG_SCALE)
    fgp.resize((n // SS, n // SS), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))

# --- Заставка для Android 8–11: градиент на весь экран и гантель в центре ---
for path in sorted(os.listdir(RES)):
    f = os.path.join(RES, path, 'splash.png')
    if not os.path.exists(f):
        continue
    w, h = Image.open(f).size
    im = gradient(w // 2, h // 2).resize((w, h), Image.BILINEAR)
    s = min(w, h)
    dumbbell(im, w / 2, h / 2, s * 0.34 / 48 * 1.4)
    im.save(f)
print('ok')
