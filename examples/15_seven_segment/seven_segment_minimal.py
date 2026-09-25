"""7-segment display: minimal

The 7-segment display counts down from 10 to 0, then says DONE.

The Python of seven_segment_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: the 7-segment display on I2C port 1
"""
from evn import wait, SevenSegmentLED

# Set up all devices.
seven_segment_1 = SevenSegmentLED(1)

i = None


# The main program starts here.
for i in range(10, -1, -1):
    seven_segment_1.number(i)
    wait(500)
seven_segment_1.text('DONE')
