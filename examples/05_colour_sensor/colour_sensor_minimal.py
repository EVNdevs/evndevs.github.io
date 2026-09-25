"""Colour sensor: minimal

Says the colour the sensor sees, five times a second, for ever (stop it with the stop button).

The Python of colour_sensor_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: the colour sensor on I2C port 1, and something coloured to hold under it
"""
from evn import wait, ColorSensor

# Set up all devices.
color_sensor_1 = ColorSensor(1)


# The main program starts here.
while True:
    print(color_sensor_1.color())
    wait(200)
