# Standard peripherals: displays, lights, servo and Bluetooth

Part 3 of the [EVN ALPHA MicroPython API reference](API.md), which has the units, the port numbers and the differences from Pybricks. Previous: [Standard peripherals: sensors](API_SENSORS.md) · Next: [Extended peripherals: HiTechnic, HuskyLens, VL53L1X and TCS3430](API_EXTENDED.md).

The standard peripherals that show, move or talk: the OLED display, the LED matrix, the seven-segment display, the RGB LEDs, the servo and the Bluetooth module. The rules every standard peripheral follows, and the table of all fifteen, are at the top of [Standard peripherals: sensors](API_SENSORS.md#standard-peripherals).

## Display — 128×64 OLED (SSD1306 / SSD1315)

Plug the EVN OLED into an I2C port; only SDA and SCL are used. Text sits on a grid of 16 columns × 8 rows of 8×8 characters; drawing uses pixels, x 0..127 from the left and y 0..63 from the top. The `draw_*` calls and `print()` are Pybricks' EV3 screen names.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `oled = Display(port, addr=0x3C, *, flip=False)` | `port` 1..16; `addr` 0x3C (the EVN OLED) or 0x3D, else `ValueError`; `flip=True` mounts the picture rotated 180°. `OSError` if nothing answers at the address, `OSError` when two displays are already open, `OSError(ETIMEDOUT)` if the panel does not come up. Returns with the panel blank and on, contrast 207 (≈ 55 ms; up to ≈ 740 ms on a panel that has just been plugged in) |

### Text

| Call | Notes |
| :--- | :--- |
| `oled.write(row, text)` | a whole row 0..7: the text from column 0, cut at 16 characters and padded with spaces; forgets the row's label. `text` may be a `str`, int, float (2 decimals), bool or `None`; anything else raises `TypeError` |
| `oled.label(row, text)` | the row's label from column 0 (`"Dist:"`), which `data()` writes after (the EVN Arduino `writeLabel`); a shorter label blanks the rest of the old one |
| `oled.data(row, value)` | `value` after the row's label, the rest of the row cleared (the EVN Arduino `writeData`); the same types as `write()`: `oled.label(1, "Dist:"); oled.data(1, 123)` |
| `oled.text(col, row, text, invert=False)` | characters from column 0..15 (else `ValueError`) on a row, no padding, cut at the right edge; `invert=True` draws dark on lit. Returns how many characters were written |
| `oled.print(*args, sep=" ", end="\n")` | like the built-in `print()`, on the text grid at a cursor: wraps at 16 characters and scrolls up at the bottom (the eighth row is used before the first scroll). `sep` and `end` are keywords; `clear()` puts the cursor back at the top left |
| `oled.mirror([enable])` | `oled.mirror(True)` copies everything the board prints (the REPL, every `print()`, tracebacks) to this display's console, with or without a USB host; one display at a time. `mirror(False)`, `close()` or a soft reset (Ctrl-D) ends it; `oled.mirror()` says whether this display is mirroring. Each mirrored line scrolls the whole panel, so a program that prints steadily keeps it busy |
| `oled.clear_row(row)` | blank one row 0..7 and forget its label |
| `oled.clear()` | blank the whole screen, forget every label and put the `print()` cursor at the top left |

### Drawing

| Call | Notes |
| :--- | :--- |
| `oled.pixel(x, y)`, `oled.pixel(x, y, on)` | read one pixel (`True` = lit) or set it; x 0..127, y 0..63, else `ValueError` |
| `oled.line(x0, y0, x1, y1, on=True, /)` | a one-pixel line; both ends must be on the screen (else `ValueError`); a `False` last argument erases |
| `oled.rect(x0, y0, x1, y1, on=True, *, fill=False)` | a rectangle between two corners given in either order, outlined or filled; corners must be on the screen |
| `oled.draw_pixel(x, y, color=Color.BLACK)` | one pixel in EV3 colours: the EV3 draws `Color.BLACK` on a white screen, so here a colour **lights** the pixel and `Color.WHITE`, `Color.GRAY` (any grey of 50 % value or more) and `Color.NONE` **erase** it; `True` / `False` work too. A pixel off the screen is skipped, not refused |
| `oled.draw_line(x1, y1, x2, y2, width=1, color=Color.BLACK)` | a line `width` 1..64 pixels thick (a square brush, so a thick line runs `width / 2` past its ends); clipped at the edges |
| `oled.draw_box(x1, y1, x2, y2, r=0, fill=False, color=Color.BLACK)` | a rectangle with corner radius `r` (≥ 0; `r=0` = `rect()`), outlined or filled; clipped at the edges |
| `oled.draw_circle(x, y, r, fill=False, color=Color.BLACK)` | a circle of radius `r` 0..255 around (x, y), outlined or filled; clipped at the edges |
| `oled.draw_text(x, y, text, text_color=Color.BLACK, background_color=None)` | 8×8 characters with their top-left corner at a pixel position; `background_color=None` leaves the pixels around the letters as they are, a colour fills or erases them; clipped at the edges |
| `oled.width`, `oled.height` | 128 and 64 |
| `oled.frame([data])` | the whole picture as 1024 bytes, page by page: byte `page * 128 + x` holds the pixels (x, 8 × page .. 8 × page + 7), bit 0 the top one. `oled.frame()` returns it, `oled.frame(data)` replaces it (another length raises `ValueError`) |
| `oled.splash()` | the EVN logo; forgets every label |
| `oled.show()` | send every pending change to the panel now and wait: ≈ 30 ms for a whole new picture, ≈ 1 ms for one pixel. Stops a hardware scroll first. `OSError` while the display is unplugged |

### Panel

| Call | Notes |
| :--- | :--- |
| `oled.contrast([value])` | 1..255 (default 207) |
| `oled.flip([enable])` | rotate the picture 180°; the picture is repainted (≈ 30 ms) |
| `oled.invert([enable])` | the panel shows dark on lit; the picture itself is unchanged |
| `oled.on(enable=True, /)` | switch the panel on (or off with `False`); the picture is kept |
| `oled.off()` | switch the panel off (it sleeps); the picture is kept and comes back with `on()` |
| `oled.scroll(left=False, rows=None, speed=0, vertical=0)` | the panel's hardware scroll: to the right (or left) over the rows `(first, last)` 0..7 in ascending order (`None` = the whole screen), `speed` 0..7 (the chip's frame-interval code), `vertical` −63..63 rows per step for a diagonal scroll; out-of-range values raise `ValueError`. While it runs the panel cannot be drawn on, so drawing waits: the next drawing call (or `show()`) stops the scroll and repaints; a new `scroll()` stops the old one first |
| `oled.scroll_stop()` | stop the scroll; the picture is repainted |
| `oled.fade(mode, interval=0, /)` | `'off'`, `'fade'` (fade out) or `'blink'`, `interval` 0..15 (the chip's frame-interval code); anything else raises `ValueError` |
| `oled.zoom(enable=True, /)` | the panel's zoom-in (every row shown twice as tall); `False` ends it |
| `oled.all_on(enable=True, /)` | light every pixel whatever the picture (a panel test); `False` shows the picture again |
| `oled.command(data)` | send 1..32 raw command bytes to the panel, for anything not wrapped (another length raises `ValueError`) |
| `oled.close()` | switch the panel off, end a `mirror()` and free the port |

**Example**

```python
from evn import Display
oled = Display(16)
oled.write(0, "Distance")
oled.label(1, "mm:")
oled.data(1, 123)
```

**Notes**

Drawing changes a picture held in the firmware and returns at once (50 `write()` calls take about 28 ms); the changed parts are streamed to the panel in the background, a whole new picture in about 60 ms, or at once with `show()`. Drawing and `contrast()`, `flip()`, `invert()`, `on()` / `off()` keep working while the display is unplugged, and a replugged display gets its picture and settings back by itself; `show()`, `scroll()`, `scroll_stop()`, `fade()`, `zoom()`, `all_on()` and `command()` need the panel and raise `OSError("display on port N not responding")` while it is unplugged.

The constructor raises `OSError` when nothing answers on the port or two displays are already open. The getters read the firmware's copy and do not raise while the display is unplugged. After `close()` every call except `close()` raises `ValueError("Display is closed")`.

## MatrixLED — 8×8 LED matrix (HT16K33)

Plug the EVN 8×8 LED matrix into an I2C port; only SDA and SCL are used. The names follow Pybricks' `hub.display` (row first, `icon()`, `number()`, `text()`, `animate()`, `orientation()`).

**Constructor**

| Call | Notes |
| :--- | :--- |
| `m = MatrixLED(port, addr=None)` | `port` 1..16. `addr=None` is the EVN matrix's 0x71; another HT16K33 board 0x71..0x77. **0x70 raises `ValueError`**: it is the board's own I2C multiplexer. `OSError` if nothing answers at the address (the chip has no ID register: an answer at the address is taken as the display), `OSError` when four LED displays (`MatrixLED` and `SevenSegmentLED` together) are already open, `OSError(ETIMEDOUT)` if the chip does not come up. One LED display per port: a second `MatrixLED` or `SevenSegmentLED` on the same port re-attaches the one slot at its own address. Returns with the matrix cleared and on, brightness 16, no blink (≈ 6 ms) |

### Drawing

| Call | Notes |
| :--- | :--- |
| `m.pixel(row, column, brightness=100)` | row 0..7 from the top, column 0..7 from the left (else `ValueError`); `brightness` 0, 0.0 or `False` turns the pixel off, any other value lights it (the chip has one brightness for the whole matrix: `m.brightness()`) |
| `m.get(row, column)` | `True` if that pixel is lit in the picture |
| `m.hline(row, col0, col1, on=True, /)` | a horizontal line, both ends included, in either order; a `False` last argument clears it |
| `m.vline(column, row0, row1, on=True, /)` | a vertical line, both ends included; a `False` last argument clears it |
| `m.rect(row0, col0, row1, col1, on=True, /)` | a filled rectangle between the two corners; a `False` last argument clears it |
| `m.bitmap(rows)` | the whole picture from 8 bytes (one per row, top row first, bit 7 = leftmost pixel), 8 ints of the same form, or 8 rows of 8 values (non-zero = on). `ValueError` for fewer than 8 bytes, a list that is not 8 rows or a row that is not 8 values |
| `m.image(matrix)` | the same as `bitmap()` (the Pybricks name) |
| `m.icon(icon)` | the same as `bitmap()`, for an `Icon` member (below): `m.icon(Icon.HEART)` |
| `m.char(c)` | one 8×8 character (printable ASCII; anything else shows blank); a string that is not one character raises `ValueError` |
| `m.number(n)` | an int −99..99 in 3×5 digits; a negative two-digit number is marked by one pixel at the left edge, a negative single digit by a dash. Outside the range `ValueError("number must be -99..99")` |
| `m.text(text, on=500, off=50, *, wait=True)` | one character at a time, `on` ms lit then `off` ms blank, and blank at the end. `wait=False` returns at once and the text runs in the background (`m.animating()`). Up to 63 characters; `on` below 1 ms, a negative `off` or a longer text raises `ValueError`; with `wait=True` an unplug during the text raises `OSError` |
| `m.animate(images, interval)` | cycle 1..32 images (any `bitmap()` form, e.g. `Icon` members) forever in the background, `interval` ms (≥ 1) each; the first image shows at once. Any drawing call ends it |
| `m.animating()` | `True` while an `animate()` or a `text()` is running |
| `m.stop()` | end an `animate()` or a `text()`, leaving the picture as it is |
| `m.orientation([up])`, `m.orientation(*, invert_x=False, invert_y=False, swap_xy=False)` | which edge of the matrix is up: `Side.TOP` (as wired, the default), `Side.RIGHT`, `Side.BOTTOM` or `Side.LEFT`; any other `Side` raises `ValueError`. The keyword form is for a mirrored mounting (the flags left out are reset to `False`). `m.orientation()` returns the `Side` (an int, so `m.orientation() == Side.RIGHT` works), or `(invert_x, invert_y, swap_xy)` when the setting is not a rotation. It applies to the drawing calls that follow it: a picture already drawn keeps its LEDs |
| `m.clear()` | every LED off |
| `m.fill()` | every LED on |
| `m.show()` | send the picture to the chip now and wait (≈ 1.2 ms) instead of within the next 10 ms; `OSError` while the display is unplugged |
| `m.raw([frame])`, `m.raw(led, on)` | the chip's 16 display-RAM bytes: `m.raw()` returns them (as held by the firmware), `m.raw(frame)` writes all 16 (another length raises `ValueError`), `m.raw(led, on)` sets one LED 0..127 (= byte × 8 + bit). Not affected by `orientation()` |

### Panel

| Call | Notes |
| :--- | :--- |
| `m.brightness([level])` | 1 (dim) .. 16 (default), the whole matrix |
| `m.blink([hz])` | 0 (off, the default), 2, 1 or 0.5 Hz; any other value raises `ValueError` |
| `m.on(enable=True, /)` | switch the display on (or off with `False`); the picture is kept |
| `m.off()` | switch the display off; the picture is kept and comes back with `on()` |
| `m.keys([enable])` | the chip's key scan: `m.keys(True)` / `m.keys(False)` turns it on or off (off by default), `m.keys()` returns the six key-scan bytes, or raises `ValueError("key scan is off: keys(True)")` while it is off or before its first scan. The EVN matrix has no keys wired: six zero bytes |
| `m.close()` | switch the display off (chip in standby) and free the port. Two objects on one port share the display, so closing one closes both |

### Icon

`Icon` (from `evn`) is Pybricks' icon set redrawn at 8×8, for `m.icon()`, `m.image()`, `m.bitmap()` and `m.animate()`. Each member is 8 `bytes`, one per row, top row first, bit 7 = leftmost pixel, so your own `bytes` of the same form work in the same places.

`Icon.UP`, `DOWN`, `LEFT`, `RIGHT`, `ARROW_UP`, `ARROW_DOWN`, `ARROW_LEFT`, `ARROW_RIGHT`, `ARROW_RIGHT_UP`, `ARROW_RIGHT_DOWN`, `ARROW_LEFT_UP`, `ARROW_LEFT_DOWN`, `HAPPY`, `SAD`, `EYE_LEFT`, `EYE_RIGHT`, `EYE_LEFT_BLINK`, `EYE_RIGHT_BLINK`, `EYE_LEFT_BROW`, `EYE_RIGHT_BROW`, `EYE_LEFT_BROW_UP`, `EYE_RIGHT_BROW_UP`, `HEART`, `PAUSE`, `EMPTY`, `FULL`, `SQUARE`, `TRIANGLE_UP`, `TRIANGLE_DOWN`, `TRIANGLE_LEFT`, `TRIANGLE_RIGHT`, `CIRCLE`, `CLOCKWISE`, `COUNTERCLOCKWISE`, `TRUE`, `FALSE`.

**Example**

```python
from evn import MatrixLED, Icon, Side
m = MatrixLED(1)
m.orientation(Side.RIGHT)   # the matrix is mounted with its right edge up
m.animate([Icon.HAPPY, Icon.SAD], 500)
```

**Notes**

Drawing calls change a picture held in the firmware, which reaches the chip within 10 ms (1.2–3.8 ms measured); `show()` sends it at once. Drawing calls and settings keep working while the display is unplugged, and a replugged display gets its picture, brightness, blink and orientation back by itself (the firmware looks for it every 250 ms); a chip reset without an unplug (a supply dip) is healed within about 110 ms.

The constructor raises `OSError` when nothing answers on the port or the display pool is full. The display's getters read the firmware's copy and do not raise while it is unplugged; `show()` does, and so does a setting sent while the chip stops answering. After `close()` every call except `close()` raises `ValueError("MatrixLED is closed")`.

## SevenSegmentLED — 4-digit seven-segment display (HT16K33)

Plug the EVN 4-digit seven-segment display into an I2C port; only SDA and SCL are used. Positions are 0..3 from the left.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `seg = SevenSegmentLED(port, addr=None)` | `port` 1..16. `addr=None` is the EVN seven-segment board's 0x74; another HT16K33 board 0x71..0x77. **0x70 raises `ValueError`**: it is the board's own I2C multiplexer. `OSError` if nothing answers at the address (the chip has no ID register: an answer at the address is taken as the display), `OSError` when four LED displays (`MatrixLED` and `SevenSegmentLED` together) are already open, `OSError(ETIMEDOUT)` if the chip does not come up. One LED display per port: a second `MatrixLED` or `SevenSegmentLED` on the same port re-attaches the one slot at its own address. Returns with the display cleared and on, brightness 16, no blink (≈ 6 ms) |

### Numbers and letters

| Call | Notes |
| :--- | :--- |
| `seg.number(value)` | a float with the point after the integer part and the remaining positions filled with decimals, cut off rather than rounded (the EVN Arduino layout): `12.5` → `12.50`, `3.14159` → `3.141`, `1234.5` → `1234.`, `-1.5` → `-1.50`; a float of 10000 or more shows `9999`, of −1000 or less `-999`. An int goes to the `integer()` layout and raises `ValueError("number must be -999..9999")` outside that range; NaN or infinity raise `ValueError`. Clears the colon |
| `seg.integer(value)` | −999..9999, right-aligned, a minus before a negative number (`-42` → ` -42`); outside the range `ValueError`. Clears the points and the colon |
| `seg.text(text)` | up to 4 characters, left-aligned (any after the fourth are ignored); a `'.'` after a character lights that character's point (`"12.5"`). Every position is cleared first (the colon is kept). Lower case is accepted; a character without a glyph (see `char()`) raises `ValueError`, with the characters before it already drawn |
| `seg.digit(position, value)` | `value` 0..9 at `position` 0..3 (else `ValueError`); the position's point is kept |
| `seg.char(position, letter)` | the first character of `letter`: `0`–`9`, `A B C D E F G H J L N O P R T U Y` (either case), `-`, `_` or a space; anything else, or an empty string, raises `ValueError`. The position's point is kept |
| `seg.point(position, on=True, /)` | the decimal point after that position; a `False` last argument turns it off |
| `seg.colon(on=True, /)` | the colon between positions 1 and 2; `False` turns it off |
| `seg.segments(position, mask)` | raw segments, `mask` 0..255: a..g = bits 0..6, the point = bit 7 |
| `seg.clear_position(position, clear_point=True, /)` | blank one position; a `False` last argument keeps its point |
| `seg.clear()` | every segment, point and the colon off |
| `seg.fill()` | every segment, point and the colon on |
| `seg.show()` | send the picture to the chip now and wait (≈ 1.1 ms) instead of within the next 10 ms; `OSError` while the display is unplugged |
| `seg.raw([frame])`, `seg.raw(led, on)` | the chip's 16 display-RAM bytes: `seg.raw()` returns them (as held by the firmware), `seg.raw(frame)` writes all 16 (another length raises `ValueError`), `seg.raw(led, on)` sets one LED 0..127 (= byte × 8 + bit) |

### Panel

| Call | Notes |
| :--- | :--- |
| `seg.brightness([level])` | 1 (dim) .. 16 (default), the whole display |
| `seg.blink([hz])` | 0 (off, the default), 2, 1 or 0.5 Hz; any other value raises `ValueError` |
| `seg.on(enable=True, /)` | switch the display on (or off with `False`); what it shows is kept |
| `seg.off()` | switch the display off; what it shows is kept and comes back with `on()` |
| `seg.keys([enable])` | the chip's key scan: `seg.keys(True)` / `seg.keys(False)` turns it on or off (off by default), `seg.keys()` returns the six key-scan bytes, or raises `ValueError("key scan is off: keys(True)")` while it is off or before its first scan. The EVN board has no keys wired: six zero bytes |
| `seg.close()` | switch the display off (chip in standby) and free the port. Two objects on one port share the display, so closing one closes both |

**Example**

```python
from evn import SevenSegmentLED
seg = SevenSegmentLED(2)
seg.text("1234"); seg.colon(True)   # 12:34
seg.number(3.14159)                  # 3.141 (number() clears the colon)
```

**Notes**

Every call changes a picture held in the firmware, which reaches the chip within 10 ms (1.7–4.9 ms measured; many changes in a row go out as one write); `show()` sends it at once. The calls and settings keep working while the display is unplugged, and a replugged display gets its digits, brightness and blink back by itself (the firmware looks for it every 250 ms).

The constructor raises `OSError` when nothing answers on the port or the display pool is full. The display's getters read the firmware's copy and do not raise while it is unplugged; `show()` does, and so does a setting sent while the chip stops answering. After `close()` every call except `close()` raises `ValueError("SevenSegmentLED is closed")`.

## RGBLED — RGB LED module (WS2812B)

Plug the EVN RGB LED module (or any WS2812B strip) into a servo port; the strip borrows that port's servo channel while the object is open.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `leds = RGBLED(port, count=8, *, invert=False)` | `port` is the servo port, 1..4; `count` 1..64 LEDs (8 = the EVN module), brightness starts at 255 and every LED off. `invert` is keyword-only: `True` makes LED 0 the far end of the strip. `ValueError` for a port or count out of range; `OSError` while a `Servo` object holds the port (`"servo port n is used by a Servo object"`), while another `RGBLED` already has it (`"... already has an RGBLED strip"`) or when the channel cannot be taken (`"... is not available for an LED strip"`) |

### Colours

| Call | Notes |
| :--- | :--- |
| `leds.on(color)` | every LED this colour (Pybricks `hub.light.on`): a `Color`, an `(r, g, b)` tuple, or `None` for off |
| `leds.on([c0, c1, ...])` | one colour per LED from LED 0 on (Pybricks `ColorLightMatrix`); `None` in the list turns that LED off, LEDs past the end of the list keep their colour, entries past `count` are ignored |
| `leds.off()` | every LED off (ends a pattern) |
| `leds.set(led, r, g, b)`, `leds.set(led, color)` | one LED; `color` is a `Color` or an `(r, g, b)` tuple, components 0..255. `led` 0..`count`−1, else `ValueError("led index out of range")` |
| `leds.fill(r, g, b)`, `leds.fill(color)` | every LED the same colour |
| `leds.range(first, last, r, g, b)`, `leds.range(first, last, color)` | LEDs `first`..`last` inclusive |
| `leds.clear()` | every LED off |
| `leds.get(led)` | `(r, g, b)` stored for that LED, before the brightness scale |
| `leds.hsv(h, s, v)` | colour helper, does not touch the strip: `h` degrees (wrapped into 0..359), `s` and `v` 0..100 → `(r, g, b)`; `ValueError` for `s` or `v` outside 0..100 |

### Patterns

| Call | Notes |
| :--- | :--- |
| `leds.blink(color, durations)` | background pattern, the whole strip: `color` on / off for `[on1, off1, on2, off2, ...]` ms, repeated until something else is written. 2..16 entries, an even number of them, each ≥ 2 ms, else `ValueError`. `leds.blink(Color.BLUE, [500, 500])` |
| `leds.animate(colors, interval)` | background pattern: the colours one after another for `interval` ms each (≥ 2 ms), repeated. 1..16 colours; `None` is off. `leds.animate([Color.RED, Color.GREEN], 250)` |
| `leds.pattern()` | `'blink'`, `'animate'` or `None` |
| `leds.stop()` | end the pattern and keep the colours it was showing |

### Settings

| Call | Notes |
| :--- | :--- |
| `leds.brightness([value])` | global scale 0..255 (default 255, very bright on the EVN module: 40 or so is plenty indoors) applied as the frame is sent; the stored colours keep their full values |
| `leds.count([n])` | LEDs on the strip, 1..64. An LED re-exposed by a larger count is off until it is set; LEDs beyond a smaller count are no longer sent, so they keep showing their last colour (clear them before shrinking the count) |
| `leds.invert([enable])` | `True`: LED 0 is the far end of the strip (a module mounted the other way round) |
| `leds.show()` | send the frame now and return once the strip has it (0.6 ms on the 8-LED module: 30 µs per LED + 340 µs latch). Not needed: every change goes out by itself within a millisecond. `OSError(ETIMEDOUT)` if the previous frame blocks it for 20 ms |
| `leds.close()` | a black frame goes out (to the `count()` LEDs only) and the servo channel is handed back once it has drained, so the strip is dark and the port free about 1–3 ms later: `Servo(port)` then works without a soft reset, straight away too (its constructor waits up to 10 ms for the hand-back). A second `close()` does nothing, and never touches a strip a newer `RGBLED(port)` has opened |

**Example**

```python
from evn import RGBLED, Color
leds = RGBLED(1)                      # servo port 1, the 8-LED module
leds.on([Color.RED, Color.GREEN, None, Color.BLUE])
leds.blink(Color.YELLOW, [200, 200, 200, 800])   # double blink, in the background
```

**Notes**

Any `set()`, `fill()`, `range()`, `clear()`, `on()` or `off()` ends a running `blink()` / `animate()`. A pattern is stepped by the firmware's 1 kHz poll in the background, so it keeps time while the program waits, prints or computes; a step below 2 ms is refused rather than silently stretched. Colours accept the whole `Color` set, including `Color(h, s, v)`, `c * 0.5` (dimmer) and `c >> 30` (hue shifted).

The servo port has one owner at a time: `Servo(n)` raises `OSError("servo port n is used by an RGBLED strip")` while the strip is open, and `RGBLED(n)` raises while a `Servo` object holds the port (`Servo.close()` gives it back). A servo port pulses nothing until a `Servo` object is built, so a strip plugged in at power-on stays dark.

Nothing is read back from the strip, so there is no unplug detection: writes to an unplugged strip simply go nowhere. After `close()` every call except `close()` itself raises `ValueError("RGBLED is closed")`, even once a new `RGBLED(port)` has opened the same port: an old object never acts on the new one's strip.

## Servo — hobby servo (Geekservo 270° / continuous-rotation)

Plug a servo into servo port 1..4 and name its profile; `Servo(port)` is the kit's Geekservo 270° servo, `Servo(port, "geekservo_360")` the grey Geekservo 2KG that turns to an angle over a full 360°, and any other servo is the `generic` profile with its own `range`, `min_us` and `max_us` (the Board view's *Custom servo...* builds that line for you). The port sends 50 Hz pulses, and a new position is on the wire within one 20 ms frame.

| Profile | Travel | Pulse | Start | Sweep limit | Drive with |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `"geekservo_270"` (default) | 0..270° | 600..2400 µs | 135° | 500 deg/s | `angle()`, `move()` |
| `"geekservo_360"` | 0..360° (the grey Geekservo 2KG) | 500..2500 µs | 180° | 400 deg/s | `angle()`, `move()` |
| `"generic"` | 0..180° | 500..2500 µs | 90° | 500 deg/s | `angle()`, `move()` |
| `"geekservo_cr"` | continuous rotation | 600..2400 µs, stop = 1500 µs | stopped | — | `duty()` |

**Constructor**

| Call | Notes |
| :--- | :--- |
| `servo = Servo(port, profile="geekservo_270", reverse=False, *, range=None, min_us=None, max_us=None, start=None, max_dps=None)` | `port` 1..4; `profile` one of the four above. `reverse=True` mirrors the direction (0° at the `max_us` end; a positive duty the other way). The keyword-only overrides replace one field of the profile: `range` 0..3600 degrees (0 = continuous rotation), `min_us` / `max_us` 200..2800 with `min_us < max_us`, `start` degrees within the range, `max_dps` ≥ 1. `range=R` without `start=` starts at R/2. The servo goes to its start position (or its stop pulse) at once. `ValueError` for any value out of range, an unknown profile or a non-finite number; `OSError` while an `RGBLED` strip holds the port or the port is not available |

### Moving

| Call | Notes |
| :--- | :--- |
| `servo.angle([deg, reverse=False])` | fixed-range profiles: jump to `deg` (0..range, else `ValueError`); `reverse` (positional) mirrors this one write's pulse, but the tracked position stays `deg`, so a later `move()` starts from the unmirrored `deg` and the servo jumps first — use the constructor's `reverse=True` for a mirrored mounting. `servo.angle()` → the tracked position in degrees (float) — what was last commanded, not a measurement. `TypeError` on a continuous profile |
| `servo.move(angle, speed=None, wait=True)` | fixed-range profiles: sweep from the tracked position to `angle` at `speed` deg/s (default and upper limit the profile's `max_dps`; a higher speed is capped to it, a negative one counts as positive). `wait=True` returns at the end of the sweep; `wait=False` returns at once — poll `done()`. `speed=0` raises `ValueError` (use `angle()` to jump); `TypeError` on a continuous profile |
| `servo.done()` | `True` when no sweep is running |
| `servo.duty([pct])` | continuous profile: −100..100 % (0 = the stop pulse), pulse = (1 − \|pct\|/100) × half the span from the `min_us` end for a positive duty and from the `max_us` end for a negative one (duty 50 → 1050 µs). `servo.duty()` → the current duty (float). `ValueError` outside −100..100; `TypeError` on a fixed-range profile |
| `servo.stop()` | continuous: the stop pulse (duty 0); fixed-range: end a sweep where it is and hold that position |
| `servo.pulse([us])` | the raw pulse width, 200..2800 µs (`ValueError` outside); the tracked position follows it. `servo.pulse()` → the current width (int) |

### Settings

| Call | Notes |
| :--- | :--- |
| `servo.profile()` | `(name, range, min_us, max_us, start, max_dps, reverse)` in force, overrides and `set_range()` included |
| `servo.set_range(min_us, max_us)` | new pulse endpoints for this servo, 200 ≤ `min_us` < `max_us` ≤ 2800 (`ValueError` otherwise); the current position or duty is re-sent under them at once |
| `servo.enable()` | pulses on again, at the last width |
| `servo.disable()` | pulses off and the pin low: the servo goes limp. Sticky until `enable()` (a later write does not revive it) or a new `Servo` object on the port |
| `servo.close()` | give the port back: the pulse stops and the pin goes low, so an `RGBLED` strip or a new `Servo` object can take it without a soft reset |

**Example**

```python
from evn import Servo
arm = Servo(1)                   # Geekservo 270°, starts at 135°
arm.move(270, speed=200)         # sweep at 200 deg/s, returns at the end
wheel = Servo(2, "geekservo_cr")
wheel.duty(50)                   # about 185 deg/s unloaded; wheel.stop() to stop
```

**Notes**

The emergency stop (Ctrl-C, the board button) ends every sweep and sends a continuous servo its stop pulse; a fixed-range servo keeps holding its position, the way a motor keeps its brake. A servo port pulses nothing until the first `Servo` object on it is built, and a new object drives its port even after `disable()` on an earlier one.

The port has one owner at a time: `RGBLED(n)` raises `OSError("servo port n is used by a Servo object")` while this object is open, and while a strip holds the port the constructor and every writing call here raise `OSError("servo port n is used by an RGBLED strip")`. A strip's `close()` frees the port about 1–3 ms later (its black frame drains first); `Servo(port)` straight after `leds.close()` waits up to 10 ms for that, and raises only if the strip is still open or has not handed the port back within those 10 ms.

A servo has no feedback line, so nothing detects an unplugged servo. After `close()` every call except `close()` itself raises `ValueError("Servo is closed")`.

## Bluetooth — Bluetooth module (HC-05)

Plug the EVN Bluetooth module into Serial 1 or Serial 2. Once a peer is connected the module is a transparent serial link: bytes written on one end come out of the other.

The module has two modes. **Hold its button while switching the board on** and it boots in command mode: the constructor then programs the baud, name and role, reboots the module (about 1 s) and switches to data mode. Switched on without the button it is already in data mode, and the constructor only opens the port at `baud` after a 300 ms `AT` probe that goes unanswered. `configured()` says which happened. The settings persist in the module, so it only needs programming once.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `bt = Bluetooth(port, baud=230400, name="EVN Bluetooth", mode="remote", addr=None, *, stay_in_command=False, wait=True)` | `port` is the serial port, 1 or 2. Applied only in command mode (button held): `baud` 4800..1382400, rounded down to the module's table (4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1382400) — 230400 is the highest the module sustains without losing data; `name` 1..32 characters; `mode` `'remote'` (a PC or a host module connects to it) or `'host'` (it connects by itself to the module at `addr`, `'NAP,UAP,LAP'` as `address()` prints it, `:` accepted). `stay_in_command=True` leaves the module in command mode for `command()`, `address()`, `version()`. `wait=True` returns once the module is ready (`OSError(ETIMEDOUT)` after 3 s); `wait=False` returns at once — poll `ready()`. `ValueError` for any value out of range; `OSError` while an `evn.UART` object or another live `Bluetooth` object holds the port, `OSError(EIO)` when the port cannot be opened |

### Sending and receiving

| Call | Notes |
| :--- | :--- |
| `bt.write(data)` | queue `bytes` for the peer; returns `len(data)`. Every byte is queued, never dropped: it waits only while the 1 KiB transmit queue is full. `OSError(EIO)` if the module leaves data mode meanwhile. Bytes written with no peer connected are lost inside the module |
| `bt.read(n=-1, timeout=0)` | up to `n` bytes (everything buffered when `n` is −1) as `bytes`. `timeout=0` returns at once (`b""` when nothing is waiting), `timeout=None` waits for `n` bytes (at least one when `n` is −1), a value in ms waits at most that long and returns what arrived. `ValueError` for a negative timeout |
| `bt.readline(timeout=5000)` | the next line without its `b"\n"` (and a `b"\r"` in front of it), or `None` on timeout or if the module leaves data mode. Only the line leaves the buffer; `timeout=0` never waits; `ValueError` for a negative timeout. A line longer than 255 bytes never completes and `overflow()` counts the drop |
| `bt.read_all()` | everything buffered, at once (`b""` when nothing) |
| `bt.any()`, `bt.waiting()` | bytes buffered (`waiting` is the Pybricks `UARTDevice` name) |
| `bt.overflow()` | bytes the 256-byte receive buffer had to drop since the last call because the program read too slowly; read-and-clear, 0 means nothing was lost |
| `bt.clear()` | drop everything buffered |
| `bt.wait_until(pattern, timeout=None)` | wait for the byte sequence `pattern` (1..32 bytes), discarding everything up to and including it; `True` when it arrived, `False` after `timeout` ms. `OSError(EIO)` if the module leaves data mode |
| `bt.set_baudrate(baud)` | the board side's speed, 1200..1382400, for a module already set to another baud (the module's own baud only changes through the constructor). Queued bytes leave at the old speed first. Data mode only, `ValueError` otherwise |

### The module

| Call | Notes |
| :--- | :--- |
| `bt.repl([enable])` | `bt.repl(True)` puts the board's REPL (prompt, `print()`, tracebacks, Ctrl-C) on the module as well as USB; `bt.repl()` → whether it is on. Data mode only (`ValueError("repl needs data mode")`). Bytes the REPL consumes never reach `read()`. Survives a soft reboot; put it in `boot.py` for every power-up |
| `bt.state()` | `'probing'`, `'configuring'`, `'resetting'`, `'command'`, `'data'` or `'closed'` |
| `bt.ready()` | `True` in data mode, or in command mode with no command in flight. The module's STATE pin is not on the header, so it does **not** mean a peer is connected |
| `bt.configured()` | `True` when the module was found in command mode and accepted every setting |
| `bt.config_errors()` | the configuration commands the module refused (`"AT+UART"`, `"AT+NAME"`, `"AT+ROLE"`, `"AT+CMODE"`, `"AT+BIND"`, `"AT+RESET"`) followed by its last reply (`"ERROR:(n)"`, `"FAIL"`, or `""` for a timeout); `()` when everything was accepted |
| `bt.in_command_mode()` | `True` while the module is in command mode |
| `bt.command(cmd)` | command mode only: send one AT command (`"AT+NAME?"`) and return `(ok, payload)` — whether the module answered `OK`, and its last reply line. `OSError("module is not in command mode")` in data mode, `OSError(ETIMEDOUT)` when no reply comes within 300 ms |
| `bt.address()`, `bt.version()` | command mode only: the module's Bluetooth address (`"98D3:41:F71802"`) and firmware version as strings, `None` when the module did not answer; the same `OSError`s as `command()` |
| `bt.exit_command_mode()` | reboot the module into data mode (`AT+RESET`, about 1 s until `ready()`); `True` when it answered `OK` (at once when already in data mode) |
| `bt.factory_reset()` | command mode only: `AT+ORGL`, the module's factory settings (role remote, the bound address cleared) **including its data baud** (38400 on an HC-05 3.0), so a default `Bluetooth(n)` at 230400 can no longer talk to it; `True` when it answered `OK`. The module is left in command mode while the board's port reports data mode: switch the board off and on and re-program the module with its button held (`Bluetooth(n)` programs the baud again), or open it in data mode with `Bluetooth(n, baud=38400)` |
| `bt.startup_time()` | ms from the constructor to the module being ready (0 while it is not yet) |
| `bt.close()` | release the serial port (the REPL leaves the module if it was on it), so an `evn.UART` or a new `Bluetooth` object can take it. Dropping the object without `close()` closes it too, unless the module carries the REPL |

**Example** — the REPL over the air, in `boot.py`:

```python
import evn
bt = evn.Bluetooth(2)
bt.repl(True)
```

**Notes**

**Pairing with a PC.** Pair the module in the Windows Bluetooth settings (it shows as `HC-05` or `EVN Bluetooth`, PIN `1234`); Windows then lists a *Standard Serial over Bluetooth link (COMxx)* port, and a PC program that opens it talks to `bt.read()` / `bt.write()`. Only a module in the `'remote'` role can be reached from a PC.

**Two modules, no PC.** Program one module as the host bound to the other's address, once: switch on with the host module's button held and run `Bluetooth(1, mode="host", addr="98D3:41:F71802")` (the address the other module's `address()` gave). From then on the host connects to that module by itself at every power-up.

**The REPL over the air.** `bt.repl(True)` lets the PC's Bluetooth COM port carry the prompt, Run and Stop, so the USB cable can come out ([Getting started](GETTING_STARTED.md), §5a; the *Board* view does the whole set-up). In `boot.py`:

A module that already carries the REPL — even one whose object was dropped, as in `evn.Bluetooth(2).repl(True)` — is adopted as it stands by a plain `Bluetooth(n)`: at the port's own baud, nothing sent to the module, `configured()` `False`. Any configuration argument (a `baud` equal to the port's own is accepted) then raises `ValueError("the module carries the REPL; call repl(False) before changing its configuration")`; a program that needs the module for its own traffic calls `bt.repl(False)` first.

One object per serial header: `Bluetooth(n)` raises `OSError("serial port n is used by a UART object")` while an `evn.UART` object holds the port, `OSError("serial port n is already open")` while another live `Bluetooth` object does, and `UART(n)` raises the mirror error while this object holds it. The module does not answer from the serial side in data mode, so the constructor does not detect an absent module, and nothing detects an unplug. After `close()` every call except `close()` itself raises `ValueError("Bluetooth is closed")`, even once a new `Bluetooth(n)` has opened the same port: an old object never acts on the new one's module, and its second `close()` does nothing.
