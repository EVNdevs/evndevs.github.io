"""Data log: complete

Every DataLog method: channels from a motor, the IMU, the battery and the user button at their
own rates, rows of the program's own values with log(), what the board holds with info(), a
save while the motor still drives (refused) and after it stops, a second log in a with-block,
and a third one stopped but not saved, for autosave to write at the program's end.

The board records on its own: each source at the rate it makes new readings (a motor up to
1000 a second, an IMU 200, the battery 25), kept in RAM. When a reading's share of the RAM is full, the board
keeps every second sample and halves its rate, so a recording never stops by itself. The file is
written only while the motors coast: a flash write while a motor drives would stall its control
loop. Copy a file to your computer with `mpremote cp :/data/<file>.csv .` and open it in the
extension's data viewer (right-click it, Open in data viewer).

Needs: a motor on port 1, free to turn; an EVN IMU module on I2C port 1, kept still; a battery
pack.
"""
import evn
from evn import Motor, IMU, DataLog, wait

motor = Motor(1)
imu = IMU(1)

# What a source can be logged for: the names of its methods.
print("motor:", DataLog.quantities(motor))
print("IMU:", DataLog.quantities(imu))

# Two columns of the program's own values (log()), the file /data/turns_<date>_<time>.csv,
# 16 kB of RAM for the samples.
log = DataLog("turn", "heading", name="turns", size=16384)
log.add(motor, "angle")                 # 0 = every new reading: the motor engine's 1000 a second
log.add(motor, "speed", 100)            # 100 a second
log.add(imu, "heading", 50)             # 50 a second (the IMU makes 200)
log.add(imu, "acceleration", 20)        # three values a reading: acceleration.x, .y, .z in the file
log.add(evn.battery, "voltage", 1)      # mV
log.add(evn.button, "pressed")
seconds = log.start()
print("recording:", log.running(), "- the first halving comes after about %.1f s" % (seconds or 0))

for turn in range(4):
    motor.run_angle(500, 180)
    log.log(turn, imu.heading())        # one row: the values of the headers, in order
    wait(500)

# The file is not written while a motor drives: save() raises OSError(EBUSY) (errno 16), nothing written.
log.stop()
motor.run(200)
try:
    log.save()
except OSError as e:
    print("save while the motor drives:", e)
motor.stop()                            # coast: the flash may be written again

info = log.info()
print("recorded %.1f s, %d polls, %.0f us per poll on average" % (info["seconds"], info["polls"], info["cost_mean_us"]))
for ch in info["channels"]:
    print("  %s %s %s: %d samples at %.0f a second (%s), halved %d times" % (
        ch["device"], ch["port"], ch["quantity"], ch["samples"], ch["rate"], ch["unit"], ch["halvings"]))
print("saved to", log.save())
log.close()                             # frees the RAM (close() never saves)

# A with-block closes the log at its end: save inside it.
with DataLog(name="still", size=4096) as still:
    still.add(imu, "angular_velocity", 50)
    still.start()
    wait(2000)
    still.stop()
    print("saved to", still.save("/data/still.csv"))

# autosave=True (the default): a log not yet saved is saved by itself when main.py ends, when the
# editor's Run finishes, at the board's next soft reboot or when a with block ends, once the motors coast.
last = DataLog(name="battery")
last.add(evn.battery, "cells", 5)
last.start()
wait(3000)
last.stop()                             # stopped, not saved: autosave writes it at the end
motor.stop()
