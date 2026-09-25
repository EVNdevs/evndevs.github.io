"""Colour sensor: the whole API

Every ColorSensor method once: naming a colour, the numbers behind it, your own list of colours, a
white / black calibration, the chip settings (gain, integration time, wait time) and its
light-level alarm. The firmware keeps the latest reading fresh in the background, so reading in a
loop costs nothing; read() waits for the next new one. Anything the example changes it puts back.
Some steps ask you to hold something under the sensor: the text says what, and when.

Needs: the colour sensor on I2C port 1, a white and a black surface, and something coloured.
"""
from evn import ColorSensor, Color, StopWatch, wait

cs = ColorSensor(1)                     # I2C port 1..16; OSError if no TCS34725 answers there
print(cs)                               # ColorSensor(1, id=0x44, gain=16x, integration_time=2.4) (or id=0x4d)
print("chip id", hex(cs.id()))          # 0x44 (TCS34725) or 0x4d (TCS34727)

# --- naming the colour ---------------------------------------------------------------------------
# color() picks the nearest of detectable_colors(): by default RED, YELLOW, GREEN, BLUE, WHITE or
# NONE. Coloured things are told apart by hue alone, at any distance or light level.
print("move coloured things under the sensor ...")
for i in range(10):
    colour, confidence = cs.color_match()   # the same choice, and how sure: 1.0 sure, 0.0 a coin flip
    print(cs.color(), "match", colour, "confidence %.2f" % confidence)
    wait(300)

# --- the numbers behind it -----------------------------------------------------------------------
c = cs.hsv()                            # a Color: hue 0..359, saturation 0..100, value 0..100
print("hue", c.h, "saturation", c.s, "value", c.v)
print("rgb", cs.rgb())                  # (r, g, b) 0..255, each relative to the clear channel
print("raw", cs.raw())                  # (clear, red, green, blue) counts of the latest reading
print("next reading", cs.read())        # the same four, but waits for a new reading (about 5 ms)
print("percent", cs.percent())          # the four as % of full scale
print("ambient", cs.ambient(), "%")     # the clear channel alone, in % of full scale
print("lux about", cs.lux(), "colour temperature about", cs.color_temperature(), "K")   # estimates, not calibrated
print("reading is", cs.age(), "ms old")

# --- your own list of colours ----------------------------------------------------------------------
# Standard colours or measured ones: print cs.hsv() over the thing you want to find and put those
# numbers in a Color.
old_colours = cs.detectable_colors()
cs.detectable_colors((Color.GREEN, Color.MAGENTA, Color(h=348, s=96, v=40), Color.NONE))
print("now choosing from", cs.detectable_colors(), "->", cs.color())
cs.detectable_colors(old_colours)       # back to the six

# --- calibration on white and black --------------------------------------------------------------
# WHITE and NONE differ only in brightness, so telling them apart needs a calibration: the counts
# on black and on white, per channel. normalized() then reads 0..100 between them, and color() and
# hsv(normalized=True) use it. (The ranges live in the object only; nothing is stored on the board.)
old_ranges = cs.ranges()                # ((low, high) or None) for clear, red, green, blue
print("hold the sensor over WHITE"); wait(3000); white = cs.read()
print("hold the sensor over BLACK"); wait(3000); black = cs.read()
if all(w > b for w, b in zip(white, black)):    # each range needs low < high
    cs.ranges(clear=(black[0], white[0]), red=(black[1], white[1]),
              green=(black[2], white[2]), blue=(black[3], white[3]))
    print("ranges", cs.ranges())
    print("normalized", cs.normalized(), "hsv", cs.hsv(normalized=True), "colour", cs.color())
else:
    print("white", white, "is not brighter than black", black, "on every channel: calibration skipped")
cs.ranges(clear=old_ranges[0], red=old_ranges[1], green=old_ranges[2], blue=old_ranges[3])   # None clears a range

# --- gain and integration time ---------------------------------------------------------------------
# More gain or a longer integration = more counts from the same light (for dim scenes); in bright
# light the defaults saturate, so lower the gain there.
old_gain = cs.gain()                    # 16 at start
print("gain", old_gain, "raw", cs.raw())
cs.gain(4)                              # 1, 4, 16 or 60
print("gain 4: raw", cs.raw(), "(about a quarter)")
cs.gain(old_gain)

old_time = cs.integration_time()        # 2.4 ms at start
print("integration_time set to", cs.integration_time(24), "ms")   # 2.4 .. 614.4 ms in 2.4 ms steps
print("raw", cs.raw(), "(about ten times the counts; full scale is ten times larger too)")
cs.integration_time(old_time)

# --- wait time: a pause between readings (saves power, fewer readings) -------------------------------
old_wait = cs.wait_time()               # 0 at start: back to back
print("wait_time set to", cs.wait_time(100), "ms")   # 0..7372.8 ms; returns what the chip can do
sw = StopWatch()
for i in range(5):
    cs.read()
print("one new reading every", sw.time() / 5, "ms")
cs.wait_time(old_wait)

# --- the light-level alarm ----------------------------------------------------------------------------
# A window on the clear channel: when the count stays outside (low, high) for `persistence`
# readings in a row, interrupt() turns True and stays True until clear_interrupt().
old_thresholds = cs.thresholds()        # (low, high, persistence), (0, 0, 0) at start
clear = cs.raw()[0]
cs.thresholds(clear // 2, min(clear * 2 + 10, 65535), 5)   # half to twice today's light, 5 readings
cs.clear_interrupt()
print("alarm", cs.interrupt(), "- now cover the sensor with your hand for 3 s")
wait(3000)
print("alarm", cs.interrupt())          # True if it got dark enough for long enough
cs.thresholds(*old_thresholds)

# --- the end: the sensor sleeps and the port is free again ------------------------------------------
cs.close()
