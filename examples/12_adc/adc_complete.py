"""ADC: the whole API

Every ADC method once: voltages and raw codes, which inputs are measured (four single-ended and
four differential), the range, the data rate and continuous mode. The ADC measures by itself in the
background; voltage() and raw() return the latest conversion at once and read() waits for the next
one. Anything the example changes it puts back.

Inputs: 0..3 = A0..A3 against GND; 4 = A0 - A1, 5 = A0 - A3, 6 = A1 - A3, 7 = A2 - A3 (these can
be negative). An input with nothing wired to it floats and reads a wandering few tenths of a volt.

Needs: the ADC module on I2C port 1, and a voltage of 0 to 3.3 V on A0 (for example a potentiometer
between the board's 3.3 V and GND pins, its middle pin on A0; A1..A3 may stay open). Never more than
3.3 V on a pin, whatever the range.
"""
from evn import ADC, StopWatch, wait

adc = ADC(1)                            # I2C port 1..16; OSError if no ADS1115 answers there
print(adc)                              # its settings: inputs, range, data rate

# --- voltage and raw code ------------------------------------------------------------------------
print("A0", adc.voltage(0), "V")        # the latest conversion, in volts
print("A0", adc.voltage(), "V")         # no input = the first measured one (A0 at start)
print("next conversion", adc.read(0), "V")   # waits for a new one (about 3 ms)
code = adc.raw(0)                       # the chip's signed 16-bit code, -32768..32767
print("raw", code, "=", code * adc.range() / 32768, "V")   # volts = code x range / 32768
print("conversion is", adc.age(0), "ms old")

print("turn the potentiometer ...")
for i in range(20):
    print("A0 %.3f V" % adc.read(0))
    wait(250)

# --- which inputs are measured -----------------------------------------------------------------------
old_inputs = adc.inputs()               # (0,) at start: only A0
adc.inputs((0, 1, 2, 3, 4))             # measured in turn; each one is refreshed less often
for i in adc.inputs():
    print("input", i, "%.3f V" % adc.voltage(i))
adc.inputs(old_inputs)                  # a voltage() of an input not measured raises ValueError

# --- the range: full scale is +/- this many volts -----------------------------------------------------
old_range = adc.range()                 # 4.096 at start
adc.range(2.048)                        # 6.144, 4.096, 2.048, 1.024, 0.512 or 0.256
print("range 2.048 V: raw", adc.raw(0), "- twice the code for the same voltage,",
      "and anything above 2.048 V clips at 32767:", adc.voltage(0), "V")
adc.range(old_range)

# --- the data rate: slower = quieter ---------------------------------------------------------------------
old_rate = adc.data_rate()              # 860 samples per second at start
adc.data_rate(8)                        # 8, 16, 32, 64, 128, 250, 475 or 860
sw = StopWatch()
for i in range(5):
    adc.read(0)
print("8 per second: one conversion every", sw.time() / 5, "ms")   # the chip is ~20 % slower than its rate
adc.data_rate(old_rate)

# --- continuous mode: one input, back to back, the fastest way -------------------------------------------
old_continuous = adc.continuous()       # None at start: the inputs() are measured in turn
adc.continuous(0)                       # only A0, converted back to back
sw = StopWatch()
for i in range(100):
    adc.read(0)
print("continuous: one conversion every", sw.time() / 100, "ms")
adc.continuous(old_continuous)          # None = back to measuring inputs() in turn

print("back to", adc)

# --- the end: the chip powers down and the port is free again ---------------------------------------------
adc.close()
