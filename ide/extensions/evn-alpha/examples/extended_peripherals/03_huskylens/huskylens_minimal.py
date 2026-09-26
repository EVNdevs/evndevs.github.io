"""HuskyLens: minimal

Prints how many objects the HuskyLens sees, five times a second for ten seconds.

The Python of huskylens_minimal.evnblocks: the blocks and this file are the same program (open
the blocks file under Examples to see it as blocks).

Needs: a DFRobot HuskyLens set to Protocol Type I2C on I2C port 11
"""
from evn import wait, HuskyLens

# Set up all devices.
huskylens_11 = HuskyLens(11)


# The main program starts here.
for count in range(50):
    print(huskylens_11.count())
    wait(200)
