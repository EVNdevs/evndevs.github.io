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

Plug the sensor into an I2C port through an NXT cable adapter (SDA, SCL, power and ground). The V2 (type "ColorPD") and the older V1 (type "Color") are both taken; `version()` says which is on the port. The V2 has three modes, switched on demand: the LED on with the ambient light cancelled (every colour reading, the colour index and the normalised red, green and blue), the LED off (`ambient()`, `ambient_raw()`) and the LED on without cancellation (`raw()`).

**Constructor**

| Call | Notes |
| :--- | :--- |
| `hc = HiTechnicColorSensor(port)` | `port` 1..16; `OSError("no HiTechnic sensor on port N (I2C 0x01)")` when no "HiTechnc" ID string answers, `OSError("port N has a HiTechnic Compass, not a HiTechnicColorSensor")` for another HiTechnic sensor, `OSError("no free HiTechnic slot (4 at once)")`. Returns with the first reading |

**Methods**

| Call | Notes |
| :--- | :--- |
| `hc.version()` | 1 (V1) or 2 (V2), from the sensor's type string |
| `hc.firmware()` | the sensor's firmware text, e.g. `'V1.5'` |
| `hc.calibrate_black()` | takes the current reading (LED on, ambient cancelled) as the black reference: hold nothing in front of the sensor (or a black target) where the colours will be read. A V2 is switched to that mode first. **Stored for the port**: every later `HiTechnicColorSensor(port)` starts with it. `ValueError("the black reading is too bright: nothing (or a black target) in front")` when a channel reads 230 or more |
| `hc.calibrate_white()` | takes the current reading of a white target as the reference white, stored for the port like the black. From then on each of red, green and blue is (reading − black) / (white − black), clamped 0..100 %, before `hsv()`, `color()` and `color_match()`. `ValueError("the white target is too dark or not brighter than the black reference: hold a white sheet in front")` when a channel is under 20 counts or not at least 10 % above the black |
| `hc.black_reference()` | the black reference as `(R, G, B)` in counts (floats), or `None` when none is taken; `hc.black_reference(None)` clears it and the stored one (any other argument raises `ValueError`: use `calibrate_black()`) |
| `hc.white_reference()` | the reference white as `(R, G, B)` in counts, or `None`; `hc.white_reference(None)` clears it and the stored one (any other argument raises `ValueError`: use `calibrate_white()`) |
| `hc.stored_calibration()` | the port's stored colour calibration, the dict of `evn.color_calibration(port)`: `calibrated`, `chip` (`'HiTechnic Color V2'` / `'HiTechnic Color V1'`, or another colour sensor's chip), `stored`, `pending`, `stamp`, `black` / `white` as `(R, G, B)` counts, `error` |
| `hc.clear_calibration()` | forget the stored calibration, then the references in force: `True`, or `False` while a driving motor keeps the flash write back (it follows once every motor is stopped). A record another colour sensor made on the port is left alone. `RuntimeError` when another calibration waits for the flash (a motor is driving): nothing changes; `OSError` when the flash write fails: cleared all the same (stored and in force), and the next `stored_calibration()` retries the write |
| `hc.color()` | the `detectable_colors()` entry nearest the reading's hue, saturation and value (the same matcher as `ColorSensor`; calibrated once the black and the white are taken), or `None` when that set is empty |
| `hc.color_match()` | `(color, confidence)`: the confidence is 1.0 on the chosen colour and 0.0 halfway between two; `(None, 0.0)` with no detectable colours |
| `hc.detectable_colors([colors])` | the colours `color()` chooses from; default `(Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)`; anything that is not a `Color` raises `TypeError` |
| `hc.color_number()` | the sensor's own colour number, 0..17 (HiTechnic's chart: 0 black ... 17 white; a V1's is returned as read, its chart unverified). The sensor gives no confidence with it; `color_match()` is the classifier with one |
| `hc.color_index()` | V2 only: the sensor's colour index 0..63 — three 2-bit levels, bits 5–4 red, 3–2 green, 1–0 blue (`(i >> 4) & 3` is the red level 0..3); `NotImplementedError` on a V1 |
| `hc.rgb()` | `(r, g, b)` 0..255, LED on, ambient light cancelled |
| `hc.normalized_rgb()` | V2 only: the sensor's normalised `(r, g, b)`: the strongest of the three set to 255 and the other two in proportion — the colour without its brightness; `NotImplementedError` on a V1 |
| `hc.hsv()` | the reading as a `Color` (`.h` 0..359, `.s` and `.v` 0..100), through the black and white references when they are taken (`rgb()` stays the sensor's own 0..255) |
| `hc.reflection()` | reflected light 0..100 % (float): V2 the white channel, V1 the mean of red, green and blue |
| `hc.ambient()` | V2 only: the light level with the LED off, 16-bit counts; `NotImplementedError` on a V1 |
| `hc.ambient_raw()` | V2 only: `(r, g, b, white)` 16-bit counts with the LED off — the colour of the light around the sensor (`ambient()` is its white); `NotImplementedError` on a V1 |
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

**Calibrate once**, at the distance the colours will be read: `hc.calibrate_black()` with nothing in front, then `hc.calibrate_white()` over a white sheet — from a program, or the Board view's Calibrate on the sensor's row. The two references are **stored on the board for the port** (like a `ColorSensor`'s: `evn.color_calibration(port)` shows them), so every later `HiTechnicColorSensor(port)` starts calibrated; a V1 and a V2 each keep their own (a V2's record is not used by a V1). One colour calibration per port: calibrating a `ColorSensor` or a `GestureSensor` on the port replaces it, and the reverse.

`evn.DataLog` records the sensor: `color`, `color_number`, `rgb`, `hsv`, `reflection`, `color_index` and `normalized_rgb` (LED on), `ambient` and `ambient_raw` (LED off), `raw`. A reading is recorded only while the sensor is in its mode — the program's own calls choose the mode (a `color()` in the loop keeps the LED on), the logger never switches it.

On a V2, a call that needs another mode than the last one switches the sensor and waits for its first reading under the new mode: about **125 ms**. Group the calls by mode: `color()`, `color_match()`, `color_number()`, `color_index()`, `rgb()`, `normalized_rgb()`, `hsv()`, `reflection()`, `calibrate_black()` and `calibrate_white()` share one mode, `ambient()` and `ambient_raw()` another, while `rgb()` and `ambient()` called in turn in a loop run at about 4 Hz. A garbled read (on a V2 a colour number above 17 or an index above 63, on a V1 all four bytes 0xFF — all 0xFF from a loose NXT cable, say) is never returned: it counts as a bus error, and three in a row are treated as an unplug. While the sensor is unplugged every reading raises `OSError("HiTechnicColorSensor on port N not responding")`; a replugged sensor is found again by itself. After `close()` every call except `close()` raises `ValueError`. The V1 is supported from its register map alone; only a V2 has been on the bench.

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

A heading only: there is no field vector and no `heading_confidence()` (the sensor gives nothing to base one on; the standard [`Compass`](API_SENSORS.md#compass--magnetometer-qmc5883l--hmc5883l) has both). Every reading takes the heading in both of the forms HiTechnic documents — twice the two-degree register plus the one-degree adder, and the 16-bit word after them — and uses it only when the two agree: a read that disagrees (torn while the sensor turns, or garbled) is dropped and read again at once, never returned; only a sensor whose two forms keep disagreeing is looked for again. `evn.DataLog` records `heading` (relative to `north()`). While the sensor is unplugged `heading()` raises `OSError("HiTechnicCompass on port N not responding")`; a replugged sensor is found again by itself. After `close()` every call except `close()` raises `ValueError`.

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
| `tof.distance()` | the distance in mm, or `None` when the measurement is not valid (`status()` says why) or, under a distance threshold, did not meet it |
| `tof.status()` | ST's range status of the latest measurement: `'valid'`, `'sigma fail'`, `'signal fail'`, `'min range fail'`, `'out of bounds'`, `'hardware fail'`, `'valid, no wrap check'`, `'wrap around'`, `'crosstalk fail'`, `'synchronisation'`, `'merged pulse'`, `'too close'` or `'unknown'`; under a distance threshold also `'not detected'`. Only `'valid'` gives a `distance()`. A `roi()` the sensor cannot use reads `'min range fail'` (ST's status 13, UM2555 section 4.2): `raw()[1]` is 13 then |
| `tof.raw()` | `(distance mm, status number, signal kcps, ambient kcps)`, whatever the status (status 0 = valid; 254 = not detected, the other three 0) |
| `tof.distance_mode([mode])` | `'short'` (up to ~1.3 m, copes better with sunlight) or `'long'` (up to ~4 m in the dark, the default); without an argument returns the mode. Any other name raises `ValueError`; switching to `'long'` with a 15 ms budget raises `ValueError` (15 ms is short mode only) |
| `tof.timing_budget([ms])` | the time per measurement in ms: 15 (short mode only), 20, 33 (the default), 50, 100, 200 or 500 (else `ValueError`; 15 in long mode raises `ValueError`: call `distance_mode('short')` first; so does a budget longer than a non-zero `inter_measurement()`); without an argument returns it. Longer = more precise and longer range, fewer readings |
| `tof.inter_measurement([ms])` | the time from the start of one measurement to the start of the next: 0 (the default) = back to back, a measurement every timing budget; otherwise from the timing budget up to 60000 ms (ST's rule: never shorter than the budget; else `ValueError`). `timing_budget(33)` with `inter_measurement(100)` measures 10 times a second, each measurement as precise as 33 ms makes it |
| `tof.roi([width, height[, center]])` | the region of interest: the part of the 16 x 16 array of light detectors (SPADs) that measures, `width` and `height` 4..16 (the default 16 x 16 sees the whole ~27° cone; a smaller region narrows it and gets less signal). `center` is the SPAD at the middle, numbered as in ST's UM2555 table (below); left out, ST's rule: 199 (the array's middle) above 10 SPADs, else the sensor's own optical centre. Without arguments returns `(width, height, center)`. `ValueError` for a size outside 4..16, a centre outside 0..255, or a region that would leave the array |
| `tof.signal_threshold([kcps])` | the weakest return signal accepted, in kcps (`raw()`'s unit): 0..65535, kept in ST's steps of 8 (read back rounded down), default 1024. A weaker measurement reads `'signal fail'`; lower it for dark or far targets |
| `tof.sigma_threshold([mm])` | the largest estimated spread (sigma) accepted: 0..16383 mm, default 90 (ST's configuration). A noisier measurement reads `'sigma fail'` |
| `tof.distance_threshold([window[, ...]])` | ST's window detection, done by the sensor: `distance_threshold('below', mm)`, `('above', mm)`, `('inside', low, high)` or `('outside', low, high)`; `distance_threshold(None)` reports every measurement again (the default). Without arguments returns `None`, `('below', mm)`, `('above', mm)` or `(window, low, high)`. `TypeError` for the wrong number of distances, `ValueError` for another name, below 0 or above 65535 mm, or low ≥ high |
| `tof.detected()` | under a distance threshold, `True` when the latest measurement met it and is valid: the sensor decides whether a measurement meets the threshold, and only a valid one counts, the same measurements `distance()` gives a number for (a measurement the sensor flags, a missing target's, cannot trip `'below'`). With nothing in range nothing is detected, under `'above'` and `'outside'` too (ST's manual, UM2510 3.6.4: no object found, no report; not yet benched in open air): to wait for a clear path, use no threshold and `tof.status() != 'valid' or tof.distance() > mm`. `ValueError` without a threshold |
| `tof.calibrate_offset(target_mm)` | ST's offset calibration: a flat target (ST: grey, 17 % reflectance) square to the sensor at exactly `target_mm` (1..4000; ST recommends 100), nothing else in view. The sensor's own offsets are set to 0, 50 valid measurements are taken (under the settings in force, with the distance threshold lifted and back to back while it measures; a flagged one is left out, at most 100), and `target_mm` minus their mean (mm, rounded) is applied and **stored for the port**. Returns the offset in mm. About 50 timing budgets (2 s at 33 ms). `ValueError` when fewer than 50 of 100 measurements were valid (no target, or not at that distance) or the offset would pass ±1023 mm |
| `tof.calibrate_crosstalk(target_mm)` | ST's crosstalk calibration, for a sensor behind a cover window: the target at the distance where the window starts to make the sensor read short. 50 valid measurements with the crosstalk compensation off; crosstalk = 512 × signal × (1 − distance / target) / SPADs (ST's formula; 0 when the target reads at or beyond `target_mm`), applied and stored for the port. Returns it in cps. Without a window it measures about 0: calibrate the offset first |
| `tof.offset([mm])` | the offset in mm the port's calibration applies, or `None` while the sensor runs on its own factory offset; `offset(mm)` sets it (−1023..1023, stored), `offset(None)` puts the sensor's own back |
| `tof.crosstalk([cps])` | the crosstalk compensation in cps the port's calibration applies, or `None` (the sensor's own); `crosstalk(cps)` sets it (0..127999, in ST's steps of 1.95 cps, read back rounded down; stored), `crosstalk(None)` puts the sensor's own back |
| `tof.stored_calibration()` | the port's stored calibration (`evn.vl53l1x_calibration(port)`, no sensor object needed): `{"port", "calibrated", "stored", "pending", "stamp", "offset", "offset_target", "offset_sd", "crosstalk", "crosstalk_target", "crosstalk_sd", "part_offset", "part_crosstalk"}`. `*_target` is the calibration's distance (`None` for a value set by hand), `*_sd` the spread (standard deviation, mm) of the 50 distances it came from — the calibration's confidence; `part_*` the sensor's own values, read before the port was first calibrated |
| `tof.clear_calibration()` | puts the sensor's own offset and crosstalk back and erases the port's record; `True` when nothing of it is left in flash, `False` while a motor drives (the next `stored_calibration()` writes it once they stop); `RuntimeError` when a motor drives and another calibration waits for the flash: stop the motors and call it again - until it succeeds the port's calibration may still be in force (on the sensor and in the record) |
| `tof.age()` | ms since the cached measurement was taken (a new one every measurement period) |
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

**Detecting, a narrower view, a slower rate**

```python
from evn import VL53L1X, wait
tof = VL53L1X(1)
tof.roi(8, 8)                          # a narrower cone, centred
tof.inter_measurement(100)             # 10 measurements a second
tof.distance_threshold('below', 200)   # the sensor reports only what is closer than 200 mm
while not tof.detected():
    wait(10)
print('something at', tof.distance(), 'mm')
tof.distance_threshold(None)           # every measurement again
```

**Calibrating the offset** (stored on the board for the port: every `VL53L1X` on it starts with it, after a reboot or a re-plug too)

```python
from evn import VL53L1X
tof = VL53L1X(1)
# a flat grey or white card square to the sensor, exactly 140 mm from its glass (measure it)
print('offset', tof.calibrate_offset(140), 'mm')
print(tof.distance(), 'mm')            # about 140 now
print(tof.stored_calibration())        # the target, the spread of the 50 readings, the sensor's own values
```

The sensor comes with its own factory offset and crosstalk; a port that was never calibrated keeps them untouched (the firmware writes those registers only for a calibrated port). The first calibration of a port reads them and keeps them in its record, so `clear_calibration()`, `offset(None)` and `crosstalk(None)` put them back without a power cycle. Storing is a flash write the board never makes while a motor drives: the new values are in force at once and are written to the flash by the next `stored_calibration()` (or calibration change) once the motors have stopped (`stored_calibration()["pending"]` until then); while another calibration already waits for the flash a new one raises `RuntimeError` (stop the motors and try again). Nothing identifies the module: another VL53L1X plugged into a calibrated port gets that port's calibration, and a clear there puts back the first sensor's own values (unplug and replug the sensor to get its own). Ctrl-C or `close()` during a calibration puts the values before back: `close()` at once, Ctrl-C by the sensor's next reading (within about one timing budget, at most about half a second). A hard reset of the board (the RESET button, the watchdog, a flash, `evn.reset()`) while it calibrates a port with no calibration stored yet, or right after a Ctrl-C stopped that, leaves the powered sensor on the calibration's zeros: `clear_calibration()` puts its own values back - unless the port's record never reached the flash (a motor was driving when the calibration started; `part_offset` is `None` in `stored_calibration()` after the reset): then unplug and replug the sensor before calibrating or setting it again, or its zeros are kept as its own values. The same holds for a port's first `offset(mm)` / `crosstalk(cps)` set by hand while a motor drove: a hard reset before its record reached the flash leaves the sensor on the value set with `part_offset` `None`, and the next calibration or setting would keep that value as the sensor's own - unplug and replug it first.

**The SPAD numbers** (ST's UM2555, section 3.1; the table as ST prints it, pin 1 marked above its first row; UM2555 reads its example "viewing from behind the device looking toward the target"). A region's `center` is the SPAD at its middle; for an even width or height the middle falls between two SPADs, and ST's rule takes the one to the right, or above. Which way a shifted region looks depends on how the sensor is mounted: try it against a target on one side.

```
128 136 144 152 160 168 176 184 | 192 200 208 216 224 232 240 248
129 137 145 153 161 169 177 185 | 193 201 209 217 225 233 241 249
130 138 146 154 162 170 178 186 | 194 202 210 218 226 234 242 250
131 139 147 155 163 171 179 187 | 195 203 211 219 227 235 243 251
132 140 148 156 164 172 180 188 | 196 204 212 220 228 236 244 252
133 141 149 157 165 173 181 189 | 197 205 213 221 229 237 245 253
134 142 150 158 166 174 182 190 | 198 206 214 222 230 238 246 254
135 143 151 159 167 175 183 191 | 199 207 215 223 231 239 247 255
127 119 111 103  95  87  79  71 |  63  55  47  39  31  23  15   7
126 118 110 102  94  86  78  70 |  62  54  46  38  30  22  14   6
125 117 109 101  93  85  77  69 |  61  53  45  37  29  21  13   5
124 116 108 100  92  84  76  68 |  60  52  44  36  28  20  12   4
123 115 107  99  91  83  75  67 |  59  51  43  35  27  19  11   3
122 114 106  98  90  82  74  66 |  58  50  42  34  26  18  10   2
121 113 105  97  89  81  73  65 |  57  49  41  33  25  17   9   1
120 112 104  96  88  80  72  64 |  56  48  40  32  24  16   8   0
```

So `roi(8, 16, 167)` is the left half and `roi(8, 16, 231)` the right half of the table (UM2555's own two-zone example). A region the chip cannot select (near the edge) reads `status()` `'min range fail'` (ST's status 13, UM2555 section 4.2): shrink it or move the centre one SPAD inwards.

**Notes**

Every setter rewrites the sensor's configuration at once, whatever the sensor is doing, and waits for the first measurement under the new setting (58–179 ms on the bench for a mode or budget; not a whole `inter_measurement()` period). The measurement already under way is let finish first (the sensor completes it even when told to stop, and it would otherwise come back as the new setting's first reading), so a setter can take up to one more timing budget of the old setting; the reading it returns on is always the new setting's own. At the default 33 ms budget, back to back, a new measurement arrives about 31 times a second. Under a distance threshold the sensor itself compares each measurement and raises its data-ready flag for one that meets the threshold (there is no interrupt wire: the firmware polls that flag); a measurement that does not becomes a reading with the status `'not detected'` (one the sensor flags, `'signal fail'` or `'sigma fail'` for example, may be reported with its own status instead, never as detected), so a reading still comes every measurement period, `age()` stays short and nothing times out while nothing is detected. Silence is never an error under a threshold: a sensor that stops measuring but keeps its settings reads `'not detected'` for ever (a reset is caught and the sensor configured again; an unplug raises `OSError` as below). Without a threshold, a sensor that keeps answering but stops measuring (seen on the bench, rarely, after many setting changes) is reset by the firmware and configured again with its settings and its stored calibration, by itself. While the sensor is unplugged every reading raises `OSError("VL53L1X on port N not responding")`, and so does a setter, which then leaves the previous setting in place; a replugged sensor is found again by itself and gets the settings back. Two VL53L1X at once (each on its own port). After `close()` every call except `close()` raises `ValueError("VL53L1X is closed")`. `evn.DataLog` records it: `distance`, `status`, `raw`, `detected` ([the data logger](API_SYSTEM.md)).

## TCS3430 — XYZ colour and ambient light sensor

Plug the sensor into an I2C port. Its X, Y and Z channels follow the CIE 1931 colour-matching curves (the way the eye sees colour), and two more channels measure infrared (IR1, 687–830 nm at half response, and IR2 from 827 nm). The EVN module lights its target with its own LED and is used close to it, so the defaults are the fastest: one 2.78 ms integration cycle at 64x gain, no wait, a new reading about every 3 ms. Its address, 0x39, is also the standard [`GestureSensor`](API_SENSORS.md#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960)'s (APDS-9960): the two are told apart by their ID registers. Its black / white calibration is stored on the board for the port, like the `ColorSensor`'s.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `tcs = TCS3430(port)` | `port` 1..16; `OSError("no TCS3430 on port N (I2C 0x39, ID 0xDC)")` when no TCS3430 answers (an APDS-9960 on the port is refused the same way), `OSError("TCS3430 on port N: no free slot (2 at once)")`. Returns with the first reading |

**Methods**

| Call | Notes |
| :--- | :--- |
| `tcs.calibrate_black()` | takes the current reading as the black reference: hold nothing in front of the sensor (or a black target) where the colours will be read. It is subtracted, channel by channel, from every reading and from the white. **Stored for the port** (flash: every later `TCS3430(port)` starts with it). `ValueError` when the reading is saturated (lower `gain()`); `ValueError("this black is as bright as the white reference: the white was cleared, calibrate_white() again")` when it leaves the white no room (the black is taken and stored, the white cleared) |
| `tcs.calibrate_white()` | takes the current reading as the reference white: hold a white target where the colours will be read, under the module's own LED. Each channel is then divided by the white's and scaled to D65, so the white target reads `s` 0, `v` 100. Stored like the black. `ValueError` when the reading is saturated (lower `gain()`) or a channel is not at least 10 % above the black (`"the white target is too dark or not brighter than the black reference: hold a white sheet in front"`) |
| `tcs.black_reference()` | the black reference as `(X, Y, Z)` per 1x-gain cycle, or `None` when none is taken; `tcs.black_reference(None)` clears it and the stored one (any other argument raises `ValueError`: use `calibrate_black()`) |
| `tcs.white_reference()` | the reference white as `(X, Y, Z)` per 1x-gain cycle, net of the black, or `None`; `tcs.white_reference(None)` clears it and the stored one (any other argument raises `ValueError`: use `calibrate_white()`) |
| `tcs.stored_calibration()` | the port's stored colour calibration, the dict of `evn.color_calibration(port)`: `"chip"` is `'TCS3430'` for a record this sensor made (`'TCS34725'` / `'APDS9960'` for a `ColorSensor` / `GestureSensor` record, which a `TCS3430` does not use), `"black"` / `"white"` its `(X, Y, Z)` - exactly `black_reference()` / `white_reference()` -, `"stored"`, `"pending"`, `"stamp"`, `"error"` as the `ColorSensor`'s |
| `tcs.clear_calibration()` | forgets the stored calibration, then the one in force; `True` when nothing of this sensor's is left in flash (another chip's record on the port is left alone), `False` while a motor drives and the old record is still in flash (the next `stored_calibration()` writes the clear once the motors stop); `RuntimeError` (another calibration waits for the flash) changes nothing; `OSError` (the flash write failed) clears both all the same and the next `stored_calibration()` retries the write |
| `tcs.color()` | the `detectable_colors()` entry the reading's `hsv()` matches (the same matcher as `ColorSensor`), or `None` when that set is empty |
| `tcs.color_match()` | `(color, confidence)`: the confidence is 1.0 on the chosen colour and 0.0 halfway between two; `(None, 0.0)` with no detectable colours |
| `tcs.detectable_colors([colors])` | the colours `color()` chooses from; default `(Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)`; anything that is not a `Color` raises `TypeError` |
| `tcs.hsv()` | the reading as a `Color` (`.h` 0..359, `.s` and `.v` 0..100): the X, Y, Z net of the black reference, relative to the reference white (without one, to full scale), turned into RGB with the sRGB standard's matrix |
| `tcs.xyz()` | `(X, Y, Z)` raw counts |
| `tcs.raw()` | `(X, Y, Z, IR1)` raw counts |
| `tcs.ir()` | the infrared (IR1) channel, raw counts |
| `tcs.ir2()` | the far-infrared (IR2) channel, raw counts, **measured now**: X and IR2 share one converter, so the firmware switches it to IR2 for one cycle and back. It returns after about two cycles plus a few ms (about 12 ms at the default 2.78 ms, 0.2 s at 100 ms); `xyz()` keeps its last reading meanwhile. A call straight after another first lets one X reading through (about four cycles plus a few ms, ~25 ms at 2.78 ms), so `xyz()` gets a new reading at least that often (up to ~30 ms apart at 2.78 ms), even with `ir2()` in a loop. No clip flag of its own: an IR2 at the full scale is clipped |
| `tcs.xy()` | `(x, y)` = X / (X + Y + Z), Y / (X + Y + Z) of the raw counts, or `None` in the dark — **uncalibrated** chromaticity (no per-unit correction matrix) |
| `tcs.saturated()` | `True` when the latest reading clipped: lower `gain()` or shorten `integration_time()` |
| `tcs.gain([n])` | the analog gain: 1, 4, 16, 64 (the default) or 128 (else `ValueError`); without an argument returns it. The typical ratios are 1 : 4 : 16 : 66 : 137 |
| `tcs.integration_time([ms])` | the integration time, 2.78..711.7 ms in 2.78 ms steps (else `ValueError`): the nearest step is set and **returned** (a float); without an argument returns it. Full scale is 1023 counts at one step and 65535 from 178 ms up |
| `tcs.wait_time([ms])` | a pause after each cycle, 0 (off, the default) .. 8540 ms: 2.78 ms steps up to 711.68 ms, then the chip's long wait in 33.36 ms steps (never shorter than 711.68 ms there). A reading comes every integration + wait. The setter returns the wait set (the int `0` when off); `ValueError` outside the range |
| `tcs.autozero([nth, mode=0])` | the chip's auto-zero (its search for the ADC's dark offset): `nth` 127 = only at the first cycle after a start (the default), 1..126 = every nth cycle, 0 = never; `mode` 0 = each search starts at zero, 1 = at the last offset (faster on average, slower in the worst case). Without arguments returns `(nth, mode)`; out of range `ValueError` |
| `tcs.thresholds([low, high, persistence=1])` | a window on the **Z** channel (the channel the chip's own ALS thresholds watch): Z below `low` or above `high` (0..65535) for `persistence` consecutive cycles (0 = every cycle, 1, 2, 3, 5, 10, 15 .. 60) latches `interrupt()` until `clear_interrupt()`. The firmware applies the chip's rule to every cycle it reads (setting it on the chip would take away the flag that marks a new reading, and the module's INT pin is not wired). Setting it clears the flag. `thresholds()` → `(low, high, persistence)`, `(0, 0, 0)` on a fresh sensor; `thresholds(low)` alone raises `TypeError` |
| `tcs.interrupt()`, `tcs.clear_interrupt()` | the window's latched flag, and clearing it. At persistence 0 ("every cycle", the default) it is set on every cycle whatever the window is, as the chip's: use 1 or more for a flag that means "Z left the window" |
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

**Calibrate once per port.** The module's LED is warm, so without calibration a white sheet reads `Color.YELLOW` (confidence about 0.3) and nothing in front reads `Color.BLUE`. Two lines fix it, taken at the distance the colours will be read - or the Board view's Calibrate on the sensor's row, which runs the same two steps:

```python
tcs.calibrate_black()   # nothing in front of the sensor
tcs.calibrate_white()   # a white sheet
```

The board stores the calibration for the port (the colour calibration page, one record per I2C port, as the `ColorSensor`'s and `GestureSensor`'s): every later `TCS3430(port)` starts with it, after a reboot or a re-plug. Calibrating a `ColorSensor` or `GestureSensor` on the same port replaces it (and the reverse); nothing identifies the module itself, so another module on the port, or another distance to the target, needs a new calibration. The write happens only when the calibration changed and never while a motor drives (`stored_calibration()["pending"]` is then `True` until the motors stop).

Calibration details (both colour sensors):

- `calibrate_white()` is refused when the target is too dark (TCS3430: Y under 5 % of the full scale at the current setting; HiTechnic: any channel under 20 of 255) or not at least 10 % above the black on every channel — a "white" taken with nothing in front would otherwise make every later reading white.
- `calibrate_black()` is refused when it would clear an existing white (the black is as bright as the white): `ValueError("this black is as bright as the white reference: the white was cleared, calibrate_white() again")`. On the HiTechnic a black with a channel near full scale (230+) is refused too.
- HiTechnic: the references belong to the open object: they survive an unplug and replug on the same port (a different unit plugged in inherits them), a second object on the same port shares them, and `close()` forgets them; they are also stored for the port, so the next `HiTechnicColorSensor(port)` starts with them again (`clear_calibration()` forgets both). TCS3430: the references are the port's stored record, installed by `TCS3430(port)`; a second object on the same port shares them.
- TCS3430: the references are normalised to gain and integration time with the datasheet's typical gain ratios, so after `gain()` changes a white stays close to, but not exactly on, s 0 — take the white again at the setting you will read at.
- HiTechnic: `reflection()` and `rgb()` stay the sensor's raw values; only `hsv()`, `color()` and `color_match()` use the references.


The references stay valid when `gain()` or `integration_time()` change. Validated by hand on the rig (2026-09-26, the default 2.78 ms at 64x, targets about 1 cm away, after `calibrate_black()` with nothing in front and `calibrate_white()` on a white sheet): nothing in front `Color.NONE` 1.00, white `Color.WHITE` 1.00 (`s` 0, `v` 100), red `Color.RED` 0.98 (`h` 1, `s` 83), green `Color.GREEN` 0.75 (`h` 140, `s` 94), blue `Color.BLUE` 0.91–0.93 (`h` 231, `s` 73).

`gain(n)`, `integration_time(ms)`, `wait_time(ms)` and `autozero(...)` wait for the first reading under the new setting. With nothing in front, 64x reads about 16–18 counts at 2.78 ms. For far-field or ambient light use `integration_time(100)` or more. The counts are not a calibrated XYZ (no per-unit correction matrix): for colours the named ones do not separate, hold the sensor over each real target, keep what `hsv()` returns and pass those `Color` objects to `detectable_colors()`. There is no lux or colour-temperature conversion: ams-OSRAM publishes the method (XYZ through a colour calibration matrix regressed against a reference meter for the finished optical stack, application note AN000571; then lux = Y and the colour temperature by McCamy's formula, AN000517) but no matrix for the bare sensor, and measuring one per unit is a characterisation this firmware does not ask for. An unplugged sensor is noticed at the firmware's next look at the chip — up to 90 % of a cycle (integration + wait) after the last reading, as it does not poll through the wait; until then the readings return that last one, `age()` growing. From then on every reading (and `ir2()`, `interrupt()`) raises `OSError("TCS3430 on port N not responding")` at once, whatever the wait; a replugged sensor is found again by itself. Two TCS3430 at once; a second `TCS3430(port)` on a port that is already open shares its settings and calibration, but sets the chip up again, so the readings pause for about two cycles. After `close()` every call except `close()` raises `ValueError("TCS3430 is closed")`.
