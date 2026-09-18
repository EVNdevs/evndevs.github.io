"""Speeds in percent instead of deg/s.

With speed_unit=SpeedUnit.PERCENT every speed this motor takes or reports is a
percentage of full_speed(): the motor's no-load speed at the present battery
voltage. The firmware starts from the motor model's rated no-load speed
(EV3 Large 1050 deg/s, EV3 Medium 1560 deg/s at 9 V) scaled by the pack;
calibrate() replaces that with a measurement on your motor, stored in flash
for that port (the shaft must be free to spin: wheels off the ground).

Needs: one motor on port 1, shaft free to spin (it calibrates itself).
"""
from evn import Motor, SpeedUnit, Stop, wait

m = Motor(1, speed_unit=SpeedUnit.PERCENT)

print("100 % is", m.full_speed(), "deg/s at this battery voltage")
m.calibrate()                           # 4.5 s: pulses forward and back, stored for this port
print("calibrated: 100 % is now", m.full_speed(), "deg/s")

m.run(50)                               # half of full speed
wait(1000)
print("run(50) -> speed()", m.speed(), "%")

m.run_angle(30, 360)                    # one turn at 30 %
m.run_target(60, 0, then=Stop.COAST)    # back to 0 at 60 %, then release
print("angle", m.angle())

# The validated speed limit is still enforced; in percent mode it reads as %.
print("limits (speed %, acceleration deg/s^2, torque mNm):", m.control.limits())

# Switch the same motor back to deg/s at any time.
m.speed_unit(SpeedUnit.DEG_S)
print("in deg/s: limits", m.control.limits())

m.stop()
m.close()
