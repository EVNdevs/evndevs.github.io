"""Limits and tuning: read the validated defaults, then try an asymmetric profile.

Every change here affects this Motor object only; the firmware's per-model
defaults are untouched and come back at the next power-on.

control.pid() and control.evn() are the legacy PID law's knobs. The default
law is "adrc" (self-calibrated, no gains to set) and ignores them, so the
last section switches this motor to control.law("pid") first.

Needs: one motor on port 3, wheels off the ground.
"""
from evn import Motor, wait, StopWatch

m = Motor(3)

print("limits (speed, acceleration, torque):", m.control.limits())
print("pid (kp, ki, kd, integral_deadzone, integral_limit):", m.control.pid())
print("evn (endpoint_kd, start_duty %, hold_duty %, friction_ff %):", m.control.evn())
print("target tolerances (speed, position):", m.control.target_tolerances())

# Accelerate hard, decelerate gently: the profiler honours the two separately.
m.control.limits(acceleration=(2000, 400))
print("limits now:", m.control.limits())

sw = StopWatch()
m.run_angle(500, 720, wait=False)
peak = 0
while not m.done():
    peak = max(peak, m.speed())
    wait(10)
print("720 deg in", sw.time(), "ms, peak", peak, "deg/s (slow ramp-down is expected)")

# A softer voltage cap slows everything down without changing the gains.
m.settings(max_voltage=6000)
sw.reset()
m.run_angle(800, 360)
print("360 deg under a 6 V cap:", sw.time(), "ms")
m.settings(max_voltage=9000)

# Anti-windup and the stiction floors are real, enforced knobs - of the PID
# law only. Under the default "adrc" law they are stored but never used.
m.control.law("pid")
m.control.pid(integral_limit=10)
m.control.evn(hold_duty=40)
print("pid after integral_limit=10:", m.control.pid())
print("evn after hold_duty=40:", m.control.evn())
m.run_angle(500, 360)
print("law:", m.control.law())
m.control.law("adrc")

m.stop()
m.close()
