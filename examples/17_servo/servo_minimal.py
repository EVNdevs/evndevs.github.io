"""Servo: minimal

The kit's 270-degree servo sweeps to 45 degrees, over to 225, and jumps back to the middle
(135).

The Python of servo_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: a Geekservo 270-degree servo on servo port 1, horn free to turn
"""
from evn import wait, Servo

# Set up all devices.
servo_1 = Servo(1)


# The main program starts here.
servo_1.move(45, 200)
servo_1.move(225, 200)
servo_1.angle(135)
wait(500)
