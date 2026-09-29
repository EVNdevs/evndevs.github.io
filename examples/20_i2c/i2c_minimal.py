"""I2C: minimal

Finds the EVN IMU module on I2C port 1 the safe way. A device answering at an address proves
nothing (another chip can sit there), so the program also reads the chip's WHO_AM_I register
(0x75), which an MPU-6500 answers with 0x70 (112). Only reads: the one byte written is the
register number that the read sends first.

The Python of i2c_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: an EVN IMU module (MPU-6500) on I2C port 1
"""
from evn import I2C

# Set up all devices.
i2c_1 = I2C(1)


# The main program starts here.
print('addresses answering on port 1: ' + str([hex(address) for address in i2c_1.scan()]))
if i2c_1.probe(0x68) and i2c_1.readfrom_mem(0x68, 0x75, 1)[0] == 112:
    print('an MPU-6500 IMU at 0x68')
else:
    print('no MPU-6500 on port 1')
