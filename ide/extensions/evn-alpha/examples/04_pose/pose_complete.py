"""Pose: the whole API

Every Pose method once: what it is built from and what is live, the position, heading, speeds and
the filter's own uncertainty while the robot drives, the wheel geometry, re-framing with reset(),
and a second Pose from the IMU alone. The robot drives a 30 cm square-ish loop and ends where it
started.

Frames: x East / y North in mm, heading in degrees clockwise from north (0..360), speed mm/s,
yaw rate deg/s clockwise. Without a compass "north" is simply the way the robot faced at reset():
forward is +y and its right is +x.

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels
170 mm apart, an EVN IMU on I2C port 3 fixed flat to the chassis, and 40 cm of clear floor ahead
and to the right. A compass on I2C port 14, calibrated on the robot (Compass.calibrate()), is
used when it is there. Keep the robot still while the program starts: the IMU calibrates its
gyro 8 to 25 s into stillness.
"""
from evn import Motor, Direction, DriveBase, IMU, Compass, Pose, StopWatch, wait, stop_all

left = Motor(4, Direction.COUNTERCLOCKWISE)      # the mirrored motor: forward is counterclockwise
right = Motor(3)

# --- the sources ----------------------------------------------------------------------------------
# The IMU and the compass objects must exist before the Pose names their ports. A module that is
# not mounted flat and upright gets its silkscreen axes first, e.g. imu.axes(top="-z").
imu = IMU(3)
try:
    compass = Compass(14)                        # optional: an absolute heading
except OSError:
    compass = None
    print("no compass on port 14: the pose runs on the wheels and the IMU")

# A robot with a DriveBase gets its pose from the base: imu= / compass= make the base build an
# evn.Pose from its own ports, wheel, track and the mirrored motor's direction, and robot.pose is
# that Pose. declination= (degrees) is added to the compass heading: true north instead of
# magnetic north; it goes with compass=. (A Pose without a base - pushed by hand - is built on its
# own: Pose(4, 3, wheel_diameter=62.4, axle_track=170, reverse_left=True, imu=3), see pose_minimal.py.)
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=170, imu=3,
                  compass=14 if compass else None, declination=0 if compass else None)
pose = robot.pose
print("built from", pose.configured())

print("keep the robot still until the IMU is ready ...")
watch = StopWatch()
while not imu.ready() and watch.time() < 30000:
    wait(100)
# sources() is what contributes right now: the compass only once it has a calibration and while
# its field looks like the Earth's (a motor's magnets or a steel table drop it out).
print("live now", pose.sources(), "- position bounded:", pose.bounded())

# --- re-framing -----------------------------------------------------------------------------------
# reset(x, y, heading) says where the robot is; nothing moves. With a live compass the heading is
# the compass's to give, so keep it and only move the origin.
if "compass" in pose.sources():
    pose.reset(0, 0, pose.heading())
else:
    pose.reset(0, 0, 0)
start_heading = pose.heading()

# --- reading it while the robot drives ------------------------------------------------------------
robot.straight(300, wait=False)                  # drive and watch at the same time
while not robot.done():
    speed, yaw_rate = pose.velocity()            # mm/s forward, deg/s clockwise
    print("speed %4.0f mm/s  yaw rate %5.1f deg/s" % (speed, yaw_rate))
    wait(250)
x, y = pose.position()
print("after 30 cm: x %.1f mm, y %.1f mm, heading %.2f degrees" % (x, y, pose.heading()))

robot.turn(90)
robot.straight(200)
robot.turn(90)
x, y, heading, speed, yaw_rate = pose.state()    # the five in one call
print("state: (%.1f, %.1f) mm, heading %.2f, %.0f mm/s, %.1f deg/s"
      % (x, y, heading, speed, yaw_rate))
robot.straight(300)
robot.turn(90)
robot.straight(200)
robot.turn(90)                                   # back where it started, facing the same way

x, y = pose.position()
print("back at (%.1f, %.1f) mm, heading %.2f (started at %.2f)"
      % (x, y, pose.heading(), start_heading))
# the filter's own uncertainty: (sigma x mm, sigma y mm, sigma heading degrees)
print("uncertainty:", pose.covariance())
# the wheel radii and the track as the filter estimates them now (they only move with turns)
print("r_left, r_right, track (mm):", pose.parameters())

# --- the wheel geometry ---------------------------------------------------------------------------
# settings() -> (wheel_diameter, axle_track). The track that matters is the one between the two
# contact patches: turn the robot a commanded 360 degrees against a floor mark, then
# track_measured = track * (degrees it really turned) / 360. The geometry has one home, the base:
# on a robot with a DriveBase the measured track goes into DriveBase(..., axle_track=track_measured,
# imu=3) (rebuild the base; it builds its Pose from it). pose.settings(axle_track=...) is for a Pose
# without a base: on the base's Pose, use_gyro(True) refuses it (ValueError), and with use_gyro
# already on the next maneuver raises OSError and turns use_gyro off. This program never calls
# use_gyro, so the call below (the same numbers) is harmless. Not stored: set it at start-up.
wheel, track = pose.settings()
print("geometry: wheel %.1f mm, track %.1f mm" % (wheel, track))
pose.settings(wheel_diameter=wheel, axle_track=track)   # the same numbers, but it still re-seeds the wheel estimates (it forgets what it learned)

# --- one Pose per robot ---------------------------------------------------------------------------
# A second Pose raises OSError while this one is open; close() hands the estimator back (the base
# keeps driving on its wheels alone).
pose.close()

# A Pose from the IMU alone: a heading, but a position it cannot bound (from the accelerometer
# alone it drifts), so bounded() is False. imu_offset= is where the IMU sits, mm forward and left
# of the axle mid-point (a tape-measure value; (0, 0) = right over it). "with" closes the Pose at
# the end of the block.
with Pose(imu=3, imu_offset=(0, 0)) as heading_only:
    print("IMU alone:", heading_only.configured(), "bounded:", heading_only.bounded(),
          "heading %.1f" % heading_only.heading())

# --- the end: everything coasts, and the objects let go of their ports ----------------------------
robot.stop()
robot.close()
stop_all()
imu.close()
if compass:
    compass.close()
left.close()
right.close()
