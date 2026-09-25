"""Distance sensor: the whole API

Every DistanceSensor method once: the distance, why a reading is missing, the four ready-made
profiles, and the settings behind them (timing budget, signal rate limit, laser pulse periods,
pause between readings). The sensor measures by itself all the time; distance() returns the latest
reading at once and read() waits for the next one. Anything the example changes it puts back.
Distances are in mm; None means nothing is in range.

Needs: the distance sensor on I2C port 1, and a hand or a box to move in front of it.
"""
from evn import DistanceSensor, StopWatch, wait

ds = DistanceSensor(1)                  # I2C port 1..16; OSError if no VL53L0X answers there
print(ds)                               # its settings: timing budget, signal rate limit, ...


def mm(d):
    """A distance as text: None (no target) becomes "nothing in range"."""
    return "nothing in range" if d is None else str(d) + " mm"


# --- the distance --------------------------------------------------------------------------------
print("move your hand in front of the sensor ...")
for i in range(20):
    d = ds.distance()                   # mm, or None when there is no valid target
    # status() says why a reading is missing ('signal fail', 'phase fail', ...); it stays 'valid'
    # when the sensor simply saw nothing within its reach
    print(mm(d), "- status", ds.status())
    wait(100)

print("next reading", mm(ds.read()))    # waits for a new measurement
print("status", ds.status())            # 'valid' when the reading can be trusted
# (range_mm, status, device_status, signal_rate, ambient_rate, spad_count): the range is there even
# when the status says it is not valid; the rates are in MCPS (millions of counts per second)
print("raw", ds.raw())
print("reading is", ds.age(), "ms old")

# --- the four profiles ---------------------------------------------------------------------------
# Each one sets the timing budget, signal rate limit and pulse periods together.
for name in ("high_speed", "high_accuracy", "long_range", "default"):
    ds.profile(name)
    sw = StopWatch()
    d = ds.read()
    print(name, ":", mm(d), "- next reading after", sw.time(), "ms")

# --- the settings behind them --------------------------------------------------------------------
# timing budget: time per measurement, 20..1000 ms. Longer = more exact, fewer readings.
old_budget = ds.timing_budget()         # 33.0 ms at start
ds.timing_budget(200)
sw = StopWatch()
for i in range(3):
    ds.read()
print("timing budget 200 ms: one reading every", sw.time() / 3, "ms")
ds.timing_budget(old_budget)

# signal rate limit: how weak a return still counts, 0..511.99 MCPS. Lower = further, more mistakes.
old_limit = ds.signal_rate_limit()      # 0.25 at start
ds.signal_rate_limit(0.1)
print("signal rate limit 0.1:", mm(ds.read()))
ds.signal_rate_limit(old_limit)

# laser pulse periods (pre-range, final-range), in PCLKs: longer pulses reach further
old_pre, old_final = ds.vcsel_periods() # (14, 10) at start
ds.vcsel_periods(18, 14)                # pre 12/14/16/18, final 8/10/12/14
print("pulse periods", ds.vcsel_periods(), ":", mm(ds.read()))
ds.vcsel_periods(old_pre, old_final)

# pause between readings, 0..60000 ms: fewer readings, less power
old_pause = ds.inter_measurement()      # 0 at start: back to back
ds.inter_measurement(500)
sw = StopWatch()
ds.read()
ds.read()
print("with a 500 ms pause: two readings took", sw.time(), "ms")
ds.inter_measurement(old_pause)

print("back to", ds)

# --- the end: the port is free again --------------------------------------------------------------
ds.close()
