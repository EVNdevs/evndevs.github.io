"""Motor: minimal

One motor turns a full turn, comes back to where it started, and says where it is.

The Python of motor_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: a motor on port 1, wheel off the ground
"""
from evn import Motor

# Set up all devices.
motor_1 = Motor(1)


# The main program starts here.
motor_1.run_angle(500, 360)
motor_1.run_target(500, 0)
print(motor_1.angle())
motor_1.stop()
