"""Compass: minimal

Prints the compass heading five times a second for ten seconds: turn the robot and watch it
change. The calibration stored on the board for the port is used by itself.

The Python of compass_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: an EVN compass module on I2C port 2, away from the motors
"""
from evn import wait, Compass

# Set up all devices.
compass_2 = Compass(2)


# The main program starts here.
for count in range(50):
    print(compass_2.heading())
    wait(200)
