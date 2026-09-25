"""Touch pads: the whole API

Every TouchArray method once: which pads are touched, touches and releases as events, the raw
readings behind them, proximity (a hand near the pads), and the chip settings (thresholds,
debounce, sampling, charge and its automatic set-up). Pads are numbered 0 to 11; channel 12 is the
proximity channel. Anything the example changes it puts back. Some steps ask you to touch pads or
hold a hand above them: the text says what, and when.

Needs: the touch pads (MPR121) on I2C port 1, and bare fingers.
"""
from evn import TouchArray, StopWatch, wait

t = TouchArray(1)                       # I2C port 1..16; OSError if no MPR121 answers there
print(t)                                # its settings: electrodes, proximity, thresholds, update period

# --- which pads are touched ---------------------------------------------------------------------------
print("touch some pads, one or several at a time, for 10 s ...")
t.events()                              # forget anything from before
sw = StopWatch()
while sw.time() < 10000:
    pressed, released = t.events()      # bit masks of the pads touched / let go since the last call
    for pad in range(12):
        if pressed & (1 << pad):
            print("pad", pad, "touched")
        if released & (1 << pad):
            print("pad", pad, "let go")
    wait(20)

print("hold a finger on pad 0 ...")
wait(3000)
print("any pad", t.pressed(), "pad 0", t.read(0), "mask", bin(t.touched()))   # bit n = pad n
# (filtered, baseline): the pad's reading and what it reads untouched; a touch pulls the reading
# far below the baseline (hundreds of counts for a bare finger)
print("pad 0 data", t.data(0))
print("reading is", t.age(), "ms old")
print("let go")
wait(2000)
print("pad 0 data", t.data(0))

# --- thresholds: how far below the baseline counts as a touch, and as a release -------------------------
print("thresholds of pad 0", t.thresholds(0), "of every pad", t.thresholds(),
      "of the proximity channel", t.thresholds(channel=12))
old_thresholds = t.thresholds(0)        # (touch, release): (12, 6) at start
t.thresholds(100, 50, channel=0)        # 0..255 counts; without channel= it sets all 13 channels
print("pad 0 now", t.thresholds(0), "- a firm touch still counts: touch pad 0 ...")
wait(3000)
print("pad 0", t.read(0))
t.thresholds(old_thresholds[0], old_thresholds[1], channel=0)

# --- debounce: how many readings in a row before a touch / release counts -------------------------------
old_debounce = t.debounce()             # (touch, release): (0, 0) at start
t.debounce(4, 4)                        # 0..7 each
print("debounce", t.debounce())
t.debounce(old_debounce[0], old_debounce[1])

# --- proximity: all pads together as one big sensor --------------------------------------------------------
old_electrodes = t.electrodes()         # (count, proximity): (12, 0) at start
t.electrodes(12, proximity=3)           # proximity 0 off, 1 = pads 0-1, 2 = pads 0-3, 3 = pads 0-11
print("hold your hand 2-3 cm above the pads, then take it away ...")
for i in range(30):
    print("hand near", t.proximity())
    wait(200)
t.electrodes(old_electrodes[0], old_electrodes[1])

# --- sampling: how often the pads are read -------------------------------------------------------------------
old_sampling = t.sampling()             # (first filter, second filter, interval ms): (6, 4, 1) at start
t.sampling(6, 4, 16)                    # first 6/10/18/34, second 4/6/10/18, interval 1..128 ms
oldest = 0
sw = StopWatch()
while sw.time() < 1000:
    oldest = max(oldest, t.age())
    wait(2)
print("sampling", t.sampling(), ": the reading got up to", oldest, "ms old")
t.sampling(old_sampling[0], old_sampling[1], old_sampling[2])

# --- charge and its automatic set-up ------------------------------------------------------------------------
# At every start the chip searches the best charge for each pad by itself (autoconfig). With that
# off, every pad runs at the charge() setting instead.
old_auto = t.autoconfig()               # (enabled, reconfig, usl, tl, lsl): (True, True, ...) at start
old_charge = t.charge()                 # (current uA, time us): (16, 0.5) at start
print("autoconfig", old_auto, "pad 0 data", t.data(0))
t.autoconfig(False)                     # the charge() setting applies to every pad now
print("charge", t.charge(), "pad 0 data", t.data(0))
t.charge(20, 1)                         # 0..63 uA; 0, 0.5, 1, 2, 4, 8, 16 or 32 us
print("charge", t.charge(), "pad 0 data", t.data(0), "(more charge, higher reading)")
t.charge(old_charge[0], old_charge[1])
t.autoconfig(old_auto[0], old_auto[1])  # the search runs again
print("pads the search could not set up (mask):", t.out_of_range())

# --- faults ----------------------------------------------------------------------------------------------------
# The driver recovers from an over-current fault by itself; overcurrent() says whether one happened.
print("over-current seen:", t.overcurrent())
t.clear_overcurrent()                   # forget it (the chip is reset and set up again, about 50 ms)
print("over-current seen:", t.overcurrent())

# --- the end: the port is free again ----------------------------------------------------------------------------
t.close()
