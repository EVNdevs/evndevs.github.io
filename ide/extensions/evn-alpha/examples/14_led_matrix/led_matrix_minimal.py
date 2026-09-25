"""LED matrix: minimal

The LED matrix counts down from 5 to 0, then shows a heart.

The Python of led_matrix_minimal.evnblocks: the blocks and this file are the same program (open
the blocks file under Examples to see it as blocks).

Needs: the 8x8 LED matrix on I2C port 1
"""
from evn import wait, Icon, MatrixLED

# Set up all devices.
matrix_1 = MatrixLED(1)

i = None


# The main program starts here.
for i in range(5, -1, -1):
    matrix_1.number(int(round(i)))
    wait(1000)
matrix_1.icon(Icon.HEART)
