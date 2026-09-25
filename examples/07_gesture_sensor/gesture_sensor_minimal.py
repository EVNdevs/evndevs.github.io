"""Gesture sensor: minimal

Waits for a hand to swipe over the sensor and says which way it went: 'up', 'down', 'left' or
'right' (None when no swipe comes within 5 s). Runs for ever; stop it with the stop button.

The Python of gesture_sensor_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: the gesture sensor on I2C port 1, and a hand to swipe a few cm above it
"""
from evn import GestureSensor

# Set up all devices.
gesture_sensor_1 = GestureSensor(1)


# The main program starts here.
while True:
    print(gesture_sensor_1.read_gesture(5000))
