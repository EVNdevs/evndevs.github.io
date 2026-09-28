"""VL53L1X distance sensor: the whole API

Every method of VL53L1X once: the distance and why a reading is not valid, the raw result, both
distance modes and the timing budget (the time per measurement: longer is steadier and reaches
further, with fewer readings), the time between readings, the field of view, the signal and sigma
thresholds, the sensor's own detection of something closer than a distance, and ST's offset
calibration, stored on the board for the port.

Needs: an ST VL53L1X distance sensor on I2C port 1, a flat grey or white card and a ruler
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

tof.inter_measurement(100)                       # a measurement every 100 ms (0 = back to back)
tof.roi(8, 8)                                    # a narrower field of view, centred
tof.signal_threshold(512)                        # accept a weaker return (dark or far targets)
tof.sigma_threshold(90)                          # the spread accepted, ST's default
print("period %d ms, roi %s, signal >= %d kcps, sigma <= %d mm"
      % (tof.inter_measurement(), tof.roi(), tof.signal_threshold(), tof.sigma_threshold()))
tof.distance_threshold('below', 200)             # the sensor itself reports only what is closer than 200 mm
press_button("Now bring your hand closer than 20 cm, and away again, for five seconds.")
clock.reset()
while clock.time() < 5000:
    print("threshold %s  detected %s  distance %s  status %r"
          % (tof.distance_threshold(), tof.detected(), tof.distance(), tof.status()))
    wait(250)
tof.distance_threshold(None)                     # every measurement again
tof.roi(16, 16)
tof.inter_measurement(0)

# ST's offset calibration, stored on the board for this port: every VL53L1X object on it starts with it
press_button("Hold a flat grey or white card square to the sensor, exactly 140 mm from its glass (measure it).")
print("offset %d mm" % tof.calibrate_offset(140))   # 50 readings, about 2 s, then stored
print("offset %s mm, crosstalk %s cps" % (tof.offset(), tof.crosstalk()))   # crosstalk None: the sensor's own
print("140 mm reads %s mm" % tof.distance())
print(tof.stored_calibration())                  # the target, the spread of the 50 readings, the sensor's own values
print("stored offset of port %d: %s mm" % (PORT, evn.vl53l1x_calibration(PORT)["offset"]))   # no sensor object needed
tof.close()                                      # stops ranging
