"""Compass: the whole API

Every Compass method once, as steps you follow at the robot: the calibration stored on the
board (used by itself when the compass opens), the heading and what it rests on, the chip's
settings, then two new calibrations - planar (the robot turned on the floor) and full (the robot
tumbled in the air) - each finished when it has seen enough directions or cancelled after a
minute, and last a calibration installed by hand. The program waits for the user button before
each step that needs your hands, and prints what to do; to leave early, press Stop in the editor
(or Ctrl-C).

Each finished calibration is stored on the board for the port and replaces the one there (the
full one, made last, is the one kept); a cancelled one leaves the stored one as it was. Nothing
here clears a stored calibration.

Needs: an EVN compass module (HMC5883L or QMC5883L) on I2C port 2, fixed flat to the robot away
from the motors; room to turn the robot on the floor and to pick it up and tumble it.
"""
import evn
from evn import Compass, StopWatch, wait

PORT = 2


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


def directions_seen(mask):
    """How many bits of calibrate_directions()'s mask are set (one bit per direction)."""
    return sum((mask >> n) & 1 for n in range(27))


def run_calibration(compass, planar, target, seconds):
    """Collect while the robot is turned, then fit and store the calibration.

    target: the coverage (0..1) to wait for before trying to finish; seconds: how long to try.
    Returns True when a calibration was fitted and stored, False when it was cancelled."""
    compass.calibrate(planar)                    # start collecting (planar=True: a floor robot)
    clock = StopWatch()
    while clock.time() < seconds * 1000:
        samples, coverage = compass.calibrate_progress()          # coverage 0..1
        mask, current, flat = compass.calibrate_directions()      # which directions so far
        total = 8 if flat else 26
        print("%4d samples  coverage %3d %%  directions %2d of %d  now in direction %d (-1: none)"
              % (samples, round(coverage * 100), directions_seen(mask), total, current))
        if coverage >= target:
            try:
                residual, coverage, samples = compass.calibrate_stop()   # fit, install, store
                print("calibrated: fit error %.1f %%, coverage %d %%, %d samples"
                      % (residual * 100, round(coverage * 100), samples))
                return True
            except ValueError as e:              # refused: the collection carries on
                print(e)
        wait(1000)
    # time is up: one last try with what was collected, else give up
    try:
        print("calibrated:", compass.calibrate_stop())
        return True
    except ValueError:
        compass.calibrate_cancel()               # end the collection; the stored calibration stays
        print("not turned through enough directions: cancelled, the stored calibration stays")
        return False


# --- step 1: the calibration stored on the board, read without opening the compass -------------
record = evn.compass_calibration(PORT)
if record["calibrated"]:
    print("port %d has a stored %s calibration (coverage %d %%, fit error %.1f %%, field %.2f G)"
          % (PORT, "planar" if record["planar"] else "full", round(record["coverage"] * 100),
             record["residual"] * 100, record["field"]))
else:
    print("port %d has no stored calibration yet: the steps below make one" % PORT)

# --- step 2: open it: the stored calibration is installed by itself ----------------------------------
compass = Compass(PORT)                          # finds the chip by its ID register
print(compass)
print("chip", compass.chip(), " axes (top, front)", compass.axes())
print("in force (offset, matrix):", compass.calibration())
print("stored for the port:", compass.stored_calibration())    # the same dict as step 1

# --- step 3: the heading and what it rests on ----------------------------------------------------
press_button("Put the robot on the floor, pointing any way.")
# 0..360 degrees clockwise from magnetic north, while the module is level; north() moves the 0
print("heading %.1f" % compass.heading())
# how far the field can be trusted as the Earth's: 1 = exactly the calibrated strength,
# 0 = a motor or a steel part has bent it (then do not steer by the heading)
print("confidence %.2f  field strength %.2f G (the Earth's is 0.25..0.65)"
      % (compass.heading_confidence(), compass.field_strength()))
print("field (forward, left, up) in gauss:", compass.field())
print("raw sensor counts:", compass.raw())
print("next new reading: %.1f" % compass.read())    # read() waits for a fresh sample
print("reading age %d ms, out of range %s, a reading lost %s"
      % (compass.age(), compass.overflow(), compass.overrun()))

compass.north()                                  # the way the robot points now is 0 degrees
print("after north(): %.1f" % compass.heading())
compass.north(90)                                # ... or any heading you choose
print("after north(90): %.1f" % compass.heading())
compass.north()

# --- step 4: the chip's settings (each put back as it was) -----------------------------------------
top, front = compass.axes()
compass.axes(top=top, front=front)               # the same axes: nothing changes (another pair
                                                 # would drop the calibration)
rate, gauss, samples = compass.data_rate(), compass.range(), compass.oversampling()
print("data rate %s Hz, range %s G, oversampling %d" % (rate, gauss, samples))
if compass.chip() == "HMC5883L":
    compass.data_rate(15)                        # HMC: 0.75 .. 75 Hz
    compass.oversampling(4)                      # HMC: average 1, 2, 4 or 8 samples
    print("bias strap", compass.bias(), "(0 = off)")
    compass.bias(0)                              # 1 / 2 would need range(4.0) or more first
    print("self test (x, y, z) ok:", compass.self_test())   # HMC only; settings put back after
else:
    compass.data_rate(50)                        # QMC: 10, 50, 100 or 200 Hz
    compass.oversampling(256)                    # QMC: 64, 128, 256 or 512
    print("die temperature %.1f C (relative)" % compass.temperature())   # QMC only
compass.range(gauss)                             # the same range (a new one rescales the calibration)
compass.data_rate(rate)
compass.oversampling(samples)

# --- step 5: a planar calibration: the robot on the floor --------------------------------------------
press_button("PLANAR CALIBRATION: put the robot flat on the floor, away from steel and magnets.\n"
             "When it starts, turn the robot slowly on the spot, about two full turns.")
run_calibration(compass, planar=True, target=1.0, seconds=60)

# --- step 6: a full calibration: the robot tumbled in the air -----------------------------------------
press_button("FULL CALIBRATION: pick the robot up. When it starts, turn it slowly through every\n"
             "orientation: nose up and down, onto each side, upside down, turning as you go.")
run_calibration(compass, planar=False, target=0.7, seconds=60)

record = evn.compass_calibration(PORT)
if record["calibrated"]:
    print("stored now:", "planar" if record["planar"] else "full", record)

# --- step 7: a calibration installed by hand ------------------------------------------------------
press_button("Put the robot back on the floor.")
cal = compass.calibration()                      # the one in force: (offset, matrix) or None
compass.calibration(None)                        # no calibration: the raw field
print("uncalibrated heading %.1f" % compass.heading())
if cal is not None:
    offset, matrix = cal
    compass.calibration(offset, matrix)          # installed again (not stored: it has no fitted
                                                 # field size: heading_confidence() is 0.5 or 0)
    print("installed by hand: heading %.1f, confidence %.2f"
          % (compass.heading(), compass.heading_confidence()))

# a new Compass(port) after close() starts with the stored calibration again
compass.close()
compass = Compass(PORT)
print("reopened: heading %.1f, confidence %.2f" % (compass.heading(), compass.heading_confidence()))
compass.close()
