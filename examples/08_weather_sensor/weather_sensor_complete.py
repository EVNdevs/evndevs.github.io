"""Weather sensor: the whole API

Every EnvSensor method once: temperature, humidity and air pressure, the raw readings behind them,
and the settings that trade speed against noise (oversampling, filter, standby, forced mode). The
sensor measures by itself about 25 times a second; the getters return the latest measurement at
once and read() waits for the next one. Anything the example changes it puts back. Units: degrees
Celsius, % relative humidity, pascals (about 101300 Pa at sea level; 100 Pa = 1 hPa = 1 mbar).

Needs: the weather sensor (BME280) on I2C port 1, with its small vent hole left uncovered.
"""
from evn import EnvSensor, StopWatch, wait

env = EnvSensor(1)                      # I2C port 1..16; OSError if no BME280 answers there
print(env)                              # its settings: oversampling, filter, standby

# --- the three values ------------------------------------------------------------------------------
print("temperature %.2f C" % env.temperature())
print("humidity %.1f %%" % env.humidity())
print("pressure %.0f Pa" % env.pressure())
t, p, h = env.all()                     # all three from the same measurement
print("all:", t, p, h)
print("next measurement:", env.read())  # waits for a new one (about 40 ms at the settings of the start)
print("raw", env.raw())                 # the sensor's uncompensated codes behind them
print("measurement is", env.age(), "ms old")

print("breathe on the sensor ...")
for i in range(10):
    t, p, h = env.read()
    print(t, "C", h, "%")
    wait(500)


def pressure_spread(count):
    """How much the pressure jumps about over `count` measurements, in Pa (the noise)."""
    ps = []
    for i in range(count):
        p = env.read()[1]
        if p is not None:
            ps.append(p)
    return max(ps) - min(ps)


# --- oversampling: more samples per measurement = less noise, slower ----------------------------------
old_os = env.oversampling()             # (temperature, pressure, humidity): (2, 16, 1) at start
print("oversampling", old_os, "measurement takes at most", env.measurement_time(), "ms",
      "pressure noise %.1f Pa" % pressure_spread(20))
env.oversampling(temperature=1, pressure=1, humidity=1)   # 0 (skip), 1, 2, 4, 8 or 16 each
print("oversampling", env.oversampling(), "measurement takes at most", env.measurement_time(), "ms",
      "pressure noise %.1f Pa" % pressure_spread(20))
env.oversampling(humidity=0)            # skip humidity: it reads None (skipping temperature makes all three None)
print("humidity skipped:", env.humidity())
env.oversampling(temperature=old_os[0], pressure=old_os[1], humidity=old_os[2])

# --- the filter: smooths pressure (and temperature) over several measurements -----------------------------
old_filter = env.filter()               # 16 at start
env.filter(0)                           # 0 (off), 2, 4, 8 or 16
print("filter off: pressure noise %.1f Pa" % pressure_spread(20))
env.filter(old_filter)
print("filter", env.filter(), ": pressure noise %.1f Pa" % pressure_spread(20))

# --- standby: the pause between measurements --------------------------------------------------------------
old_standby = env.standby()             # 0.5 ms at start
env.standby(250)                        # 0.5, 10, 20, 62.5, 125, 250, 500 or 1000 ms
sw = StopWatch()
env.read()
env.read()
print("standby 250 ms: two measurements took", sw.time(), "ms")
env.standby(old_standby)

# --- forced mode: the board asks for one measurement every so often (saves power) ---------------------------
old_forced = env.forced()               # 0 at start: the sensor measures by itself (normal mode)
env.forced(1000)                        # one measurement a second (0..2000000 ms; 0 = back to normal mode)
sw = StopWatch()
env.read()
env.read()
print("forced every 1000 ms: two measurements took", sw.time(), "ms")
env.forced(old_forced)

print("back to", env)

# --- the end: the port is free again ------------------------------------------------------------------------
env.close()
