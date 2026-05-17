from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = "/Users/pedroescobar/.houston/workspaces/Personal/Zuckerberg/raw/public/icons"
SIZE = 512
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 45, 45)
LIGHT_GRAY = (232, 232, 232)

def get_font(size):
    """Try to load Impact, fall back to a bold system font."""
    candidates = [
        "/Library/Fonts/Impact.ttf",
        "/System/Library/Fonts/Supplemental/Impact.ttf",
        "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    # Fallback: Arial Bold
    fallback = [
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in fallback:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def draw_text_centered(draw, img_size, text, font, color=BLACK):
    """Returns (x, y, text_w, text_h) after drawing centered text."""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (img_size - text_w) // 2 - bbox[0]
    y = (img_size - text_h) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=color)
    return x, y, text_w, text_h

# ---------------------------------------------------------------------------
# Variation A — dumbbell above text, red rule below
# ---------------------------------------------------------------------------
def make_variation_a():
    img = Image.new("RGB", (SIZE, SIZE), WHITE)
    draw = ImageDraw.Draw(img)

    font = get_font(180)

    # Measure text to position everything
    bbox = draw.textbbox((0, 0), "RAW", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Vertical layout: dumbbell (60px) + gap(20) + text + gap(16) + rule
    dumbbell_h = 30   # visual height of dumbbell area
    gap1 = 28
    rule_h = 4
    gap2 = 18

    total_h = dumbbell_h + gap1 + text_h + gap2 + rule_h
    start_y = (SIZE - total_h) // 2

    # --- Draw dumbbell ---
    db_w = 140          # total dumbbell width
    db_bar_h = 6        # bar thickness
    plate_r = 15        # plate circle radius
    db_cx = SIZE // 2
    db_cy = start_y + dumbbell_h // 2

    # bar
    bar_x0 = db_cx - db_w // 2 + plate_r
    bar_x1 = db_cx + db_w // 2 - plate_r
    bar_y0 = db_cy - db_bar_h // 2
    bar_y1 = db_cy + db_bar_h // 2
    draw.rectangle([bar_x0, bar_y0, bar_x1, bar_y1], fill=BLACK)

    # left plate
    draw.ellipse([db_cx - db_w // 2 - plate_r, db_cy - plate_r,
                  db_cx - db_w // 2 + plate_r, db_cy + plate_r], fill=BLACK)
    # right plate
    draw.ellipse([db_cx + db_w // 2 - plate_r, db_cy - plate_r,
                  db_cx + db_w // 2 + plate_r, db_cy + plate_r], fill=BLACK)

    # --- Draw "RAW" text ---
    text_y = start_y + dumbbell_h + gap1
    text_x = (SIZE - text_w) // 2 - bbox[0]
    draw.text((text_x, text_y - bbox[1]), "RAW", font=font, fill=BLACK)

    # --- Draw red rule ---
    rule_y = text_y - bbox[1] + text_h + gap2
    rule_x0 = (SIZE - text_w) // 2
    rule_x1 = rule_x0 + text_w
    draw.rectangle([rule_x0, rule_y, rule_x1, rule_y + rule_h], fill=RED)

    out = os.path.join(OUTPUT_DIR, "raw-icon-v2a-dumbbell.png")
    img.save(out, "PNG")
    print(f"Saved: {out}")

# ---------------------------------------------------------------------------
# Variation B — barbell as underline
# ---------------------------------------------------------------------------
def make_variation_b():
    img = Image.new("RGB", (SIZE, SIZE), WHITE)
    draw = ImageDraw.Draw(img)

    font = get_font(200)

    bbox = draw.textbbox((0, 0), "RAW", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    gap = 20
    barbell_h = 20      # height of barbell area
    total_h = text_h + gap + barbell_h
    start_y = (SIZE - total_h) // 2

    # --- Draw "RAW" text centered ---
    text_x = (SIZE - text_w) // 2 - bbox[0]
    text_y = start_y - bbox[1]
    draw.text((text_x, text_y), "RAW", font=font, fill=BLACK)

    # --- Draw barbell underline ---
    bar_x0 = (SIZE - text_w) // 2
    bar_x1 = bar_x0 + text_w
    bar_cy = start_y + text_h + gap + barbell_h // 2
    bar_thickness = 5
    plate_r = 10

    # horizontal bar
    draw.rectangle([bar_x0 + plate_r, bar_cy - bar_thickness // 2,
                    bar_x1 - plate_r, bar_cy + bar_thickness // 2], fill=RED)

    # left weight plate
    draw.ellipse([bar_x0 - plate_r, bar_cy - plate_r,
                  bar_x0 + plate_r, bar_cy + plate_r], fill=RED)

    # right weight plate
    draw.ellipse([bar_x1 - plate_r, bar_cy - plate_r,
                  bar_x1 + plate_r, bar_cy + plate_r], fill=RED)

    out = os.path.join(OUTPUT_DIR, "raw-icon-v2b-barbell.png")
    img.save(out, "PNG")
    print(f"Saved: {out}")

# ---------------------------------------------------------------------------
# Variation C — large weight-plate circle behind text + red rule
# ---------------------------------------------------------------------------
def make_variation_c():
    img = Image.new("RGB", (SIZE, SIZE), WHITE)
    draw = ImageDraw.Draw(img)

    # --- Draw large background circle (weight plate) ---
    circle_d = 380
    stroke = 6
    cx, cy = SIZE // 2, SIZE // 2
    x0 = cx - circle_d // 2
    y0 = cy - circle_d // 2
    x1 = cx + circle_d // 2
    y1 = cy + circle_d // 2
    draw.ellipse([x0, y0, x1, y1], outline=LIGHT_GRAY, width=stroke)

    # Inner decorative ring (optional second ring for plate realism)
    inner_d = circle_d - 40
    ix0 = cx - inner_d // 2
    iy0 = cy - inner_d // 2
    ix1 = cx + inner_d // 2
    iy1 = cy + inner_d // 2
    draw.ellipse([ix0, iy0, ix1, iy1], outline=LIGHT_GRAY, width=2)

    font = get_font(200)

    bbox = draw.textbbox((0, 0), "RAW", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    gap = 18
    rule_h = 5
    total_h = text_h + gap + rule_h
    start_y = (SIZE - total_h) // 2

    # --- Draw "RAW" text ---
    text_x = (SIZE - text_w) // 2 - bbox[0]
    text_y = start_y - bbox[1]
    draw.text((text_x, text_y), "RAW", font=font, fill=BLACK)

    # --- Red rule ---
    rule_y = start_y + text_h + gap
    rule_x0 = (SIZE - text_w) // 2
    rule_x1 = rule_x0 + text_w
    draw.rectangle([rule_x0, rule_y, rule_x1, rule_y + rule_h], fill=RED)

    out = os.path.join(OUTPUT_DIR, "raw-icon-v2c-plate.png")
    img.save(out, "PNG")
    print(f"Saved: {out}")

if __name__ == "__main__":
    make_variation_a()
    make_variation_b()
    make_variation_c()
    print("All icons generated successfully.")
