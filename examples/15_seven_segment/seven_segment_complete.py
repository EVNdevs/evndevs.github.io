"""7-segment display: the whole API

Every SevenSegmentLED method once: numbers (whole and decimal), text, single digits and letters,
the points and the colon, raw segments, brightness and blinking, and the chip's raw memory and key
scan. Every setting the example changes it puts back, and it ends with a blank display.

Positions are 0..3 from the left. Every call changes a picture kept by the board, which sends it
to the display within 10 ms by itself.

Needs: the 7-segment display on I2C port 1.
"""
from evn import SevenSegmentLED, wait

# --- the constructor ---------------------------------------------------------------------------
seg = SevenSegmentLED(1)                 # I2C port 1..16; starts blank, on, brightness 16, no blink
print(seg)                               # port, address, brightness, blink, on

# --- numbers -----------------------------------------------------------------------------------
seg.number(1234)                         # a whole number: -999..9999, right aligned
wait(1000)
seg.number(-42)                          # " -42"
wait(1000)
seg.number(3.14159)                      # a decimal: as many decimals as fit, cut off: "3.141"
wait(1000)
seg.number(12.5)                         # "12.50"
wait(1000)
seg.integer(7)                           # whole numbers only: "   7"
wait(1000)

# --- text --------------------------------------------------------------------------------------
seg.text("HELP")                         # up to 4 characters, left aligned
wait(1000)
seg.text("12.5")                         # a '.' lights the point of the character before it
wait(1000)
# Only 0-9, A B C D E F G H J L N O P R T U Y, '-', '_' and a space have a shape; anything else
# (K, M, S, V, ...) raises ValueError. Lower case is shown the same as upper case.

# --- one position at a time --------------------------------------------------------------------
seg.clear()                              # every segment, point and the colon off
seg.digit(0, 1)                          # position 0: the digit 1
seg.digit(1, 2)
seg.char(2, "A")                         # position 2: a letter
seg.char(3, "b")                         # lower case works too (the same shape as "B")
seg.point(1)                             # the point after position 1: "12.Ab"
wait(1500)
seg.point(1, False)
seg.clear_position(3)                    # blank position 3 (and its point)
seg.clear_position(2, False)             # blank position 2 but keep its point
wait(1000)

# --- a clock -----------------------------------------------------------------------------------
for minute in range(5):
    seg.text("120" + str(minute))        # 12:00, 12:01, ...
    seg.colon(True)                      # the colon between positions 1 and 2
    wait(500)
    seg.colon(False)                     # blink it like a clock
    wait(500)

# --- raw segments: a..g are bits 0..6, the point is bit 7 --------------------------------------
seg.clear()
for turn in range(3):
    for mask in (1, 2, 4, 8, 16, 32):    # a b c d e f: the outer ring, one segment at a time
        seg.segments(0, mask)
        wait(80)
seg.segments(0, 0b01110110)              # b c e f g: an H drawn by hand
wait(1000)

# --- brightness, blinking, on and off ------------------------------------------------------------
seg.fill()                               # every segment, point and the colon on: "8.8.:8.8."
level = seg.brightness()                 # 1 (dim) .. 16 (bright)
seg.brightness(1)
wait(1000)
seg.brightness(level)                    # put it back
blinking = seg.blink()                   # 0 (off), 2, 1 or 0.5 blinks a second
seg.blink(1)                             # the chip blinks the whole display
wait(3000)
seg.blink(blinking)
seg.off()                                # dark, but what it shows is kept ...
wait(1000)
seg.on()                                 # ... and comes back
seg.show()                               # send the picture now instead of within 10 ms

# --- the chip itself: its 16 bytes of LED memory and its key scan --------------------------------
seg.number(42)
saved = seg.raw()                        # the 16 memory bytes, one bit per LED
seg.raw(0, True)                         # one LED by its number 0..127 (byte * 8 + bit); which
wait(1000)                               # segment that is depends on the board's wiring
seg.raw(saved)                           # write all 16 bytes back: 42 again
wait(1000)
seg.keys(True)                           # the chip can also scan keys ...
wait(50)                                 # (the first scan takes a moment)
print("keys:", seg.keys())               # ... none are wired on the EVN board: six zero bytes
seg.keys(False)

# --- the end: a blank display, and the port is free again --------------------------------------
seg.clear()
seg.show()
seg.close()                              # also puts the chip in standby
