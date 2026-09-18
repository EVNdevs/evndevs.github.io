"""run_until_stalled: drive against an obstruction and report where it stopped.

Hold the shaft (or let the mechanism hit its end stop). An unloaded shaft
creeps instead of stalling, so this call does not return until something blocks
it. Ctrl+C aborts and coasts the motor.

duty_limit caps the push as a percentage of the voltage cap; 50 % is a gentle
push for an EV3 Medium (its breakaway is about 50 %); an EV3 Large moves at 40 %.

Needs: one motor on port 1 and something to block its shaft (your hand or an end stop).
"""
from evn import Motor, Stop, wait

m = Motor(1)

print("grab the shaft within the next 3 s ...")
wait(3000)

end = m.run_until_stalled(200, then=Stop.COAST, duty_limit=50)
print("stalled at", end, "deg; stalled() =", m.stalled())

wait(500)
m.reset_angle()                  # the stop becomes the 0 reference
m.run_target(300, -90)           # back off 90 deg from it
print("backed off to", m.angle(), "deg")

m.stop()
m.close()
