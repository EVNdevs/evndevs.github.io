"""Gesture sensor: the whole API

Every GestureSensor method once: swipes (waiting for one, or checking without waiting), proximity,
colour, the three engines, and the chip settings (gains, integration time, LED current, pulses,
gesture thresholds, alarm windows, offsets, photodiodes, wait time). The firmware keeps the latest
readings fresh in the background. Anything the example changes it puts back. Some steps ask you to
move your hand over the sensor: the text says what, and when.

Needs: the gesture sensor on I2C port 1 (nothing over it at the start), a hand, and something
coloured.
"""
from evn import GestureSensor, Color, StopWatch, wait

g = GestureSensor(1)                    # I2C port 1..16; OSError if no APDS-9960 answers there
print(g)                                # which engines run: colour, proximity, gesture
print("chip id", hex(g.id()))           # 0xab (the data sheet), or 0xa8 seen on some parts

# --- swipes ------------------------------------------------------------------------------------------
# 'up', 'down', 'left' or 'right': the way the hand moved with the module's label upright
# ('up' = from the bottom edge toward the top edge).
print("swipe a hand a few cm above the sensor, three times ...")
for i in range(3):
    print(g.read_gesture(5000))         # waits up to 5000 ms; None if no swipe came
    # (gesture, up_down, left_right, ud_delta, lr_delta, datasets, overflow) of that swipe
    print("  detail", g.gesture_detail())

print("swipe again for 5 s: gesture() does not wait, and reports each swipe once")
sw = StopWatch()
while sw.time() < 5000:
    d = g.gesture()                     # a direction, or None
    if d is not None:
        print(d)
    wait(20)

# --- proximity ---------------------------------------------------------------------------------------
# 0..255, higher = closer. While the gesture engine runs, a hand held still close by puts the chip
# in gesture mode: proximity and colour then stop updating until the hand moves away.
print("move your hand slowly down toward the sensor and hold it there ...")
for i in range(20):
    # status(): (colour alarm, proximity alarm, colour saturated, proximity saturated, in gesture mode)
    print("proximity", g.proximity(), "in gesture mode", g.status()[4])
    wait(150)

old_engines = g.engines()               # (colour, proximity, gesture), all True at start
g.engines(gesture=False)                # swipes off: proximity follows a still hand now
print("engines", g.engines(), "- again: hand down and hold it")
for i in range(20):
    print("proximity", g.proximity())
    wait(150)
# The gesture engine stays off until the settings below are done: with it on, anything held close
# above the sensor would put the chip in gesture mode, and the colour getters would raise OSError.

# --- colour ------------------------------------------------------------------------------------------
print("hold something coloured close above the sensor ...")
wait(2000)
print("raw", g.raw())                   # (clear, red, green, blue) counts
print("rgb", g.rgb())                   # (r, g, b) 0..255
print("hsv", g.hsv())                   # a Color: .h 0..359, .s 0..100, .v 0..100
print("ambient", g.ambient(), "%")      # the clear channel in % of full scale
colour, confidence = g.color_match()    # the nearest colour, and how sure (1.0 sure, 0.0 a coin flip)
print("colour", g.color(), "match", colour, "confidence %.2f" % confidence)
old_colours = g.detectable_colors()     # RED, YELLOW, GREEN, BLUE, WHITE, NONE at start
g.detectable_colors((Color.RED, Color.BLUE, Color.NONE))
print("choosing from red, blue, nothing:", g.color())
g.detectable_colors(old_colours)
print("reading is", g.age(), "ms old")

# --- gains and integration time ----------------------------------------------------------------------
old_gain = g.gain()                     # (colour, proximity, gesture): (4, 4, 4) at start
g.gain(colour=16)                       # colour 1/4/16/64, proximity and gesture 1/2/4/8
print("gains", g.gain(), "raw", g.raw(), "(about four times the counts)")
g.gain(colour=old_gain[0], proximity=old_gain[1], gesture=old_gain[2])

old_time = g.integration_time()         # 2.78 ms at start
print("integration_time set to", g.integration_time(27.8), "ms")   # 2.78..712 ms in 2.78 ms steps
print("raw", g.raw(), "(about ten times the counts)")
g.integration_time(old_time)

# --- the infrared LED: current and pulses --------------------------------------------------------------
# Stronger or more pulses = a hand is seen from further away.
print("hold your hand still about 5 cm above the sensor ...")
wait(2000)
old_led = g.led()                       # (proximity mA, gesture mA, boost %): (100.0, 100.0, 100) at start
print("LED", old_led, "proximity", g.proximity())
g.led(proximity=25)                     # 100, 50, 25 or 12.5 mA; boost 100, 150, 200 or 300 %
print("LED", g.led(), "proximity", g.proximity(), "(lower)")
g.led(proximity=old_led[0], gesture=old_led[1], boost=old_led[2])

old_pulses = g.pulses()                 # (proximity, gesture) as (count, length us): ((8, 16), (10, 32)) at start
g.pulses(proximity=(4, 8))              # count 1..64, length 4, 8, 16 or 32 us
print("pulses", g.pulses(), "proximity", g.proximity(), "(lower: less light sent)")
g.pulses(proximity=old_pulses[0], gesture=old_pulses[1])

# --- offsets and photodiodes: for a sensor behind a cover -------------------------------------------------
# Light the cover reflects back looks like something close; an offset takes it away. Values are
# sign/magnitude bytes: 0..127 one way, 128..255 the other.
old_offsets = g.offsets()               # (prox_ur, prox_dl, g_up, g_down, g_left, g_right), all 0 at start
g.offsets(10, 10, 0, 0, 0, 0)
print("offsets", g.offsets(), "proximity", g.proximity())
g.offsets(*old_offsets)

old_diodes = g.photodiodes()            # (mask, compensate): (0, False) at start
g.photodiodes(0b0001, True)             # mask 0..15 switches single diodes off for proximity
print("photodiodes", g.photodiodes(), "proximity", g.proximity())
g.photodiodes(old_diodes[0], old_diodes[1])
print("take your hand away")
wait(2000)
# swipes back on, with nothing over the sensor (a hand there at the restart would start gesture mode)
g.engines(colour=old_engines[0], proximity=old_engines[1], gesture=old_engines[2])

# --- when a swipe starts and ends ------------------------------------------------------------------------
# (entry, exit, fifo_threshold, dimensions, wait_ms, exit_mask, exit_persistence): a swipe starts
# when proximity rises past `entry` and ends when it falls under `exit`.
old_config = g.gesture_config()         # entry 30, exit 20 at start
g.gesture_config(entry=100)             # 0..255: the hand has to come closer before a swipe counts
print("gesture config", g.gesture_config(), "- swipe close to the sensor ...")
print(g.read_gesture(5000))
g.gesture_config(entry=old_config[0], exit=old_config[1], fifo_threshold=old_config[2],
                 dimensions=old_config[3], wait=old_config[4], exit_mask=old_config[5],
                 exit_persistence=old_config[6])

# --- alarm windows ---------------------------------------------------------------------------------------
# (als_low, als_high, als_persistence, prox_low, prox_high, prox_persistence): the chip sets its
# alarm flags, status()[0] and status()[1], when a reading stays outside its window.
old_windows = g.thresholds()            # (0, 65535, 0, 0, 255, 0) at start: nothing is outside
g.thresholds(proximity=(0, 50, 2))      # (low, high, persistence) per engine
print("windows", g.thresholds(), "status", g.status())
g.thresholds(als=old_windows[0:3], proximity=old_windows[3:6])
g.clear_interrupts()                    # clears the latched alarm flags
print("status", g.status())

# --- wait time: a pause between colour / proximity readings (saves power) ----------------------------------
old_wait = g.wait_time()                # 0 at start: back to back
print("wait_time set to", g.wait_time(100), "ms")   # 0..8540 ms; returns what the chip can do
oldest = 0
sw = StopWatch()
while sw.time() < 1000:
    oldest = max(oldest, g.age())
    wait(5)
print("the reading got up to", oldest, "ms old")
g.wait_time(old_wait)

# --- the end: the sensor is switched off and the port is free again ---------------------------------------
g.close()
