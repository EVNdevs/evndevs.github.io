"""VL53L1X distance sensor: minimal

Prints the VL53L1X distance in millimetres (-1 when the reading is not valid), five times a
second for ten seconds.

The Python of vl53l1x_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: an ST VL53L1X distance sensor on I2C port 1
"""
from evn import wait, VL53L1X

# Set up all devices.
vl53l1x_1 = VL53L1X(1)


# The main program starts here.
for count in range(50):
    print(vl53l1x_1.distance() or -1)
    wait(200)
