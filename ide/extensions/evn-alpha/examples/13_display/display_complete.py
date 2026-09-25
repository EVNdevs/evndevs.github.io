"""Display: the whole API

Every Display method once: text on the 16 x 8 character grid, label / data rows, the print()
console and mirroring, drawing with pixels and with the EV3 screen names, the whole picture as
bytes, and the panel's own settings and effects. Every setting the example changes it puts back,
and it ends with a blank screen.

Text uses columns 0..15 and rows 0..7. Drawing uses pixels: x 0..127 from the left, y 0..63 from
the top. Drawing goes into a picture kept by the board, which sends it to the panel by itself.

Needs: the OLED display on I2C port 1.
"""
from evn import Display, Color, battery, wait

# --- the constructor ---------------------------------------------------------------------------
display = Display(1)                     # I2C port 1..16; starts blank and on
print(display)                           # port, address, contrast, flip, invert, on
print("size:", display.width, "x", display.height, "pixels")    # 128 x 64

# --- the EVN logo --------------------------------------------------------------------------------
display.splash()
display.show()                           # send the picture now and wait (it would go out anyway)
wait(1500)

# --- text on the character grid ----------------------------------------------------------------
display.clear()                          # blank screen; the print() cursor goes to the top left
display.write(0, "EVN ALPHA")            # a whole row, filled up with spaces to 16 characters
display.write(1, "to be removed")
count = display.text(0, 3, "dark on lit", invert=True)   # at column 0, row 3; returns 11 characters
display.text(count + 1, 3, count)        # numbers work too: "11" right after it
display.label(5, "Battery:")             # a label at the start of row 5 ...
display.data(5, battery.voltage())       # ... and a value after it (millivolts)
wait(1500)
display.clear_row(1)                     # blank one row
for step in range(5):
    display.data(5, battery.voltage())   # only the value changes, the label stays
    wait(300)

# --- the print() console ------------------------------------------------------------------------
display.clear()
for line in range(10):
    display.print("line", line)          # like print(): wraps at 16 characters, scrolls at the bottom
    wait(200)
print("mirroring:", display.mirror())    # False: only this program writes to the display
display.mirror(True)                     # from now on every print() of the board shows here too
print("on USB and here")
wait(1500)
display.mirror(False)                    # back to USB only

# --- pixels, lines and rectangles (every corner must be on the screen) ------------------------
display.clear()
display.pixel(0, 0, True)                # light the top left pixel
print("pixel (0, 0) lit:", display.pixel(0, 0))   # read it back: True
display.line(0, 63, 127, 0)              # corner to corner
display.rect(10, 10, 40, 30)             # an outline
display.rect(50, 10, 80, 30, fill=True)  # filled
display.rect(55, 15, 75, 25, False, fill=True)    # False erases: a hole in the middle
wait(1500)

# --- the EV3 screen names: clipped at the edges; Color.BLACK (the default) lights a pixel, -------
# --- Color.WHITE erases it -----------------------------------------------------------------------
display.clear()
display.draw_line(0, 32, 127, 32, width=3)           # a 3-pixel-thick line
display.draw_box(4, 4, 44, 24, r=5)                  # round corners
display.draw_circle(64, 32, 20, fill=True)
display.draw_circle(64, 32, 8, fill=True, color=Color.WHITE)   # erase a smaller disc inside
display.draw_pixel(120, 60)
display.draw_text(80, 4, "EV3", text_color=Color.WHITE, background_color=Color.BLACK)  # dark on lit
wait(2000)

# --- the whole picture as 1024 bytes -----------------------------------------------------------
saved = display.frame()                  # keep a copy of the picture
display.clear()
wait(500)
display.frame(saved)                     # and put it back
wait(1000)

# --- panel settings: each one is read, changed, and put back -----------------------------------
contrast = display.contrast()            # 1..255
display.contrast(1)                      # dimmest
wait(1000)
display.contrast(contrast)

flipped = display.flip()
display.flip(not flipped)                # upside down (the picture is sent again)
wait(1500)
display.flip(flipped)

inverted = display.invert()
display.invert(not inverted)             # dark on lit; the picture itself is unchanged
wait(1500)
display.invert(inverted)

display.off()                            # the panel sleeps, the picture is kept ...
wait(1000)
display.on()                             # ... and comes back

# --- panel effects: done by the panel itself, the picture is not changed ------------------------
display.all_on()                         # every pixel lit (a panel test)
wait(1000)
display.all_on(False)
display.zoom()                           # the panel's zoom: every row twice as tall
wait(1500)
display.zoom(False)
display.fade("blink", 1)                 # fades out and in again, over and over
wait(4000)
display.fade("off")
display.scroll()                         # the whole picture scrolls to the right, round and round
wait(3000)
display.scroll_stop()                    # stop; the picture is sent again as it was
display.scroll(left=True, rows=(0, 3), speed=7)    # only rows 0..3, to the left; speed 0..7 is a
wait(3000)                                         # panel code, not in order (7 is the fastest)
display.scroll_stop()

# --- the end: a blank screen, and the port is free again --------------------------------------
display.clear()
display.show()
display.close()                          # also switches the panel off
