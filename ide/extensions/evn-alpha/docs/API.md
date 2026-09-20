# EVN ALPHA MicroPython API reference (early access)

Everything a program needs comes from the `evn` module:

```python
from evn import Motor, Port, Stop, Direction, SpeedUnit, wait, StopWatch
```

The `Motor` class follows the Pybricks `Motor` reference (https://docs.pybricks.com/en/latest/pupdevices/motor.html) for names, argument order, keyword defaults and units, so that documentation reads across. Where the EVN ALPHA has something Pybricks does not, it is exposed under its own name (`control.evn()`), and nothing is accepted that would silently do nothing. The differences are listed at the end.

Units: angle **deg**, speed **deg/s**, acceleration **deg/s²**, time **ms**, duty **%**, torque **mNm**, voltage **mV**, PID gains **µNm/deg**, **µNm/(deg·s)**, **µNm/(deg/s)**. Measurements return `int`; `model.state()` returns floats.

## Motor

```python
Motor(port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None, speed_unit=SpeedUnit.DEG_S, *, model=None)
```

| Parameter | Meaning |
| :--- | :--- |
| `port` | EVN port number **1–4** (M1–M4). `Port.A`–`Port.D` are the same integers 1–4. A port already held by an open `Motor` raises `OSError(EBUSY)` until that object is `close()`d. |
| `positive_direction` | `Direction.CLOCKWISE` (physically clockwise looking at the shaft) or `Direction.COUNTERCLOCKWISE`, which flips angle, speed, load, duty and targets. |
| `gears` | `[12, 36]` or `[[12, 36], [20, 16, 40]]`; all values are then in output degrees, limits are divided by `control.scale`. |
| `reset_angle` | `True` zeroes `angle()` at construction; `False` keeps the count accumulated since power-on. |
| `profile` | position tolerance in degrees for `done()`, default 1 (two encoder edges: the controller lands inside its own 0.75° deadband). |
| `speed_unit` | `SpeedUnit.DEG_S` (default) or `SpeedUnit.PERCENT`: the unit of every speed this motor takes or reports (see *Speed in percent*). |
| `model` | keyword-only: `"EV3 Large"`, `"EV3 Medium"` or `"NXT"` (`"large"`, `"medium"`, `"nxt"` also work; an unknown name is `ValueError`). The motor **model** is the base of every gain and limit; `calibrate()` refines them for this motor and stores the record with the model. `None` (default) keeps the model the port runs: the one its stored calibration was made for, else the firmware's fallback (EV3 Large on ports 1–2, EV3 Medium on 3–4). Naming another model switches the port to that model's compiled defaults and prints a `WARNING` that the stored calibration (made for the other model) is not applied until `calibrate()` runs again. `print(m)` shows the model (`Motor(1, EV3 Large)`); `m.model` is the observer object below. |

`Port.A..D` = 1..4, `Direction.CLOCKWISE=0 / COUNTERCLOCKWISE=1`, `Stop.COAST=0 / BRAKE=1 / HOLD=2 / NONE=3 / COAST_SMART=4`, `SpeedUnit.DEG_S=0 / PERCENT=1`.

### Measuring

| Method | Returns |
| :--- | :--- |
| `angle()` | deg, 64-bit, never wraps |
| `reset_angle(angle=None)` | makes the current position read `angle`; with no argument it becomes the **0 reference** every later move counts from |
| `speed()` | deg/s (the controller's own estimate) |
| `load()` | mNm; positive opposes the motor in the positive direction |
| `stalled()` | `bool` — pushing as hard as it is allowed to (the voltage cap, or the `duty_limit` of `run_until_stalled`) and the shaft does not turn, for `control.stall_tolerances()` (Pybricks meaning) |
| `done()` | `True` when the axis is passive, or a profiled move has finished and the shaft is within `control.target_tolerances()`; `False` while `run()` is active |

### Stopping

| Method | Effect |
| :--- | :--- |
| `stop()` | coast |
| `brake()` | passive brake |
| `hold()` | actively hold the current angle |

### Running

| Method | Behaviour |
| :--- | :--- |
| `run(speed)` | constant speed until the next command, ramped at the acceleration limit (and the deceleration limit when slowing) |
| `dc(duty)` | open loop, −100..100 % |
| `run_time(speed, time, then=Stop.HOLD, wait=True)` | profiled move covering the distance a trapezoid of `speed` covers in `time` ms |
| `run_angle(speed, rotation_angle, then=Stop.HOLD, wait=True)` | relative move; negative `speed` reverses. Counts from the aim the motor is holding, so chained relative moves are exact (ten `run_angle(200, 90)` are 900°); from the measured angle after a coast, brake or stall |
| `run_target(speed, target_angle, then=Stop.HOLD, wait=True)` | absolute move; the sign of `speed` is ignored |
| `run_until_stalled(speed, then=Stop.COAST, duty_limit=None)` | `run(speed)` with the voltage capped at `duty_limit` % of `settings()`; returns the angle once `stalled()` is true, after the first 150 ms (the breakaway). **`duty_limit` is the stall force: the motor pushes up to that cap before the stall is reported, and without one it pushes with the whole pack** (an EV3 Large gripper closes hard — pass `duty_limit=30` or so for a gentle grip). Needs a real obstruction: an unloaded shaft creeps and the call does not return (Ctrl-C aborts); a `duty_limit` below the breakaway returns at once, where it stands. Breakaway on the reference rig: EV3 Medium ≈ 50 %, EV3 Large < 40 % |
| `track_target(target_angle)` | unprofiled position servo, the reference jumps to the target |

`then` is carried out by the motion engine when the profile completes, so it works with `wait=False` too:

| `then` | At the end of the profile |
| :--- | :--- |
| `Stop.HOLD` | keep regulating at the target (default) |
| `Stop.COAST` | release |
| `Stop.BRAKE` | passive brake |
| `Stop.NONE` | no deceleration phase: reach the target at speed and keep running until the next command; `done()` is `True` from the target on |
| `Stop.COAST_SMART` | release, and start the next relative move from this target |

`wait=True` polls every 2 ms; Ctrl-C and the user button keep working while a program waits.

### Speed in percent

With `speed_unit=SpeedUnit.PERCENT` (constructor) or `speed_unit(SpeedUnit.PERCENT)` (any time), every speed argument and result of that motor is a percentage of `full_speed()`: `run`, `run_time`, `run_angle`, `run_target`, `run_until_stalled`, `speed()`, the speed in `control.limits()`, `control.target_tolerances()` and `control.stall_tolerances()`. Accelerations stay in deg/s², `dc()` stays % duty.

| Method | Notes |
| :--- | :--- |
| `speed_unit()` / `speed_unit(unit)` | read or switch the unit; switching converts nothing, it changes how numbers are read and reported |
| `full_speed()` / `full_speed(deg_s)` | what 100 % means in deg/s **at the present battery voltage**. Default: the motor model's rated no-load speed (EV3 Large 1050, EV3 Medium 1560, NXT 1020 deg/s at 9 V) scaled by the pack voltage, i.e. the theoretical full speed. Setting it stores deg/s per volt, so 100 % keeps tracking the battery |
| `calibrate(wait=True)` | the ADRC self-calibration of this port (about 4.5 s, shaft free to turn): returns `(b0, tau_ms, v_break_mv, v_f_mv)`, stores the result in flash per port and makes the measured no-load speed this motor's 100 %. `calibrate(wait=False)` starts it and returns `None`; a later `calibrate()` on the same port joins it, so several ports calibrate together. Measured on the reference rig at 8.16 V: EV3 Large 967 deg/s, EV3 Medium 1560 |

The speed limit still applies, but a calibrated port's default limit is its measured no-load speed when that is above the model's default, so `run(100)` is not clamped (`control.limits()` reads 100 % on such a port).

### Settings

| Method | Notes |
| :--- | :--- |
| `settings(max_voltage, stall_timeout=)` / `settings() -> (max_voltage, stall_timeout)` | voltage cap in mV applied to every command, default 9000 (above any 2S pack, so no effect until lowered); `stall_timeout` ms (default 1000): a `wait=True` move returns once the motor has been stalled this long — the hold keeps pushing and `stalled()` is True, but the program is not stuck on a gripper closed on a brick; 0 waits forever (Pybricks) |
| `close()` | coast, free the port; later calls raise `RuntimeError`. `with Motor(1) as m:` closes on exit |

### `control`

| Method | Notes |
| :--- | :--- |
| `control.limits(speed, acceleration, torque)` / `control.limits()` | `speed` caps every speed argument. `acceleration` is a number or an `(accel, decel)` tuple in deg/s²: the profiler honours the two independently (ramp up at `accel`, down at `decel`; `run()` ramps at `decel` whenever the speed magnitude shrinks). The getter returns the tuple when they differ. `torque` (mNm) becomes an equivalent voltage cap through the motor model. New limits apply to the next command |
| `control.pid(kp, ki, kd, integral_deadzone, integral_limit)` / `control.pid()` | **PID law only** (`control.law("pid")`; the default `"adrc"` law is self-calibrated and ignores these). Pybricks units. `kd` is the cascade's velocity gain. `integral_deadzone` (deg, 0..5) is the endpoint deadzone (default 0.75). `integral_limit` (% duty, 0..100, default 20) is the largest contribution the integrator may make. Pybricks' `integral_rate` has no counterpart and is not accepted. Per motor object; the compiled per-model vector is untouched |
| `control.evn(endpoint_kd, start_duty, hold_duty, friction_ff)` / `control.evn()` | **PID law only**, like `control.pid()`. EVN ALPHA's own tuned parameters of that law, the getter returns the compiled per-model optimum. `endpoint_kd`: velocity gain inside the endpoint window. `start_duty` / `hold_duty` (% duty): stiction floors, breakaway push and least duty held near the target. `friction_ff` (%): Coulomb friction feed-forward |
| `control.target_tolerances(speed, position)` / `()` | the `done()` criterion; defaults 50 deg/s, 1 deg |
| `control.stall_tolerances(speed, time)` / `()` | stall detection speed and time; defaults 50 deg/s, 50 ms |
| `control.scale` | motor degrees per output degree (read-only) |
| `control.done()`, `control.stalled()`, `control.load()` | same as the motor methods |

Defaults from the validated firmware, at the motor shaft:

| | EV3 Large | EV3 Medium |
| :--- | :--- | :--- |
| speed limit | 1000 deg/s (or the calibrated no-load speed when higher) | 1400 deg/s (or the calibrated no-load speed when higher) |
| acceleration limit | 2400 deg/s² | 3000 deg/s² |
| torque limit | 449 mNm | 206 mNm |
| `control.pid()` | (73837, 295, 3692, 1, 20) | (31402, 184, 342, 1, 20) |
| `control.evn()` | (923, 12, 20, 50) | (170, 83, 50, 20) |

These are the fastest moves of the validation harness; the firmware also caps every move at what the calibrated motor can do at the present battery voltage, so a program never asks for a speed the battery cannot deliver. Higher limits are accepted but are outside the validated envelope.

### `model`

| Method | Notes |
| :--- | :--- |
| `model.state() -> (angle, speed, current, stalled)` | observer estimates: deg, deg/s, mA, flag |
| `model.settings()` / `model.settings(values)` | observer settings in firmware units; debug use |

## Board, battery, button, LED

| Call | Notes |
| :--- | :--- |
| `evn.version` | API version string |
| `evn.battery.voltage()`, `.cells()`, `.age()`, `.present()` | pack mV, `(cell1, cell2)` mV, age of the reading in ms |
| `evn.button.pressed()` | the user button; it is also the emergency stop (coast all) and, held 2 s, a reboot |
| `evn.led.on()`, `.off()`, `.toggle()`, `.set(bool)` | until a program touches the LED it is the board's heartbeat |
| `evn.stop_all()` | coast every motor |
| `evn.core1_status()` | `(ticks, period_min_us, period_max_us, exec_max_us, missed)` of the 1 kHz motion engine |
| `evn.reset_cause()` | `"watchdog"` after a watchdog reboot, else `"normal"` |
| `evn.reset(*, start=False)`, `evn.bootloader()` | reboot (`start=True`: that boot runs `main.py` at once instead of waiting for the user button); reboot into the RPI-RP2 drive |
| `evn.autostart([on])` | whether `main.py` starts at boot without the user-button press (default `False`, reset at every boot and soft reboot); set it in `boot.py` |
| `evn.Servo(1..4, profile=)` | bench-validated against a coupled encoder (2026-09-17); the Geekservo profiles are in the standard-peripherals table below. `Servo(port)` is the Geekservo 270° profile |
| `evn.UART(1\|2, baudrate=115200)` | `write(buf)` (every byte queued, never lossy), `read([n])`, `readline(timeout=5000)`, `any()`, `overflow()` (bytes the 256-byte receive ring dropped since the last call, read-and-clear), `flush_rx()`, `repl(True)` (the REPL on this port as well as USB), `close()` (releases the port — it keeps running and keeps its queued bytes — so a `Bluetooth` object or another `UART` at a different baud can take it; every later call raises `ValueError("UART is closed")`). One object per header: `UART(n)` raises `OSError` while an `evn.Bluetooth` object holds the port, `OSError("serial port %d is already open")` while another `UART` object does, and the other way round. Re-opening a port that is already open never resets it and never drops queued bytes |
| `evn.I2C(1..16)` | raw I2C through the board's multiplexers: `scan()` (never lists 0x70), `probe(addr)`, `readfrom(addr, n)` / `writeto(addr, buf)` (1..4096 bytes), `readfrom_mem` / `writeto_mem`, `stats() -> ((errors, recoveries, stuck), (...))` per bus. **0x70** (the multiplexers) is refused everywhere and **0x6A on port 16** (the battery charger) with `ValueError`. Errors: `OSError(ENODEV)` nothing answered, `OSError(EIO)` present but refused a byte, `OSError(ETIMEDOUT)` the bus was held and has been reset. The transaction deadline grows with the length (1 ms + 40 µs per byte, at least 5 ms), so a long transfer never times out by being long |

## Colour sensor (TCS34725, standard peripheral)

Plug an Adafruit TCS34725 breakout (or any TCS34725 board) into an I2C port; only SDA and SCL are used, the breakout's LED stays on.

| Call | Notes |
| :--- | :--- |
| `cs = ColorSensor(port)` | `port` 1..16; `OSError` if nothing answers at 0x29. Returns after the first reading (≈ 12 ms). Same defaults as the EVN Arduino library: 2.4 ms integration, gain 16× |
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
| `cs.ranges(clear=(low, high), red=…, green=…, blue=…)`, `cs.ranges()` | calibration: the raw count you measured on the darkest and brightest surface per channel (`None` clears one) |
| `cs.normalized()` | `(clear, red, green, blue)` mapped 0..100 between each channel's calibration low and high; `cs.hsv(normalized=True)` uses these (white balance) |
| `cs.gain([x])` | 1, 4, 16 (default) or 60 |
| `cs.integration_time([ms])` | 2.4 (default) .. 614.4 in 2.4 ms steps; longer = more resolution, slower |
| `cs.wait_time([ms])` | pause between readings, 0 (default) .. 7372.8 |
| `cs.thresholds([low, high, persistence])`, `cs.interrupt()`, `cs.clear_interrupt()` | the chip's clear-channel window flag |
| `cs.id()`, `cs.close()` | part ID (0x44); sleep the sensor and free the port |

**Bench-validated 2026-09-17** on three TCS34725 sensors at once: every setting and derived value against the datasheet, `age` ≤ 5 ms with three attached, hot-plug with the settings re-applied.

Every setter (`gain()`, `integration_time()`, `wait_time()`, `thresholds()`) returns only once a sample measured **under the new setting** exists. `interrupt()` reads `True` as soon as `thresholds()` has been called at the default persistence of 0 ("every cycle"): pass a persistence of 1 or more for a flag that means "the clear count left the window".

## Standard peripherals (all bench-validated)

Every device below is an *EVN Standard Peripheral*: plug it in, name the port, read. The firmware identifies the chip, configures it, keeps the latest reading in a cache refreshed in the background (reading adds no bus traffic of its own; the refresh runs at up to 1 kHz inside waits, prints and the getters themselves) and re-attaches it after an unplug. `docs/STANDARD_PERIPHERALS.md` in the firmware repository is the full reference with a function-by-function comparison to the EVN Arduino classes, and §1 there carries the validation date of each device — **all fifteen have now been on hardware** (colour sensor, distance sensor, gesture sensor, environment sensor, compass, seven-segment display and OLED 2026-09-17; ADC, touch array, IMU, LED matrix, RGB LED module 2026-09-18; the Bluetooth module and both Geekservo profiles 2026-09-17), and the firmware in this package includes them.

Blocks exist for every one of them (**EVN: Open blocks reference**, `docs/BLOCKS.md`), with four block examples in `examples/blocks/`: `colour_line`, `spirit_level`, `compass_lights` and `bluetooth_grabber`.

Every constructor raises `OSError` when nothing answers on the port or the driver pool is full, every getter raises `OSError` while the device is unplugged, and every call after `close()` raises `ValueError("<Class> is closed")`.

| Class | Device | Main calls |
| :--- | :--- | :--- |
| `ADC(port)` | ADS1115 16-bit ADC (I2C, 0x48) | `voltage(input)`, `read(input)` (waits for the next conversion), `raw(input)`, `inputs((0, 1, 2, 3))`, `range(4.096)`, `data_rate(860)`, `continuous(0)`, `age(input)`, `close()`. Inputs 0..3 single-ended, 4..7 differential; defaults input 0, **±4.096 V** (the 3.3 V module's inputs never exceed 3.6 V, so this covers them at 1.5× the resolution of 6.144 V), 860 SPS. A setter waits for a sample under the new setting, so the first reading after it costs one extra conversion. Never put more than 3.6 V on a pin |
| `EnvSensor(port)` | BME280 temperature / pressure / humidity (I2C, 0x76) | `temperature()` °C, `pressure()` Pa, `humidity()` %, `all()`, `read()`, `raw()`, `oversampling(temperature=2, pressure=16, humidity=1)`, `filter(16)`, `standby(0.5)`, `forced(100)`, `measurement_time()`, `age()`, `close()`. In normal mode a reading arrives every measurement time plus the standby (40.5 ms at the defaults, ≈ 24.7 per second); `measurement_time()` is the datasheet's worst case, which is longer. Skipping the temperature channel makes all three values `None` |
| `Compass(port)` | QMC5883L / HMC5883L magnetometer (I2C, 0x0D / 0x1E) | `heading()` 0..360 clockwise, `north()`, `read()`, `field()` gauss, `raw()`, `axes(top='z', front='x')`, `data_rate()` / `range()` (floats on both chips), `oversampling()`, `overflow()`, `overrun()` (a measurement was lost before the last read — the QMC's DOR flag; always `False` on an HMC), `chip()`, `bias()` and `self_test(negative=False, raw=False)` (HMC only); calibration on the board: `calibrate()` → tumble the sensor (or `calibrate(planar=True)` and spin the robot) → `calibrate_stop()`; save `calibration()` and restore it with `calibration(offset, matrix)`. A refused `calibrate_stop()` raises `ValueError` and **keeps collecting** — turn more and stop again, or `calibrate_cancel()`. `bias()` needs `range(4.0)` or more (the strap saturates below it); use `self_test()`, which sets the gain itself |
| `TouchArray(port)` | MPR121 12-key capacitive touch (I2C, 0x5A) | `touched()` bitmask, `read(n)`, `pressed()`, `proximity()`, `events()` → `(pressed_mask, released_mask)`, `data(n)`, `electrodes(12, proximity=3)`, `debounce(2, 2)`, `sampling()`, `charge()`, `autoconfig()`, `out_of_range()`, `overcurrent()` (a fault seen since `open` / `clear_overcurrent()`; the driver recovers by itself, so it would otherwise be invisible), `age()`, `close()`. `thresholds()` → channel 0's `(touch, release)`, `thresholds(3)` → channel 3's pair, `thresholds(12, 6)` or `thresholds(touch=12, release=6)` sets every channel **including the proximity channel 12** (`channel=` sets one); `thresholds(3, channel=2)` raises `TypeError` |
| `GestureSensor(port)` | APDS-9960 gesture / proximity / colour (I2C, 0x39) | `gesture()` → `'up'`/`'down'`/`'left'`/`'right'`/`None`, `read_gesture(timeout=5000)` (a keyword; a negative timeout raises `ValueError`), `gesture_detail()`, `proximity()` 0..255, `color()`, `color_match()` (with its confidence), `hsv()`, `raw()`, `rgb()`, `ambient()`, `engines(colour=, proximity=, gesture=)`, `gain()`, `integration_time()`, `led()`, `pulses()`, `gesture_config()`, `thresholds()`, `status()` (the fifth flag, `in_gesture`, is the chip's `GCONF4.GMODE`), `offsets()`, `photodiodes()`, `wait_time()`, `close()`. While a hand is held still inside the gesture threshold the chip stays in gesture mode and `proximity()` / `raw()` stop updating (they raise `OSError("... is in gesture mode ...")` when there is no reading yet, e.g. a sensor lying face down at power-up): `engines(gesture=False)` to track a stationary object |
| `DistanceSensor(port)` | VL53L0X time-of-flight (I2C, 0x29) | `distance()` mm or `None`, `read()`, `status()`, `timing_budget(33)`, `profile('long_range')`, `raw()`, `close()` |
| `IMU(port)` | MPU-6500 gyro + accelerometer with DMP (I2C, 0x68) | `heading()` (keeps growing past ±180°, as Pybricks), `reset_heading()`, `up()` → `Side`, `stationary()`, `ready()`, `settings(heading_correction=)` (clamped 1..3600), `tilt()` → `(pitch, roll)`, both in (−180, 180] so an upside-down module is not read as level, `euler()`, `quaternion()`, `acceleration()` mm/s², `linear_acceleration()`, `angular_velocity()` deg/s, `gravity()`, `raw()`, `read()`, `temperature()`, `tap()`, `screen_orientation()` (each event once), `axes(top=, front=)`, `ranges()`, `filter(gyro=, accel=)`, `sample_rate()`, `dmp(enable, rate=None, …)` (`rate=None` keeps the rate in force) for raw readings + `calibrate_gyro()`, `close()`. The gyro filter values 250 Hz and 3600 Hz are refused (they select the chip's 8 kHz internal rate and break the DMP's time base). Every getter — `heading()` and `stationary()` included — raises while the module is unplugged. An `evn.I2C(port).scan()` of this port pops one FIFO byte (the driver heals it) |
| `MatrixLED(port, addr=0x71)` | EVN 8×8 LED matrix (HT16K33, I2C, 0x71) | `pixel(row, column)` (Pybricks order; `0` / `False` turns it off), `get()`, `icon(Icon.HEART)`, `image(rows)`, `number(-99..99)`, `char('A')`, `text('HI', on=500, off=50, wait=True)` (`on` must be ≥ 1 ms), `animate([Icon.HAPPY, Icon.SAD], 500)`, `animating()`, `stop()`, `hline()`, `vline()`, `rect()`, `bitmap(8 bytes)`, `orientation(Side.LEFT)` (or `invert_x=`/`invert_y=`/`swap_xy=`), `brightness(1..16)`, `blink(hz)`, `clear()`, `fill()`, `show()`, `raw()`, `keys()`, `on(enable=True)`/`off()`, `close()`. `addr` 0x71..0x77; **0x70 is refused** (it is the board's I2C multiplexer) |
| `SevenSegmentLED(port, addr=0x74)` | EVN 4-digit display (HT16K33, I2C, 0x74) | `number(12.34)` (an int outside −999..9999 raises `ValueError`, as does NaN or infinity), `integer(-42)`, `text("HELP")` (only letters with a seven-segment glyph), `digit(pos, n)`, `char(pos, 'A')`, `point(pos)`, `colon()`, `segments(pos, mask)`, `clear_position(pos)`, plus the shared `brightness()`, `blink()`, `on(enable=True)`/`off()`, `clear()`, `fill()`, `show()`, `raw()`, `keys()`, `close()`. `addr` 0x71..0x77, 0x70 refused |
| `Display(port, addr=0x3C)` | EVN 128×64 OLED (SSD1306/SSD1315, I2C, 0x3C) | `write(row, text)` (16 columns × 8 rows), `label(row, "Dist:")` + `data(row, value)`, `text(col, row, s, invert=False)` (a keyword; returns the number of characters written), `print(*args, sep=, end=)` (wraps and scrolls), `mirror(True)` (the REPL and every `print()` on the panel; dropped by Ctrl-D), `draw_text(x, y, s)`, `draw_circle()`, `draw_box(r=)`, `draw_line(width=)`, `draw_pixel()`, `width`/`height`, `clear()`, `clear_row()`, `pixel()`, `line()`, `rect()`, `frame()`, `splash()`, `show()`, `contrast()`, `flip()`, `invert()`, `on(enable=True)`/`off()`, `zoom(enable=True)`, `all_on(enable=True)`, `fade()`, `scroll()`, `scroll_stop()`, `command()`, `close()`. The panel's RAM may not be written while a hardware scroll runs, so drawing is held back: the first drawing call after `scroll()` stops it and repaints, and a new `scroll()` sends the stop first. `flip()` repaints the frame (the segment re-map only affects data written after it, SSD1306 §10.1.8). The constructor can take up to ≈ 740 ms on a panel that has just been plugged in |
| `RGBLED(servo_port, count=8, *, invert=False)` | EVN RGB LED module / WS2812B strip on a servo port | `on(Color.RED)` / `on([c0, c1, ...])`, `off()`, `blink(Color.BLUE, [500, 500])`, `animate([Color.RED, Color.GREEN], 250)` (background; every pattern step must be ≥ 2 ms, 1..16 entries), `pattern()`, `stop()`, `set(led, r, g, b)` or `set(led, Color.BLUE)`, `fill(...)`, `range(first, last, ...)`, `clear()`, `get(led)`, `brightness(0..255)`, `count(1..64)`, `invert()`, `show()`, `hsv(h, s, v)`, `close()`. `invert` is keyword-only. The servo port is borrowed until `close()`: `Servo(n)` raises while the strip is open, and `RGBLED(n)` raises while a `Servo` object holds the port. `close()` leaves the strip dark about a millisecond later |
| `Bluetooth(serial_port, baud=230400, name="EVN Bluetooth", mode="remote", addr=None, *, stay_in_command=False, wait=True)` | EVN Bluetooth (HC-05) on Serial 1 or 2 | hold the module's button while powering on to program it (name, baud, `mode='host'` with `addr='98d3,31,fd1234'` to bind); then `write(b"...")`, `read()` / `read(n, timeout=None)`, `readline(timeout=5000)` (the next line without its `b"\n"` / `b"\r"`, or `None` on timeout; bytes behind it stay buffered; `timeout=0` never waits; a negative timeout raises `ValueError`; a line longer than 255 bytes never completes and `overflow()` counts the drop), `read_all()`, `any()` / `waiting()`, `overflow()` (read-and-clear), `wait_until(b"OK")`, `clear()`, `set_baudrate()`; `state()`, `ready()`, `configured()` / `config_errors()`, `in_command_mode()`, `command()`, `address()`, `version()`, `exit_command_mode()`, `factory_reset()`, `startup_time()`, `close()`; two modules link with one as `mode='host'` bound to the other's `address()`; `repl(True)` puts the board's REPL on the module so the PC's Bluetooth COM port carries the prompt, Run and Stop (Getting started §5a). One object per serial header: `Bluetooth(n)` raises while an `evn.UART` object holds the port |
| `Servo(port)`, `Servo(port, "geekservo_cr")` | Geekservo 270° and continuous-rotation servos on servo port 1..4 | `Servo(port)` is the **Geekservo 270° profile** (the kit's servo): `angle(135)`, `move(270, speed=200)` (sweep, waits), `angle()`, `done()`; continuous: `duty(50)`, `stop()`; both: `reverse=True`, `range=`/`min_us=`/`max_us=`/`start=`/`max_dps=` overrides (keyword-only; `range=R` without `start=` starts at R/2), `profile()`, `pulse(us)`, `set_range()`, `enable()` / `disable()`, `close()` (gives the channel back — the pulse stops and the pin goes low — so an `RGBLED` strip or a new `Servo` object can take the port without a soft reset; every later call raises `ValueError("Servo is closed")`). `Servo(port, "generic")` is the 180° hobby-servo profile. A servo port pulses nothing until the first `Servo` object is built, and a new object drives its port even after `disable()` on an earlier one |

## DriveBase (two motors as a robot)

`evn.DriveBase` follows [`pybricks.robotics.DriveBase`](https://docs.pybricks.com/en/latest/robotics.html): two `Motor` objects, the wheel diameter and the axle track in mm. Distances are mm, speeds mm/s, accelerations mm/s²; headings are degrees, deg/s, deg/s², **positive = clockwise seen from above** (the `Pose` / compass convention). Each motor's `positive_direction` is its forward direction (a mirrored left motor: `Motor(4, Direction.COUNTERCLOCKWISE)`) and its `gears=` make the values wheel degrees.

```python
from evn import Motor, Direction, DriveBase, Stop
left, right = Motor(4, Direction.COUNTERCLOCKWISE), Motor(3)
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=170)
robot.straight(300); robot.turn(45); robot.arc(-150, angle=90)
robot.drive(200, 30); ...; robot.stop()
```

| Method | Meaning |
| :--- | :--- |
| `straight(distance, then=Stop.HOLD, wait=True)` | drive `distance` mm (negative = backwards). `then`: `HOLD`, `COAST`, `BRAKE`, `COAST_SMART` (the next relative move counts from this move's aim); `Stop.NONE` raises `ValueError` (use `drive()`). `wait=False` returns at once — poll `done()`. |
| `turn(angle, then, wait)` | turn in place by `angle` degrees, clockwise positive. |
| `arc(radius, distance=None, angle=None, then, wait)` | drive along a circle of `|radius|` mm on the right (positive radius) or left (negative) for `distance` mm of path **or** `angle` degrees of heading (one of the two); negative = backwards. |
| `curve(radius, angle, then, wait)` | the same circle with the older Pybricks signs: the angle's sign picks the side (positive = right), the radius's sign the direction (negative = backwards), so `curve(-r, a)` retraces `curve(r, a)`. |
| `drive(speed, turn_rate)` | mm/s along the path and deg/s of heading until the next command; both wheels ramp together (the path during the ramp is the steady-state arc), and if a wheel would exceed the weaker motor's limit both are scaled so the radius is kept. |
| `stop()` / `brake()` | coast / brake both wheels. |
| `distance()`, `angle()` | mm driven and degrees turned since `reset()`, from the two encoders (ints). |
| `state()` | `(distance, drive_speed, angle, turn_rate)` as floats. |
| `reset(distance=0, angle=0)` | start the readings again from these values. |
| `done()`, `stalled()` | both wheels finished (or passive) / either wheel stalled. With `use_gyro(True)`, `done()` also waits for the pose to settle. |
| `use_gyro(True)` / `use_gyro()` | close the loop over an `evn.Pose` built on the same two motors: the robot itself follows the path the program asked for — scrub on a turn, a dragged cable and the gyro's drift are corrected as they happen, at 200 Hz, instead of adding up over minutes. Needs the `Pose` running (an IMU on it for the heading). What the pose cannot see (a robot pushed sideways) is not corrected. |
| `follower(...)` / `follower()` | the loop's knobs: `b` (400), `zeta` (0.7), `k_min` (4), `correction_speed` (150 mm/s), `correction_rate` (90 deg/s), `trim_limit` (180°), `trim_slew` (600 deg/s), `position_tolerance` (1 mm), `heading_tolerance` (0.3°), `settle_time` (100 ms). |
| `pose_error()` | `(forward mm, left mm, heading deg, settled, trim_left, trim_right)`: where the ideal robot is, seen from the pose. |
| `settings(straight_speed, straight_acceleration, turn_rate, turn_acceleration)` / `settings()` | mm/s, mm/s², deg/s, deg/s²; an acceleration may be `(accel, decel)`. **Defaults: the weaker motor's `control.limits()`, the straight acceleration at 75 % of it** — about 770 mm/s, 1230 mm/s², 520 deg/s, 1100 deg/s² on two EV3 Mediums with 62.4 mm wheels 170 mm apart. At the full 1630 mm/s² five 30 cm out-and-backs left the robot 8 mm off its floor mark from tyre slip the encoders cannot see; at 1230 and below it came back within 1–3 mm, and the turns showed no such dependence. Lower them further for a heavier robot or a slick floor; a value above the motor's limit is clamped to it. |
| `close()` | coast both wheels and release them (the `Motor` objects stay open). A new `DriveBase` on a motor that still belongs to one takes the pair over. |

**How it drives.** A maneuver is two profiled moves on one time base: the wheel with the longer travel gets the maneuver's speed and acceleration, the other the same numbers scaled by the ratio of the travels, both started on the same 1 kHz tick — so a straight is straight and an arc is an arc, and each wheel then tracks its own reference with the calibrated controller (endpoints within 1°, the two profiles ending within 5 ms of each other on the reference robot). There is no gyro in the loop: a `Pose` built on the same ports gives you the position and heading, and the axle track that matters is the effective one between the tyres' contact patches — measure it with one `turn(360)` against a floor mark. A direct `Motor` command on one wheel while a maneuver runs coasts the other wheel (Pybricks). A maneuver started while the robot is still moving lets each wheel blend from its own speed for one ramp; the endpoints stay exact.

## Pose (pose estimator)

`evn.Pose` estimates the robot's planar pose from any subset of the two drive encoders, an `IMU` and a `Compass` — all eight combinations work; the sources not attached are simply left out. One object per robot (`OSError` for a second one until `close()`); every call after `close()` raises `ValueError("Pose is closed")`.

```python
Pose(left=None, right=None, wheel_diameter=None, axle_track=None, *, gear_ratio=1.0, imu=None, compass=None, reverse_left=False, reverse_right=False, declination=0.0, imu_offset=None)
```

| Parameter | Meaning |
| :--- | :--- |
| `left`, `right` | motor ports 1–4 of the two drive wheels; both or neither |
| `wheel_diameter`, `axle_track` | mm, both or neither, with the ports. The axle track that matters is the **effective** one (between the two contact patches as the robot really turns), see `settings()` |
| `gear_ratio` | motor turns per wheel turn |
| `imu`, `compass` | the I2C ports of existing `IMU` / `Compass` objects (`OSError` if no object is on that port; the compass counts once a calibration is installed). Set the module's `axes(top=, front=)` from its silkscreen **before** building the `Pose` — the filter takes the body frame those objects publish |
| `reverse_left`, `reverse_right` | that motor's positive direction is backwards (a mirrored mount) |
| `declination` | degrees added to the compass heading |
| `imu_offset` | `(x_mm, y_mm)`: where the IMU sits, forward and left of the axle mid-point (`(-50, 60)` is 50 mm behind, 60 mm left); a tape-measure value is enough. Needs `imu=` and **no motor ports** (`ValueError` with wheels: the accelerometer is not used then) |

Frames: `x` East / `y` North in mm (without a compass, `x` is +90° from the heading at `reset()`), heading clockwise from north in degrees, speed mm/s, yaw rate deg/s clockwise.

| Method | Notes |
| :--- | :--- |
| `position() -> (x, y)` | mm |
| `heading()` | degrees clockwise from north, 0..360 |
| `velocity() -> (speed, yaw_rate)` | mm/s, deg/s clockwise |
| `state() -> (x, y, heading, speed, yaw_rate)` | the five above in one call |
| `covariance() -> (sigma_x, sigma_y, sigma_heading)` | mm, mm, degrees: the filter's own uncertainty |
| `parameters() -> (r_left, r_right, track)` | mm, as the filter estimates them (they only move with turns) |
| `settings() -> (wheel_diameter, axle_track)` / `settings(wheel_diameter=, axle_track=)` | read or apply a calibrated geometry in mm (1..1000 / 1..2000). Measure the effective track with one commanded 360° turn against a floor mark: `t_eff = t * turned_by_the_encoders / 360`. The pose, the heading and the gyro bias are kept; **not stored** — a power cycle brings back the constructor's numbers, so a program sets it at start-up. The setter raises `ValueError` without motor ports |
| `bounded()` | `False` while the live sources cannot bound the position (IMU alone, IMU + compass, none) |
| `sources()` / `configured()` | the sources live right now / the ones the object was built with: subsets of `('wheels', 'imu', 'compass')`. A source whose driver is lost leaves the set by itself and rejoins when running |
| `reset(x=0, y=0, heading=0)` | set the pose (mm, mm, degrees clockwise from north); biases and wheel parameters are kept |
| `close()` | release the estimator |

Bench diagnostics, not for programs: `_stats()` (seven counters: steps, rejected wheel / lateral / magnetometer updates, the yaw-rate row's reject run near rest, wheel-gate escapes taken, steps with a stale IMU), `_bias()` (the filter's gyro bias and its sigma in deg/s, counter-clockwise positive — the filter's frame, not the heading's) and `_step(...)` (one filter step on SI values, for a `Pose(_test=True)` object).

## Timing

| Call | Notes |
| :--- | :--- |
| `evn.wait(ms)` | pause the program; motors keep doing what they were told |
| `evn.StopWatch()` | `time()` ms since construction, `pause()`, `resume()`, `reset()` |

## Files and `main.py`

An 11 MB file system is mounted at `/`. `open()`, `import`, `os` and `vfs` work as in MicroPython. `boot.py` runs at power-on and after Ctrl-D; `main.py` then waits for a press of the user button (LED blinking fast) and runs again at the next press once it has ended. Anything typed at the port during the wait (the extension's own connections, `mpremote`) gives the REPL instead, so a session never runs `main.py`; with the extension's live console attached, only *Upload and run now* starts it. When `main.py` ends, every motor coasts. `evn.autostart(True)` in `boot.py` starts it without the press; `evn.reset(start=True)` does so for one boot. Hold the user button while powering on to skip `main.py` once; after a watchdog reboot it is skipped automatically. A file write pauses the motion engine for its duration (tens of ms): write while the motors are idle.

## Safety behaviour

- **Ctrl-C** coasts all four motors, whether a program is running or not. Connecting `mpremote` (which every extension command does) sends Ctrl-C too.
- **Ctrl-D** (soft reboot) coasts all motors.
- The **user button** coasts all motors; held 2 s it reboots the board.
- A 3 s hardware **watchdog** reboots a frozen board; motors coast on reset and `main.py` is skipped on that boot.
- At the REPL, motors keep their last command when a program ends: `stop()` or `close()` them, or use `with Motor(1) as m:`.

## Deviations from Pybricks

| Topic | Pybricks | EVN ALPHA |
| :--- | :--- | :--- |
| `Motor(port)` | `Port.A`..`Port.D` | port numbers 1..4 (`Port.A`..`D` exist as the same integers) |
| `Motor(port)` model | the motor identifies itself over the port | `model="EV3 Medium"` / `"EV3 Large"` / `"NXT"` (keyword-only) names it; without it the port keeps the model its stored calibration was made for, else the firmware's fallback (EV3 Large on 1-2, EV3 Medium on 3-4). The gain base is the model, never the port; `calibrate()` stores its record with the model, so nothing is re-run at boot |
| `reset_angle()` with no argument | resets to the absolute marker angle | makes the current position 0 (EV3/NXT encoders have no absolute marker) |
| `speed(window)` | averages over `window` ms | `speed()` only; the controller's own estimate is reported |
| `control.pid()` `integral_rate` | caps integral growth | not offered; `integral_limit` and `integral_deadzone` are the real anti-windup knobs |
| `control.pid()` units | torque controller | converted through the nominal pack voltage and the model's torque constant; EVN-specific terms live in `control.evn()` |
| `run_until_stalled` | any obstruction; `duty_limit` is the stall torque | the same: the stall is reported once the drive sits at `duty_limit` (or the pack) and the shaft does not turn; the first 150 ms of a move are ignored |
| Absolute angle range | unbounded | unbounded (64-bit) |
| `settings()` | may return more fields | `(max_voltage,)` |
| Program end | motors stop | motors keep their last command at the REPL; Ctrl-C, Ctrl-D, `evn.stop_all()` and connecting a tool coast them |
