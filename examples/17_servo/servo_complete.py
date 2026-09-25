"""Servo: the whole API

Every Servo method once, on the two kinds of servo in the kit. A fixed-range servo (the Geekservo
270, the default profile) goes to an ANGLE: angle() jumps, move() sweeps at a set speed, done()
says when a sweep has finished, stop() ends one part way. A continuous-rotation servo (the
Geekservo continuous) turns at a SPEED: duty() -100..100 %, 0 or stop() stops it; angle() and
move() raise TypeError on it, as duty() does on a fixed-range one. Then the pulse itself, the
pulse range, switching the pulses off and on, and giving the port back.

Needs: a Geekservo 270-degree servo on servo port 1 and a Geekservo continuous-rotation servo on
servo port 2, both with nothing in the way of the horn.
"""
from evn import Servo, wait

# --- the constructors: the servo goes to its start position at once -----------------------------
arm = Servo(1)                                   # profile "geekservo_270": 0..270 degrees, 600..2400 us,
                                                 # starts at 135, sweeps at up to 500 deg/s
wheel = Servo(2, "geekservo_cr")                 # continuous rotation: starts stopped
# other forms: Servo(n, "generic") is a 180-degree hobby servo (500..2500 us); reverse=True
# mirrors the direction; range=, min_us=, max_us=, start=, max_dps= override one field
print(arm)
print(wheel)
print("profile (name, range, min_us, max_us, start, max_dps, reverse):", arm.profile())

# --- a fixed-range servo: angles ------------------------------------------------------------------
arm.angle(90)                                    # jump: as fast as the servo can go
wait(1000)
print("at", arm.angle(), "degrees")              # the position the board sent (no sensor inside)
arm.move(180, 90)                                # sweep to 180 at 90 deg/s, wait until there
arm.move(0, speed=200, wait=False)               # sweep in the background ...
while not arm.done():                            # ... while the program goes on
    print("passing", round(arm.angle()))
    wait(200)
arm.move(270, 60, wait=False)
wait(1500)
arm.stop()                                       # end the sweep where it is (about 90 degrees)
print("stopped at", round(arm.angle()))
try:
    arm.duty(50)                                 # a fixed-range servo has no speed
except TypeError as e:
    print("arm.duty():", e)

# --- the pulse itself (both kinds) --------------------------------------------------------------------
arm.pulse(1500)                                  # 1500 us, the middle of 600..2400: 135 degrees
wait(1000)
print("pulse", arm.pulse(), "us = angle", arm.angle())

# a narrower pulse range: 0 and 270 degrees now land 100 us inside the old ends (a servo that
# buzzes at its end stops gets this); put back as the profile had it
arm.set_range(700, 2300)
arm.move(0, 200)
arm.set_range(600, 2400)
arm.move(135, 200)

# --- a continuous-rotation servo: speed ------------------------------------------------------------
wheel.duty(50)                                   # half speed forwards (about 185 deg/s on the bench rig, turning a gearbox)
wait(2000)
print("duty", wheel.duty(), "%, pulse", wheel.pulse(), "us")
wheel.duty(-100)                                 # full speed backwards
wait(2000)
wheel.duty(0)                                    # 0 stops it ...
wait(500)
wheel.duty(30)
wait(1000)
wheel.stop()                                     # ... and so does stop()
try:
    wheel.angle(90)                              # a continuous servo has no angle
except TypeError as e:
    print("wheel.angle():", e)

# --- pulses off and on ---------------------------------------------------------------------------------
arm.disable()                                    # no pulses, the pin low: the servo goes limp
wait(2000)
arm.enable()                                     # pulses again, at the last position
wait(500)

# --- the end: stop both and give the ports back (an RGBLED strip or a new Servo can take them) -------
arm.stop()
wheel.stop()
arm.close()
wheel.close()
