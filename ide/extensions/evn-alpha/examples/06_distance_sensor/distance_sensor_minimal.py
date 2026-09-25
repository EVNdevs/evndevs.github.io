"""Distance sensor: minimal

Says how far away the nearest thing is, in mm, ten times a second, for ever (None when nothing
is in range; stop it with the stop button).

The Python of distance_sensor_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: the distance sensor on I2C port 1
"""
from evn import wait, DistanceSensor

# Set up all devices.
distance_sensor_1 = DistanceSensor(1)


# The main program starts here.
while True:
    print(distance_sensor_1.distance())
    wait(100)
