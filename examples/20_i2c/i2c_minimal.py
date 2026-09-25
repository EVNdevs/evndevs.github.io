"""I2C: minimal

Finds the EVN IMU module on I2C port 1 the safe way. A device answering at an address proves
nothing (another chip can sit there), so the program also reads the chip's WHO_AM_I register,
which an MPU-6500 answers with 0x70. Only reads: the one byte written is the register number that
readfrom_mem() sends before it reads.

Needs: an EVN IMU module (MPU-6500) on I2C port 1
"""
from evn import I2C

bus = I2C(1)                                     # raw I2C on port 1 (ports 1..16)
print("addresses answering on port 1:", [hex(a) for a in bus.scan()])

# 0x68 is the MPU-6500's address, 0x75 its WHO_AM_I register
if bus.probe(0x68) and bus.readfrom_mem(0x68, 0x75, 1) == b"\x70":
    print("an MPU-6500 IMU at 0x68")
else:
    print("no MPU-6500 on port 1")
