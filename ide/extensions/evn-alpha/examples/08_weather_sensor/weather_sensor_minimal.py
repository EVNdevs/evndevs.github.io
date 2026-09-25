"""Weather sensor: minimal

Says the temperature in degrees Celsius once a second, for ever (stop it with the stop button).

The Python of weather_sensor_minimal.evnblocks: the blocks and this file are the same program
(open the blocks file under Examples to see it as blocks).

Needs: the weather sensor (BME280) on I2C port 1
"""
from evn import wait, EnvSensor

# Set up all devices.
env_sensor_1 = EnvSensor(1)


# The main program starts here.
while True:
    print(env_sensor_1.temperature())
    wait(1000)
