"""HiTechnic colour sensor: minimal

Prints the HiTechnic colour sensor's own colour number five times a second for ten seconds.

The Python of hitechnic_color_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: a HiTechnic NXT Color Sensor (V1 or V2) on I2C port 8, through an NXT cable adapter
"""
from evn import wait, HiTechnicColorSensor

# Set up all devices.
ht_color_8 = HiTechnicColorSensor(8)


# The main program starts here.
for count in range(50):
    print(ht_color_8.color_number())
    wait(200)
