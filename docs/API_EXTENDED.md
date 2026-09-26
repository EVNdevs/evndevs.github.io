# Extended peripherals: HiTechnic, HuskyLens, VL53L1X and TCS3430

Part 4 of the [EVN ALPHA MicroPython API reference](API.md), which has the units, the port numbers and the differences from Pybricks. Previous: [Standard peripherals: displays, lights, servo and Bluetooth](API_DISPLAYS.md) · Next: [Ports, programs, the data logger and timing](API_SYSTEM.md).

Devices the firmware drives natively that EVN does not stock: the HiTechnic NXT colour sensor and compass, the HuskyLens camera, the VL53L1X distance sensor and the TCS3430 colour sensor.

## EVN Extended Peripherals

*Extended peripherals* are devices the firmware drives natively, like the standard ones, that EVN does not stock and has no LEGO-compatible mounts for — kit people may already own. The firmware treats them like standard peripherals; a few features of each are still being added (see each section's notes).

| Class | Device | Port | Examples |
| :--- | :--- | :--- | :--- |
| [`HiTechnicColorSensor`](#hitechniccolorsensor--hitechnic-nxt-color-sensor-v1--v2) | HiTechnic NXT Color Sensor V1 / V2 | I2C 1–16 (NXT cable adapter) | `examples/extended_peripherals/01_hitechnic_color/` |
| [`HiTechnicCompass`](#hitechniccompass--hitechnic-nxt-compass-sensor) | HiTechnic NXT Compass Sensor | I2C 1–16 (NXT cable adapter) | `examples/extended_peripherals/02_hitechnic_compass/` |
| [`HuskyLens`](#huskylens--dfrobot-huskylens-ai-camera) | DFRobot HuskyLens AI camera (I2C mode) | I2C 1–16 | `examples/extended_peripherals/03_huskylens/` |
| [`VL53L1X`](#vl53l1x--time-of-flight-distance-sensor-up-to-4-m) | ST VL53L1X time-of-flight distance sensor | I2C 1–16 | `examples/extended_peripherals/04_vl53l1x/` |
| [`TCS3430`](#tcs3430--xyz-colour-and-ambient-light-sensor) | ams-OSRAM TCS3430 XYZ colour / ambient light sensor | I2C 1–16 | `examples/extended_peripherals/05_tcs3430/` |

**The HiTechnic sensors run their port at 100 kHz.** At the standard 400 kHz they failed about one read in 800 on the bench; at 100 kHz none. The rate is per port (`evn.I2C(port).freq()` shows it): every other port stays at 400 kHz, and `close()` or the end of the program puts the port back. A standard peripheral on the same port as a HiTechnic sensor runs at 100 kHz too. Their address is 0x01 (the NXT's 8-bit 0x02), which `evn.I2C` and its `scan()` reach.

The HuskyLens, the VL53L1X and the TCS3430 run at the standard 400 kHz.

Blocks for all five are in the **Extended** category of the block editor (`docs/BLOCKS.md`).

## HiTechnicColorSensor — HiTechnic NXT Color Sensor V1 / V2

Plug the sensor into an I2C port through an NXT cable adapter (SDA, SCL, power and ground). The V2 (type "ColorPD") and the older V1 (type "Color") are both taken; `version()` says which is on the port. The V2 has three modes, switched on demand: the LED on with the ambient light cancelled (every colour reading), the LED off (`ambient()`) and the LED on without cancellation (`raw()`).

**Constructor**

| Call | Notes |
| :--- | :--- |
| `hc = HiTechnicColorSensor(port)` | `port` 1..16; `OSError("no HiTechnic sensor on port N (I2C 0x01)")` when no "HiTechnc" ID string answers, `OSError("port N has a HiTechnic Compass, not a HiTechnicColorSensor")` for another HiTechnic sensor, `OSError("no free HiTechnic slot (4 at once)")`. Returns with the first reading |

**Methods**

| Call | Notes |
| :--- | :--- |
| `hc.version()` | 1 (V1) or 2 (V2), from the sensor's type string |
| `hc.firmware()` | the sensor's firmware text, e.g. `'V1.5'` |
| `hc.calibrate_black()` | takes the current reading (LED on, ambient cancelled) as the black reference: hold nothing in front of the sensor (or a black target) where the colours will be read. A V2 is switched to that mode first |
| `hc.calibrate_white()` | takes the current reading of a white target as the reference white. From then on each of red, green and blue is (reading − black) / (white − black), clamped 0..100 %, before `hsv()`, `color()` and `color_match()`. `ValueError("the white target is too dark or not brighter than the black reference: hold a white sheet in front")` when a channel is not at least 10 % above the black |
| `hc.black_reference()` | the black reference as `(R, G, B)` in counts (floats), or `None` when none is taken; `hc.black_reference(None)` clears it (any other argument raises `ValueError`: use `calibrate_black()`) |
| `hc.white_reference()` | the reference white as `(R, G, B)` in counts, or `None`; `hc.white_reference(None)` clears it (any other argument raises `ValueError`: use `calibrate_white()`) |
| `hc.color()` | the `detectable_colors()` entry nearest the reading's hue, saturation and value (the same matcher as `ColorSensor`; calibrated once the black and the white are taken), or `None` when that set is empty |
| `hc.color_match()` | `(color, confidence)`: the confidence is 1.0 on the chosen colour and 0.0 halfway between two; `(None, 0.0)` with no detectable colours |
| `hc.detectable_colors([colors])` | the colours `color()` chooses from; default `(Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)`; anything that is not a `Color` raises `TypeError` |
| `hc.color_number()` | the sensor's own colour number, 0..17 (HiTechnic's chart: 0 black ... 17 white) |
| `hc.rgb()` | `(r, g, b)` 0..255, LED on, ambient light cancelled |
| `hc.hsv()` | the reading as a `Color` (`.h` 0..359, `.s` and `.v` 0..100), through the black and white references when they are taken (`rgb()` stays the sensor's own 0..255) |
| `hc.reflection()` | reflected light 0..100 % (float): V2 the white channel, V1 the mean of red, green and blue |
| `hc.ambient()` | V2 only: the light level with the LED off, 16-bit counts; `NotImplementedError` on a V1 |
| `hc.raw()` | V2 only: `(r, g, b, white)` 16-bit counts, LED on, no ambient cancellation; `NotImplementedError` on a V1 |
| `hc.mains(hz)` | V2 only: 50 or 60, the mains frequency whose flicker the sensor cancels (else `ValueError`). **Stored by the sensor itself and not readable back**: set it once where you are |
| `hc.age()` | ms since the cached reading was taken (a new one every 10 ms) |
| `hc.close()` | the V2's LED goes out, the port goes back to 400 kHz and the slot is freed |

**Example**

```python
from evn import HiTechnicColorSensor, wait
hc = HiTechnicColorSensor(8)
print("V%d firmware %s" % (hc.version(), hc.firmware()))
print("Nothing in front of the sensor...")
wait(2000)
hc.calibrate_black()            # the black reference
print("Hold a white sheet in front...")
wait(3000)
hc.calibrate_white()            # the reference white
while True:
    print(hc.color(), hc.color_number(), hc.reflection(), hc.rgb())
    wait(100)
```

**Notes**

**Calibrate at the start of a program**, at the distance the colours will be read: `hc.calibrate_black()` with nothing in front, then `hc.calibrate_white()` over a white sheet. The two references are kept in RAM by the object (nothing is stored on the board), for a V1 and a V2 alike.

On a V2, a call that needs another mode than the last one switches the sensor and waits for its first reading under the new mode: about **125 ms**. Group the calls by mode: `color()`, `color_match()`, `color_number()`, `rgb()`, `hsv()`, `reflection()`, `calibrate_black()` and `calibrate_white()` share one mode, while `rgb()` and `ambient()` called in turn in a loop run at about 4 Hz. While the sensor is unplugged every reading raises `OSError("HiTechnicColorSensor on port N not responding")`; a replugged sensor is found again by itself. After `close()` every call except `close()` raises `ValueError`. The V1 is supported from HiTechnic's register map; only a V2 has been on the bench.

## HiTechnicCompass — HiTechnic NXT Compass Sensor

Plug the sensor into an I2C port through an NXT cable adapter, level and away from the motors (their magnets bend the field as the robot moves). It gives a heading in whole degrees and calibrates itself.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `hc = HiTechnicCompass(port)` | `port` 1..16; `OSError("no HiTechnic sensor on port N (I2C 0x01)")`, `OSError("port N has a HiTechnic Color V2, not a HiTechnicCompass")` for another HiTechnic sensor, `OSError("no free HiTechnic slot (4 at once)")`. Returns with the first reading |

**Methods**

| Call | Notes |
| :--- | :--- |
| `hc.heading()` | 0..359 degrees clockwise (float, whole degrees), relative to `north()` |
| `hc.north(heading=0)` | from now the direction the sensor points at reads `heading`; kept while the object is open |
| `hc.calibrate()` | start the sensor's own hard-iron calibration: then turn the robot slowly and level through a little more than one full turn, taking at least 20 s |
| `hc.calibrate_stop()` | end it: `True` when the sensor accepted the calibration, `False` when it rejected it; `ValueError("not calibrating: call calibrate() first")` outside one. The sensor keeps the result itself; nothing is stored on the board |
| `hc.calibrating()` | `True` between `calibrate()` and `calibrate_stop()` |
| `hc.firmware()` | the sensor's firmware text, e.g. `'V1.23'` |
| `hc.age()` | ms since the cached reading was taken (a new one every 10 ms) |
| `hc.close()` | the port goes back to 400 kHz and the slot is freed; a compass closed during a calibration is put back into measuring |

**Example**

```python
from evn import HiTechnicCompass, wait
hc = HiTechnicCompass(5)
hc.north()                      # the way the robot points now reads 0
while True:
    print(hc.heading())
    wait(100)
```

**Notes**

A heading only: there is no field vector and no `heading_confidence()` (the standard [`Compass`](API_SENSORS.md#compass--magnetometer-qmc5883l--hmc5883l) has both). While the sensor is unplugged `heading()` raises `OSError("HiTechnicCompass on port N not responding")`; a replugged sensor is found again by itself. After `close()` every call except `close()` raises `ValueError`.

## HuskyLens — DFRobot HuskyLens AI camera

Plug the camera into an I2C port (its 4-pin cable: SDA, SCL, power, ground) and set its **Protocol Type to I2C** in the camera's General Settings. The camera runs its own recognition (faces, objects, lines, colours, tags); the firmware asks it for a result every 10 ms and keeps the latest frame whole.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `cam = HuskyLens(port)` | `port` 1..16; `OSError("no HuskyLens on port N (I2C 0x32)")` when nothing answers the camera's KNOCK handshake, `OSError("a HuskyLens is already open on another port (1 at once)")`. Nothing is written to the camera: its algorithm and what it learned stay as they are |

**Methods**

| Call | Notes |
| :--- | :--- |
| `cam.algorithm([n])` | `algorithm(n)` switches the camera (and waits for its OK): `HuskyLens.FACE_RECOGNITION` 0, `OBJECT_TRACKING` 1, `OBJECT_RECOGNITION` 2, `LINE_TRACKING` 3, `COLOR_RECOGNITION` 4, `TAG_RECOGNITION` 5, `OBJECT_CLASSIFICATION` 6 (else `ValueError`). `algorithm()` returns the one last set through this object, or `None` until one is: **the camera cannot report it** |
| `cam.blocks([id])` | the blocks of the latest frame, all or only `id`: a list of `(x, y, width, height, id)` with `x`, `y` the block's centre on the 320 × 240 screen; `id` 0 = seen but not learned |
| `cam.arrows([id])` | the arrows of the latest frame (line tracking), all or only `id`: a list of `(x_origin, y_origin, x_target, y_target, id)` |
| `cam.count()` | how many objects the camera saw in the latest frame (`blocks()` and `arrows()` hold at most 16) |
| `cam.learned()` | how many IDs the current algorithm has learned |
| `cam.frame()` | the camera's frame number of the latest result (wraps at 65536) |
| `cam.learn(id=1)` | learn what the camera frames now as `id` (1..65535) |
| `cam.forget()` | forget everything learned in the current algorithm |
| `cam.age()` | ms since the latest result was received |
| `cam.close()` | frees the port; the camera keeps its algorithm and what it learned |

**Example**

```python
from evn import HuskyLens, wait
cam = HuskyLens(11)
cam.algorithm(HuskyLens.OBJECT_TRACKING)
while True:
    for x, y, w, h, id in cam.blocks():
        print("block", id, "at", x, y)
    wait(100)
```

**Notes**

`learn()`, `forget()` and `algorithm(n)` wait for the camera's answer: `OSError("HuskyLens is busy: try again")` when it was busy, `OSError("this needs a HuskyLens Pro")` for a function only the Pro model has. While the camera is unplugged every call raises `OSError("HuskyLens on port N not responding")`; a replugged camera is found again by itself. One HuskyLens at a time. After `close()` every call except `close()` raises `ValueError("HuskyLens is closed")`.

## VL53L1X — time-of-flight distance sensor, up to 4 m

Plug the sensor into an I2C port. It measures the distance to what is in front of it with an infrared laser pulse, up to about 4 m in the dark (about 1.3 m in short mode), and ranges continuously; the firmware keeps the latest measurement. Its address, 0x29, is also the standard [`DistanceSensor`](API_SENSORS.md#distancesensor--time-of-flight-distance-sensor-vl53l0x)'s (VL53L0X) and the [`ColorSensor`](API_SENSORS.md#colorsensor--colour-sensor-tcs34725)'s (TCS34725): the firmware reads their ID registers first and takes the port only when its own model ID (0xEACC) answers.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `tof = VL53L1X(port)` | `port` 1..16; `OSError("no VL53L1X on port N (I2C 0x29, model ID 0xEACC)")` when no VL53L1X answers (a VL53L0X or a TCS34725 on the port is refused the same way), `OSError("VL53L1X on port N: no free slot (2 at once)")`. Starts ranging in long mode with a 33 ms timing budget and returns with the first measurement |

**Methods**

| Call | Notes |
| :--- | :--- |
| `tof.distance()` | the distance in mm, or `None` when the measurement is not valid (`status()` says why) |
| `tof.status()` | ST's range status of the latest measurement: `'valid'`, `'sigma fail'`, `'signal fail'`, `'min range fail'`, `'out of bounds'`, `'hardware fail'`, `'valid, no wrap check'`, `'wrap around'`, `'crosstalk fail'`, `'synchronisation'`, `'merged pulse'`, `'too close'` or `'unknown'`; only `'valid'` gives a `distance()` |
| `tof.raw()` | `(distance mm, status number, signal kcps, ambient kcps)`, whatever the status (status 0 = valid) |
| `tof.distance_mode([mode])` | `'short'` (up to ~1.3 m, copes better with sunlight) or `'long'` (up to ~4 m in the dark, the default); without an argument returns the mode. Any other name raises `ValueError`; switching to `'long'` with a 15 ms budget raises `ValueError` (15 ms is short mode only) |
| `tof.timing_budget([ms])` | the time per measurement in ms: 15 (short mode only), 20, 33 (the default), 50, 100, 200 or 500 (else `ValueError`); without an argument returns it. Longer = more precise and longer range, fewer readings |
| `tof.age()` | ms since the cached measurement was taken (a new one every timing budget) |
| `tof.close()` | stops ranging and frees the slot |

**Example**

```python
from evn import VL53L1X, wait
tof = VL53L1X(1)
tof.distance_mode('short')      # up to ~1.3 m, better in daylight
tof.timing_budget(50)
while True:
    d = tof.distance()
    print(d if d is not None else tof.status())
    wait(100)
```

**Notes**

`distance_mode(mode)` and `timing_budget(ms)` rewrite the sensor's configuration and wait for the first measurement under the new setting (58–179 ms on the bench). At the default 33 ms budget a new measurement arrives about 31 times a second. While the sensor is unplugged every reading raises `OSError("VL53L1X on port N not responding")`; a replugged sensor is found again by itself. Two VL53L1X at once (each on its own port). After `close()` every call except `close()` raises `ValueError("VL53L1X is closed")`.

## TCS3430 — XYZ colour and ambient light sensor

Plug the sensor into an I2C port. Its X, Y and Z channels follow the CIE 1931 colour-matching curves (the way the eye sees colour), and a fourth channel measures infrared. The EVN module lights its target with its own LED and is used close to it, so the defaults are the fastest: one 2.78 ms integration cycle at 64x gain, a new reading about every 3 ms. Its address, 0x39, is also the standard [`GestureSensor`](API_SENSORS.md#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960)'s (APDS-9960): the two are told apart by their ID registers.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `tcs = TCS3430(port)` | `port` 1..16; `OSError("no TCS3430 on port N (I2C 0x39, ID 0xDC)")` when no TCS3430 answers (an APDS-9960 on the port is refused the same way), `OSError("TCS3430 on port N: no free slot (2 at once)")`. Returns with the first reading |

**Methods**

| Call | Notes |
| :--- | :--- |
| `tcs.calibrate_black()` | takes the current reading as the black reference: hold nothing in front of the sensor (or a black target) where the colours will be read. It is subtracted, channel by channel, from every reading and from the white. `ValueError` when the reading is saturated (lower `gain()`) |
| `tcs.calibrate_white()` | takes the current reading as the reference white: hold a white target where the colours will be read, under the module's own LED. Each channel is then divided by the white's and scaled to D65, so the white target reads `s` 0, `v` 100. `ValueError` when the reading is saturated (lower `gain()`) or a channel is not at least 10 % above the black (`"the white target is too dark or not brighter than the black reference: hold a white sheet in front"`) |
| `tcs.black_reference()` | the black reference as `(X, Y, Z)` per 1x-gain cycle, or `None` when none is taken; `tcs.black_reference(None)` clears it (any other argument raises `ValueError`: use `calibrate_black()`) |
| `tcs.white_reference()` | the reference white as `(X, Y, Z)` per 1x-gain cycle, or `None`; `tcs.white_reference(None)` clears it (any other argument raises `ValueError`: use `calibrate_white()`) |
| `tcs.color()` | the `detectable_colors()` entry the reading's `hsv()` matches (the same matcher as `ColorSensor`), or `None` when that set is empty |
| `tcs.color_match()` | `(color, confidence)`: the confidence is 1.0 on the chosen colour and 0.0 halfway between two; `(None, 0.0)` with no detectable colours |
| `tcs.detectable_colors([colors])` | the colours `color()` chooses from; default `(Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)`; anything that is not a `Color` raises `TypeError` |
| `tcs.hsv()` | the reading as a `Color` (`.h` 0..359, `.s` and `.v` 0..100): the X, Y, Z net of the black reference, relative to the reference white (without one, to full scale), turned into RGB with the sRGB standard's matrix |
| `tcs.xyz()` | `(X, Y, Z)` raw counts |
| `tcs.raw()` | `(X, Y, Z, IR1)` raw counts |
| `tcs.ir()` | the infrared (IR1) channel, raw counts |
| `tcs.xy()` | `(x, y)` = X / (X + Y + Z), Y / (X + Y + Z) of the raw counts, or `None` in the dark — **uncalibrated** chromaticity (no per-unit correction matrix) |
| `tcs.saturated()` | `True` when the latest reading clipped: lower `gain()` or shorten `integration_time()` |
| `tcs.gain([n])` | the analog gain: 1, 4, 16, 64 (the default) or 128 (else `ValueError`); without an argument returns it. The typical ratios are 1 : 4 : 16 : 66 : 137 |
| `tcs.integration_time([ms])` | the integration time, 2.78..711.7 ms in 2.78 ms steps (else `ValueError`): the nearest step is set and **returned** (a float); without an argument returns it. Full scale is 1023 counts at one step and 65535 from 178 ms up |
| `tcs.age()` | ms since the cached reading was taken |
| `tcs.close()` | powers the chip down and frees the slot |

**Example**

```python
from evn import TCS3430, wait
tcs = TCS3430(16)
print("Nothing in front of the sensor...")
wait(2000)
tcs.calibrate_black()           # the black reference
print("Hold a white sheet about 1 cm in front...")
wait(3000)
tcs.calibrate_white()           # the reference white
while True:
    x, y, z = tcs.xyz()
    print(tcs.color(), x, y, z, tcs.ir(), tcs.xy())
    if tcs.saturated():
        tcs.gain(16)            # a bright target close up: less gain
    wait(100)
```

**Notes**

**Calibrate at the start of every program.** The module's LED is warm, so without calibration a white sheet reads `Color.YELLOW` (confidence about 0.3) and nothing in front reads `Color.BLUE`. Two lines fix it, taken at the distance the colours will be read:

```python
tcs.calibrate_black()   # nothing in front of the sensor
tcs.calibrate_white()   # a white sheet
```

Calibration details (both colour sensors):

- `calibrate_white()` is refused when the target is too dark (TCS3430: Y under 5 % of the full scale at the current setting; HiTechnic: any channel under 20 of 255) or not at least 10 % above the black on every channel — a "white" taken with nothing in front would otherwise make every later reading white.
- `calibrate_black()` is refused when it would clear an existing white (the black is as bright as the white): `ValueError("this black is as bright as the white reference: the white was cleared, calibrate_white() again")`. On the HiTechnic a black with a channel near full scale (230+) is refused too.
- The references belong to the open object: they survive an unplug and replug on the same port (a different unit plugged in inherits them), a second object on the same port shares them, and `close()` forgets them.
- TCS3430: the references are normalised to gain and integration time with the datasheet's typical gain ratios, so after `gain()` changes a white stays close to, but not exactly on, s 0 — take the white again at the setting you will read at.
- HiTechnic: `reflection()` and `rgb()` stay the sensor's raw values; only `hsv()`, `color()` and `color_match()` use the references.


The references are kept in RAM by the `TCS3430` object (an extended peripheral stores no calibration on the board), so a new program takes them again. They stay valid when `gain()` or `integration_time()` change. Validated by hand on the rig (2026-09-26, the default 2.78 ms at 64x, targets about 1 cm away, after `calibrate_black()` with nothing in front and `calibrate_white()` on a white sheet): nothing in front `Color.NONE` 1.00, white `Color.WHITE` 1.00 (`s` 0, `v` 100), red `Color.RED` 0.98 (`h` 1, `s` 83), green `Color.GREEN` 0.75 (`h` 140, `s` 94), blue `Color.BLUE` 0.91–0.93 (`h` 231, `s` 73).

`gain(n)` and `integration_time(ms)` wait for the first reading under the new setting. With nothing in front, 64x reads about 16–18 counts at 2.78 ms. For far-field or ambient light use `integration_time(100)` or more. The counts are not a calibrated XYZ (no per-unit correction matrix): for colours the named ones do not separate, hold the sensor over each real target, keep what `hsv()` returns and pass those `Color` objects to `detectable_colors()`. There is no lux or colour-temperature conversion, and the second IR channel is not exposed. While the sensor is unplugged every reading raises `OSError("TCS3430 on port N not responding")`; a replugged sensor is found again by itself. Two TCS3430 at once. After `close()` every call except `close()` raises `ValueError("TCS3430 is closed")`.
