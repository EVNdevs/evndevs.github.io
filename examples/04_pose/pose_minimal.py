"""Pose: minimal

Where is the robot? Push it around by hand for 20 s and watch its position and heading, worked
out from the two wheel encoders. Nothing is driven: the pose only reads the encoders.

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels
170 mm apart; you push it along the floor while the program runs.
"""
from evn import Pose, wait

# The two wheel ports, the wheel diameter and the axle track in mm; the mirrored left motor
# counts backwards, so the pose is told so. It starts at (0, 0) facing heading 0, which is +y:
# forward from where the robot stands is +y, to its right is +x.
pose = Pose(4, 3, wheel_diameter=62.4, axle_track=170, reverse_left=True)

for _ in range(40):
    x, y = pose.position()
    print("x %6.0f mm   y %6.0f mm   heading %5.1f degrees" % (x, y, pose.heading()))
    wait(500)

pose.close()
