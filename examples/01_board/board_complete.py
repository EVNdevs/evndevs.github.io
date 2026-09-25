"""Board: the whole API

Everything on the board itself, once: the firmware and the motion engine, the battery, the user
button, the LED, the wall clock, waiting and the stopwatch. Nothing moves; the LED is left off
and every motor coasts at the end.

Needs: nothing but the board (a battery pack for the battery readings); you press the user button
when it asks.
"""
import evn
from evn import StopWatch, wait, stop_all

# --- the firmware and the motion engine -----------------------------------------------------------
print("firmware", evn.version)
print("reset cause:", evn.reset_cause())         # "watchdog" after a watchdog reboot, else "normal"
status = evn.core1_status()                      # the 1 kHz motion engine; None if not running
if status:
    ticks, period_min, period_max, exec_max, missed, late = status
    print("motion engine: %d ticks, period %d..%d us, longest tick %d us, missed %d, late %d"
          % (ticks, period_min, period_max, exec_max, missed, late))   # missed and late should be 0

# main.py starts at power-on without a button press only when boot.py says evn.autostart(True);
# it is read at boot, so setting it from a program changes nothing for this boot.
print("main.py starts without a press:", evn.autostart())

# --- the battery ----------------------------------------------------------------------------------
if evn.battery.present():
    print("battery %d mV, cells %s mV, reading %d ms old"
          % (evn.battery.voltage(), evn.battery.cells(), evn.battery.age()))
else:
    print("no battery pack: voltage() is", evn.battery.voltage())   # 0; cells(), age() None

# --- the wall clock -------------------------------------------------------------------------------
# Seconds since 1970 UTC. The board has no clock battery: it reads 0 until a host sets it (the
# extension's console sets it at every connect; a board running on its own keeps 0).
now = evn.clock()
if now:
    print("the board's clock: %d s since 1970, day %d" % (now, now // 86400))
else:
    print("the board's clock is not set")

# --- the user button and the LED ------------------------------------------------------------------
# The button is also the emergency stop (a press coasts every motor; held 2 s it reboots the
# board), so use it to start things, not in the middle of a move.
print("press the user button within 10 s")
watch = StopWatch()                              # counts milliseconds from here
while not evn.button.pressed() and watch.time() < 10000:
    evn.led.toggle()                             # blink while waiting
    wait(100)
if evn.button.pressed():
    print("pressed after", watch.time(), "ms")
    while evn.button.pressed():                  # wait for the release
        wait(10)
else:
    print("no press seen")

evn.led.on()                                     # once a program touches the LED it stops being
wait(500)                                        # the board's heartbeat
evn.led.off()
for _ in range(20):                              # set() takes any true/false value: here the LED
    evn.led.set(evn.button.pressed())            # shows the button for 2 s
    wait(100)

# --- the stopwatch --------------------------------------------------------------------------------
watch.reset()                                    # back to 0, still running
wait(300)
watch.pause()                                    # stop counting ...
wait(500)                                        # ... so this half second is left out
watch.resume()
wait(200)
print("stopwatch: %d ms (about 500: 300 + 200, the paused 500 not counted)" % watch.time())

# --- the end: the LED off, every motor coasts -----------------------------------------------------
evn.led.off()
stop_all()
