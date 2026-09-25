"""LED matrix: the whole API

Every MatrixLED method once: pictures (icons, your own bitmaps), numbers, text and letters,
pixels and lines, background animations, which way up the matrix is mounted, brightness and
blinking, and the chip's raw memory and key scan. Every setting the example changes it puts back,
and it ends with a blank matrix.

Pixels are (row, column): row 0..7 from the top, column 0..7 from the left. Drawing changes a
picture kept by the board, which sends it to the matrix within 10 ms by itself.

Needs: the 8x8 LED matrix on I2C port 1.
"""
from evn import MatrixLED, Icon, Side, wait

# --- the constructor ---------------------------------------------------------------------------
matrix = MatrixLED(1)                    # I2C port 1..16; starts blank, on, brightness 16, no blink
print(matrix)                            # port, address, brightness, blink, on

# --- pictures ----------------------------------------------------------------------------------
matrix.icon(Icon.HEART)                  # one of the built-in icons
wait(1000)
matrix.bitmap(b"\x18\x3c\x7e\xff\xff\x7e\x3c\x18")   # your own: 8 bytes, top row first,
wait(1000)                                           # the left pixel is the highest bit
matrix.image([[1, 0, 0, 0, 0, 0, 0, 1],  # the Pybricks form: 8 rows of 8 values, non-zero = on
              [0, 1, 0, 0, 0, 0, 1, 0],
              [0, 0, 1, 0, 0, 1, 0, 0],
              [0, 0, 0, 1, 1, 0, 0, 0],
              [0, 0, 0, 1, 1, 0, 0, 0],
              [0, 0, 1, 0, 0, 1, 0, 0],
              [0, 1, 0, 0, 0, 0, 1, 0],
              [1, 0, 0, 0, 0, 0, 0, 1]])
wait(1000)

# --- numbers, text and letters -------------------------------------------------------------------
for n in (-42, 0, 7, 99):
    matrix.number(n)                     # -99..99 in small digits
    wait(700)
matrix.text("EVN")                       # one letter at a time: 500 ms lit, 50 ms dark; waits
matrix.text("HI", 300, 100)              # 300 ms lit, 100 ms dark
matrix.char("?")                         # one letter that stays
wait(1000)

# --- pixels, lines and rectangles --------------------------------------------------------------
matrix.clear()                           # every LED off
matrix.hline(0, 0, 7)                    # row 0, columns 0..7: a line along the top
matrix.hline(7, 0, 7)                    # ... and the bottom
matrix.vline(0, 0, 7)                    # column 0, rows 0..7: the left edge
matrix.vline(7, 0, 7)                    # ... and the right edge
matrix.rect(3, 3, 4, 4)                  # a filled 2 x 2 square in the middle
matrix.pixel(1, 1)                       # one pixel (row 1, column 1)
matrix.show()                            # send the picture now instead of within 10 ms
print("pixel (1, 1) lit:", matrix.get(1, 1))   # True
wait(1500)
matrix.pixel(1, 1, 0)                    # 0 (or False) turns a pixel off
matrix.rect(3, 3, 4, 4, False)           # False erases: the square goes
matrix.hline(0, 0, 7, False)             # and so does the top line
wait(1000)
matrix.fill()                            # every LED on
wait(1000)

# --- animations in the background: the program goes on while they run ---------------------------
matrix.animate([Icon.HAPPY, Icon.SAD], 400)   # these pictures in turn, 400 ms each, until stopped
for step in range(10):
    print("animating:", matrix.animating())   # True
    wait(300)
matrix.stop()                            # stop; the picture that is showing stays
matrix.text("GO", wait=False)            # text in the background too ...
while matrix.animating():                # ... until it is over
    wait(10)

# --- which way up the matrix is mounted ---------------------------------------------------------
print("top up:", matrix.orientation() == Side.TOP)   # True: as wired, how a new MatrixLED starts
matrix.orientation(Side.RIGHT)           # the matrix is turned: its right edge is up
matrix.icon(Icon.ARROW_UP)               # drawing from now on is turned to match
wait(1500)
matrix.orientation(invert_x=True)        # a mirror image (a matrix seen from behind)
print("mirrored:", matrix.orientation())     # (True, False, False): not a turn, so the three flags
matrix.char("R")
wait(1500)
matrix.orientation(Side.TOP)             # back as wired

# --- brightness, blinking, on and off ------------------------------------------------------------
matrix.icon(Icon.SQUARE)
level = matrix.brightness()              # 1 (dim) .. 16 (bright)
matrix.brightness(1)
wait(1000)
matrix.brightness(level)                 # put it back
blinking = matrix.blink()                # 0 (off), 2, 1 or 0.5 blinks a second
matrix.blink(2)                          # the chip blinks the whole matrix
wait(2000)
matrix.blink(blinking)
matrix.off()                             # dark, but the picture is kept ...
wait(1000)
matrix.on()                              # ... and comes back

# --- the chip itself: its 16 bytes of LED memory and its key scan --------------------------------
saved = matrix.raw()                     # the 16 memory bytes, one bit per LED
matrix.raw(0, True)                      # one LED by its number 0..127 (byte * 8 + bit); which
wait(1000)                               # pixel that is depends on the board's wiring
matrix.raw(saved)                        # write all 16 bytes back: the square again
wait(1000)
matrix.keys(True)                        # the chip can also scan keys ...
wait(50)                                 # (the first scan takes a moment)
print("keys:", matrix.keys())            # ... none are wired on the EVN matrix: six zero bytes
matrix.keys(False)

# --- the end: a blank matrix, and the port is free again ---------------------------------------
matrix.clear()
matrix.show()
matrix.close()                           # also puts the chip in standby
