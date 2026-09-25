"""IMU: the whole API

Every IMU method once, as steps you follow at the robot: the calibration stored on the board
(applied by itself when the IMU opens), waiting for the gyro to settle, the heading and the
orientation, taps, the stillness settings, the one-pose calibration (still on a level table; run
here in the background) and the two-pose calibration (half a turn in between, for a surface that
is not level), then the raw mode without the DMP and its settings. The program waits for the
user button before each step that needs your hands, and prints what to do; to leave early, press
Stop in the editor (or Ctrl-C).

Each finished calibration is stored on the board for the port and replaces the one there (the
two-pose one, made last, is the one kept); a cancelled or failed one leaves the stored one as it
was. Nothing here clears a stored calibration.

Needs: an EVN IMU module (MPU-6500) on I2C port 1, fixed flat to the robot with the x axis of
its silkscreen pointing forward (else set axes()); a table and a book; you tilt, tap and turn the
robot when the program asks.
"""
import evn
from evn import IMU, Side, StopWatch, wait

PORT = 1


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


def wait_still(imu, seconds=1.5):
    """Wait until the robot has been still for `seconds` without a break: pressing the button on the
    board rocks the robot, and a calibration started while it still wobbles is refused ("the IMU
    moved during the calibration"), so one still sample is not enough (bench, 2026-09-25)."""
    timer = StopWatch()
    while timer.time() < seconds * 1000:
        if not imu.stationary():
            timer.reset()
        wait(10)


def show(cal):
    """Print the parts of a calibration record a student needs."""
    print("  calibrated %s  two poses %s  top %s front %s  tilt %s  slope %s"
          % (cal["calibrated"], cal["two_pose"], cal["top"], cal["front"], cal["tilt"], cal["slope"]))
    print("  gyro bias (deg/s)", cal["gyro"], " accel error (g)", cal["accel"])
    if cal["warning"]:
        print("  warning:", cal["warning"])
    if cal["error"]:
        print("  error:", cal["error"])


# --- step 1: the calibration stored on the board, read without opening the IMU ------------------
print("stored for port %d:" % PORT)
show(evn.imu_calibration(PORT))

# --- step 2: open it: the stored calibration is applied (offsets and axes) -------------------------
# IMU(PORT, calibrate=True) would first run a new one-pose calibration (step 6)
imu = IMU(PORT)                                  # about half a second: loads the DMP
print(imu)
print("axes (top, front):", imu.axes())
top, front = imu.axes()
imu.axes(top=top, front=front)                   # the same axes: nothing changes. A module
                                                 # mounted upside down needs top='-z'

press_button("Put the robot on the table; let go of it after the button.")
print("Keep it still: the gyro settles (up to about 25 s) ...")
clock = StopWatch()
while not imu.ready() and clock.time() < 30000:
    wait(100)
print("ready:", imu.ready(), "after %.1f s" % (clock.time() / 1000))

# --- step 3: heading and orientation ---------------------------------------------------------------
imu.reset_heading()                              # the way the robot points now is 0
press_button("Turn the robot a quarter turn clockwise (seen from above) and leave it.")
print("heading %.1f (clockwise is positive, and it keeps counting past 360)" % imu.heading())
imu.reset_heading(90)                            # ... or call this direction anything you like
print("after reset_heading(90): %.1f" % imu.heading())

press_button("Put a book under the front of the robot, so its nose points up a little.")
pitch, roll = imu.tilt()                         # nose up = + pitch, left side up = + roll
print("pitch %.1f  roll %.1f" % (pitch, roll))
print("euler (yaw, pitch, roll):", imu.euler())  # yaw = the heading wrapped to -180..180
print("next sample:", imu.read())                # read() waits for a new sample
print("quaternion (w, x, y, z):", imu.quaternion())
print("gravity, unit vector (forward, left, up):", imu.gravity())
up = imu.up()                                    # the side facing up, past 45 degrees
print("top side up" if up == Side.TOP else "nose up" if up == Side.FRONT else "another side up")

press_button("Take the book away: the robot flat on the table.")
print("acceleration mm/s^2 (gravity included, about 9800 up):", imu.acceleration())
print("linear acceleration mm/s^2 (gravity removed):", imu.linear_acceleration())
print("angular velocity deg/s:", imu.angular_velocity())
print("raw counts ((ax, ay, az), (gx, gy, gz)):", imu.raw())
print("die temperature %.1f C, sample age %d ms" % (imu.temperature(), imu.age()))

# --- step 4: taps and turning it on its side -------------------------------------------------------
press_button("For 10 s: tap the robot firmly, then stand it on one side.")
clock.reset()
while clock.time() < 10000:
    tap = imu.tap()                              # each tap once: ('z up', 1), a double tap 2
    if tap:
        print("tap", tap)
    side = imu.screen_orientation()              # each change once (the chip's own axes)
    if side:
        print("orientation", side)
    wait(20)

# --- step 5: what counts as still -----------------------------------------------------------------
gyro_limit, accel_limit, full_turn = imu.settings()
print("still below %s deg/s and %s mm/s^2; one full turn reads %s degrees"
      % (gyro_limit, accel_limit, full_turn))
# heading_correction: when ten real turns read 3590 degrees, 359 makes a turn read 360
imu.settings(angular_velocity_threshold=3, heading_correction=359)
imu.settings(angular_velocity_threshold=gyro_limit, heading_correction=full_turn)   # put back

# --- step 6: the one-pose calibration, in the background ------------------------------------------
press_button("ONE-POSE CALIBRATION: put the robot on a level table, standing as it drives;\n"
             "let go of it after the button and keep it still for 2 s.")
wait_still(imu)
imu.calibrate(wait=False)                        # about 2 s; returns at once
while imu.calibration()["busy"]:                 # calibration() finishes it when it is done
    if not imu.stationary():
        imu.cancel_calibration()                 # moved: drop it, nothing is stored
        print("the robot moved: cancelled, the stored calibration stays")
        break
    wait(50)
show(imu.calibration())

# --- step 7: the two-pose calibration ------------------------------------------------------------
# One pose cannot tell a tilted mount from a sloped table. Two poses on the same spot, turned
# half a turn in between, can: a slope up to 20 degrees is left out (reported as "slope").
press_button("TWO-POSE CALIBRATION: put the robot on a flat surface (it may slope a little);\n"
             "let go of it after the button and keep it still for 2 s.")
wait_still(imu)
try:
    imu.calibrate(pose=1)                        # about 2 s still; nothing is stored yet
    print("Now turn the robot about half a turn (120 to 240 degrees) on the spot, on its wheels,")
    print("and let go. You have 110 seconds.")
    start = imu.heading()
    clock.reset()
    turned = False
    while clock.time() < 110000 and imu.calibration()["waiting"]:
        if 120 < abs(imu.heading() - start) < 240 and imu.stationary():
            turned = True                        # the driver's 120..240 degrees, and still again
            break
        wait(20)
    if turned:
        wait_still(imu)                          # the hand that turned it has let go
        imu.calibrate(pose=2)                    # about 2 s still: stores the pair
        print("two-pose calibration stored")
    else:
        imu.cancel_calibration()                 # drops the waiting first pose
        print("no half turn seen: cancelled, the stored calibration stays")
except RuntimeError as e:                        # it moved during a pose, or the turn was wrong
    print(e)
show(imu.calibration())

# --- step 8: raw mode: the registers without the DMP ------------------------------------------------
# The orientation getters (tilt, euler, quaternion, gravity, linear_acceleration) need the DMP.
press_button("Leave the robot still on the table for the next few seconds.")
imu.dmp(False)                                   # raw registers, 1 kHz, 2000 deg/s, 16 g
print("DMP on:", imu.dmp(), " rate", imu.sample_rate(), "Hz  ranges", imu.ranges(),
      " filter", imu.filter(), "Hz")
imu.ranges(gyro=500, accel=4)                    # finer steps for slow motion (raw mode only)
imu.filter(gyro=41, accel=41)                    # a smoother signal
imu.sample_rate(200)
print("gyro bias measured (counts):", imu.calibrate_gyro(200))   # about 1 s, keep it still
print("raw mode read() = ((g), (deg/s)):", imu.read())
print("up:", imu.up() == Side.TOP)               # up() works in raw mode too

imu.dmp(True)                                    # back to the DMP (it settles again ~10 s)
print("DMP on:", imu.dmp())

imu.close()
