"""HiTechnic compass: minimal

Prints the HiTechnic compass heading five times a second for ten seconds.

The Python of hitechnic_compass_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: a HiTechnic NXT Compass Sensor on I2C port 5, through an NXT cable adapter; room to turn the robot on the floor
"""
from evn import wait, HiTechnicCompass

# Set up all devices.
ht_compass_5 = HiTechnicCompass(5)


# The main program starts here.
for count in range(50):
    print(ht_compass_5.heading())
    wait(200)
