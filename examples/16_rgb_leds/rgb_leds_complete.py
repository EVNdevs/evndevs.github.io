"""RGB LEDs: the whole API

Every RGBLED method once: colours for every LED, one LED or a range of them, reading a colour
back, the brightness, patterns that run in the background (blink, animate), the colour helper
hsv(), and the strip's length and direction. Every setting the example changes it puts back, and
the LEDs are off at the end.

A colour is a Color (Color.RED, Color(200, 100, 100) as hue, saturation, value) or a tuple
(r, g, b) of 0..255 each. LED 0 is the one at the plug. Every change reaches the strip within a
millisecond by itself.

Needs: the RGB LED module (8 LEDs) on servo port 1.
"""
from evn import RGBLED, Color, wait

# --- the constructor ---------------------------------------------------------------------------
leds = RGBLED(1)                         # servo port 1..4, 8 LEDs (count=1..64 for a longer strip)
print(leds)                              # port, count, brightness, invert

# --- brightness: one scale for the whole strip, 0..255 -----------------------------------------
full = leds.brightness()                 # 255 at the start: very bright
leds.brightness(40)                      # comfortable to look at; put back at the end

# --- colours -------------------------------------------------------------------------------------
leds.fill(Color.RED)                     # every LED, a named colour
wait(1000)
leds.fill(0, 0, 255)                     # every LED, red / green / blue 0..255
wait(1000)
leds.clear()                             # every LED off
leds.set(0, 255, 255, 255)               # one LED: white
leds.set(1, Color.GREEN)                 # a Color ...
leds.set(2, (255, 120, 0))               # ... or an (r, g, b) tuple
leds.range(4, 7, Color.MAGENTA)          # LEDs 4 to 7, both included
leds.range(3, 3, 0, 255, 255)            # a range of one: LED 3
leds.show()                              # send it now and wait (it would go out by itself anyway)
print("LED 2 is", leds.get(2))           # (255, 120, 0): the colour as stored, before the brightness
wait(1500)

# --- the Pybricks names: on() with one colour or one per LED, off() --------------------------------
leds.on(Color.YELLOW)                    # every LED
wait(1000)
leds.on([Color.RED, Color.GREEN, None, Color.BLUE])   # LEDs 0..3; None is off, 4..7 keep theirs
wait(1500)
leds.off()                               # every LED off

# --- hsv(): a colour from hue 0..359, saturation and value 0..100 -------------------------------
for led in range(8):                     # a rainbow along the strip
    leds.set(led, leds.hsv(led * 45, 100, 100))   # hsv() returns (r, g, b)
wait(2000)

# --- patterns: they run in the background while the program goes on ------------------------------
leds.blink(Color.BLUE, [200, 200])       # 200 ms on, 200 ms off, again and again
wait(2000)
leds.blink(Color.RED, [100, 100, 100, 700])   # a double blink: on, off, on, a long off
wait(3000)
leds.animate([Color.RED, Color.YELLOW, Color.GREEN, None], 300)   # each colour 300 ms, None is off
for step in range(5):
    print("pattern:", leds.pattern())    # 'animate' ('blink' during a blink, None with none)
    wait(400)
leds.stop()                              # stop; the LEDs keep the colour they were showing
print("pattern:", leds.pattern())        # None
wait(1000)
leds.off()                               # (any set / fill / range / clear / on / off also ends a pattern)

# --- the strip: how many LEDs, and which end is LED 0 ---------------------------------------------
length = leds.count()                    # 8
leds.count(4)                            # only LEDs 0..3 are sent from now on
leds.fill(Color.CYAN)                    # so only four light up
wait(1500)
leds.count(length)                       # back to 8; LEDs 4..7 come back off
flipped = leds.invert()                  # False: LED 0 is at the plug
leds.invert(not flipped)                 # now LED 0 is the far end (a module mounted the other way)
leds.clear()
leds.set(0, Color.RED)                   # so this lights the LED furthest from the plug
wait(1500)
leds.invert(flipped)                     # back as it was

# --- the end: every LED off, the brightness as it was, and the servo port free again --------------
leds.off()
leds.brightness(full)
leds.close()                             # the strip goes dark and Servo(1) can use the port again
