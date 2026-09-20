"""A drive base that follows its gyro: the ROBOT, not just the wheels, drives the path.

09_drive_base.py counts wheel turns. That is exact for the wheels, but a wheel scrubs
a little on every turn in place, a cable drags, and a gyro drifts; over minutes of
driving those millimetres and fractions of a degree add up. With an IMU on the
chassis, `evn.Pose` tracks where the robot really is from the encoders and the gyro,
and `use_gyro(True)` (Pybricks' name) makes every straight, turn and arc correct
itself against that estimate as it goes (200 Hz). On the floor, 40 maneuvers end
about a centimetre from the mark with no visible heading error
(the pose's own closure 3 mm / 0.24 degrees).

Needs: two motors driving two wheels (left on port 4, mounted mirrored; right on
port 3), 62.4 mm wheels 170 mm apart, an EVN IMU on I2C port 3 fixed to the chassis,
and about 40 cm of clear floor ahead. Keep the robot still while the program starts:
the IMU calibrates its gyro 8 to 25 s into stillness, and use_gyro(True) waits for it
(up to 30 s, OSError if the robot was moving).
"""
from evn import Motor, Direction, DriveBase, IMU, Pose

left = Motor(4, Direction.COUNTERCLOCKWISE)   # the mirrored motor: forward is counterclockwise
right = Motor(3)
imu = IMU(3)
# imu.axes(top="-z")   # an IMU that is not mounted flat and upright: its silkscreen axes for up / forward

# The pose takes the motors' PORTS and reads the encoders itself, so the mirrored
# motor is named again here (reverse_left); the wheel numbers are the drive base's.
# Position (x, y) in mm and heading in degrees clockwise, 0 where the program starts.
pose = Pose(4, 3, wheel_diameter=62.4, axle_track=170, reverse_left=True, imu=3)
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=170)

robot.use_gyro(True)           # waits here, still, until the IMU is ready
pose.reset(0, 0, 0)            # here is (0, 0) facing 0: the pose ran (and settled) since it was built
imu.reset_heading(0)           # and the IMU's own yaw reads 0 from here too, so the two headings compare
print("following the pose; loop knobs (b, zeta, k_min, ...):", robot.follower())

# The same out-and-back as 09, with an about-turn each way so the robot ends where it
# started, facing the same way. Every move now ends when the robot is on its path,
# not just when the wheels have turned their share.
for rep in range(3):
    robot.straight(300)
    robot.turn(45)
    robot.turn(-45)
    robot.turn(180)
    robot.straight(300)
    robot.turn(-45)
    robot.turn(45)
    robot.turn(-180)
    x, y = pose.position()
    print("ladder %d: pose (%.1f, %.1f) mm heading %.2f deg, IMU yaw %.2f deg, error %s"
          % (rep + 1, x, y, pose.heading(), imu.heading(), robot.pose_error()))

# pose_error() is (forward mm, left mm, heading deg, settled, trim_left deg, trim_right deg):
# where the ideal robot is, seen from the estimate, and the wheel corrections in force.
# A robot pushed sideways by hand is the one thing the pose cannot see - the encoders
# and the gyro do not register a pure sideways slide.

robot.use_gyro(False)          # back to wheel-only moves (the trims are dropped)
robot.stop()
robot.close()
pose.close()
left.close()
right.close()
