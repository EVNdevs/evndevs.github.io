"""Robot: the whole DriveBase API

Every DriveBase method once: the four fixed moves (straight, turn, curve, arc), driving at a speed,
stopping, the measurements, the speed and acceleration settings, and the gyro loop over the
evn.Pose the base builds for itself (imu=3; robot.pose). The moves go out and come back, so the robot ends near where it started. Distances are
mm, angles degrees (positive = clockwise, seen from above), speeds mm/s and deg/s.

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels
170 mm apart, an EVN IMU on I2C port 3 fixed flat to the chassis, and 40 cm of clear floor ahead
and 20 cm to each side. Keep the robot still while the program starts: the IMU calibrates its
gyro 8 to 25 s into stillness.
"""
from evn import Motor, Direction, DriveBase, IMU, Stop, StopWatch, wait, stop_all

# --- the robot ------------------------------------------------------------------------------------
left = Motor(4, Direction.COUNTERCLOCKWISE)      # the mirrored motor: forward is counterclockwise
right = Motor(3)
# The IMU and the pose are only for the gyro part at the end. Built now, the IMU settles while
# the robot is still; a robot that moves before then may keep it from settling for a long time.
imu = IMU(3)                                     # fixed flat to the chassis; build it before the base
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=170, imu=3)   # the base builds its own Pose
# Measure your own wheel and track: the track that matters is between the two contact patches,
# so check it with one robot.turn(360) against a mark on the floor and adjust until it ends there.
# imu=3 makes the base build its evn.Pose from these same ports, wheel, track and the mirrored
# motor's direction, so none of it is typed twice; robot.pose is that Pose.
print("keep the robot still until the IMU is ready ...")
watch = StopWatch()
while not imu.ready() and watch.time() < 30000:
    wait(100)
print("IMU ready after", watch.time(), "ms")

# --- the settings ---------------------------------------------------------------------------------
# (straight speed mm/s, straight acceleration mm/s^2, turn rate deg/s, turn acceleration deg/s^2);
# the defaults come from the weaker motor's limits.
defaults = robot.settings()
print("settings:", defaults)

# --- straight and turn ----------------------------------------------------------------------------
robot.straight(300)                              # 30 cm forward, then hold
robot.turn(90)                                   # a quarter turn right, on the spot
robot.turn(-90, then=Stop.COAST_SMART)           # back left; the next move counts from this aim
robot.straight(-300)                             # 30 cm backwards
print("driven", robot.distance(), "mm, turned", robot.angle(), "degrees")   # about 0 and 0

# --- arcs -----------------------------------------------------------------------------------------
# arc(): a positive radius is a circle to the right, a negative one to the left; the angle (or the
# distance along the arc) says how far, and a negative amount drives it backwards.
robot.arc(150, angle=90)                         # a quarter circle to the right
robot.arc(150, angle=-90)                        # the same circle backwards: back at the start
robot.arc(-200, distance=150)                    # 150 mm along a circle to the left
robot.arc(-200, distance=-150)                   # and back
# curve() is the older Pybricks form: the ANGLE's sign picks the side, the radius's sign the
# direction, so curve(-r, a) retraces curve(r, a).
robot.curve(150, 45)
robot.curve(-150, 45)

# --- without waiting ------------------------------------------------------------------------------
robot.reset()                                    # distance() and angle() count from 0 here
robot.straight(200, wait=False)                  # returns at once ...
while not robot.done():                          # ... so the program can watch the move
    distance, speed, angle, turn_rate = robot.state()
    print("at %.0f mm, %.0f mm/s" % (distance, speed))
    wait(200)
print("done at", robot.distance(), "mm; a wheel stalled:", robot.stalled())

# --- driving at a speed ---------------------------------------------------------------------------
robot.drive(-150, 0)                             # 150 mm/s backwards until the next command
wait(1000)
robot.brake()                                    # short both motors: a quick stop, then free
robot.drive(0, 90)                               # turn on the spot at 90 deg/s
wait(1000)
robot.drive(0, -90)
wait(1000)
robot.stop()                                     # coast both wheels
robot.reset(0, 0)                                # reset(distance, angle): count from these values

# --- slower and gentler ---------------------------------------------------------------------------
# an acceleration may also be (speed up, slow down)
robot.settings(straight_speed=150, straight_acceleration=(300, 600),
               turn_rate=60, turn_acceleration=240)
robot.straight(150)
robot.turn(45)
robot.turn(-45)
robot.straight(-150)
robot.settings(*defaults)                        # back to what it was

# --- the robot follows its gyro -------------------------------------------------------------------
# With the base's evn.Pose (robot.pose, encoders + IMU), every move is corrected as it goes, so
# the ROBOT follows the path, not just the wheels: scrub on a turn and the gyro's drift no longer
# add up. use_gyro(True) waits (up to 30 s, still) for the IMU to be ready.
robot.use_gyro(True)
robot.pose.reset(0, 0, 0)                        # here is (0, 0), heading 0
print("following the pose:", robot.use_gyro())
# (b, zeta, k_min, correction_speed, correction_rate, trim_limit, trim_slew, position_tolerance,
#  heading_tolerance, settle_time)
knobs = robot.follower()
print("loop knobs:", knobs)
robot.follower(position_tolerance=2, heading_tolerance=0.5)   # a looser "done"
robot.straight(300)
robot.turn(180)
robot.straight(300)
robot.turn(-180)
# where the ideal robot is, seen from the estimate: (forward mm, left mm, heading deg, settled,
# the correction on the left and right wheel in degrees)
print("pose error:", robot.pose_error())
print("pose: (%.1f, %.1f) mm, heading %.2f degrees" % (robot.pose.position() + (robot.pose.heading(),)))
robot.follower(position_tolerance=knobs[7], heading_tolerance=knobs[8])   # back to what they were
robot.use_gyro(False)                            # wheel-only moves again (corrections dropped)

# --- the end: everything coasts, and the objects let go of their ports ----------------------------
robot.stop()
robot.close()                                    # coasts both wheels, releases them and closes its Pose
imu.close()
stop_all()
left.close()
right.close()
