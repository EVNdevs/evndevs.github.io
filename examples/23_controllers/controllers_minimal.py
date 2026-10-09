"""Controllers: minimal

A line follower: a PID controller, made once and kept in the variable pid, turns the robot from
the brightness of the floor under the colour sensor, so the robot follows the edge of the line
for 10 s, then stops. Tune kp first (the wobble), then kd (the damping), then ki (the steady
pull to one side). A second controller is a second variable: as many as the program needs.

The Python of controllers_minimal.evnblocks: the blocks and this file are the same program (open
the blocks file under Examples to see it as blocks).

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels 170 mm apart; an EVN colour sensor on I2C port 2 facing the floor a few mm up, over the edge of a dark line on a light floor
"""
from evn import Motor, Direction, wait, ColorSensor, DriveBase, PID

# Set up all devices.
motor_3 = Motor(3)
motor_4 = Motor(4, positive_direction=Direction.COUNTERCLOCKWISE)

color_sensor_2 = ColorSensor(2)

drive_base = DriveBase(motor_4, motor_3, wheel_diameter=62.4, axle_track=170)

pid = None


# The main program starts here.
pid = PID(kp=1.5, ki=0.2, kd=0.08, limits=120)
for count in range(1000):
    drive_base.drive(120, pid.update(34, color_sensor_2.hsv().v))
    wait(10)
drive_base.stop()
