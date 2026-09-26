# Standard peripherals: sensors

Part 2 of the [EVN ALPHA MicroPython API reference](API.md), which has the units, the port numbers and the differences from Pybricks. Previous: [The board, the motors, the drive base and the pose](API_ROBOT.md) · Next: [Standard peripherals: displays, lights, servo and Bluetooth](API_DISPLAYS.md).

The rules every EVN Standard Peripheral follows and the table of all fifteen, then one section per sensor: the IMU, the compass, the colour, distance and gesture sensors, the touch array, the environment sensor and the ADC.

## Standard peripherals

Every device below is an *EVN Standard Peripheral*: plug it in, name the port, read. The firmware identifies the chip by its ID register, configures it, keeps the latest reading in a cache refreshed in the background (reading adds no bus traffic of its own; the refresh runs at up to 1 kHz inside waits, prints and the getters themselves) and re-attaches it after an unplug. All fifteen have been tested on hardware (the dates are in the [appendix](API_SYSTEM.md#validation-record)); `docs/STANDARD_PERIPHERALS.md` in the firmware repository is the full reference, with a function-by-function comparison to the EVN Arduino classes.

A second tier, the [EVN Extended Peripherals](API_EXTENDED.md#evn-extended-peripherals) (HiTechnic NXT sensors, the HuskyLens camera, the VL53L1X distance sensor, the TCS3430 colour sensor), has a page of its own.

Every constructor raises `OSError` when nothing answers on the port or the driver pool is full. What a device does while it is unplugged (its readings raise `OSError`; its settings, and a display's drawing, still answer from the firmware's copy) and after `close()` (a `ValueError`) is in the notes of its section. Blocks exist for every one of them (**EVN: Open blocks reference**, `docs/BLOCKS.md`), and every one has a folder of examples — a minimal and a complete program, in Python and in blocks — under `examples/`.

| Class | Device | Port | Examples |
| :--- | :--- | :--- | :--- |
| [`IMU`](#imu--gyro-and-accelerometer-mpu-6500) | MPU-6500 gyro + accelerometer with DMP | I2C 1–16 | `examples/11_imu/` |
| [`Compass`](#compass--magnetometer-qmc5883l--hmc5883l) | QMC5883L / HMC5883L magnetometer | I2C 1–16 | `examples/09_compass/` |
| [`ColorSensor`](#colorsensor--colour-sensor-tcs34725) | TCS34725 colour sensor | I2C 1–16 | `examples/05_colour_sensor/` |
| [`DistanceSensor`](#distancesensor--time-of-flight-distance-sensor-vl53l0x) | VL53L0X time-of-flight distance | I2C 1–16 | `examples/06_distance_sensor/` |
| [`GestureSensor`](#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960) | APDS-9960 gesture, proximity, colour | I2C 1–16 | `examples/07_gesture_sensor/` |
| [`TouchArray`](#toucharray--capacitive-touch-array-mpr121) | MPR121 12-key capacitive touch | I2C 1–16 | `examples/10_touch_pads/` |
| [`EnvSensor`](#envsensor--temperature-pressure-and-humidity-bme280) | BME280 temperature, pressure, humidity | I2C 1–16 | `examples/08_weather_sensor/` |
| [`ADC`](#adc--analogue-to-digital-converter-ads1115) | ADS1115 16-bit ADC | I2C 1–16 | `examples/12_adc/` |
| [`Display`](API_DISPLAYS.md#display--12864-oled-ssd1306--ssd1315) | EVN 128×64 OLED (SSD1306 / SSD1315) | I2C 1–16 | `examples/13_display/` |
| [`MatrixLED`](API_DISPLAYS.md#matrixled--88-led-matrix-ht16k33) | EVN 8×8 LED matrix (HT16K33) | I2C 1–16 | `examples/14_led_matrix/` |
| [`SevenSegmentLED`](API_DISPLAYS.md#sevensegmentled--4-digit-seven-segment-display-ht16k33) | EVN 4-digit display (HT16K33) | I2C 1–16 | `examples/15_seven_segment/` |
| [`RGBLED`](API_DISPLAYS.md#rgbled--rgb-led-module-ws2812b) | EVN RGB LED module / WS2812B strip | servo 1–4 | `examples/16_rgb_leds/` |
| [`Servo`](API_DISPLAYS.md#servo--hobby-servo-geekservo-270--continuous-rotation) | Geekservo 270° / continuous-rotation | servo 1–4 | `examples/17_servo/` |
| [`Bluetooth`](API_DISPLAYS.md#bluetooth--bluetooth-module-hc-05) | EVN Bluetooth module (HC-05) | serial 1–2 | `examples/18_bluetooth/` |

## IMU — gyro and accelerometer (MPU-6500)

Plug an MPU-6500 module into an I2C port (0x68, identified by its WHO_AM_I register); only SDA and SCL are used. By default the chip's DMP fuses gyro and accelerometer into an orientation at 200 Hz and calibrates its own gyro. Body frame: x forward, y left, z up — set `axes()` from the module's silkscreen before anything relies on it.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `imu = IMU(port, *, calibrate=False)` | `port` 1..16 (`ValueError` otherwise); `OSError("no MPU-6500 on port …")` if nothing answers, `OSError(EIO)` when two IMUs are already attached, `OSError(ETIMEDOUT)` if no first sample arrives. Takes ≈ 510 ms (reset and the DMP firmware load). Starts in DMP mode: 200 Hz, ±2000 deg/s, ±2 g, tap and orientation events, DMP gyro calibration. **The port's stored calibration is applied by default** (its offsets and its axes); `calibrate=True` first runs a new one (≈ 2 s more, still and level; see `calibrate()`), and a failed one fails the constructor with its `RuntimeError` |

### Heading and motion (`heading`, `reset_heading`)

| Call | Notes |
| :--- | :--- |
| `imu.heading()` | degrees, **clockwise positive** seen from above, relative to start-up or `reset_heading()`; keeps growing past ±180° and 360° (as Pybricks). Drift after the DMP's calibration ≈ 0.2° per 5 s |
| `imu.reset_heading(angle=0)` | the current direction reads as `angle` degrees (positional) |
| `imu.stationary()` | `True` while angular velocity and acceleration have varied less than the `settings()` thresholds over the last 250 ms |
| `imu.ready()` | `True` once the gyro bias has settled: stationary, with the calibrated gyro under the angular-velocity threshold on every axis (DMP: 8..25 s into stillness; raw mode, or `dmp(True, gyro_cal=False)`: the driver averages 1 s by itself after 1 s still) |
| `imu.settings(*, angular_velocity_threshold=, acceleration_threshold=, heading_correction=)`, `imu.settings()` | keyword-only; the getter returns all three. `angular_velocity_threshold` deg/s (default 2) and `acceleration_threshold` mm/s² (default 2500) for `stationary()` and `ready()`; `heading_correction` = degrees `heading()` reports per true full turn (default 360), clamped to 1..3600. A value that is not positive raises `ValueError("settings must be positive")` |

### Orientation (DMP mode)

These need the DMP: in raw mode (`dmp(False)`) each raises `ValueError("orientation needs the DMP: imu.dmp(True)")`. The DMP's orientation starts at identity and settles within ~10 s.

| Call | Notes |
| :--- | :--- |
| `imu.tilt()` | `(pitch, roll)` degrees, both in (−180, 180], so an upside-down module is not read as level. Nose up = positive pitch, left side up = positive roll |
| `imu.euler()` | `(yaw, pitch, roll)` degrees; yaw is `heading()` wrapped into −180..180 |
| `imu.quaternion()` | `(w, x, y, z)`, unit |
| `imu.gravity()` | unit vector of gravity in the body frame (≈ `(0, 0, 1)` when level) |
| `imu.linear_acceleration()` | `(x, y, z)` mm/s² in the body frame with gravity removed |
| `imu.up()` | the `Side` that faces up: `Side.TOP` when level, `FRONT` / `BACK` / `LEFT` / `RIGHT` / `BOTTOM` past 45°. Works in raw mode too |
| `imu.tap()` | `(direction, taps)` of a tap not yet returned, e.g. `('z up', 1)`, else `None`; each tap once. Directions `'x up'`, `'x down'`, `'y up'`, `'y down'`, `'z up'`, `'z down'` in the body frame; a firm tap is needed, and a double tap (`taps` 2) counts only when both impulses read in the same direction within 500 ms |
| `imu.screen_orientation()` | `'portrait'`, `'landscape'`, `'reverse portrait'` or `'reverse landscape'` of an orientation change not yet returned, else `None`; each event once. This output stays in the chip's frame whatever `axes()` says |

### Raw readings

| Call | Notes |
| :--- | :--- |
| `imu.acceleration()` | `(x, y, z)` mm/s² in the body frame, gravity included (≈ 9800 on z when level) |
| `imu.angular_velocity()` | `(x, y, z)` deg/s in the body frame |
| `imu.raw()` | `((ax, ay, az), (gx, gy, gz))` counts of the latest sample (cached, never blocks) |
| `imu.read()` | waits for the **next** sample (one period, 5 ms at 200 Hz): `(yaw, pitch, roll)` degrees in DMP mode, `((ax, ay, az) g, (gx, gy, gz) deg/s)` in raw mode |
| `imu.temperature()` | die temperature in °C, refreshed once a second |
| `imu.age()` | ms since the latest sample was taken (at most one period + 1 ms) |

### Settings

Every setter here returns only once the first sample under the new setting exists.

| Call | Notes |
| :--- | :--- |
| `imu.dmp(enable, *, rate=None, tap=True, orientation=True, gyro_cal=True)`, `imu.dmp()` | switch the DMP on or off; the getter returns `bool`. `rate` 12..200 Hz (`ValueError` otherwise); `rate=None` **keeps the rate in force**. `tap` / `orientation` / `gyro_cal` select the DMP features. Off: raw registers at 1 kHz, ±2000 deg/s, ±16 g, filter 184 Hz. Switching back keeps the loaded image (≈ 80 ms) |
| `imu.sample_rate([hz])` | DMP mode 12..200 Hz (default 200), raw mode 4..1000 Hz (default 1000); `ValueError` outside |
| `imu.ranges(*, gyro=, accel=)`, `imu.ranges()` | `(gyro deg/s, accel g)`. Raw mode: gyro 250, 500, 1000 or 2000, accel 2, 4, 8 or 16; a missing one keeps its value. The DMP runs at 2000 / 2: anything else in DMP mode raises `ValueError` |
| `imu.filter(*, gyro=, accel=)`, `imu.filter()` | the digital low-pass in Hz, `(gyro, accel)`: gyro 184 (default), 92, 41, 20, 10 or 5; accel 460, 184 (default), 92, 41, 20, 10 or 5. The gyro's 250 Hz and 3600 Hz are **refused** — they select the chip's 8 kHz internal rate and break the DMP's time base |
| `imu.axes(top='z', front='x')`, `imu.axes()` | which chip axes point up and forward: `'x'`, `'y'`, `'z'` or `'-x'`, `'-y'`, `'-z'` (keyword-only; a missing one keeps its value); the getter returns `(top, front)`. Read them from the module's silkscreen (a module mounted upside down needs `top='-z'`). Two equal axes raise `ValueError`. Applied in software: it costs one sample period, and the orientation, the heading and `ready()` carry on |
| `imu.calibrate_gyro(samples=500)` | raw mode, or `dmp(True, gyro_cal=False)`: average `samples` (1..65535, positional) still readings and subtract the bias; returns the bias in counts. With the DMP's own gyro calibration on (the default in DMP mode) that calibration owns the bias and it returns `None` |
| `imu.close()` | detach the driver and free the port. A second `close()` does nothing |

### IMU calibration

**Calibrate it once per port** (`imu.calibrate()`, `IMU(port, calibrate=True)`, or the pulse button on the IMU's row in the extension's Board view): about 2 s with the robot still on a level surface. It measures the gyro bias, the accelerometer offsets and which sensor axis points up, and stores them in the board's flash for that I2C port with the date. **Every `IMU(port)` afterwards starts with the stored calibration** — the gyro is corrected from the first sample, so `ready()` comes as soon as the robot is still instead of 8..25 s later, and `tilt()` reads 0 in the pose it was calibrated in. The step-by-step guide is [Calibrating your robot](CALIBRATION.md#imu).

| Call | Notes |
| :--- | :--- |
| `imu.calibrate(wait=True, *, pose=0)` | about 2 s with the robot **still on a level surface**: measures the gyro bias, the accelerometer offsets and which sensor axis points up, stores them in flash for this port with the date, and applies them — to this object at once and to every `IMU(port)` from now on (the offsets go into the chip's own offset registers, so the DMP, the raw readings and `evn.Pose` all use them). `axes()` follows: `top` becomes the axis gravity found; gravity cannot tell forward, so `front` is kept when it still fits and otherwise assumed from a pitch of the mounting — check it. Returns `imu.calibration()`. Raises `RuntimeError("IMU calibration failed: …")` only when it moved or read a steady turn (the stored calibration is then unchanged); anything else calibrates what it can (table above) and says what it left out in `warning`. `wait=False` returns at once; `calibration()` reports `busy` and finishes it. `pose=1` / `pose=2`: the two-pose calibration (below); after `pose=1`, `calibration()['waiting']` is True until `pose=2`. The date is only known when the board's clock is set (the extension does that) |
| `imu.calibration()` | this port's stored calibration: `{"port", "calibrated", "busy", "stored", "stamp", "gyro", "accel", "top", "front", "temperature", "error"}` — `gyro` the bias in deg/s and `accel` the accelerometer error in g, both on the sensor's own (chip) axes; `top` / `front` the axes it put in force; `stamp` seconds since 1970 UTC when it was made (0 when the board's clock was not set then); `stored` false while a motor kept it out of flash; `error` why the last calibration on the port failed, else `None`; `pending` true while a change on any port has not reached flash (a motor was driving); `accel_calibrated` whether the accelerometer part was measured, `tilt` how far off level it was measured (degrees, `None` when it was not), `warning` what the last calibration left out or a caution (else `None`); `two_pose` whether the accelerometer part came from two poses, `slope` the surface slope the last two-pose calibration left out this session (else `None`), `waiting` True between `pose=1` and `pose=2` |
| `imu.cancel_calibration()` | drop a calibration in progress (a `wait=False` run, or a first pose waiting for its turn); nothing is stored |
| `imu.clear_calibration()` | forget this port's calibration: the chip goes back to its factory trim (and the DMP to its own gyro calibration); `axes()` stays as it is. Returns `True`, or `False` when a running motor kept the flash write back (the old record would return at power-off until the next `calibration()` writes it) |

What the surface does to it (one pose cannot tell a tilted **mount** from a sloped **surface**):

| Tilt during the calibration | What is calibrated | Afterwards |
| :--- | :--- | :--- |
| up to 5° | gyro, accelerometer, up axis | the chip's own error is removed in every pose |
| 5°–8° | the same, with a `warning` | a tilted **mount** is levelled out (within ~1° up to ±30° of pitch and roll, ~2× the mount tilt upside down); a sloped **surface** stays as an error of about the slope in every pose — calibrate again on a level one |
| 8°–30° | gyro and up axis; the accelerometer keeps what it had | `accel_calibrated` False, a `warning` says so |
| over 30° (mounted between axes), or not reading 1 g | gyro only; axes and accelerometer unchanged | set `axes()` yourself |
| moving, or a steady turn | nothing: `RuntimeError` | the stored calibration is unchanged |


**Two poses** remove the surface from the calibration: `imu.calibrate(pose=1)`, turn the robot about half a turn (120°–240°) on the same spot on its wheels, then `imu.calibrate(pose=2)` (in the Board view: the pulse button, *Two poses*). The robot turns about its own up axis, so the slope's share of gravity turns with it while the chip's error and the mount tilt stay; the driver measures the turn itself and separates the two. Only the chip's error and the mount are stored (8° bound on those), a slope of up to 20° is left out and reported as `slope`. Refused if the robot was tipped onto another face or turned less than 120° / more than 240°, if it turned too fast for the gyro range, or if the board was busy between the poses (an I2C scan, a long computation: over 0.1 s while turning, or over 0.3 s at all) — the driver integrates the turn and must not lose any of it; the second pose must come within 2 minutes (`cancel_calibration()` drops a waiting first pose). In raw mode the two-pose calibration needs `sample_rate()` of 50 Hz or more. A mount tilt is still removed as an offset: upright poses read level, upside down about twice the mount tilt off. Without a calibration, **keep the robot still for the first ~15 s** after `IMU(port)`: the DMP calibrates its gyro 8..25 s into stillness (`ready()`), and a module moved early may not calibrate for a long time. The calibration belongs to the port, not the module: calibrate again after moving the module to another port or plugging another one in.

**Example**

```python
from evn import IMU
imu = IMU(3)
imu.axes(top='-z', front='y')   # from the silkscreen: module upside down, nose along its y
while not imu.ready(): pass     # keep the robot still
print(imu.heading(), imu.tilt())
```

**Notes**

**With `evn.Pose`:** `Pose(imu=port)` takes the IMU's body-frame angular velocity and acceleration, not `heading()`, so `reset_heading()` and `heading_correction` do not change the Pose; set `axes()` before building it. On a robot, `DriveBase(..., imu=port)` builds that `Pose` for the base (`robot.pose`). A second `IMU(port)` on an open port shares the same driver.

A scan of this port with `evn.I2C` pops one byte of the chip's FIFO (the driver heals it with a FIFO reset). One call can hold the I2C bus for up to ≈ 3.7 ms while it drains the waiting DMP packets.

The constructor raises `OSError` when nothing answers; every getter — `heading()`, `stationary()` and `ready()` included — raises `OSError("IMU on port … not responding")` while the module is unplugged, and a replug into the same socket keeps the settings and carries the heading on; after `close()` every call except `close()` itself raises `ValueError("IMU is closed")`.

## Compass — magnetometer (QMC5883L / HMC5883L)

Plug a QMC5883L or HMC5883L compass module (the EVN compass module is an HMC5883L) into an I2C port; only SDA and SCL are used. The firmware finds whichever of the two chips answers (QMC at 0x0D, HMC at 0x1E, each checked by its ID register), keeps the latest reading in a cache and re-attaches it after an unplug. Body frame: x forward, y left, z up — `axes()` says which sensor axes those are. Mount it away from the motors: their magnets bend the field as the robot moves, and a calibration corrects the sensor, not the room.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `c = Compass(port)` | `port` 1..16 (`ValueError` otherwise); `OSError("no QMC5883L/HMC5883L on port …")` if neither chip answers, `OSError(EIO)` when four compasses are already attached, `OSError(ETIMEDOUT)` if no first reading arrives. Returns after the first reading (≈ 33 ms on the HMC). **The port's stored calibration is installed by default** (the one `calibrate_stop()` stored, when it was made on this chip type; a default open starts on its axes). Defaults: QMC ±2 G, 200 Hz, oversampling 512; HMC ±1.3 G, 75 Hz, 1 average. A second `Compass(port)` on a port that is already open keeps its calibration, `axes()` and `north()` reference, but its settings go back to the defaults and a running `calibrate()` collection ends |

### Heading and field

| Call | Notes |
| :--- | :--- |
| `c.heading()` | degrees 0..360, clockwise seen from above, from `north()` — the direction of the calibrated horizontal field, whatever its size. 2-D only: no tilt compensation, so keep the module level |
| `c.heading_confidence()` | 0..1, measured from this reading's field strength: 1 when \|field\| equals the calibration's fitted radius, falling to 0 at ±25 % off it. After a planar calibration (`calibrate(planar=True)`) only the horizontal part of the field is measured against the fitted circle — the Earth's vertical field, which the planar fit does not see, does not count. Without a fitted radius (no `calibrate()`, or a calibration installed with `calibration(offset, matrix)`, which carries none) only a coarse test: 0.5 while \|field\| is inside the Earth's 0.25..0.65 G, else 0. A field the motors have cancelled reads 0 even when the heading looks plausible |
| `c.field_strength()` | \|field\| in gauss (calibrated when a calibration is installed); the Earth's field is 0.25..0.65 G. After a planar calibration it is the horizontal field only (x and y, what the planar fit calibrates; compare it with `stored_calibration()["field"]`), which is smaller: from about 0.1 G at high latitudes to 0.4 G near the equator |
| `c.read()` | waits for the **next** reading and returns its heading (13.3 ms at the HMC default) — use it in a loop that should see a new sample each time |
| `c.north(heading=0)` | the current direction reads as `heading` degrees from now on (positional) |
| `c.field()` | `(x, y, z)` gauss in the body frame (forward, left, up), calibrated when a calibration is installed; a planar calibration corrects x and y only, so z is then the sensor's own reading, the robot's iron included |
| `c.raw()` | `(x, y, z)` sensor-frame counts of the latest reading (cached, never blocks) |
| `c.age()` | ms since the latest reading was taken |

### Settings and chip

| Call | Notes |
| :--- | :--- |
| `c.axes(top='z', front='x')`, `c.axes()` | which sensor axes point up and forward: `'x'`, `'y'`, `'z'` or `'-x'`, `'-y'`, `'-z'` (keyword-only; a missing one keeps its value); the getter returns `(top, front)`. Read them from the module's silkscreen. Two equal axes raise `ValueError`. Setting the axes already in force changes nothing; a real change **clears the installed calibration** and ends a collection in progress |
| `c.data_rate([hz])` | QMC 10, 50, 100 or 200 (default); HMC 0.75, 1.5, 3, 7.5, 15, 30 or 75 (default). The getter is a float on both chips |
| `c.range([gauss])` | QMC 2 (default) or 8; HMC 0.88, 1.3 (default), 1.9, 2.5, 4.0, 4.7, 5.6 or 8.1 (`range(4.0)` for a motor-heavy robot). The getter is a float on both chips; `field()` stays in gauss at every range. Lowering an HMC under 4.0 while a `bias()` is set raises `ValueError` |
| `c.oversampling([n])` | QMC filter 64, 128, 256 or 512 (default); HMC samples averaged 1 (default), 2, 4 or 8 |
| `c.overflow()` | `True` when the latest reading was out of range for the current `range()` |
| `c.overrun()` | `True` when a measurement was lost before the last read (the QMC's DOR flag); always `False` on an HMC, which has no such flag |
| `c.temperature()` | QMC5883L only: relative die temperature in °C (no factory offset); `ValueError` on an HMC |
| `c.chip()` | `'QMC5883L'` or `'HMC5883L'` |
| `c.bias([mode])` | HMC5883L only (`ValueError` on a QMC): the self-test strap, 0 normal, 1 positive, 2 negative. The strap adds ≈ 1.16 G and saturates every range under 4.0, so a non-zero bias needs `range(4.0)` or more first (else `ValueError`) — use `self_test()`, which sets the gain itself |
| `c.self_test(*, negative=False, raw=False)` | HMC5883L only (`ValueError` on a QMC): the datasheet's strap test, run at the gain the datasheet prescribes, with the settings put back afterwards. Returns `(ok_x, ok_y, ok_z)` booleans, or the raw strap counts with `raw=True`; `negative=True` uses the negative strap |
| `c.close()` | detach the driver and free the port; the `north()` reference is dropped (the stored calibration stays in flash). A second `close()` does nothing |

HMC5883L setters (`data_rate()`, `range()`, `oversampling()`, `bias()`) return only once the first reading **under the new setting** is in: the chip's first measurement after a configuration write is still under the old one, so a setter holds two periods — 27–31 ms at 75 Hz, 138 ms at 15 Hz, 2.7 s at 0.75 Hz. The previous reading stays readable meanwhile.

### Compass calibration

A compass on a robot reads the robot's own iron (motors, battery, screws) as well as the Earth's field, so it needs a **hard- and soft-iron calibration** before its heading means anything: start a collection, turn the robot, stop it. The fit is stored in the board's flash for the port with the date, and every later `Compass(port)` starts with it. The step-by-step guide, with the Board view's live map of the directions, is [Calibrating your robot](CALIBRATION.md#compass).

| Call | Notes |
| :--- | :--- |
| `c.calibrate(planar=False)` | start collecting samples for the hard- and soft-iron fit, then tumble the sensor through every orientation; `planar=True` fits the horizontal ellipse for a floor robot that only turns in place |
| `c.calibrate_progress()` | `(samples, coverage)`: samples collected and the share of directions seen, 0..1 |
| `c.calibrate_directions()` | `(mask, current, planar)`: which directions have been seen, as a bit mask (bit n = `cx + 3*cy + 9*cz`, each 0 / 1 / 2 for below / inside / above the dead band of that axis of the field around its centre, body frame; 26 bits, the 8 with `cz` = 1 in planar mode), the direction of the latest reading (−1: none yet, or too near the centre) and the mode — for drawing the coverage live. `ValueError` when no collection is running |
| `c.calibrate_stop()` | fit and install the calibration, and **store it in the board's flash for this port** with the date (every later `Compass(port)` starts with it); returns `(residual, coverage, samples)`. `ValueError` when `calibrate()` was not started; `ValueError("calibration refused: …")` when there are not enough samples or directions (a still sensor covers 0, a flat ring is refused by the 3-D fit) — the collection **keeps running**, so turn some more and call it again, or `calibrate_cancel()` |
| `c.calibrate_cancel()` | end a collection without fitting (the way out of a refused `calibrate_stop()`) |
| `c.stored_calibration()` | this port's stored calibration: `{"port", "calibrated", "busy" (a collection is running), "stored", "pending" (a change is not in flash yet: a motor was driving), "stamp" (seconds since 1970 UTC, 0 when the board's clock was not set), "planar", "coverage" (0..1 of the directions), "residual" (the fit's RMS radius error, 0.02 = 2 %), "field" (the calibrated \|field\|, gauss), "samples", "chip", "top", "front" (the axes it was made with), "offset" (hard iron, gauss, body frame), "error"}`. `evn.compass_calibration(port)` reads the same without opening the compass |
| `c.clear_calibration()` | forget this port's stored calibration and the one in force. Returns `True`, or `False` when a running motor kept the flash write back (retried by the next `stored_calibration()`) |
| `c.calibration()`, `c.calibration(offset, matrix=None)`, `c.calibration(None)` | the installed calibration as `((ox, oy, oz), ((…), (…), (…)))`, or `None`; give a stored `offset` and 3×3 `matrix` back to install it (an offset alone installs the identity matrix, a hard-iron-only calibration), `None` clears it. Wrong shapes raise `ValueError`. A calibration installed this way is **not stored** (`calibrate_stop()`'s is) |

**Calibrate from the Board view:** the pulse button on a compass row offers *Full* (turn the robot slowly through every orientation — onto each side, nose up and down, upside down; about a minute) or *Planar* (spin it on a flat floor, a couple of full turns, about 20 s; for a robot that only drives on the floor, and the heading is right only while it stays flat). A **map of the directions** opens beside the editor while it runs — each dot a direction the magnetic field can take around the sensor (planar: 8 on a ring; full: 26, the thick outer ring being one of them), lit in the EVN tan once covered and all turning jade once every one is in, with a ring on where the field points now — so you can see which way to turn next. The dots are directions of the field, not of the robot: turn it until the ring lands on the dark dots. The extension tries the fit by itself once **75 % of the directions** are covered in a full calibration (20 of 26, so the map need not turn jade) and **all 8** in a planar one, and finishes as soon as the fit is accepted; stopping early, or 3 minutes without enough directions, offers to finish with what was covered. Calibrate on the robot as it drives — motors, battery and metal parts in place, away from other magnets and steel — and again after moving any of them: the hard iron is the robot's. The row then shows *calibrated &lt;date&gt; (full)* or *(planar)*; right-click for *Clear calibration*. A stored calibration is used only with the axes it was made with (`axes()` to other ones drops it) and only on the chip type it was made on. After `axes()` away and back in the same session, or `calibration(None)`, the stored one returns only with a fresh `Compass(port)` (after `close()`).

**Example**

```python
from evn import Compass, wait
c = Compass(6)
c.calibrate()               # now turn the robot every way, for about a minute
wait(60000)
print(c.calibrate_stop())   # (residual, coverage, samples); stored for port 6
print(c.heading())
```

**Notes**

**With `evn.Pose`:** `Pose(compass=port)` takes this object's `heading()` — including any `north()` offset — plus the Pose's `declination`. The compass counts only once a calibration is installed, and the Pose drops every sample whose `heading_confidence()` is 0, so a field the motors have bent leaves the heading without an absolute reference (`'compass'` leaves `pose.sources()`) instead of pulling it off. Set `axes()` before building the `Pose`. On a robot, `DriveBase(..., compass=port, declination=...)` builds that `Pose` for the base (`robot.pose`).

The constructor raises `OSError` when nothing answers; every reading raises `OSError("compass on port … not responding")` while the module is unplugged (`data_rate()`, `range()`, `oversampling()`, `bias()`, `axes()`, `chip()` and `calibration()` still answer); after `close()` every call except `close()` itself raises `ValueError("Compass is closed")`.

## ColorSensor — colour sensor (TCS34725)

Plug an Adafruit TCS34725 breakout (or any TCS34725 board) into an I2C port; only SDA and SCL are used, the breakout's LED stays on.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `cs = ColorSensor(port)` | `port` 1..16; `OSError` if nothing answers at 0x29. Returns after the first reading (≈ 12 ms). Same defaults as the EVN Arduino library: 2.4 ms integration, gain 16× |

### Reading colours

| Call | Notes |
| :--- | :--- |
| `cs.color()` | the nearest of `cs.detectable_colors()` as a `Color` — `if cs.color() == Color.RED:`. Pybricks' matcher: hue decides for coloured surfaces at any distance; white vs none needs `ranges()` calibration (or a white surface reading over 50 % of full scale) |
| `cs.color_match()` | `(color, confidence)` from one reading: the colour `cs.color()` would give and how sure the match is — 1.0 dead on the colour, 0.0 halfway between two detectable colours. `c, p = cs.color_match(); if c == Color.RED and p > 0.6:` |
| `cs.detectable_colors([colors])` | default `(Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)`; give your own tuple of `Color`s, e.g. `(Color.GREEN, Color.MAGENTA, Color(h=348, s=96, v=40), Color.NONE)` |
| `Color` | `Color.RED`, `ORANGE`, `YELLOW`, `GREEN`, `CYAN`, `BLUE`, `VIOLET`, `MAGENTA`, `BROWN`, `WHITE`, `GRAY`, `BLACK`, `NONE`, or `Color(h, s=100, v=100)`; `.h .s .v`; `c >> 30` shifts the hue, `c * 0.5` dims |
| `cs.raw()` | `(clear, red, green, blue)` counts of the latest reading (cached, never blocks) |
| `cs.read()` | waits for the **next** reading (≤ 4.8 ms at the defaults; longer right after changing gain or integration time) and returns `(clear, red, green, blue)` — use this in a loop that should see a new sample each time |
| `cs.percent()` | `(clear, red, green, blue)` as % of full scale |
| `cs.rgb()` | `(r, g, b)` 0..255, relative to the clear channel |
| `cs.hsv(normalized=False)` | the reading as a `Color` (`.h` 0..359, `.s` %, `.v` %); value = strongest channel's % of full scale |
| `cs.ambient()` | clear channel as % of full scale |
| `cs.lux()`, `cs.color_temperature()` | estimates (uncalibrated) in lux and kelvin |
| `cs.age()` | ms since the reading was taken (the firmware refreshes it every 4.8 ms at the defaults) |

### Settings and calibration

| Call | Notes |
| :--- | :--- |
| `cs.ranges(clear=(low, high), red=…, green=…, blue=…)`, `cs.ranges()` | calibration: the raw count you measured on the darkest and brightest surface per channel (`None` clears one); a pair must satisfy `0 <= low < high <= 65535`, else `ValueError`. `cs.ranges()` → four entries in clear, red, green, blue order, each `(low, high)` or `None` |
| `cs.normalized()` | `(clear, red, green, blue)` mapped 0..100 between each channel's calibration low and high; `cs.hsv(normalized=True)` uses these (white balance) |
| `cs.gain([x])` | 1, 4, 16 (default) or 60 |
| `cs.integration_time([ms])` | 2.4 (default) .. 614.4 in 2.4 ms steps (`ValueError` outside); longer = more resolution, slower. The setter returns the time actually set (rounded to the step) |
| `cs.wait_time([ms])` | pause between readings, 0 (default) .. 7372.8 (2.4 ms steps up to 614.4, 28.8 ms steps above). The getter returns the int `0` when there is no pause; the setter returns the pause actually set |
| `cs.thresholds([low, high, persistence=1])`, `cs.interrupt()`, `cs.clear_interrupt()` | the chip's clear-channel window flag: a clear count below `low` or above `high` (0..65535) for `persistence` consecutive readings (0 = every reading, 1, 2, 3, 5, 10, 15 .. 60; `thresholds(low, high)` sets 1) latches `interrupt()` until `clear_interrupt()`. `thresholds()` → `(low, high, persistence)`, `(0, 0, 0)` on a fresh sensor; `thresholds(low)` alone raises `TypeError` |
| `cs.id()`, `cs.close()` | part ID (0x44 for a TCS34725/34721, 0x4D for a TCS34727/34723); sleep the sensor and free the port |

**Example**

```python
from evn import ColorSensor, Color
cs = ColorSensor(5)
if cs.color() == Color.RED:
    print("red", cs.hsv())
```

**Notes**

Every setter (`gain()`, `integration_time()`, `wait_time()`, `thresholds()`) returns only once a sample measured **under the new setting** exists. With a persistence of 0 ("every reading") `interrupt()` reads `True` as soon as `thresholds()` has been called, whatever the count: pass 1 or more (the setter's default) for a flag that means "the clear count left the window".

While the sensor is unplugged every reading raises `OSError("colour sensor on port N not responding")`; `gain()`, `integration_time()`, `wait_time()`, `thresholds()`, `ranges()`, `detectable_colors()` and `id()` still answer, and a replugged sensor comes back with its settings. After `close()` every call except `close()` itself raises `ValueError("colour sensor is closed")`.

## DistanceSensor — time-of-flight distance sensor (VL53L0X)

Plug a VL53L0X time-of-flight board (address 0x29) into an I2C port; only SDA and SCL are used. It measures 30 to about 2000 mm to the surface in front of its window with an infrared laser, and reports `None` rather than a number when it has no valid target.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `ds = DistanceSensor(port)` | `port` 1..16; `OSError("no VL53L0X on port N (I2C 0x29)")` if no chip with the VL53L0X reference registers answers (a colour sensor at the same address is refused), `OSError("no free DistanceSensor slot for port N (4 in use)")` when all 4 slots are taken, `OSError("distance sensor on port N gave no first measurement")` on a timeout. Resets the chip, runs ST's initialisation and returns with the first range (≈ 90–120 ms after the call). Defaults: timing budget 33 ms, signal rate limit 0.25 MCPS, VCSEL periods 14 / 10, back-to-back ranging |

**Methods**

| Call | Notes |
| :--- | :--- |
| `ds.distance()` | the latest distance in mm (int), or `None` when there is no valid target (the Pybricks `UltrasonicSensor` name). Cached, no bus traffic |
| `ds.read()` | waits for the **next** measurement and returns it (mm or `None`) — use this in a loop that should see a new sample each time (31.7 ms per call at the 33 ms budget); `OSError` if none arrives |
| `ds.status()` | why the latest range is or is not valid: `'valid'`, `'sigma fail'`, `'signal fail'`, `'phase fail'`, `'hardware fail'`, `'min range fail'` or `'no update'` (`'phase fail'` with nothing in range) |
| `ds.raw()` | `(range_mm, status, device_status, signal_rate, ambient_rate, spad_count)`: the range as the chip gave it (8190 = no target), the `status()` name, the chip's device-status code, the return signal and the ambient light in MCPS (floats), and the effective SPAD count (a float) |
| `ds.timing_budget([ms])` | time for one measurement, 20..1000 ms (default 33; the getter is a float); outside it `ValueError`. Longer = more accurate: a ~100 mm target read 80–116 mm at 33 ms and 85–92 mm at 200 ms (spread 5–8 mm against 37–71 mm at 20 ms) |
| `ds.signal_rate_limit([mcps])` | the weakest return signal accepted as a range, 0..511.99 MCPS (default 0.25); outside it `ValueError`. Lower = longer range but more false readings; above the target's return the range is `None` with `'signal fail'` |
| `ds.vcsel_periods([pre, final])` | laser pulse periods in PCLKs as `(pre, final)`, default `(14, 10)`; set both: `pre` 12, 14, 16 or 18 and `final` 8, 10, 12 or 14 (else `ValueError`; one argument alone raises `TypeError`). Longer periods reach further; (18, 14) read about 15 mm longer on the bench (the factory offset is trimmed at 14 / 10) |
| `ds.inter_measurement([ms])` | 0 = back to back (default); `ds.inter_measurement(100)` starts a measurement every 100 ms (start to start; 0..60000 ms, else `ValueError`) to save power and bus time |
| `ds.profile(name)` | sets ST's profiles in one call (setter only): `'default'` (33 ms, 0.25 MCPS, 14 / 10), `'high_speed'` (20 ms), `'high_accuracy'` (200 ms), `'long_range'` (33 ms, 0.1 MCPS, 18 / 14, for dark surroundings); anything else `ValueError`. It sets the budget, limit and periods, which their getters then report |
| `ds.age()` | ms since the latest measurement was taken (≤ 30 ms at the 33 ms budget with three sensors attached) |
| `ds.close()` | stops ranging and frees the port and its slot; a new `DistanceSensor(port)` starts from the defaults again |

**Example**

```python
from evn import DistanceSensor
ds = DistanceSensor(8)
d = ds.read()
print(d if d is not None else "nothing in range", ds.status())
```

**Notes**

Every setter (`timing_budget()`, `signal_rate_limit()`, `vcsel_periods()`, `inter_measurement()`, `profile()`) stops ranging, lets the range in flight finish (up to a whole old budget: 1 s after `timing_budget(1000)`), applies the change and returns only with the first measurement under the **new** setting; if none arrives it raises `OSError("distance sensor on port N gave no measurement under the new setting")` and the object stays usable. Offset and cross-talk calibration are not performed (the factory offset in the chip applies). `print(ds)` shows the settings.

While the module is unplugged every getter — `distance()`, `read()`, `status()`, `raw()`, `age()` — raises `OSError("distance sensor on port N not responding")`; the settings getters still answer, and a replugged module comes back by itself (1.5 s after the replug) with the settings kept. After `close()` every call except `close()` itself raises `ValueError("distance sensor is closed")`.

## GestureSensor — gesture, proximity and colour sensor (APDS-9960)

Plug the EVN gesture module (or any APDS-9960 breakout at 0x39) into an I2C port; only SDA and SCL are used. Three engines run at once: gestures, proximity and colour.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `gs = GestureSensor(port)` | `port` 1..16. Checks the part ID, configures the chip, turns all three engines on and returns after the first reading (≈ 23 ms). `OSError("no APDS-9960 on port N (I2C 0x39)")` if nothing answers there, `OSError("no free GestureSensor slot for port N (k in use)")` when all four slots are taken, `OSError("gesture sensor on port N gave no first sample")` on a timeout |

### Gestures and proximity

| Call | Notes |
| :--- | :--- |
| `gs.gesture()` | `'up'`, `'down'`, `'left'`, `'right'` or `None`: the newest gesture not yet returned, each one once (two gestures between calls return only the second). Names are the direction the hand moved with the module's label upright (`'up'` = from the bottom edge toward the top edge). A hand that only hovers and lifts is no gesture. Returns `None` while the gesture engine is off |
| `gs.read_gesture(timeout=5000)` | waits up to `timeout` ms (positional or keyword; `None` keeps 5000) for the next gesture and returns its name, or `None` on timeout. A negative timeout raises `ValueError`; with the gesture engine off it raises `ValueError("gesture engine is off: engines(gesture=True)")` |
| `gs.gesture_detail()` | `(gesture, up_down, left_right, ud_delta, lr_delta, datasets, overflow)` of the last gesture: the name, each axis's name (or `None`), the two axis deltas (the larger picks the axis), the number of FIFO datasets it was decoded from, and `True` if the chip's FIFO overflowed during it |
| `gs.proximity()` | 0..255, higher = closer (≈ 2–5 with nothing in front, ≈ 37 with a hand at 3 cm). Needs the proximity or the gesture engine; with both off it raises `OSError` |
| `gs.status()` | `(als_int, prox_int, als_saturated, prox_saturated, in_gesture)`: the colour and proximity threshold flags (see `thresholds()`), the two saturation flags, and whether the chip is in gesture mode right now (its `GCONF4.GMODE` bit) |
| `gs.age()` | ms since the latest proximity reading (the colour reading when proximity has none). With no reading and both the colour and proximity engines off it raises `ValueError("colour and proximity engines are off: engines(colour=True) or engines(proximity=True)")` |

**Gesture mode.** While an object sits inside the gesture entry threshold (a hand held still a few cm away) the chip stays in gesture mode and **suspends its proximity and colour engines**: `proximity()` and the colour readings keep their last value, `age()` grows and `status()[4]` is `True`; moving the hand away ends it. With no last value yet — the object was there from power-up, e.g. a module lying face down, or a setter has just restarted the engines — `proximity()`, the colour getters and `age()` raise `OSError("gesture sensor on port N is in gesture mode ...")`. A program that tracks a stationary object uses `gs.engines(gesture=False)`.

### Colour

| Call | Notes |
| :--- | :--- |
| `gs.color()` | the nearest of `gs.detectable_colors()` as a `Color`, or `None` when that set is empty; the same matcher as `ColorSensor.color()` |
| `gs.color_match()` | `(color, confidence)` from one reading, as `ColorSensor.color_match()`: 1.0 dead on the colour, 0.0 halfway between two detectable colours; `(None, 0.0)` for an empty set |
| `gs.detectable_colors([colors])` | default `(Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)`; give your own tuple of `Color`s |
| `gs.raw()` | `(clear, red, green, blue)` counts of the latest reading |
| `gs.rgb()` | `(r, g, b)` 0..255, relative to the clear channel |
| `gs.hsv()` | the reading as a `Color`; value = strongest channel's % of full scale |
| `gs.ambient()` | clear channel as % of full scale, 0..100 |

The colour getters raise `ValueError("colour engine is off: engines(colour=True)")` while the colour engine is off.

### Settings

| Call | Notes |
| :--- | :--- |
| `gs.engines([*, colour, proximity, gesture])` | turn each engine on or off (all three on by default); keyword-only, a value left out keeps the current state. The getter returns `(colour, proximity, gesture)` |
| `gs.gain([*, colour, proximity, gesture])` | colour 1 / 4 (default) / 16 / 64, proximity 1 / 2 / 4 (default) / 8, gesture 1 / 2 / 4 (default) / 8; keyword-only, a value left out keeps the current one. The getter returns the three gains |
| `gs.integration_time([ms])` | colour integration 2.78 (default) .. 712 ms in 2.78 ms steps; longer = more resolution, slower. Returns the value actually set |
| `gs.led([*, proximity, gesture, boost])` | IR LED current per engine 100 (default) / 50 / 25 / 12.5 mA, boost 100 (default) / 150 / 200 / 300 %; keyword-only. The getter returns `(proximity_mA, gesture_mA, boost_percent)` |
| `gs.pulses([*, proximity=(count, length_us), gesture=(count, length_us)])` | IR pulses per reading: count 1..64, length 4 / 8 / 16 / 32 µs (defaults proximity 8 × 16 µs, gesture 10 × 32 µs); keyword-only. The getter returns `((count, us), (count, us))` |
| `gs.gesture_config([*, entry, exit, fifo_threshold, dimensions, wait, exit_mask, exit_persistence])` | gesture engine: `entry` / `exit` proximity thresholds 0..255 (default 30 / 20), `fifo_threshold` 1 / 4 (default) / 8 / 16 datasets, `dimensions` 0..3 (the chip's GDIMS; default both axes), `wait` 0 (default) / 2.8 / 5.6 / 8.4 / 14 / 22.4 / 30.8 / 39.2 ms between gesture cycles, `exit_mask` 0..15 (photodiodes left out of the exit test), `exit_persistence` 1 / 2 / 4 / 7; keyword-only. The getter returns the seven values in that order |
| `gs.thresholds([*, als=(low, high, persistence), proximity=(low, high, persistence)])` | the window flags read by `status()` (not verified on hardware: the driver does not enable the chip's threshold interrupts, AIEN / PIEN, so the flags may never set): clear-channel counts 0..65535 with persistence 0, 1, 2, 3, 5, 10 .. 60 cycles; proximity 0..255 with persistence 0..15; keyword-only. The getter returns the six values in one flat tuple `(als_low, als_high, als_persistence, prox_low, prox_high, prox_persistence)` |
| `gs.clear_interrupts()` | clear the threshold flags `status()` reports |
| `gs.offsets([prox_ur, prox_dl, g_up, g_down, g_left, g_right])` | the chip's proximity and gesture offset registers, six sign/magnitude bytes 0..255 (bit 7 = negative); pass all six or none (any other count raises `TypeError`) |
| `gs.photodiodes([mask], [compensate])` | proximity photodiode masking: `mask` 0..15, a set bit turns a diode off (bit 3 up, 2 down, 1 left, 0 right); `compensate` turns the chip's gain compensation for masked diodes on. With neither given it returns `(mask, compensate)` |
| `gs.wait_time([ms])` | pause between colour / proximity cycles, 0 (default, off) .. 8540 ms; returns the value actually set (the int `0` when off) |
| `gs.id()`, `gs.close()` | part ID (0xAB, or 0xA8 on the alternate part the EVN module carries); power the chip down and free the port |

**Example**

```python
from evn import GestureSensor
gs = GestureSensor(7)
g = gs.read_gesture(timeout=10000)
if g == 'left':
    print("swiped left")
```

**Notes**

Every setter returns only once a sample under the new setting exists, and a value out of range raises `ValueError` naming the allowed values. `gain()` and `pulses()` given several keywords apply them one after another, each with its own wait.

The constructor raises `OSError` when nothing answers on the port, every reading raises `OSError("gesture sensor on port N not responding")` while the module is unplugged (the settings getters and `id()` read the stored configuration and do not) (it re-attaches with the settings kept), and after `close()` every call raises `ValueError("gesture sensor is closed")` — except `detectable_colors()`, which keeps working, and `close()` itself, which does nothing.

## TouchArray — capacitive touch array (MPR121)

Plug the EVN touch module (or any MPR121 breakout at 0x5A) into an I2C port; only SDA and SCL are used. Twelve electrodes, 0..11, plus a proximity channel 12 that sums several electrodes when you turn it on.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `ta = TouchArray(port)` | `port` 1..16. Resets the chip, writes its configuration, runs auto-configuration and returns after the first touch status (≈ 55 ms). `OSError("no MPR121 on port N (I2C 0x5a)")` if nothing answers there, `OSError(EIO)` when all four touch-array slots are taken, `OSError(ETIMEDOUT)` if no first sample arrives. Defaults: 12 electrodes, proximity off, thresholds touch 12 / release 6 on electrodes 0..11 and 8 / 5 on the proximity channel 12, debounce 0, auto-configuration on for 3.3 V |

### Reading touches

| Call | Notes |
| :--- | :--- |
| `ta.touched()` | bitmask of touched channels, bit n = electrode n, bit 12 = proximity |
| `ta.read(channel)` | `True` while that channel is touched; `channel` 0..12 (12 = proximity), else `ValueError` |
| `ta.pressed()` | `True` while any electrode 0..11 is touched (the proximity channel is not counted) |
| `ta.proximity()` | `True` while the proximity channel 12 detects something; it stays `False` until `ta.electrodes(..., proximity=1\|2\|3)` turns the channel on |
| `ta.events()` | `(pressed_mask, released_mask)`: every channel pressed and released since the previous call (read and clear), so no short tap is missed between two reads |
| `ta.data(channel)` | `(filtered, baseline)` 10-bit counts of one channel 0..12, refreshed every 50 ms. A touch pulls `filtered` below `baseline`: a bare finger by ≈ 480–560 counts, a hand 1 cm above by at most 6 |
| `ta.age()` | ms since the latest touch status was read (≤ 5 ms at the defaults) |

### Settings

| Call | Notes |
| :--- | :--- |
| `ta.thresholds([channel])`, `ta.thresholds(touch, release, *, channel=None)` | the touch and release deltas below the baseline, in counts 0..255 (default 12 / 6 on electrodes 0..11, 8 / 5 on the proximity channel 12). `ta.thresholds()` → channel 0's `(touch, release)` (the pair an all-channel set gives every channel); `ta.thresholds(3)` or `ta.thresholds(channel=3)` → channel 3's pair — **one bare number is the channel to read**, not `touch`. `ta.thresholds(12, 6)` or `ta.thresholds(touch=12, release=6)` sets every channel **including the proximity channel 12**; add `channel=n` to set one. A value left out is taken from channel 0 (or the `channel=` given) and applied to every channel set, so `ta.thresholds(touch=20)` also gives channel 12 channel 0's release of 6. `ta.thresholds(3, channel=2)` is ambiguous and raises `TypeError` |
| `ta.debounce([touch, release])` | consecutive samples, 0..7 each (default 0, 0), before a touch / release is reported; the getter returns `(touch, release)`. Pass both or neither (one argument raises `TypeError`) |
| `ta.electrodes([count], [proximity])` | electrodes 0..count-1 are scanned, `count` 1..12 (default 12); `proximity` 0 off (default), 1 = electrodes 0–1, 2 = 0–3, 3 = 0–11 summed as channel 12. The getter returns `(count, proximity)`; a value left out keeps the current one, so `ta.electrodes(proximity=3)` keeps the count |
| `ta.sampling([first, second, interval_ms])` | the chip's two filters and sample interval: `first` 6 (default) / 10 / 18 / 34 samples, `second` 4 (default) / 6 / 10 / 18, `interval_ms` 1 (default) / 2 / 4 / 8 / 16 / 32 / 64 / 128. The touch status updates every `second × interval_ms` (4 ms at the defaults). The getter returns the three values; pass all three or none |
| `ta.charge([current_uA, time_us])` | the global charge current 0..63 µA (default 16) and time 0 / 0.5 (default) / 1 / 2 / 4 / 8 / 16 / 32 µs. This is what the electrodes run at while auto-configuration is off; with it on, the chip searches a charge per electrode at every start and this is only the search's fallback. The getter returns `(current_uA, time_us)` |
| `ta.autoconfig([enable], reconfig=enable, vdd=None)` | auto-configuration of the charge per electrode at every start (`enable`) and re-configuration when an electrode drifts out of range (`reconfig`, follows `enable` unless given). `vdd` 1.71..3.6 V recomputes the target levels; left out, the current levels stay (those for 3.3 V at start-up). `ta.autoconfig(False)` means no automatic charge change at all, so `charge()` applies; `ta.autoconfig(False, reconfig=True)` is the datasheet's manual charge with out-of-range recovery. The getter returns `(enabled, reconfig, usl, tl, lsl)`, default `(True, True, 202, 182, 131)` |
| `ta.out_of_range()` | bitmask of channels whose auto-configuration failed (0 on a healthy module) |
| `ta.overcurrent()` | `True` if an over-current fault has been seen since the object was opened or `clear_overcurrent()` was called. The driver recovers from the fault by itself (clear, reset, reconfigure), which clears the chip's own flag, so without this count a program that was not reading at that instant would never see it |
| `ta.clear_overcurrent()` | resets that count and runs the chip's recovery again (reset and full reconfiguration, settings kept); returns with the first sample |
| `ta.close()` | stop the chip and free the port |

**Example** — proximity with the whole array summed, e.g. a hand hovering over the module:

```python
from evn import TouchArray, wait
ta = TouchArray(9)
ta.electrodes(12, proximity=3)
while not ta.proximity():
    wait(10)
```

**Notes**

Every setter (`thresholds()`, `debounce()`, `electrodes()`, `sampling()`, `charge()`, `autoconfig()`) stops the chip, rewrites its configuration, restarts it and returns only once a sample under the new setting exists: ≈ 52 ms at the 4 ms status period, longer at a slower `sampling()` (≈ 171 ms at 64 ms). A changed setting also clears the per-electrode charge values auto-configuration wrote, so the next start searches afresh. `data()` raises `OSError` until the first 50 ms data read after the constructor or a setter.

The constructor raises `OSError` when nothing answers on the port, every getter raises `OSError("touch array on port N not responding")` while the module is unplugged (it re-attaches by itself with the settings kept), and after `close()` every call raises `ValueError("touch array is closed")` — except `clear_overcurrent()`, which raises the `OSError` above, and `close()` itself, which does nothing.

## EnvSensor — temperature, pressure and humidity (BME280)

Plug the EVN environment sensor module (or any BME280 board at 0x76) into an I2C port; only SDA and SCL are used. Keep the small vent hole in the metal can uncovered: a fingertip or a mounting pressing on it reads about 100 Pa high until it is lifted.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `env = EnvSensor(port)` | `port` 1..16; `OSError("no BME280 on port N (I2C 0x76)")` if no chip with ID 0x60 answers, `OSError(EIO)` when all 4 EnvSensor slots are in use, `OSError(ETIMEDOUT)` if the first measurement never arrives. Resets the chip, reads its trimming data and returns with the first measurement (≈ 60 ms). Defaults: the datasheet's "indoor navigation" setting — oversampling temperature ×2, pressure ×16, humidity ×1, IIR filter 16, normal mode with 0.5 ms standby (0.6 Pa RMS pressure noise on the bench) |

### Readings

| Call | Notes |
| :--- | :--- |
| `env.temperature()` | °C (float), or `None` while the temperature channel is skipped |
| `env.pressure()` | Pa (float; 101 325 Pa = 1013.25 hPa), or `None` while the pressure or the temperature channel is skipped |
| `env.humidity()` | % relative humidity (float), or `None` while the humidity or the temperature channel is skipped |
| `env.all()` | `(temperature, pressure, humidity)` from the same measurement (cached) |
| `env.read()` | waits for the **next** measurement and returns `(temperature, pressure, humidity)` — use this in a loop that should see a new sample each time. 40.5 ms at the defaults, the standby or the forced interval longer when those are set; `OSError` if none arrives within about two cycles |
| `env.raw()` | `(adc_t, adc_p, adc_h)`, the chip's uncompensated codes (a skipped channel reads 0x80000 / 0x8000) |
| `env.age()` | ms since the cached measurement was taken |

### Settings

| Call | Notes |
| :--- | :--- |
| `env.oversampling([temperature=, pressure=, humidity=])` | the getter returns `(temperature, pressure, humidity)` factors, default `(2, 16, 1)`. Set with keywords only (a positional value raises `TypeError`): 0 (skip the channel), 1, 2, 4, 8 or 16 each, anything else `ValueError`; a keyword left out keeps its channel, e.g. `env.oversampling(pressure=4)`. More oversampling = less noise and a longer measurement |
| `env.filter([c])` | the IIR filter coefficient: 0 (off), 2, 4, 8 or 16 (default); anything else `ValueError`. A higher coefficient smooths pressure and temperature but responds more slowly (≈ 0.9 s to 75 % at 16) |
| `env.standby([ms])` | the pause between measurements in normal mode, a float: 0.5 (default), 10, 20, 62.5, 125, 250, 500 or 1000 ms; anything else `ValueError`. Set while `forced()` is on, it is kept for when normal mode returns |
| `env.forced([ms])` | the forced-mode interval in ms, 0 = normal mode (default). `env.forced(100)` triggers one measurement every 100 ms from the board (0..2 000 000 ms, else `ValueError`); unlike normal mode it never repeats a sample and the chip sleeps in between. `env.forced(0)` returns to normal mode |
| `env.measurement_time()` | ms for one measurement at the current oversampling, the datasheet's **worst case** (46.1 ms at the defaults, 9.3 ms at ×1 / ×1 / ×1, 112.8 ms at ×16 each). Readings actually arrive at the typical time plus the standby, which is shorter (40.5 ms at the defaults, ≈ 24.7 per second) |
| `env.close()` | puts the chip to sleep and frees the port and its slot; a new `EnvSensor(port)` starts from the defaults again |

**Example**

```python
from evn import EnvSensor
env = EnvSensor(4)
t, p, h = env.all()
print(t, "C", p / 100, "hPa", h, "%")
```

**Notes**

Every setter (`oversampling()`, `filter()`, `standby()`, `forced()`) returns only once a measurement taken wholly under the **new** setting exists — about two measurement times (18–25 ms at ×1 / ×1 / ×1, ≈ 80 ms at the defaults), never a whole standby or forced interval — so a getter straight after it always answers. Skipping the temperature channel (`oversampling(temperature=0)`) makes all three values `None`: the pressure and humidity compensation need the temperature. `print(env)` shows the settings, e.g. `EnvSensor(4, oversampling=(2, 16, 1), filter=16, standby=500 us)`.

While the module is unplugged `temperature()`, `pressure()`, `humidity()`, `all()`, `read()`, `raw()` and `age()` raise `OSError("environment sensor on port N not responding")`; the settings getters still answer, and a replugged module comes back by itself (the driver re-probes every 250 ms) with the settings kept. After `close()` every call except `close()` itself raises `ValueError("environment sensor is closed")`.

## ADC — analogue-to-digital converter (ADS1115)

Plug the EVN ADC module (or any ADS1115 board at 0x48) into an I2C port; only SDA and SCL are used. Wire the signals to A0..A3 and **never put more than 3.6 V on a pin** (the module runs at 3.3 V; its inputs are limited to VDD + 0.3 V whatever the range).

Inputs are numbered as in the EVN Arduino `EVNADC`: 0..3 = A0..A3 against GND (single-ended), 4 = A0 − A1, 5 = A0 − A3, 6 = A1 − A3, 7 = A2 − A3 (differential, can read negative).

**Constructor**

| Call | Notes |
| :--- | :--- |
| `adc = ADC(port)` | `port` 1..16; `OSError("no ADS1115 on port N (I2C 0x48)")` if nothing passes the identity test (general-call reset, then Config = 8583h: the chip has no ID register), `OSError(EIO)` when all 4 ADC slots are in use, `OSError(ETIMEDOUT)` if the first conversion never arrives. Returns with the first conversion (8–9 ms). Defaults: input 0 scanned, **±4.096 V** (covers the module's 3.6 V inputs at 1.5× the resolution of 6.144 V; the Arduino default too), 860 samples per second |

### Readings

| Call | Notes |
| :--- | :--- |
| `adc.voltage([input])` | the latest conversion of `input` in volts (cached, no bus traffic). `input` is positional (`adc.voltage(2)`, not `input=2`); left out, it is the first input in `adc.inputs()`, or the `continuous()` input. An input that is not being converted raises `ValueError("input N is not enabled: see inputs()")`; outside 0..7 `ValueError("input must be 0..7")` |
| `adc.raw([input])` | the latest conversion as the chip's signed 16-bit code, −32768..32767; volts = code × range / 32768 (125 µV per count at ±4.096 V). A reading at or beyond full scale clips at 32767 / −32768 |
| `adc.read([input])` | waits for the **next** conversion of `input` and returns it in volts (the EVN Arduino `read(pin)`) — use this in a loop that should see a new sample each time. About 3 ms per call at 860 SPS with one input, 10.5 ms with four scanned, 151 ms at 8 SPS; `OSError("ADC on port N not responding")` if none arrives |
| `adc.age([input])` | ms since the cached conversion of `input` was taken (≤ 1 ms at 860 SPS, up to one cycle at slow rates) |

### Settings

| Call | Notes |
| :--- | :--- |
| `adc.inputs([seq])` | the inputs converted in turn, as a tuple in ascending order, default `(0,)`. Set with one int or a sequence, e.g. `adc.inputs((0, 1, 2, 3))` or `adc.inputs(4)`; the order given does not matter. Each scanned input costs one conversion per round, so N inputs are each refreshed N times slower. An empty sequence raises `ValueError("at least one input")` |
| `adc.range([volts])` | full scale ± volts: 6.144, 4.096 (default), 2.048, 1.024, 0.512 or 0.256; anything else raises `ValueError`. A smaller range gives finer steps but clips any input beyond it (and a signal whose peaks exceed the range is not averaged: it clips during the peaks) |
| `adc.data_rate([sps])` | samples per second: 8, 16, 32, 64, 128, 250, 475 or 860 (default); anything else raises `ValueError`. Slower rates are quieter (a steady 3.3 V: 0.18 mV standard deviation at 860, 0.00 mV at 8). The chip converts about 20 % slower than its nominal rate; the driver learns the margin per rate |
| `adc.continuous([input])` | the input being converted back to back, or `None` (default: scanning `inputs()`). `adc.continuous(0)` converts input 0 continuously at the data rate — the fastest single-input path (2.7 ms per `read()` at 860 SPS) — and makes it the only readable input; `adc.continuous(None)` returns to scanning `inputs()`. The chip has no data-ready flag in this mode, so a read can repeat or skip a conversion |
| `adc.close()` | powers the chip down and frees the port and its slot; a new `ADC(port)` starts from the defaults again |

**Example**

```python
from evn import ADC
adc = ADC(3)
adc.inputs((0, 1))                   # scan A0 and A1
print(adc.voltage(0), adc.voltage(1))
```

**Notes**

Every setter (`inputs()`, `range()`, `data_rate()`, `continuous()`) returns only once every converted input has a conversion under the **new** setting, so a getter straight after it always answers; the first sample after a setter costs one extra conversion (the one in flight is discarded). The driver scans in the background, one conversion per input per cycle, and `print(adc)` shows the settings, e.g. `ADC(3, inputs=0x01, range=4096 mV, data_rate=860)`.

While the module is unplugged `voltage()`, `raw()`, `read()` and `age()` raise `OSError("ADC on port N not responding")`; `inputs()`, `range()`, `data_rate()` and `continuous()` still return the settings, and a replugged module comes back by itself (the driver re-probes every 250 ms) with the settings kept. After `close()` every call except `close()` itself raises `ValueError("ADC is closed")`.
