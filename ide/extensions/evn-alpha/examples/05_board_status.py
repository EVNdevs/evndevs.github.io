"""Board status without moving anything: battery, button, LED, motion engine.

Needs: nothing but the board; you press the user button when it asks.
"""
import evn
import os
from evn import wait

print("firmware", evn.version, "-", os.uname().version)
print("reset cause:", evn.reset_cause())
print("battery: %d mV, cells %s" % (evn.battery.voltage(), evn.battery.cells()))
print("motion engine (ticks, period_min_us, period_max_us, exec_max_us, missed, late):", evn.core1_status())
print("files on the board:", os.listdir("/"))

print("press the user button within 5 s (it is also the emergency stop) ...")
for _ in range(50):
    if evn.button.pressed():
        print("button pressed")
        break
    evn.led.toggle()
    wait(100)
else:
    print("no press seen")
evn.led.off()
