"""IMU: minimal

The robot's heading from the gyro, five times a second for ten seconds: 0 where it points at the
start, going up as it turns clockwise.

The Python of imu_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: an EVN IMU module on I2C port 1, fixed flat to the robot; keep it still for the first seconds
"""
from evn import wait, IMU

# Set up all devices.
imu_1 = IMU(1)


# The main program starts here.
imu_1.reset_heading()
for count in range(50):
    print(imu_1.heading())
    wait(200)
