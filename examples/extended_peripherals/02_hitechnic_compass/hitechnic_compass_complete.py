"""HiTechnic compass: the whole API

Every method of HiTechnicCompass once: the heading and its age, north() to choose where 0 is, and
the calibration the sensor runs and stores itself. The sensor runs its port at 100 kHz; keep it level
and away from the motors.

Needs: a HiTechnic NXT Compass Sensor on I2C port 5, through an NXT cable adapter; room to turn the robot on the floor
"""
import evn
from evn import HiTechnicCompass, StopWatch, wait

PORT = 5


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


compass = HiTechnicCompass(PORT)                 # "HiTechnc" + "Compass" ID strings
print(compass, "firmware", compass.firmware())
press_button("Put the robot on the floor, pointing any way.")
print("heading %.0f (reading age %d ms)" % (compass.heading(), compass.age()))
compass.north()                                  # the way the robot points now is 0 degrees
print("after north(): %.0f" % compass.heading())
compass.north(90)                                # ... or any heading you choose
print("after north(90): %.0f" % compass.heading())

press_button("CALIBRATION: when it starts, turn the robot slowly and level through a little\n"
             "more than one full turn, taking at least 20 seconds.")
compass.calibrate()                              # the sensor's own hard-iron calibration
clock = StopWatch()
while clock.time() < 25000:
    print("calibrating: %s" % compass.calibrating())
    wait(1000)
if compass.calibrate_stop():                     # the sensor stores the result itself
    print("calibration accepted")
else:
    print("calibration rejected: turn more slowly, level, and try again")
print("heading %.0f" % compass.heading())
compass.close()                                  # the port back at 400 kHz
