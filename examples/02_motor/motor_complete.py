"""Motor: the whole API

Every Motor method once, in the order a program usually needs them: the constructor's options,
calibration, measuring, the four moves, stopping, stall detection, the speed unit, the limits and
tolerances of the controller, and the diagnostics. The speed unit, full speed and limits it
changes it puts back; a calibration it makes stays stored on the board, and the control law ends on
the default ADRC. Numbers are deg/s and degrees unless the line says otherwise.

Needs: motors on ports 1 and 2, wheels off the ground (the calibration turns a shaft up to a turn
each way); when the program asks, you hold the wheel on port 1 until it stops (stall detection).

"""
import evn
from evn import Motor, Direction, Stop, SpeedUnit, wait, stop_all

# --- the constructor ---------------------------------------------------------------------------
m = Motor(1)                                     # EVN port 1..4 (Port.A..D are the same numbers)
m2 = Motor(2, positive_direction=Direction.COUNTERCLOCKWISE, speed_unit=SpeedUnit.PERCENT)

print("port 1 runs:", evn.motor_config(1)["model"])    # what the board says is on the port

# --- calibration: once per motor, stored on the board -------------------------------------------
# calibrate(wait=False) starts a port's calibration and goes on; the motion engine runs the ports
# one after the other while the program waits. Watch evn.calibration(port)["busy"] to know when all
# are done (a waiting calibrate() joins a run only while it is still going: on a port that has
# already finished it would start a new one).
started = []
for port, motor in ((1, m), (2, m2)):
    if not evn.calibration(port)["calibrated"]:
        motor.calibrate(wait=False)
        started.append(port)
while any(evn.calibration(port)["busy"] for port in started):
    wait(50)
for port in started:
    print("port", port, "calibration:", evn.calibration(port))

# --- measuring ---------------------------------------------------------------------------------
m.reset_angle(0)                                 # this position is 0 from now on
print("angle", m.angle(), "speed", m.speed(), "load", m.load(), "mNm")
print("full speed", m.full_speed(), "deg/s at this battery voltage")

# --- the four moves ----------------------------------------------------------------------------
m.run_angle(500, 360)                            # by an angle: one turn at 500 deg/s, hold at the end
m.run_target(300, 90, then=Stop.BRAKE)           # to an angle
m2.run_time(50, 1000, then=Stop.COAST, wait=False)   # for a time: 50 % for 1 s, and go on at once
while not m2.done():
    wait(10)
m.run(200)                                       # at a speed, until told otherwise
wait(1000)
print("running at", m.speed(), "deg/s")

# --- stopping ----------------------------------------------------------------------------------
m.brake()                                        # short the windings: stops quickly, then free
m.hold()                                         # hold the position actively
wait(300)
m.stop()                                         # coast

# --- stall detection ---------------------------------------------------------------------------
# turn until something stops the shaft, pushing with at most 40 % duty. On a free shaft nothing
# ever does, so the program waits for your hand: grab the wheel (40 % is gentle).
print("Hold the wheel on port 1 until it stops ...")
angle = m.run_until_stalled(150, then=Stop.COAST, duty_limit=40)
print("stalled at", angle, "stalled() says", m.stalled())

# --- no speed control, and following a moving target --------------------------------------------
m2.dc(30)                                        # a plain duty cycle, -100..100 %
wait(500)
m2.dc(0)
for step in range(10):
    m.track_target(m.angle() + 10)               # jump the reference, no speed profile
    wait(50)
m.stop()

# --- the speed unit -----------------------------------------------------------------------------
print("port 2 counts in", "%" if m2.speed_unit() == SpeedUnit.PERCENT else "deg/s")
m.speed_unit(SpeedUnit.PERCENT)                  # port 1 now counts in % of full speed ...
m.run_angle(50, 180)                             # ... so this is half speed
m.speed_unit(SpeedUnit.DEG_S)
full = m.full_speed()
m.full_speed(full)                               # what 100 % means (set back to what it was)

# --- the controller: limits, tolerances, the law ---------------------------------------------------
speed, accel, torque = m.control.limits()
print("limits: speed", speed, "acceleration", accel, "torque", torque)
m.control.limits(acceleration=1000)              # gentler starts and stops; the others kept
m.run_angle(500, -360)
m.control.limits(speed, accel, torque)           # back to what they were

print("target tolerances", m.control.target_tolerances(), "stall tolerances", m.control.stall_tolerances())
print("law", m.control.law(), "PID gains", m.control.pid(), "EVN terms", m.control.evn())
m.control.law("adrc")                            # the default law ("pid" is the older one)
print("controller: done", m.control.done(), "stalled", m.control.stalled(), "load", m.control.load())
print("controller state", m.control.state())

# --- the motor's settings and model -----------------------------------------------------------------
print("settings (max voltage mV, stall timeout ms):", m.settings())
print("model state", m.model.state(), "model settings", m.model.settings())

# --- the end: every motor coasts, and the objects let go of their ports ---------------------------
stop_all()
m.close()
m2.close()
