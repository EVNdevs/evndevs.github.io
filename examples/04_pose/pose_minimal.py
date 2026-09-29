"""Pose: minimal

Where is the robot? Push it around by hand for 20 s and watch its position and heading, worked
out from the two wheel encoders. Nothing is driven: the pose only reads the encoders, and the
robot coasts at the end. It starts at x 0, y 0 facing heading 0: forward from where the robot
stands is +y, to its right is +x.

The Python of pose_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels 170 mm apart; you push it along the floor while the program runs.
"""
from evn import Motor, Direction, wait, DriveBase, Pose
import math

# Set up all devices.
motor_3 = Motor(3)
motor_4 = Motor(4, positive_direction=Direction.COUNTERCLOCKWISE)

pose = Pose(4, 3, wheel_diameter=62.4, axle_track=170, reverse_left=True)

drive_base = DriveBase(motor_4, motor_3, wheel_diameter=62.4, axle_track=170, pose=pose)


# The main program starts here.
for count in range(40):
    print(''.join([str(x) for x in ['x ', round(pose.position()[0]), ' mm   y ', round(pose.position()[1]), ' mm   heading ', round(pose.heading()), ' degrees']]))
    wait(500)
drive_base.stop()
