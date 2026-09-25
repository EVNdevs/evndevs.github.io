"""Display: minimal

Writes a title on the OLED display, then counts from 1 to 10 in the middle of the screen.

The Python of display_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: the OLED display on I2C port 1
"""
from evn import wait, Display

# Set up all devices.
display_1 = Display(1)

i = None


# The main program starts here.
display_1.clear()
display_1.text(0, 0, 'Hello, EVN!')
display_1.text(0, 3, 'count:')
for i in range(1, 11):
    display_1.text(7, 3, i)
    wait(500)
