"""Robot: minimal

The robot drives 30 cm forward, turns around, drives back and turns around again, so it ends
where it started, facing the same way.

The Python of robot_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels 170 mm apart, and 40 cm of clear floor ahead
"""
from evn import Motor, Direction, DriveBase

# Set up all devices.
motor_3 = Motor(3)
motor_4 = Motor(4, positive_direction=Direction.COUNTERCLOCKWISE)

drive_base = DriveBase(motor_4, motor_3, wheel_diameter=62.4, axle_track=170)


# The main program starts here.
drive_base.straight(300)
drive_base.turn(180)
drive_base.straight(300)
drive_base.turn(180)
print('degrees turned: ' + str(drive_base.angle()))
drive_base.stop()
