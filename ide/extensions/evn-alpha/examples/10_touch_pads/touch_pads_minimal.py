"""Touch pads: minimal

Says "touched!" each time a finger touches any of the 12 pads, for ever (stop it with the stop
button).

The Python of touch_pads_minimal.evnblocks: the blocks and this file are the same program (open
the blocks file under Examples to see it as blocks).

Needs: the touch pads (MPR121) on I2C port 1
"""
from evn import wait, TouchArray

# Set up all devices.
touch_1 = TouchArray(1)


# The main program starts here.
while True:
    while not touch_1.pressed():
        wait(10)
    print('touched!')
    while touch_1.pressed():
        wait(10)
