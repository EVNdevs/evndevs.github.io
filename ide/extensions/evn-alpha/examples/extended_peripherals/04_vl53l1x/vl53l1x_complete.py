"""VL53L1X distance sensor: the whole API

Every method of VL53L1X once: the distance and why a reading is not valid, the raw result, both
distance modes and the timing budget (the time per measurement: longer is steadier and reaches
further, with fewer readings).

Needs: an ST VL53L1X distance sensor on I2C port 1
"""
import evn
from evn import StopWatch, VL53L1X, wait

PORT = 1


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


tof = VL53L1X(PORT)                              # model ID 0xEACC, after ruling out a VL53L0X / TCS34725
print(tof, "mode", tof.distance_mode(), "budget %d ms" % tof.timing_budget())   # long, 33 ms
press_button("Hold your hand 10 to 50 cm in front of the distance sensor, then move it away.")
clock = StopWatch()
while clock.time() < 5000:
    d = tof.distance()                           # None when the reading is not valid
    mm, number, signal, ambient = tof.raw()      # whatever the status
    print("distance %s mm  status %r (%d)  signal %d kcps  ambient %d kcps  age %d ms"
          % (d, tof.status(), number, signal, ambient, tof.age()))
    wait(250)
tof.distance_mode('short')                       # up to ~1.3 m, copes better with daylight
tof.timing_budget(15)                            # the fastest reading: 15 ms is short mode only
print("short mode, 15 ms: %s mm" % tof.distance())
tof.timing_budget(50)                            # back to a budget long mode also has ...
tof.distance_mode('long')                        # ... before the switch to long (up to ~4 m)
print("long mode, 50 ms: %s mm" % tof.distance())
tof.close()                                      # stops ranging
