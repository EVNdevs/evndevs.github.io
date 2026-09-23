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
| `model` | keyword-only: `"EV3 Large"`, `"EV3 Medium"`, `"NXT"` or `"JGA25-370 6V 77RPM"` (`"large"`, `"medium"`, `"nxt"`, `"jga25"` also work; an unknown name is `ValueError`). The motor **model** is the base of every gain and limit; `calibrate()` refines them for this motor and stores the record with the model. `None` (default) keeps the motor the port runs: the one it was **configured** for (`evn.configure_motor()` or the extension's Board view, stored on the board — a standard model or a custom motor), else the one its stored calibration was made for, else the firmware's fallback (EV3 Large on ports 1–2, EV3 Medium on 3–4). Naming another model switches the port to that model's compiled defaults and prints a `WARNING` that the stored calibration (made for the other model) is not applied until `calibrate()` runs again. `print(m)` shows the model (`Motor(1, EV3 Large)`); `m.model` is the observer object below. |

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
| `run_time(speed, time, then=Stop.HOLD, wait=True)` | a timed maneuver: it takes `time` ms, then `then` (Pybricks). The distance is what a trapezoid of `speed` covers in `time` at the speed and acceleration the controller will actually allow at the present pack voltage, so a limit shortens the distance, never the duration; `speed` 0 is a timed hold of the measured angle (`done()` False until `time` has passed). `time` is 0..2147483647 ms (24.8 days): a negative or longer value raises `ValueError` (B-035: `run_time(0, 10**10)` used to be done at once). The exact bound holds for an int; a float `time` is exact only below about 2147483520 (32-bit floats: `2147483647.0` rounds to 2147483648 and is refused, the message says why) |
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
| `Stop.COAST_SMART` | release, and start the next relative move from this target — only while the shaft still stands within twice the position tolerance (`control.target_tolerances()`, 2° by default) of it, as in Pybricks; a shaft moved further while coasting (a slope, a hand, an unwinding gearbox) starts from where it is |

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
| `control.pid(kp, ki, kd, integral_deadzone, integral_limit)` / `control.pid()` | **PID law only** (`control.law("pid")`; the default `"adrc"` law is self-calibrated and ignores these). Pybricks units. `kd` is the cascade's velocity gain. `integral_deadzone` (deg, 0..5) is the endpoint deadzone (default 0.75) and reads back as a float in degrees — the one non-int in the getter's tuple, since its useful values are fractions of a degree (0.5 = one encoder edge). `integral_limit` (% duty, 0..100, default 20) is the largest contribution the integrator may make. Pybricks' `integral_rate` has no counterpart and is not accepted. Per motor object; the compiled per-model vector is untouched |
| `control.evn(endpoint_kd, start_duty, hold_duty, friction_ff)` / `control.evn()` | **PID law only**, like `control.pid()`. EVN ALPHA's own tuned parameters of that law, the getter returns the compiled per-model optimum. `endpoint_kd`: velocity gain inside the endpoint window. `start_duty` / `hold_duty` (% duty): stiction floors, breakaway push and least duty held near the target. `friction_ff` (%): Coulomb friction feed-forward |
| `control.target_tolerances(speed, position)` / `()` | the `done()` criterion; defaults 50 deg/s, 1 deg. Both read back as floats — what was set (`position=0.25` reads 0.25; it used to read 0) |
| `control.stall_tolerances(speed, time)` / `()` | stall detection speed and time; defaults 50 deg/s, 50 ms. The speed reads back as a float, the time as int ms |
| `control.scale` | motor degrees per output degree (read-only) |
| `control.done()`, `control.stalled()`, `control.load()` | same as the motor methods |
| `control.state()` | `(reference_deg, x1_deg, x2_degs, x3_degs2, applied_mv, hold, assist)`: the position reference, the ADRC observer's position / speed / total-disturbance estimates (output units; `x3` is the unmodelled acceleration being cancelled — `load()` is it through the torque constant), the voltage applied last tick, and whether the observer is at its hold bandwidth / the breakaway assist is armed. A 1 kHz diagnostic for tuning and benches. `model.state()` (below) is the legacy Luenberger observer, not this estimator |

Defaults from the validated firmware, at the motor shaft:

| | EV3 Large | EV3 Medium |
| :--- | :--- | :--- |
| speed limit | 1000 deg/s (or the calibrated no-load speed when higher) | 1400 deg/s (or the calibrated no-load speed when higher) |
| acceleration limit | 2400 deg/s² | 3000 deg/s² |
| torque limit | 449 mNm | 206 mNm |
| `control.pid()` | (73837, 295, 3692, 0.75, 20) | (31402, 184, 342, 0.75, 20) |
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
| `evn.configure_motor(port, model, *, counts_per_rev=, rated_voltage=0, no_load_speed=0)` | say what is on a motor port and **store it on the board**, so a plain `Motor(port)` runs that motor from any host and after every reboot (the extension's Board view gear does this). `model`: a library motor — `"EV3 Large"` / `"EV3 Medium"` / `"NXT"` / `"JGA25-370 6V 77RPM"` (a 6 V, 77 rpm, 1:78 gearmotor with an 11 cpr hall encoder: 3432 counts per revolution, the port capped at 6 V, EV3 Large control class) — or `"custom"` for any other DC motor with a quadrature encoder — `counts_per_rev` = encoder edges per **output** revolution (one channel's pulses × 4 × the gear ratio; a LEGO motor is 720), `rated_voltage` in mV (the port's voltage cap; 0 = none), `no_load_speed` in deg/s at the rated voltage (0 = not known; it is the speed limit, 100 % and the control's first guess until `calibrate()` measures the motor, which is on the EV3 Large control class, or the EV3 Medium class from 1300 deg/s). `None` removes the configuration (back to the fallback). **A change to a different motor clears the port's calibration** — the old motor's numbers must not run the new one — so `calibrate()` afterwards; `print(Motor(3))` shows `Motor(3, custom)` and the constructor warns once that a custom motor is not calibrated. Nothing moves; the port must be free (`OSError(EBUSY)` while a Motor holds it) and every motor stopped (a flash write); `RuntimeError` says why a refusal changed nothing |
| `evn.motor_config(port)` | `{"port", "model", "custom", "control_class", "counts_per_rev", "rated_voltage", "no_load_speed", "stored", "session"}` — what the port runs now: `control_class` is the standard model the control starts from (a custom motor's, or a library motor's own — the JGA25 runs the EV3 Large class), `rated_voltage` the port's voltage cap (a custom motor's rated voltage, the JGA25's 6000; 0 for a LEGO motor), `no_load_speed` at that voltage (at 9 V when uncapped); `session`: a program's `Motor(port, model=)` runs a library model in place of the stored motor until the next reboot |
| `evn.calibration(port)` | `{"port", "calibrated", "busy", "stored", "stamp", "b0", "tau_ms", "v_break_mv", "v_f_mv", "no_load_speed", "vbus_mv", "encoder_reversed", "warning", "error"}` — the calibration the port runs. `stamp` is seconds since 1970 UTC when it was made, 0 when the board's clock was not set then (the extension's console sets the clock at connect, so a calibration run from the Board view carries its date; a bare program's `calibrate()` does not). `encoder_reversed` is True when the calibration found the encoder counting **against** the drive (a non-LEGO motor wired the other way round, such as the JGA25 on the EVN cable) and flipped the port's decoder: the flip is stored with the record, comes back at boot, and goes when the record is cleared or the motor changed — until a custom or JGA25 motor is calibrated the firmware only has the wiring convention for it, so calibrate before the first closed-loop move. The flip belongs to the port's record, not to the motor: swapping a LEGO motor onto a port whose record says *reversed* without changing the port's configuration would run it flipped (positive feedback) — change the motor in the Board view (which clears the record) or `clear_calibration(port)` first |
| `evn.clock([seconds])` | the board's wall clock as seconds since 1970 UTC, 0 until a host sets it (no battery-backed clock); with an argument it is set first (2025..2105). The extension's console sets it at every connect; a calibration record's `stamp` is this clock |
| `evn.clear_calibration(port)` | forget the port's calibration (record and running numbers): back to the motor's compiled defaults as if `calibrate()` had never run. Same rules as `configure_motor` |
| `evn.core1_status()` | `(ticks, period_min_us, period_max_us, exec_max_us, missed, late)` of the 1 kHz motion engine — `missed` = deadlines the alarm ISR skipped (a flash lockout gap), `late` = loop-body overruns (a body that ran past its 1 ms; the count `exec_max_us` alone cannot give). Both should read 0 |
| `evn.reset_cause()` | `"watchdog"` after a watchdog reboot, else `"normal"` |
| `evn.reset(*, start=False)`, `evn.bootloader()` | reboot (`start=True`: that boot runs `main.py` at once instead of waiting for the user button); reboot into the RPI-RP2 drive |
| `evn.autostart([on])` | whether `main.py` starts at boot without the user-button press (default `False`, reset at every boot and soft reboot); set it in `boot.py` |
| `evn.Servo(1..4, profile=)` | bench-validated against a coupled encoder (2026-09-17); the Geekservo profiles are in the standard-peripherals table below. `Servo(port)` is the Geekservo 270° profile |
| `evn.UART(1\|2, baudrate=115200)` | `write(buf)` (every byte queued, never lossy), `read([n])`, `readline(timeout=5000)`, `any()`, `overflow()` (bytes the 256-byte receive ring dropped since the last call, read-and-clear), `flush_rx()`, `repl(True)` (the REPL on this port as well as USB), `close()` (releases the port — it keeps running and keeps its queued bytes — so a `Bluetooth` object or another `UART` at a different baud can take it; every later call raises `ValueError("UART is closed")`). One object per header: `UART(n)` raises `OSError` while an `evn.Bluetooth` object holds the port, `OSError("serial port N is already open")` while another `UART` object does, and the other way round. Re-opening a port that is already open never resets it and never drops queued bytes |
| `evn.I2C(1..16)` | raw I2C through the board's multiplexers: `scan()` (never lists 0x70), `probe(addr)`, `readfrom(addr, n)` / `writeto(addr, buf)` (1..4096 bytes), `readfrom_mem` / `writeto_mem`, `stats() -> ((errors, recoveries, stuck), (...))` per bus — `errors` are failed transactions since boot; the expected NACK of a probe, of a constructor's ID-register identify on an empty port or of a driver's re-probe of an unplugged device is not one, so a climbing count means a real fault. **0x70** (the multiplexers) is refused everywhere and **0x6A on port 16** (the battery charger) with `ValueError`. Errors: `OSError(ENODEV)` nothing answered, `OSError(EIO)` present but refused a byte, `OSError(ETIMEDOUT)` the bus was held and has been reset. The transaction deadline grows with the length (1 ms + 40 µs per byte, at least 5 ms), so a long transfer never times out by being long |

## Standard peripherals (all bench-validated)

Every device below is an *EVN Standard Peripheral*: plug it in, name the port, read. The firmware identifies the chip, configures it, keeps the latest reading in a cache refreshed in the background (reading adds no bus traffic of its own; the refresh runs at up to 1 kHz inside waits, prints and the getters themselves) and re-attaches it after an unplug. `docs/STANDARD_PERIPHERALS.md` in the firmware repository is the full reference with a function-by-function comparison to the EVN Arduino classes, and §1 there carries the validation date of each device — **all fifteen have now been on hardware** (colour sensor, distance sensor, gesture sensor, environment sensor, compass, seven-segment display and OLED 2026-09-17; ADC, touch array, IMU, LED matrix, RGB LED module 2026-09-18; the Bluetooth module and both Geekservo profiles 2026-09-17; the compass on the HMC5883L — the QMC5883L path has not been benched yet), and the firmware in this package includes them.

Blocks exist for every one of them (**EVN: Open blocks reference**, `docs/BLOCKS.md`), with four block examples in `examples/blocks/`: `colour_line`, `spirit_level`, `compass_lights` and `bluetooth_grabber`.

Every constructor raises `OSError` when nothing answers on the port or the driver pool is full. What a device does while it is unplugged (its readings raise `OSError`; its settings, and a display's drawing, still answer from the firmware's copy) and after `close()` (a `ValueError`) is spelled out in its own section below.

| Class | Device | Section |
| :--- | :--- | :--- |
| `ColorSensor` | TCS34725 colour sensor | [Colour sensor](#colorsensor--colour-sensor-tcs34725-standard-peripheral) |
| `ADC` | ADS1115 16-bit ADC | [Analogue-to-digital converter](#adc--analogue-to-digital-converter-ads1115-standard-peripheral) |
| `EnvSensor` | BME280 temperature, pressure, humidity | [Environment sensor](#envsensor--environment-sensor-bme280-standard-peripheral) |
| `DistanceSensor` | VL53L0X time-of-flight distance | [Time-of-flight distance sensor](#distancesensor--time-of-flight-distance-sensor-vl53l0x-standard-peripheral) |
| `Compass` | QMC5883L / HMC5883L magnetometer | [Magnetometer](#compass--magnetometer-qmc5883l--hmc5883l-standard-peripheral) |
| `IMU` | MPU-6500 gyro + accelerometer with DMP | [Gyro and accelerometer](#imu--gyro-and-accelerometer-mpu-6500-standard-peripheral) |
| `TouchArray` | MPR121 12-key capacitive touch | [Capacitive touch array](#toucharray--capacitive-touch-array-mpr121-standard-peripheral) |
| `GestureSensor` | APDS-9960 gesture, proximity, colour | [Gesture, proximity and colour sensor](#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960-standard-peripheral) |
| `MatrixLED` | EVN 8×8 LED matrix (HT16K33) | [8×8 LED matrix](#matrixled--88-led-matrix-ht16k33-standard-peripheral) |
| `SevenSegmentLED` | EVN 4-digit display (HT16K33) | [4-digit seven-segment display](#sevensegmentled--4-digit-seven-segment-display-ht16k33-standard-peripheral) |
| `Display` | EVN 128×64 OLED (SSD1306 / SSD1315) | [128×64 OLED](#display--12864-oled-ssd1306--ssd1315-standard-peripheral) |
| `RGBLED` | EVN RGB LED module / WS2812B strip (servo port) | [RGB LED module](#rgbled--rgb-led-module-ws2812b-standard-peripheral) |
| `Bluetooth` | EVN Bluetooth module (HC-05, serial port) | [Bluetooth module](#bluetooth--bluetooth-module-hc-05-standard-peripheral) |
| `Servo` | Geekservo 270° / continuous-rotation (servo port) | [Hobby servo](#servo--hobby-servo-geekservo-270--continuous-rotation-standard-peripheral) |

## ColorSensor — colour sensor (TCS34725, standard peripheral)

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
| `cs.ranges(clear=(low, high), red=…, green=…, blue=…)`, `cs.ranges()` | calibration: the raw count you measured on the darkest and brightest surface per channel (`None` clears one); a pair must satisfy `0 <= low < high <= 65535`, else `ValueError`. `cs.ranges()` → four entries in clear, red, green, blue order, each `(low, high)` or `None` |
| `cs.normalized()` | `(clear, red, green, blue)` mapped 0..100 between each channel's calibration low and high; `cs.hsv(normalized=True)` uses these (white balance) |
| `cs.gain([x])` | 1, 4, 16 (default) or 60 |
| `cs.integration_time([ms])` | 2.4 (default) .. 614.4 in 2.4 ms steps (`ValueError` outside); longer = more resolution, slower. The setter returns the time actually set (rounded to the step) |
| `cs.wait_time([ms])` | pause between readings, 0 (default) .. 7372.8 (2.4 ms steps up to 614.4, 28.8 ms steps above). The getter returns the int `0` when there is no pause; the setter returns the pause actually set |
| `cs.thresholds([low, high, persistence=1])`, `cs.interrupt()`, `cs.clear_interrupt()` | the chip's clear-channel window flag: a clear count below `low` or above `high` (0..65535) for `persistence` consecutive readings (0 = every reading, 1, 2, 3, 5, 10, 15 .. 60; `thresholds(low, high)` sets 1) latches `interrupt()` until `clear_interrupt()`. `thresholds()` → `(low, high, persistence)`, `(0, 0, 0)` on a fresh sensor; `thresholds(low)` alone raises `TypeError` |
| `cs.id()`, `cs.close()` | part ID (0x44 for a TCS34725/34721, 0x4D for a TCS34727/34723); sleep the sensor and free the port |

**Bench-validated 2026-09-17** on three TCS34725 sensors at once: every setting and derived value against the datasheet, `age` ≤ 5 ms with three attached, hot-plug with the settings re-applied.

While the sensor is unplugged every reading raises `OSError("colour sensor on port N not responding")`; `gain()`, `integration_time()`, `wait_time()`, `thresholds()`, `ranges()`, `detectable_colors()` and `id()` still answer, and a replugged sensor comes back with its settings. After `close()` every call except `close()` itself raises `ValueError("colour sensor is closed")`.

Every setter (`gain()`, `integration_time()`, `wait_time()`, `thresholds()`) returns only once a sample measured **under the new setting** exists. With a persistence of 0 ("every reading") `interrupt()` reads `True` as soon as `thresholds()` has been called, whatever the count: pass 1 or more (the setter's default) for a flag that means "the clear count left the window".

## ADC — analogue-to-digital converter (ADS1115, standard peripheral)

Plug the EVN ADC module (or any ADS1115 board at 0x48) into an I2C port; only SDA and SCL are used. Wire the signals to A0..A3 and **never put more than 3.6 V on a pin** (the module runs at 3.3 V; its inputs are limited to VDD + 0.3 V whatever the range).

Inputs are numbered as in the EVN Arduino `EVNADC`: 0..3 = A0..A3 against GND (single-ended), 4 = A0 − A1, 5 = A0 − A3, 6 = A1 − A3, 7 = A2 − A3 (differential, can read negative).

| Call | Notes |
| :--- | :--- |
| `adc = ADC(port)` | `port` 1..16; `OSError("no ADS1115 on port N (I2C 0x48)")` if nothing passes the identity test (general-call reset, then Config = 8583h: the chip has no ID register), `OSError(EIO)` when all 4 ADC slots are in use, `OSError(ETIMEDOUT)` if the first conversion never arrives. Returns with the first conversion (8–9 ms). Defaults: input 0 scanned, **±4.096 V** (covers the module's 3.6 V inputs at 1.5× the resolution of 6.144 V; the Arduino default too), 860 samples per second |
| `adc.voltage([input])` | the latest conversion of `input` in volts (cached, no bus traffic). `input` is positional (`adc.voltage(2)`, not `input=2`); left out, it is the first input in `adc.inputs()`, or the `continuous()` input. An input that is not being converted raises `ValueError("input N is not enabled: see inputs()")`; outside 0..7 `ValueError("input must be 0..7")` |
| `adc.raw([input])` | the latest conversion as the chip's signed 16-bit code, −32768..32767; volts = code × range / 32768 (125 µV per count at ±4.096 V). A reading at or beyond full scale clips at 32767 / −32768 |
| `adc.read([input])` | waits for the **next** conversion of `input` and returns it in volts (the EVN Arduino `read(pin)`) — use this in a loop that should see a new sample each time. About 3 ms per call at 860 SPS with one input, 10.5 ms with four scanned, 151 ms at 8 SPS; `OSError("ADC on port N not responding")` if none arrives |
| `adc.inputs([seq])` | the inputs converted in turn, as a tuple in ascending order, default `(0,)`. Set with one int or a sequence, e.g. `adc.inputs((0, 1, 2, 3))` or `adc.inputs(4)`; the order given does not matter. Each scanned input costs one conversion per round, so N inputs are each refreshed N times slower. An empty sequence raises `ValueError("at least one input")` |
| `adc.range([volts])` | full scale ± volts: 6.144, 4.096 (default), 2.048, 1.024, 0.512 or 0.256; anything else raises `ValueError`. A smaller range gives finer steps but clips any input beyond it (and a signal whose peaks exceed the range is not averaged: it clips during the peaks) |
| `adc.data_rate([sps])` | samples per second: 8, 16, 32, 64, 128, 250, 475 or 860 (default); anything else raises `ValueError`. Slower rates are quieter (a steady 3.3 V: 0.18 mV standard deviation at 860, 0.00 mV at 8). The chip converts about 20 % slower than its nominal rate; the driver learns the margin per rate |
| `adc.continuous([input])` | the input being converted back to back, or `None` (default: scanning `inputs()`). `adc.continuous(0)` converts input 0 continuously at the data rate — the fastest single-input path (2.7 ms per `read()` at 860 SPS) — and makes it the only readable input; `adc.continuous(None)` returns to scanning `inputs()`. The chip has no data-ready flag in this mode, so a read can repeat or skip a conversion |
| `adc.age([input])` | ms since the cached conversion of `input` was taken (≤ 1 ms at 860 SPS, up to one cycle at slow rates) |
| `adc.close()` | powers the chip down and frees the port and its slot; a new `ADC(port)` starts from the defaults again |

Every setter (`inputs()`, `range()`, `data_rate()`, `continuous()`) returns only once every converted input has a conversion under the **new** setting, so a getter straight after it always answers; the first sample after a setter costs one extra conversion (the one in flight is discarded). The driver scans in the background, one conversion per input per cycle, and `print(adc)` shows the settings, e.g. `ADC(3, inputs=0x01, range=4096 mV, data_rate=860)`.

```python
from evn import ADC
adc = ADC(3)
adc.inputs((0, 1))                   # scan A0 and A1
print(adc.voltage(0), adc.voltage(1))
```

While the module is unplugged `voltage()`, `raw()`, `read()` and `age()` raise `OSError("ADC on port N not responding")`; `inputs()`, `range()`, `data_rate()` and `continuous()` still return the settings, and a replugged module comes back by itself (the driver re-probes every 250 ms) with the settings kept. After `close()` every call except `close()` itself raises `ValueError("ADC is closed")`.

**Bench-validated 2026-09-18** on the EVN ADC module with three decoys: 0 V, 3.3 V and ±3.3 V differential at every range, a servo-pulse average as a mid-scale signal, hot-plug with the settings kept; re-benched 2026-09-18 on the loaded rig with all four motors running (68 / 68, no pickup on an open input) and 2026-09-19 on firmware 0.2.23 (74 / 74).

## EnvSensor — environment sensor (BME280, standard peripheral)

Plug the EVN environment sensor module (or any BME280 board at 0x76) into an I2C port; only SDA and SCL are used. Keep the small vent hole in the metal can uncovered: a fingertip or a mounting pressing on it reads about 100 Pa high until it is lifted.

| Call | Notes |
| :--- | :--- |
| `env = EnvSensor(port)` | `port` 1..16; `OSError("no BME280 on port N (I2C 0x76)")` if no chip with ID 0x60 answers, `OSError(EIO)` when all 4 EnvSensor slots are in use, `OSError(ETIMEDOUT)` if the first measurement never arrives. Resets the chip, reads its trimming data and returns with the first measurement (≈ 60 ms). Defaults: the datasheet's "indoor navigation" setting — oversampling temperature ×2, pressure ×16, humidity ×1, IIR filter 16, normal mode with 0.5 ms standby (0.6 Pa RMS pressure noise on the bench) |
| `env.temperature()` | °C (float), or `None` while the temperature channel is skipped |
| `env.pressure()` | Pa (float; 101 325 Pa = 1013.25 hPa), or `None` while the pressure or the temperature channel is skipped |
| `env.humidity()` | % relative humidity (float), or `None` while the humidity or the temperature channel is skipped |
| `env.all()` | `(temperature, pressure, humidity)` from the same measurement (cached) |
| `env.read()` | waits for the **next** measurement and returns `(temperature, pressure, humidity)` — use this in a loop that should see a new sample each time. 40.5 ms at the defaults, the standby or the forced interval longer when those are set; `OSError` if none arrives within about two cycles |
| `env.raw()` | `(adc_t, adc_p, adc_h)`, the chip's uncompensated codes (a skipped channel reads 0x80000 / 0x8000) |
| `env.oversampling([temperature=, pressure=, humidity=])` | the getter returns `(temperature, pressure, humidity)` factors, default `(2, 16, 1)`. Set with keywords only (a positional value raises `TypeError`): 0 (skip the channel), 1, 2, 4, 8 or 16 each, anything else `ValueError`; a keyword left out keeps its channel, e.g. `env.oversampling(pressure=4)`. More oversampling = less noise and a longer measurement |
| `env.filter([c])` | the IIR filter coefficient: 0 (off), 2, 4, 8 or 16 (default); anything else `ValueError`. A higher coefficient smooths pressure and temperature but responds more slowly (≈ 0.9 s to 75 % at 16) |
| `env.standby([ms])` | the pause between measurements in normal mode, a float: 0.5 (default), 10, 20, 62.5, 125, 250, 500 or 1000 ms; anything else `ValueError`. Set while `forced()` is on, it is kept for when normal mode returns |
| `env.forced([ms])` | the forced-mode interval in ms, 0 = normal mode (default). `env.forced(100)` triggers one measurement every 100 ms from the board (0..2 000 000 ms, else `ValueError`); unlike normal mode it never repeats a sample and the chip sleeps in between. `env.forced(0)` returns to normal mode |
| `env.measurement_time()` | ms for one measurement at the current oversampling, the datasheet's **worst case** (46.1 ms at the defaults, 9.3 ms at ×1 / ×1 / ×1, 112.8 ms at ×16 each). Readings actually arrive at the typical time plus the standby, which is shorter (40.5 ms at the defaults, ≈ 24.7 per second) |
| `env.age()` | ms since the cached measurement was taken |
| `env.close()` | puts the chip to sleep and frees the port and its slot; a new `EnvSensor(port)` starts from the defaults again |

Every setter (`oversampling()`, `filter()`, `standby()`, `forced()`) returns only once a measurement taken wholly under the **new** setting exists — about two measurement times (18–25 ms at ×1 / ×1 / ×1, ≈ 80 ms at the defaults), never a whole standby or forced interval — so a getter straight after it always answers. Skipping the temperature channel (`oversampling(temperature=0)`) makes all three values `None`: the pressure and humidity compensation need the temperature. `print(env)` shows the settings, e.g. `EnvSensor(4, oversampling=(2, 16, 1), filter=16, standby=500 us)`.

While the module is unplugged `temperature()`, `pressure()`, `humidity()`, `all()`, `read()`, `raw()` and `age()` raise `OSError("environment sensor on port N not responding")`; the settings getters still answer, and a replugged module comes back by itself (the driver re-probes every 250 ms) with the settings kept. After `close()` every call except `close()` itself raises `ValueError("environment sensor is closed")`.

**Bench-validated 2026-09-17** on the EVN module with three decoys: every getter and setter, the noise figures against the datasheet, forced mode (99.4–100.4 ms, never a repeat), a breath and a fingertip, hot-plug with the settings kept; re-benched 2026-09-19 on firmware 0.2.23 (91 / 91).

## DistanceSensor — time-of-flight distance sensor (VL53L0X, standard peripheral)

Plug a VL53L0X time-of-flight board (address 0x29) into an I2C port; only SDA and SCL are used. It measures 30 to about 2000 mm to the surface in front of its window with an infrared laser, and reports `None` rather than a number when it has no valid target.

| Call | Notes |
| :--- | :--- |
| `ds = DistanceSensor(port)` | `port` 1..16; `OSError("no VL53L0X on port N (I2C 0x29)")` if no chip with the VL53L0X reference registers answers (a colour sensor at the same address is refused), `OSError("no free DistanceSensor slot for port N (4 in use)")` when all 4 slots are taken, `OSError("distance sensor on port N gave no first measurement")` on a timeout. Resets the chip, runs ST's initialisation and returns with the first range (≈ 90–120 ms after the call). Defaults: timing budget 33 ms, signal rate limit 0.25 MCPS, VCSEL periods 14 / 10, back-to-back ranging |
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

Every setter (`timing_budget()`, `signal_rate_limit()`, `vcsel_periods()`, `inter_measurement()`, `profile()`) stops ranging, lets the range in flight finish (up to a whole old budget: 1 s after `timing_budget(1000)`), applies the change and returns only with the first measurement under the **new** setting; if none arrives it raises `OSError("distance sensor on port N gave no measurement under the new setting")` and the object stays usable. Offset and cross-talk calibration are not performed (the factory offset in the chip applies). `print(ds)` shows the settings.

```python
from evn import DistanceSensor
ds = DistanceSensor(8)
d = ds.read()
print(d if d is not None else "nothing in range", ds.status())
```

While the module is unplugged every getter — `distance()`, `read()`, `status()`, `raw()`, `age()` — raises `OSError("distance sensor on port N not responding")`; the settings getters still answer, and a replugged module comes back by itself (1.5 s after the replug) with the settings kept. After `close()` every call except `close()` itself raises `ValueError("distance sensor is closed")`.

**Bench-validated 2026-09-17** on three sensors at once with a colour sensor as a decoy at the same address: every setting with its effect, `age` ≤ 30 ms with three attached, hot-plug with the settings kept; re-benched 2026-09-18 with a target at 59 mm (58 / 58) and 2026-09-19 on firmware 0.2.23 (57 / 58, the target band since widened).

## Compass — magnetometer (QMC5883L / HMC5883L, standard peripheral)

Plug a QMC5883L or HMC5883L compass module (the EVN compass module is an HMC5883L) into an I2C port; only SDA and SCL are used. The firmware finds whichever of the two chips answers (QMC at 0x0D, HMC at 0x1E, each checked by its ID register), keeps the latest reading in a cache and re-attaches it after an unplug. Body frame: x forward, y left, z up — `axes()` says which sensor axes those are. Mount it away from the motors: their magnets bend the field as the robot moves, and a calibration corrects the sensor, not the room.

| Call | Notes |
| :--- | :--- |
| `c = Compass(port)` | `port` 1..16 (`ValueError` otherwise); `OSError("no QMC5883L/HMC5883L on port …")` if neither chip answers, `OSError(EIO)` when four compasses are already attached, `OSError(ETIMEDOUT)` if no first reading arrives. Returns after the first reading (≈ 33 ms on the HMC). Defaults: QMC ±2 G, 200 Hz, oversampling 512; HMC ±1.3 G, 75 Hz, 1 average. A second `Compass(port)` on a port that is already open keeps its calibration and `north()` reference, but its settings and `axes()` go back to the defaults and a running `calibrate()` collection ends |
| `c.heading()` | degrees 0..360, clockwise seen from above, from `north()` — the direction of the calibrated horizontal field, whatever its size. 2-D only: no tilt compensation, so keep the module level |
| `c.heading_confidence()` | 0..1, measured from this reading's field strength: 1 when \|field\| equals the calibration's fitted radius, falling to 0 at ±25 % off it. Without a fitted radius (no `calibrate()`, or a calibration installed with `calibration(offset, matrix)`, which carries none) only a coarse test: 0.5 while \|field\| is inside the Earth's 0.25..0.65 G, else 0. A field the motors have cancelled reads 0 even when the heading looks plausible |
| `c.field_strength()` | \|field\| in gauss (calibrated when a calibration is installed); the Earth's field is 0.25..0.65 G |
| `c.read()` | waits for the **next** reading and returns its heading (13.3 ms at the HMC default) — use it in a loop that should see a new sample each time |
| `c.north(heading=0)` | the current direction reads as `heading` degrees from now on (positional) |
| `c.field()` | `(x, y, z)` gauss in the body frame (forward, left, up), calibrated when a calibration is installed |
| `c.raw()` | `(x, y, z)` sensor-frame counts of the latest reading (cached, never blocks) |
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
| `c.calibrate(planar=False)` | start collecting samples for the hard- and soft-iron fit, then tumble the sensor through every orientation; `planar=True` fits the horizontal ellipse for a floor robot that only turns in place |
| `c.calibrate_progress()` | `(samples, coverage)`: samples collected and the share of directions seen, 0..1 |
| `c.calibrate_stop()` | fit and install the calibration; returns `(residual, coverage, samples)`. `ValueError` when `calibrate()` was not started; `ValueError("calibration refused: …")` when there are not enough samples or directions (a still sensor covers 0, a flat ring is refused by the 3-D fit) — the collection **keeps running**, so turn some more and call it again, or `calibrate_cancel()` |
| `c.calibrate_cancel()` | end a collection without fitting (the way out of a refused `calibrate_stop()`) |
| `c.calibration()`, `c.calibration(offset, matrix=None)`, `c.calibration(None)` | the installed calibration as `((ox, oy, oz), ((…), (…), (…)))`, or `None`; give a stored `offset` and 3×3 `matrix` back to install it (an offset alone installs the identity matrix, a hard-iron-only calibration), `None` clears it. Wrong shapes raise `ValueError`. The calibration is **not stored on the board**: it is gone after a reset or `close()`, so save it and restore it at start-up |
| `c.age()` | ms since the latest reading was taken |
| `c.close()` | detach the driver and free the port; the calibration and the `north()` reference are dropped. A second `close()` does nothing |

```python
from evn import Compass, wait
c = Compass(6)
c.calibrate()            # now tumble the sensor for ~25 s
wait(25000)
print(c.calibrate_stop())   # (residual, coverage, samples); save c.calibration()
```

HMC5883L setters (`data_rate()`, `range()`, `oversampling()`, `bias()`) return only once the first reading **under the new setting** is in: the chip's first measurement after a configuration write is still under the old one, so a setter holds two periods — 27–31 ms at 75 Hz, 138 ms at 15 Hz, 2.7 s at 0.75 Hz. The previous reading stays readable meanwhile.

**With `evn.Pose`:** `Pose(compass=port)` takes this object's `heading()` — including any `north()` offset — plus the Pose's `declination`. The compass counts only once a calibration is installed, and the Pose drops every sample whose `heading_confidence()` is 0, so a field the motors have bent leaves the heading without an absolute reference (`'compass'` leaves `pose.sources()`) instead of pulling it off. Set `axes()` before building the `Pose`.

The constructor raises `OSError` when nothing answers; every reading raises `OSError("compass on port … not responding")` while the module is unplugged (`data_rate()`, `range()`, `oversampling()`, `bias()`, `axes()`, `chip()` and `calibration()` still answer); after `close()` every call except `close()` itself raises `ValueError("Compass is closed")`.

**Bench-validated 2026-09-17** on the EVN HMC5883L module with three decoys: every setter and refusal against the datasheet, heading sign by a clockwise turn, a 25 s tumble calibration (coverage 22/26, residual 3.7 %), heading noise 0.14° RMS when still, hot-plug with the settings kept; on the loaded rig (2026-09-18), away from the motors, the field moved ≤ 0.015 G with every motor running. The QMC5883L path has not been on hardware yet.

## IMU — gyro and accelerometer (MPU-6500, standard peripheral)

Plug an MPU-6500 module into an I2C port (0x68, identified by its WHO_AM_I register); only SDA and SCL are used. By default the chip's DMP fuses gyro and accelerometer into an orientation at 200 Hz and calibrates its own gyro. Body frame: x forward, y left, z up — set `axes()` from the module's silkscreen before anything relies on it. **Keep the robot still for the first ~15 s** after `IMU(port)`: the DMP calibrates its gyro 8..25 s into stillness (`ready()`), and a module moved early may not calibrate for a long time.

| Call | Notes |
| :--- | :--- |
| `imu = IMU(port)` | `port` 1..16 (`ValueError` otherwise); `OSError("no MPU-6500 on port …")` if nothing answers, `OSError(EIO)` when two IMUs are already attached, `OSError(ETIMEDOUT)` if no first sample arrives. Takes ≈ 510 ms (reset and the DMP firmware load). Starts in DMP mode: 200 Hz, ±2000 deg/s, ±2 g, tap and orientation events, DMP gyro calibration |

### Heading and motion

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

```python
from evn import IMU
imu = IMU(3)
imu.axes(top='-z', front='y')   # from the silkscreen: module upside down, nose along its y
while not imu.ready(): pass     # keep the robot still
print(imu.heading(), imu.tilt())
```

**With `evn.Pose`:** `Pose(imu=port)` takes the IMU's body-frame angular velocity and acceleration, not `heading()`, so `reset_heading()` and `heading_correction` do not change the Pose; set `axes()` before building it. A second `IMU(port)` on an open port shares the same driver.

An `evn.I2C(port).scan()` of this port pops one byte of the chip's FIFO (the driver heals it with a FIFO reset). One call can hold the I2C bus for up to ≈ 3.7 ms while it drains the waiting DMP packets.

The constructor raises `OSError` when nothing answers; every getter — `heading()`, `stationary()` and `ready()` included — raises `OSError("IMU on port … not responding")` while the module is unplugged, and a replug into the same socket keeps the settings and carries the heading on; after `close()` every call except `close()` itself raises `ValueError("IMU is closed")`.

**Bench-validated 2026-09-17** (104 self-checks on an upside-down module with a decoy: frames, every setting and refusal, the DMP's gyro calibration at 14.2 s, drift 0.2° per 5 s, `age` ≤ 6 ms) **and 2026-09-18 by hand**: a quarter turn clockwise → `heading()` +89.8°, unwrapped past 360°; pitch and roll signs; `up()` on every side; taps and the orientation events; same-socket hot-plug.

## TouchArray — capacitive touch array (MPR121, standard peripheral)

Plug the EVN touch module (or any MPR121 breakout at 0x5A) into an I2C port; only SDA and SCL are used. Twelve electrodes, 0..11, plus a proximity channel 12 that sums several electrodes when you turn it on.

| Call | Notes |
| :--- | :--- |
| `ta = TouchArray(port)` | `port` 1..16. Resets the chip, writes its configuration, runs auto-configuration and returns after the first touch status (≈ 55 ms). `OSError("no MPR121 on port N (I2C 0x5a)")` if nothing answers there, `OSError(EIO)` when all four touch-array slots are taken, `OSError(ETIMEDOUT)` if no first sample arrives. Defaults: 12 electrodes, proximity off, thresholds touch 12 / release 6 on electrodes 0..11 and 8 / 5 on the proximity channel 12, debounce 0, auto-configuration on for 3.3 V |
| `ta.touched()` | bitmask of touched channels, bit n = electrode n, bit 12 = proximity |
| `ta.read(channel)` | `True` while that channel is touched; `channel` 0..12 (12 = proximity), else `ValueError` |
| `ta.pressed()` | `True` while any electrode 0..11 is touched (the proximity channel is not counted) |
| `ta.proximity()` | `True` while the proximity channel 12 detects something; it stays `False` until `ta.electrodes(..., proximity=1\|2\|3)` turns the channel on |
| `ta.events()` | `(pressed_mask, released_mask)`: every channel pressed and released since the previous call (read and clear), so no short tap is missed between two reads |
| `ta.data(channel)` | `(filtered, baseline)` 10-bit counts of one channel 0..12, refreshed every 50 ms. A touch pulls `filtered` below `baseline`: a bare finger by ≈ 480–560 counts, a hand 1 cm above by at most 6 |
| `ta.thresholds([channel])`, `ta.thresholds(touch, release, *, channel=None)` | the touch and release deltas below the baseline, in counts 0..255 (default 12 / 6 on electrodes 0..11, 8 / 5 on the proximity channel 12). `ta.thresholds()` → channel 0's `(touch, release)` (the pair an all-channel set gives every channel); `ta.thresholds(3)` or `ta.thresholds(channel=3)` → channel 3's pair — **one bare number is the channel to read**, not `touch`. `ta.thresholds(12, 6)` or `ta.thresholds(touch=12, release=6)` sets every channel **including the proximity channel 12**; add `channel=n` to set one. A value left out is taken from channel 0 (or the `channel=` given) and applied to every channel set, so `ta.thresholds(touch=20)` also gives channel 12 channel 0's release of 6. `ta.thresholds(3, channel=2)` is ambiguous and raises `TypeError` |
| `ta.debounce([touch, release])` | consecutive samples, 0..7 each (default 0, 0), before a touch / release is reported; the getter returns `(touch, release)`. Pass both or neither (one argument raises `TypeError`) |
| `ta.electrodes([count], [proximity])` | electrodes 0..count-1 are scanned, `count` 1..12 (default 12); `proximity` 0 off (default), 1 = electrodes 0–1, 2 = 0–3, 3 = 0–11 summed as channel 12. The getter returns `(count, proximity)`; a value left out keeps the current one, so `ta.electrodes(proximity=3)` keeps the count |
| `ta.sampling([first, second, interval_ms])` | the chip's two filters and sample interval: `first` 6 (default) / 10 / 18 / 34 samples, `second` 4 (default) / 6 / 10 / 18, `interval_ms` 1 (default) / 2 / 4 / 8 / 16 / 32 / 64 / 128. The touch status updates every `second × interval_ms` (4 ms at the defaults). The getter returns the three values; pass all three or none |
| `ta.charge([current_uA, time_us])` | the global charge current 0..63 µA (default 16) and time 0 / 0.5 (default) / 1 / 2 / 4 / 8 / 16 / 32 µs. This is what the electrodes run at while auto-configuration is off; with it on, the chip searches a charge per electrode at every start and this is only the search's fallback. The getter returns `(current_uA, time_us)` |
| `ta.autoconfig([enable], reconfig=enable, vdd=None)` | auto-configuration of the charge per electrode at every start (`enable`) and re-configuration when an electrode drifts out of range (`reconfig`, follows `enable` unless given). `vdd` 1.71..3.6 V recomputes the target levels; left out, the current levels stay (those for 3.3 V at start-up). `ta.autoconfig(False)` means no automatic charge change at all, so `charge()` applies; `ta.autoconfig(False, reconfig=True)` is the datasheet's manual charge with out-of-range recovery. The getter returns `(enabled, reconfig, usl, tl, lsl)`, default `(True, True, 202, 182, 131)` |
| `ta.out_of_range()` | bitmask of channels whose auto-configuration failed (0 on a healthy module) |
| `ta.overcurrent()` | `True` if an over-current fault has been seen since the object was opened or `clear_overcurrent()` was called. The driver recovers from the fault by itself (clear, reset, reconfigure), which clears the chip's own flag, so without this count a program that was not reading at that instant would never see it |
| `ta.clear_overcurrent()` | resets that count and runs the chip's recovery again (reset and full reconfiguration, settings kept); returns with the first sample |
| `ta.age()` | ms since the latest touch status was read (≤ 5 ms at the defaults) |
| `ta.close()` | stop the chip and free the port |

Every setter (`thresholds()`, `debounce()`, `electrodes()`, `sampling()`, `charge()`, `autoconfig()`) stops the chip, rewrites its configuration, restarts it and returns only once a sample under the new setting exists: ≈ 52 ms at the 4 ms status period, longer at a slower `sampling()` (≈ 171 ms at 64 ms). A changed setting also clears the per-electrode charge values auto-configuration wrote, so the next start searches afresh. `data()` raises `OSError` until the first 50 ms data read after the constructor or a setter.

Proximity with the whole array summed, e.g. a hand hovering over the module:

```python
from evn import TouchArray, wait
ta = TouchArray(9)
ta.electrodes(12, proximity=3)
while not ta.proximity():
    wait(10)
```

The constructor raises `OSError` when nothing answers on the port, every getter raises `OSError("touch array on port N not responding")` while the module is unplugged (it re-attaches by itself with the settings kept), and after `close()` every call raises `ValueError("touch array is closed")` — except `clear_overcurrent()`, which raises the `OSError` above, and `close()` itself, which does nothing.

**Bench-validated 2026-09-18** on the EVN touch module with decoys on other ports: every default and setter cross-read from the chip's registers, single pads, three pads at once, a 3 s hold without chatter, five taps counted by `events()`, proximity with the electrodes summed, hot-plug; re-benched the same evening next to the drive motors — no touch or event from four running motors, the deepest dip 4 counts against the threshold of 12.

## GestureSensor — gesture, proximity and colour sensor (APDS-9960, standard peripheral)

Plug the EVN gesture module (or any APDS-9960 breakout at 0x39) into an I2C port; only SDA and SCL are used. Three engines run at once: gestures, proximity and colour.

### Gestures and proximity

| Call | Notes |
| :--- | :--- |
| `gs = GestureSensor(port)` | `port` 1..16. Checks the part ID, configures the chip, turns all three engines on and returns after the first reading (≈ 23 ms). `OSError("no APDS-9960 on port N (I2C 0x39)")` if nothing answers there, `OSError("no free GestureSensor slot for port N (k in use)")` when all four slots are taken, `OSError("gesture sensor on port N gave no first sample")` on a timeout |
| `gs.gesture()` | `'up'`, `'down'`, `'left'`, `'right'` or `None`: the newest gesture not yet returned, each one once (two gestures between calls return only the second). Names are the direction the hand moved with the module's label upright (`'up'` = from the bottom edge toward the top edge). A hand that only hovers and lifts is no gesture. Returns `None` while the gesture engine is off |
| `gs.read_gesture(timeout=5000)` | waits up to `timeout` ms (positional or keyword; `None` keeps 5000) for the next gesture and returns its name, or `None` on timeout. A negative timeout raises `ValueError`; with the gesture engine off it raises `ValueError("gesture engine is off: engines(gesture=True)")` |
| `gs.gesture_detail()` | `(gesture, up_down, left_right, ud_delta, lr_delta, datasets, overflow)` of the last gesture: the name, each axis's name (or `None`), the two axis deltas (the larger picks the axis), the number of FIFO datasets it was decoded from, and `True` if the chip's FIFO overflowed during it |
| `gs.proximity()` | 0..255, higher = closer (≈ 2–5 with nothing in front, ≈ 37 with a hand at 3 cm). Needs the proximity or the gesture engine; with both off it raises `OSError` |
| `gs.status()` | `(als_int, prox_int, als_saturated, prox_saturated, in_gesture)`: the colour and proximity threshold flags (see `thresholds()`), the two saturation flags, and whether the chip is in gesture mode right now (its `GCONF4.GMODE` bit) |
| `gs.age()` | ms since the latest proximity reading (the colour reading when proximity has none). With no reading and both the colour and proximity engines off it raises `ValueError("colour and proximity engines are off: engines(colour=True) or engines(proximity=True)")` |

**Gesture mode.** While an object sits inside the gesture entry threshold (a hand held still a few cm away) the chip stays in gesture mode and **suspends its proximity and colour engines**: `proximity()` and the colour readings keep their last value, `age()` grows and `status()[4]` is `True`; moving the hand away ends it. With no last value yet — the object was there from power-up, e.g. a module lying face down, or a setter has just restarted the engines — `proximity()`, the colour getters and `age()` raise `OSError("gesture sensor on port N is in gesture mode ...")`. A program that tracks a stationary object uses `gs.engines(gesture=False)`.

```python
from evn import GestureSensor
gs = GestureSensor(7)
g = gs.read_gesture(timeout=10000)
if g == 'left':
    print("swiped left")
```

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
| `gs.thresholds([*, als=(low, high, persistence), proximity=(low, high, persistence)])` | the window flags read by `status()`: clear-channel counts 0..65535 with persistence 0, 1, 2, 3, 5, 10 .. 60 cycles; proximity 0..255 with persistence 0..15; keyword-only. The getter returns the six values in one flat tuple `(als_low, als_high, als_persistence, prox_low, prox_high, prox_persistence)` |
| `gs.clear_interrupts()` | clear the threshold flags `status()` reports |
| `gs.offsets([prox_ur, prox_dl, g_up, g_down, g_left, g_right])` | the chip's proximity and gesture offset registers, six sign/magnitude bytes 0..255 (bit 7 = negative); pass all six or none (any other count raises `TypeError`) |
| `gs.photodiodes([mask], [compensate])` | proximity photodiode masking: `mask` 0..15, a set bit turns a diode off (bit 3 up, 2 down, 1 left, 0 right); `compensate` turns the chip's gain compensation for masked diodes on. With neither given it returns `(mask, compensate)` |
| `gs.wait_time([ms])` | pause between colour / proximity cycles, 0 (default, off) .. 8540 ms; returns the value actually set (the int `0` when off) |
| `gs.id()`, `gs.close()` | part ID (0xAB, or 0xA8 on the alternate part the EVN module carries); power the chip down and free the port |

Every setter returns only once a sample under the new setting exists, and a value out of range raises `ValueError` naming the allowed values. `gain()` and `pulses()` given several keywords apply them one after another, each with its own wait.

The constructor raises `OSError` when nothing answers on the port, every reading raises `OSError("gesture sensor on port N not responding")` while the module is unplugged (the settings getters and `id()` read the stored configuration and do not) (it re-attaches with the settings kept), and after `close()` every call raises `ValueError("gesture sensor is closed")` — except `detectable_colors()`, which keeps working, and `close()` itself, which does nothing.

**Bench-validated 2026-09-17** on the EVN module (ID 0xA8) with two VL53L0X and a TCS34725 as decoys: every setting against the datasheet's scaling, 12/12 swipes named the way the hand moved, `age` ≤ 3 ms, hot-plug with gain and integration time kept, 88/88 checks.

## MatrixLED — 8×8 LED matrix (HT16K33, standard peripheral)

Plug the EVN 8×8 LED matrix into an I2C port; only SDA and SCL are used. The names follow Pybricks' `hub.display` (row first, `icon()`, `number()`, `text()`, `animate()`, `orientation()`).

| Call | Notes |
| :--- | :--- |
| `m = MatrixLED(port, addr=None)` | `port` 1..16. `addr=None` is the EVN matrix's 0x71; another HT16K33 board 0x71..0x77. **0x70 raises `ValueError`**: it is the board's own I2C multiplexer. `OSError` if nothing answers at the address (the chip has no ID register: an answer at the address is taken as the display), `OSError` when four LED displays (`MatrixLED` and `SevenSegmentLED` together) are already open, `OSError(ETIMEDOUT)` if the chip does not come up. One LED display per port: a second `MatrixLED` or `SevenSegmentLED` on the same port re-attaches the one slot at its own address. Returns with the matrix cleared and on, brightness 16, no blink (≈ 6 ms) |
| `m.pixel(row, column, brightness=100, /)` | row 0..7 from the top, column 0..7 from the left (else `ValueError`); `brightness` 0, 0.0 or `False` turns the pixel off, any other value lights it (the chip has one brightness for the whole matrix: `m.brightness()`) |
| `m.get(row, column)` | `True` if that pixel is lit in the picture |
| `m.hline(row, col0, col1, on=True, /)` | a horizontal line, both ends included, in either order; a `False` last argument clears it |
| `m.vline(column, row0, row1, on=True, /)` | a vertical line, both ends included; a `False` last argument clears it |
| `m.rect(row0, col0, row1, col1, on=True, /)` | a filled rectangle between the two corners; a `False` last argument clears it |
| `m.bitmap(rows)` | the whole picture from 8 bytes (one per row, top row first, bit 7 = leftmost pixel), 8 ints of the same form, or 8 rows of 8 values (non-zero = on). `ValueError` for fewer than 8 bytes, a list that is not 8 rows or a row that is not 8 values |
| `m.image(matrix)` | the same as `bitmap()` (the Pybricks name) |
| `m.icon(icon)` | the same as `bitmap()`, for an `Icon` member (below): `m.icon(Icon.HEART)` |
| `m.char(c)` | one 8×8 character (printable ASCII; anything else shows blank); a string that is not one character raises `ValueError` |
| `m.number(n)` | an int −99..99 in 3×5 digits; a negative two-digit number is marked by one pixel at the left edge, a negative single digit by a dash. Outside the range `ValueError("number must be -99..99")` |
| `m.text(text, on=500, off=50, *, wait=True)` | one character at a time, `on` ms lit then `off` ms blank, and blank at the end. `wait=False` returns at once and the text runs in the background (`m.animating()`). Up to 63 characters; `on` below 1 ms, a negative `off` or a longer text raises `ValueError`; with `wait=True` an unplug during the text raises `OSError` |
| `m.animate(images, interval)` | cycle 1..32 images (any `bitmap()` form, e.g. `Icon` members) forever in the background, `interval` ms (≥ 1) each; the first image shows at once. Any drawing call ends it |
| `m.animating()` | `True` while an `animate()` or a `text()` is running |
| `m.stop()` | end an `animate()` or a `text()`, leaving the picture as it is |
| `m.orientation([up])`, `m.orientation(*, invert_x=False, invert_y=False, swap_xy=False)` | which edge of the matrix is up: `Side.TOP` (as wired, the default), `Side.RIGHT`, `Side.BOTTOM` or `Side.LEFT`; any other `Side` raises `ValueError`. The keyword form is for a mirrored mounting (the flags left out are reset to `False`). `m.orientation()` returns the `Side`, or `(invert_x, invert_y, swap_xy)` when the setting is not a rotation. It applies to the drawing calls that follow it: a picture already drawn keeps its LEDs |
| `m.brightness([level])` | 1 (dim) .. 16 (default), the whole matrix |
| `m.blink([hz])` | 0 (off, the default), 2, 1 or 0.5 Hz; any other value raises `ValueError` |
| `m.on(enable=True, /)` | switch the display on (or off with `False`); the picture is kept |
| `m.off()` | switch the display off; the picture is kept and comes back with `on()` |
| `m.clear()` | every LED off |
| `m.fill()` | every LED on |
| `m.show()` | send the picture to the chip now and wait (≈ 1.2 ms) instead of within the next 10 ms; `OSError` while the display is unplugged |
| `m.raw([frame])`, `m.raw(led, on)` | the chip's 16 display-RAM bytes: `m.raw()` returns them (as held by the firmware), `m.raw(frame)` writes all 16 (another length raises `ValueError`), `m.raw(led, on)` sets one LED 0..127 (= byte × 8 + bit). Not affected by `orientation()` |
| `m.keys([enable])` | the chip's key scan: `m.keys(True)` / `m.keys(False)` turns it on or off (off by default), `m.keys()` returns the six key-scan bytes, or raises `ValueError("key scan is off: keys(True)")` while it is off or before its first scan. The EVN matrix has no keys wired: six zero bytes |
| `m.close()` | switch the display off (chip in standby) and free the port. Two objects on one port share the display, so closing one closes both |

Drawing calls change a picture held in the firmware, which reaches the chip within 10 ms (1.2–3.8 ms measured); `show()` sends it at once. Drawing calls and settings keep working while the display is unplugged, and a replugged display gets its picture, brightness, blink and orientation back by itself (the firmware looks for it every 250 ms); a chip reset without an unplug (a supply dip) is healed within about 110 ms.

```python
from evn import MatrixLED, Icon, Side
m = MatrixLED(1)
m.orientation(Side.RIGHT)   # the matrix is mounted with its right edge up
m.animate([Icon.HAPPY, Icon.SAD], 500)
```

### Icon

`Icon` (from `evn`) is Pybricks' icon set redrawn at 8×8, for `m.icon()`, `m.image()`, `m.bitmap()` and `m.animate()`. Each member is 8 `bytes`, one per row, top row first, bit 7 = leftmost pixel, so your own `bytes` of the same form work in the same places.

`Icon.UP`, `DOWN`, `LEFT`, `RIGHT`, `ARROW_UP`, `ARROW_DOWN`, `ARROW_LEFT`, `ARROW_RIGHT`, `ARROW_RIGHT_UP`, `ARROW_RIGHT_DOWN`, `ARROW_LEFT_UP`, `ARROW_LEFT_DOWN`, `HAPPY`, `SAD`, `EYE_LEFT`, `EYE_RIGHT`, `EYE_LEFT_BLINK`, `EYE_RIGHT_BLINK`, `EYE_LEFT_BROW`, `EYE_RIGHT_BROW`, `EYE_LEFT_BROW_UP`, `EYE_RIGHT_BROW_UP`, `HEART`, `PAUSE`, `EMPTY`, `FULL`, `SQUARE`, `TRIANGLE_UP`, `TRIANGLE_DOWN`, `TRIANGLE_LEFT`, `TRIANGLE_RIGHT`, `CIRCLE`, `CLOCKWISE`, `COUNTERCLOCKWISE`, `TRUE`, `FALSE`.

The constructor raises `OSError` when nothing answers on the port or the display pool is full. The display's getters read the firmware's copy and do not raise while it is unplugged; `show()` does, and so does a setting sent while the chip stops answering. After `close()` every call except `close()` raises `ValueError("MatrixLED is closed")`.

**Bench-validated 2026-09-18** on the EVN 8×8 module with two decoy devices: every drawing call checked on the chip's own RAM, the pictures read by eye (corners, `-42`, `HI`, the arrow after `orientation(Side.RIGHT)`, dim and bright, the heart), a forced chip reset healed in 107 ms, an unplug and replug restoring the picture, brightness and orientation.

## SevenSegmentLED — 4-digit seven-segment display (HT16K33, standard peripheral)

Plug the EVN 4-digit seven-segment display into an I2C port; only SDA and SCL are used. Positions are 0..3 from the left.

| Call | Notes |
| :--- | :--- |
| `seg = SevenSegmentLED(port, addr=None)` | `port` 1..16. `addr=None` is the EVN seven-segment board's 0x74; another HT16K33 board 0x71..0x77. **0x70 raises `ValueError`**: it is the board's own I2C multiplexer. `OSError` if nothing answers at the address (the chip has no ID register: an answer at the address is taken as the display), `OSError` when four LED displays (`MatrixLED` and `SevenSegmentLED` together) are already open, `OSError(ETIMEDOUT)` if the chip does not come up. One LED display per port: a second `MatrixLED` or `SevenSegmentLED` on the same port re-attaches the one slot at its own address. Returns with the display cleared and on, brightness 16, no blink (≈ 6 ms) |
| `seg.number(value)` | a float with the point after the integer part and the remaining positions filled with decimals, cut off rather than rounded (the EVN Arduino layout): `12.5` → `12.50`, `3.14159` → `3.141`, `1234.5` → `1234.`, `-1.5` → `-1.50`; a float of 10000 or more shows `9999`, of −1000 or less `-999`. An int goes to the `integer()` layout and raises `ValueError("number must be -999..9999")` outside that range; NaN or infinity raise `ValueError`. Clears the colon |
| `seg.integer(value)` | −999..9999, right-aligned, a minus before a negative number (`-42` → ` -42`); outside the range `ValueError`. Clears the points and the colon |
| `seg.text(text)` | up to 4 characters, left-aligned (any after the fourth are ignored); a `'.'` after a character lights that character's point (`"12.5"`). Every position is cleared first (the colon is kept). Lower case is accepted; a character without a glyph (see `char()`) raises `ValueError`, with the characters before it already drawn |
| `seg.digit(position, value)` | `value` 0..9 at `position` 0..3 (else `ValueError`); the position's point is kept |
| `seg.char(position, letter)` | the first character of `letter`: `0`–`9`, `A B C D E F G H J L N O P R T U Y` (either case), `-`, `_` or a space; anything else, or an empty string, raises `ValueError`. The position's point is kept |
| `seg.point(position, on=True, /)` | the decimal point after that position; a `False` last argument turns it off |
| `seg.colon(on=True, /)` | the colon between positions 1 and 2; `False` turns it off |
| `seg.segments(position, mask)` | raw segments, `mask` 0..255: a..g = bits 0..6, the point = bit 7 |
| `seg.clear_position(position, clear_point=True, /)` | blank one position; a `False` last argument keeps its point |
| `seg.brightness([level])` | 1 (dim) .. 16 (default), the whole display |
| `seg.blink([hz])` | 0 (off, the default), 2, 1 or 0.5 Hz; any other value raises `ValueError` |
| `seg.on(enable=True, /)` | switch the display on (or off with `False`); what it shows is kept |
| `seg.off()` | switch the display off; what it shows is kept and comes back with `on()` |
| `seg.clear()` | every segment, point and the colon off |
| `seg.fill()` | every segment, point and the colon on |
| `seg.show()` | send the picture to the chip now and wait (≈ 1.1 ms) instead of within the next 10 ms; `OSError` while the display is unplugged |
| `seg.raw([frame])`, `seg.raw(led, on)` | the chip's 16 display-RAM bytes: `seg.raw()` returns them (as held by the firmware), `seg.raw(frame)` writes all 16 (another length raises `ValueError`), `seg.raw(led, on)` sets one LED 0..127 (= byte × 8 + bit) |
| `seg.keys([enable])` | the chip's key scan: `seg.keys(True)` / `seg.keys(False)` turns it on or off (off by default), `seg.keys()` returns the six key-scan bytes, or raises `ValueError("key scan is off: keys(True)")` while it is off or before its first scan. The EVN board has no keys wired: six zero bytes |
| `seg.close()` | switch the display off (chip in standby) and free the port. Two objects on one port share the display, so closing one closes both |

Every call changes a picture held in the firmware, which reaches the chip within 10 ms (1.7–4.9 ms measured; many changes in a row go out as one write); `show()` sends it at once. The calls and settings keep working while the display is unplugged, and a replugged display gets its digits, brightness and blink back by itself (the firmware looks for it every 250 ms).

```python
from evn import SevenSegmentLED
seg = SevenSegmentLED(2)
seg.text("1234"); seg.colon(True)   # 12:34
seg.number(3.14159)                  # 3.141 (number() clears the colon)
```

The constructor raises `OSError` when nothing answers on the port or the display pool is full. The display's getters read the firmware's copy and do not raise while it is unplugged; `show()` does, and so does a setting sent while the chip stops answering. After `close()` every call except `close()` raises `ValueError("SevenSegmentLED is closed")`.

**Bench-validated 2026-09-17** on the EVN seven-segment board with three decoy devices: every call checked on the chip's own RAM and read by eye (`12.50`, ` -42`, `HELP`, `12:34`, brightness 1 and 16, blinking at 1 Hz), an unplug and replug restoring the brightness, blink and number.

## Display — 128×64 OLED (SSD1306 / SSD1315, standard peripheral)

Plug the EVN OLED into an I2C port; only SDA and SCL are used. Text sits on a grid of 16 columns × 8 rows of 8×8 characters; drawing uses pixels, x 0..127 from the left and y 0..63 from the top. The `draw_*` calls and `print()` are Pybricks' EV3 screen names.

| Call | Notes |
| :--- | :--- |
| `oled = Display(port, addr=0x3C, *, flip=False)` | `port` 1..16; `addr` 0x3C (the EVN OLED) or 0x3D, else `ValueError`; `flip=True` mounts the picture rotated 180°. `OSError` if nothing answers at the address, `OSError` when two displays are already open, `OSError(ETIMEDOUT)` if the panel does not come up. Returns with the panel blank and on, contrast 207 (≈ 55 ms; up to ≈ 740 ms on a panel that has just been plugged in) |

### Text

| Call | Notes |
| :--- | :--- |
| `oled.write(row, text)` | a whole row 0..7: the text from column 0, cut at 16 characters and padded with spaces; forgets the row's label. `text` may be a `str`, int, float (2 decimals), bool or `None`; anything else raises `TypeError` |
| `oled.label(row, text)` | the row's label from column 0 (`"Dist:"`), which `data()` writes after (the EVN Arduino `writeLabel`); a shorter label blanks the rest of the old one |
| `oled.data(row, value)` | `value` after the row's label, the rest of the row cleared (the EVN Arduino `writeData`); the same types as `write()`: `oled.label(1, "Dist:"); oled.data(1, 123)` |
| `oled.text(col, row, text, invert=False)` | characters from column 0..15 (else `ValueError`) on a row, no padding, cut at the right edge; `invert=True` draws dark on lit. Returns how many characters were written |
| `oled.print(*args, sep=" ", end="\n")` | like the built-in `print()`, on the text grid at a cursor: wraps at 16 characters and scrolls up at the bottom (the eighth row is used before the first scroll). `sep` and `end` are keywords; `clear()` puts the cursor back at the top left |
| `oled.mirror([enable])` | `oled.mirror(True)` copies everything the board prints (the REPL, every `print()`, tracebacks) to this display's console, with or without a USB host; one display at a time. `mirror(False)`, `close()` or a soft reset (Ctrl-D) ends it; `oled.mirror()` says whether this display is mirroring. Each mirrored line scrolls the whole panel, so a program that prints steadily keeps it busy |
| `oled.clear_row(row)` | blank one row 0..7 and forget its label |
| `oled.clear()` | blank the whole screen, forget every label and put the `print()` cursor at the top left |

### Drawing

| Call | Notes |
| :--- | :--- |
| `oled.pixel(x, y)`, `oled.pixel(x, y, on)` | read one pixel (`True` = lit) or set it; x 0..127, y 0..63, else `ValueError` |
| `oled.line(x0, y0, x1, y1, on=True, /)` | a one-pixel line; both ends must be on the screen (else `ValueError`); a `False` last argument erases |
| `oled.rect(x0, y0, x1, y1, on=True, *, fill=False)` | a rectangle between two corners given in either order, outlined or filled; corners must be on the screen |
| `oled.draw_pixel(x, y, color=Color.BLACK, /)` | one pixel in EV3 colours: the EV3 draws `Color.BLACK` on a white screen, so here a colour **lights** the pixel and `Color.WHITE`, `Color.GRAY` (any grey of 50 % value or more) and `Color.NONE` **erase** it; `True` / `False` work too. A pixel off the screen is skipped, not refused |
| `oled.draw_line(x1, y1, x2, y2, width=1, color=Color.BLACK)` | a line `width` 1..64 pixels thick (a square brush, so a thick line runs `width / 2` past its ends); clipped at the edges |
| `oled.draw_box(x1, y1, x2, y2, r=0, fill=False, color=Color.BLACK)` | a rectangle with corner radius `r` (≥ 0; `r=0` = `rect()`), outlined or filled; clipped at the edges |
| `oled.draw_circle(x, y, r, fill=False, color=Color.BLACK)` | a circle of radius `r` 0..255 around (x, y), outlined or filled; clipped at the edges |
| `oled.draw_text(x, y, text, text_color=Color.BLACK, background_color=None)` | 8×8 characters with their top-left corner at a pixel position; `background_color=None` leaves the pixels around the letters as they are, a colour fills or erases them; clipped at the edges |
| `oled.width`, `oled.height` | 128 and 64 |
| `oled.frame([data])` | the whole picture as 1024 bytes, page by page: byte `page * 128 + x` holds the pixels (x, 8 × page .. 8 × page + 7), bit 0 the top one. `oled.frame()` returns it, `oled.frame(data)` replaces it (another length raises `ValueError`) |
| `oled.splash()` | the EVN logo; forgets every label |
| `oled.show()` | send every pending change to the panel now and wait: ≈ 30 ms for a whole new picture, ≈ 1 ms for one pixel. Stops a hardware scroll first. `OSError` while the display is unplugged |

### Panel

| Call | Notes |
| :--- | :--- |
| `oled.contrast([value])` | 1..255 (default 207) |
| `oled.flip([enable])` | rotate the picture 180°; the picture is repainted (≈ 30 ms) |
| `oled.invert([enable])` | the panel shows dark on lit; the picture itself is unchanged |
| `oled.on(enable=True, /)` | switch the panel on (or off with `False`); the picture is kept |
| `oled.off()` | switch the panel off (it sleeps); the picture is kept and comes back with `on()` |
| `oled.scroll(left=False, rows=None, speed=0, vertical=0)` | the panel's hardware scroll: to the right (or left) over the rows `(first, last)` 0..7 in ascending order (`None` = the whole screen), `speed` 0..7 (the chip's frame-interval code), `vertical` −63..63 rows per step for a diagonal scroll; out-of-range values raise `ValueError`. While it runs the panel cannot be drawn on, so drawing waits: the next drawing call (or `show()`) stops the scroll and repaints; a new `scroll()` stops the old one first |
| `oled.scroll_stop()` | stop the scroll; the picture is repainted |
| `oled.fade(mode, interval=0, /)` | `'off'`, `'fade'` (fade out) or `'blink'`, `interval` 0..15 (the chip's frame-interval code); anything else raises `ValueError` |
| `oled.zoom(enable=True, /)` | the panel's zoom-in (every row shown twice as tall); `False` ends it |
| `oled.all_on(enable=True, /)` | light every pixel whatever the picture (a panel test); `False` shows the picture again |
| `oled.command(data)` | send 1..32 raw command bytes to the panel, for anything not wrapped (another length raises `ValueError`) |
| `oled.close()` | switch the panel off, end a `mirror()` and free the port |

Drawing changes a picture held in the firmware and returns at once (50 `write()` calls take about 28 ms); the changed parts are streamed to the panel in the background, a whole new picture in about 60 ms, or at once with `show()`. Drawing and `contrast()`, `flip()`, `invert()`, `on()` / `off()` keep working while the display is unplugged, and a replugged display gets its picture and settings back by itself; `show()`, `scroll()`, `scroll_stop()`, `fade()`, `zoom()`, `all_on()` and `command()` need the panel and raise `OSError("display on port N not responding")` while it is unplugged.

```python
from evn import Display
oled = Display(16)
oled.write(0, "Distance")
oled.label(1, "mm:")
oled.data(1, 123)
```

The constructor raises `OSError` when nothing answers on the port or two displays are already open. The getters read the firmware's copy and do not raise while the display is unplugged. After `close()` every call except `close()` raises `ValueError("Display is closed")`.

**Bench-validated 2026-09-17** on the EVN OLED (an SSD1315) with three decoy devices: every drawing call checked in the firmware's picture and the panel read by eye (the logo, the text grid, flip, invert, contrast, the shapes, the `print()` console, the hardware scroll, blink, zoom), an unplug and replug restoring the contrast, flip and picture.

## RGBLED — RGB LED module (WS2812B, standard peripheral)

Plug the EVN RGB LED module (or any WS2812B strip) into a servo port; the strip borrows that port's servo channel while the object is open.

| Call | Notes |
| :--- | :--- |
| `leds = RGBLED(port, count=8, *, invert=False)` | `port` is the servo port, 1..4; `count` 1..64 LEDs (8 = the EVN module), brightness starts at 255 and every LED off. `invert` is keyword-only: `True` makes LED 0 the far end of the strip. `ValueError` for a port or count out of range; `OSError` while a `Servo` object holds the port (`"servo port n is used by a Servo object"`), while another `RGBLED` already has it (`"... already has an RGBLED strip"`) or when the channel cannot be taken (`"... is not available for an LED strip"`) |
| `leds.on(color)` | every LED this colour (Pybricks `hub.light.on`): a `Color`, an `(r, g, b)` tuple, or `None` for off |
| `leds.on([c0, c1, ...])` | one colour per LED from LED 0 on (Pybricks `ColorLightMatrix`); `None` in the list turns that LED off, LEDs past the end of the list keep their colour, entries past `count` are ignored |
| `leds.off()` | every LED off (ends a pattern) |
| `leds.blink(color, durations)` | background pattern, the whole strip: `color` on / off for `[on1, off1, on2, off2, ...]` ms, repeated until something else is written. 2..16 entries, an even number of them, each ≥ 2 ms, else `ValueError`. `leds.blink(Color.BLUE, [500, 500])` |
| `leds.animate(colors, interval)` | background pattern: the colours one after another for `interval` ms each (≥ 2 ms), repeated. 1..16 colours; `None` is off. `leds.animate([Color.RED, Color.GREEN], 250)` |
| `leds.pattern()` | `'blink'`, `'animate'` or `None` |
| `leds.stop()` | end the pattern and keep the colours it was showing |
| `leds.set(led, r, g, b)`, `leds.set(led, color)` | one LED; `color` is a `Color` or an `(r, g, b)` tuple, components 0..255. `led` 0..`count`−1, else `ValueError("led index out of range")` |
| `leds.fill(r, g, b)`, `leds.fill(color)` | every LED the same colour |
| `leds.range(first, last, r, g, b)`, `leds.range(first, last, color)` | LEDs `first`..`last` inclusive |
| `leds.clear()` | every LED off |
| `leds.get(led)` | `(r, g, b)` stored for that LED, before the brightness scale |
| `leds.brightness([value])` | global scale 0..255 (default 255) applied as the frame is sent; the stored colours keep their full values |
| `leds.count([n])` | LEDs on the strip, 1..64. An LED re-exposed by a larger count is off until it is set |
| `leds.invert([enable])` | `True`: LED 0 is the far end of the strip (a module mounted the other way round) |
| `leds.show()` | send the frame now and return once the strip has it (0.6 ms on the 8-LED module: 30 µs per LED + 340 µs latch). Not needed: every change goes out by itself within a millisecond. `OSError(ETIMEDOUT)` if the previous frame blocks it for 20 ms |
| `leds.hsv(h, s, v)` | colour helper, does not touch the strip: `h` degrees (wrapped into 0..359), `s` and `v` 0..100 → `(r, g, b)`; `ValueError` for `s` or `v` outside 0..100 |
| `leds.close()` | a black frame goes out and the servo channel is handed back once it has drained, so the strip is dark and the port free about 1–3 ms later: `Servo(port)` then works without a soft reset, but raises `OSError("servo port n is used by an RGBLED strip")` if built before that (`wait(5)` first) |

Any `set()`, `fill()`, `range()`, `clear()`, `on()` or `off()` ends a running `blink()` / `animate()`. A pattern is stepped by the firmware's 1 kHz poll in the background, so it keeps time while the program waits, prints or computes; a step below 2 ms is refused rather than silently stretched. Colours accept the whole `Color` set, including `Color(h, s, v)`, `c * 0.5` (dimmer) and `c >> 30` (hue shifted).

The servo port has one owner at a time: `Servo(n)` raises `OSError("servo port n is used by an RGBLED strip")` while the strip is open, and `RGBLED(n)` raises while a `Servo` object holds the port (`Servo.close()` gives it back). A servo port pulses nothing until a `Servo` object is built, so a strip plugged in at power-on stays dark.

```python
from evn import RGBLED, Color
leds = RGBLED(1)                      # servo port 1, the 8-LED module
leds.on([Color.RED, Color.GREEN, None, Color.BLUE])
leds.blink(Color.YELLOW, [200, 200, 200, 800])   # double blink, in the background
```

Nothing is read back from the strip, so there is no unplug detection: writes to an unplugged strip simply go nowhere. After `close()` every call except `hsv()` and `close()` raises `ValueError("RGBLED is closed")`.

**Bench-validated 2026-09-18** on the EVN RGB LED module (servo ports 1, 2 and 4): colour order, LED 0 at the module's connector end, `invert`, brightness, `count`, blink / animate confirmed by eye; 83 / 83 self-checks, frames at the wire time (620 µs for 8 LEDs), patterns within 1 ms of the requested times.

## Bluetooth — Bluetooth module (HC-05, standard peripheral)

Plug the EVN Bluetooth module into Serial 1 or Serial 2. Once a peer is connected the module is a transparent serial link: bytes written on one end come out of the other.

The module has two modes. **Hold its button while switching the board on** and it boots in command mode: the constructor then programs the baud, name and role, reboots the module (about 1 s) and switches to data mode. Switched on without the button it is already in data mode, and the constructor only opens the port at `baud` after a 300 ms `AT` probe that goes unanswered. `configured()` says which happened. The settings persist in the module, so it only needs programming once.

| Call | Notes |
| :--- | :--- |
| `bt = Bluetooth(port, baud=230400, name="EVN Bluetooth", mode="remote", addr=None, *, stay_in_command=False, wait=True)` | `port` is the serial port, 1 or 2. Applied only in command mode (button held): `baud` 4800..1382400, rounded down to the module's table (4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1382400) — 230400 is the highest the module sustains without losing data; `name` 1..32 characters; `mode` `'remote'` (a PC or a host module connects to it) or `'host'` (it connects by itself to the module at `addr`, `'NAP,UAP,LAP'` as `address()` prints it, `:` accepted). `stay_in_command=True` leaves the module in command mode for `command()`, `address()`, `version()`. `wait=True` returns once the module is ready (`OSError(ETIMEDOUT)` after 3 s); `wait=False` returns at once — poll `ready()`. `ValueError` for any value out of range; `OSError` while an `evn.UART` object or another live `Bluetooth` object holds the port, `OSError(EIO)` when the port cannot be opened |
| `bt.write(data)` | queue `bytes` for the peer; returns `len(data)`. Every byte is queued, never dropped: it waits only while the 1 KiB transmit queue is full. `OSError(EIO)` if the module leaves data mode meanwhile. Bytes written with no peer connected are lost inside the module |
| `bt.read(n=-1, timeout=0)` | up to `n` bytes (everything buffered when `n` is −1) as `bytes`. `timeout=0` returns at once (`b""` when nothing is waiting), `timeout=None` waits for `n` bytes (at least one when `n` is −1), a value in ms waits at most that long and returns what arrived. `ValueError` for a negative timeout |
| `bt.readline(timeout=5000)` | the next line without its `b"\n"` (and a `b"\r"` in front of it), or `None` on timeout or if the module leaves data mode. Only the line leaves the buffer; `timeout=0` never waits; `ValueError` for a negative timeout. A line longer than 255 bytes never completes and `overflow()` counts the drop |
| `bt.read_all()` | everything buffered, at once (`b""` when nothing) |
| `bt.any()`, `bt.waiting()` | bytes buffered (`waiting` is the Pybricks `UARTDevice` name) |
| `bt.overflow()` | bytes the 256-byte receive buffer had to drop since the last call because the program read too slowly; read-and-clear, 0 means nothing was lost |
| `bt.clear()` | drop everything buffered |
| `bt.wait_until(pattern, timeout=None)` | wait for the byte sequence `pattern` (1..32 bytes), discarding everything up to and including it; `True` when it arrived, `False` after `timeout` ms. `OSError(EIO)` if the module leaves data mode |
| `bt.set_baudrate(baud)` | the board side's speed, 1200..1382400, for a module already set to another baud (the module's own baud only changes through the constructor). Queued bytes leave at the old speed first. Data mode only, `ValueError` otherwise |
| `bt.repl([enable])` | `bt.repl(True)` puts the board's REPL (prompt, `print()`, tracebacks, Ctrl-C) on the module as well as USB; `bt.repl()` → whether it is on. Data mode only (`ValueError("repl needs data mode")`). Bytes the REPL consumes never reach `read()`. Survives a soft reboot; put it in `boot.py` for every power-up |
| `bt.state()` | `'probing'`, `'configuring'`, `'resetting'`, `'command'`, `'data'` or `'closed'` |
| `bt.ready()` | `True` in data mode, or in command mode with no command in flight. The module's STATE pin is not on the header, so it does **not** mean a peer is connected |
| `bt.configured()` | `True` when the module was found in command mode and accepted every setting |
| `bt.config_errors()` | the configuration commands the module refused (`"AT+UART"`, `"AT+NAME"`, `"AT+ROLE"`, `"AT+CMODE"`, `"AT+BIND"`, `"AT+RESET"`) followed by its last reply (`"ERROR:(n)"`, `"FAIL"`, or `""` for a timeout); `()` when everything was accepted |
| `bt.in_command_mode()` | `True` while the module is in command mode |
| `bt.command(cmd)` | command mode only: send one AT command (`"AT+NAME?"`) and return `(ok, payload)` — whether the module answered `OK`, and its last reply line. `OSError("module is not in command mode")` in data mode, `OSError(ETIMEDOUT)` when no reply comes within 300 ms |
| `bt.address()`, `bt.version()` | command mode only: the module's Bluetooth address (`"98D3:41:F71802"`) and firmware version as strings, `None` when the module did not answer; the same `OSError`s as `command()` |
| `bt.exit_command_mode()` | reboot the module into data mode (`AT+RESET`, about 1 s until `ready()`); `True` when it answered `OK` (at once when already in data mode) |
| `bt.factory_reset()` | command mode only: `AT+ORGL`, the module's factory settings (role remote, the bound address cleared) **including its data baud** (38400 on an HC-05 3.0), so a default `Bluetooth(n)` at 230400 can no longer talk to it; `True` when it answered `OK`. The module is left in command mode while the board's port reports data mode: switch the board off and on and re-program the module with its button held (`Bluetooth(n)` programs the baud again), or open it in data mode with `Bluetooth(n, baud=38400)` |
| `bt.startup_time()` | ms from the constructor to the module being ready (0 while it is not yet) |
| `bt.close()` | release the serial port (the REPL leaves the module if it was on it), so an `evn.UART` or a new `Bluetooth` object can take it. Dropping the object without `close()` closes it too, unless the module carries the REPL |

**Pairing with a PC.** Pair the module in the Windows Bluetooth settings (it shows as `HC-05` or `EVN Bluetooth`, PIN `1234`); Windows then lists a *Standard Serial over Bluetooth link (COMxx)* port, and a PC program that opens it talks to `bt.read()` / `bt.write()`. Only a module in the `'remote'` role can be reached from a PC.

**Two modules, no PC.** Program one module as the host bound to the other's address, once: switch on with the host module's button held and run `Bluetooth(1, mode="host", addr="98D3:41:F71802")` (the address the other module's `address()` gave). From then on the host connects to that module by itself at every power-up.

**The REPL over the air.** `bt.repl(True)` lets the PC's Bluetooth COM port carry the prompt, Run and Stop, so the USB cable can come out (Getting started §5a; the *Board* view does the whole set-up). In `boot.py`:

```python
import evn
bt = evn.Bluetooth(2)
bt.repl(True)
```

A module that already carries the REPL — even one whose object was dropped, as in `evn.Bluetooth(2).repl(True)` — is adopted as it stands by a plain `Bluetooth(n)`: at the port's own baud, nothing sent to the module, `configured()` `False`. Any configuration argument (a `baud` equal to the port's own is accepted) then raises `ValueError("the module carries the REPL; call repl(False) before changing its configuration")`; a program that needs the module for its own traffic calls `bt.repl(False)` first.

One object per serial header: `Bluetooth(n)` raises `OSError("serial port n is used by a UART object")` while an `evn.UART` object holds the port, `OSError("serial port n is already open")` while another live `Bluetooth` object does, and `UART(n)` raises the mirror error while this object holds it. The module does not answer from the serial side in data mode, so the constructor does not detect an absent module, and nothing detects an unplug. After `close()` every call except `close()` itself raises `ValueError("Bluetooth is closed")`.

**Bench-validated 2026-09-17** with two modules on both serial ports: the PC's own adapter as the peer (64 KiB echoed intact full duplex and 21 ms round trips at 230400), command mode 12 / 12 with the address matching the PC's inquiry, module to module 8 / 8 (32 KiB host → remote intact at 12.9 KB/s), 96 KB of back-to-back writes intact at 230400, and the REPL, Run and Ctrl-C over the air.

## Servo — hobby servo (Geekservo 270° / continuous-rotation, standard peripheral)

Plug a servo into servo port 1..4 and name its profile; `Servo(port)` is the kit's Geekservo 270° servo. The port sends 50 Hz pulses, and a new position is on the wire within one 20 ms frame.

| Profile | Travel | Pulse | Start | Sweep limit | Drive with |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `"geekservo_270"` (default) | 0..270° | 600..2400 µs | 135° | 500 deg/s | `angle()`, `move()` |
| `"generic"` | 0..180° | 500..2500 µs | 90° | 500 deg/s | `angle()`, `move()` |
| `"geekservo_cr"` | continuous rotation | 600..2400 µs, stop = 1500 µs | stopped | — | `duty()` |

| Call | Notes |
| :--- | :--- |
| `servo = Servo(port, profile="geekservo_270", reverse=False, *, range=None, min_us=None, max_us=None, start=None, max_dps=None)` | `port` 1..4; `profile` one of the three above. `reverse=True` mirrors the direction (0° at the `max_us` end; a positive duty the other way). The keyword-only overrides replace one field of the profile: `range` 0..3600 degrees (0 = continuous rotation), `min_us` / `max_us` 200..2800 with `min_us < max_us`, `start` degrees within the range, `max_dps` ≥ 1. `range=R` without `start=` starts at R/2. The servo goes to its start position (or its stop pulse) at once. `ValueError` for any value out of range, an unknown profile or a non-finite number; `OSError` while an `RGBLED` strip holds the port or the port is not available |
| `servo.angle([deg, reverse=False])` | fixed-range profiles: jump to `deg` (0..range, else `ValueError`); `reverse` (positional) mirrors this one write. `servo.angle()` → the tracked position in degrees (float) — what was last commanded, not a measurement. `TypeError` on a continuous profile |
| `servo.move(angle, speed=None, wait=True)` | fixed-range profiles: sweep from the tracked position to `angle` at `speed` deg/s (default and upper limit the profile's `max_dps`; a higher speed is capped to it, a negative one counts as positive). `wait=True` returns at the end of the sweep; `wait=False` returns at once — poll `done()`. `speed=0` raises `ValueError` (use `angle()` to jump); `TypeError` on a continuous profile |
| `servo.done()` | `True` when no sweep is running |
| `servo.duty([pct])` | continuous profile: −100..100 % (0 = the stop pulse), pulse = (1 − \|pct\|/100) × half the span from the `min_us` end for a positive duty and from the `max_us` end for a negative one (duty 50 → 1050 µs). `servo.duty()` → the current duty (float). `ValueError` outside −100..100; `TypeError` on a fixed-range profile |
| `servo.stop()` | continuous: the stop pulse (duty 0); fixed-range: end a sweep where it is and hold that position |
| `servo.pulse([us])` | the raw pulse width, 200..2800 µs (`ValueError` outside); the tracked position follows it. `servo.pulse()` → the current width (int) |
| `servo.profile()` | `(name, range, min_us, max_us, start, max_dps, reverse)` in force, overrides and `set_range()` included |
| `servo.set_range(min_us, max_us)` | new pulse endpoints for this servo, 200 ≤ `min_us` < `max_us` ≤ 2800 (`ValueError` otherwise); the current position or duty is re-sent under them at once |
| `servo.enable()` | pulses on again, at the last width |
| `servo.disable()` | pulses off and the pin low: the servo goes limp. Sticky until `enable()` (a later write does not revive it) or a new `Servo` object on the port |
| `servo.close()` | give the port back: the pulse stops and the pin goes low, so an `RGBLED` strip or a new `Servo` object can take it without a soft reset |

The emergency stop (Ctrl-C, the board button) ends every sweep and sends a continuous servo its stop pulse; a fixed-range servo keeps holding its position, the way a motor keeps its brake. A servo port pulses nothing until the first `Servo` object on it is built, and a new object drives its port even after `disable()` on an earlier one.

The port has one owner at a time: `RGBLED(n)` raises `OSError("servo port n is used by a Servo object")` while this object is open, and while a strip holds the port the constructor and every writing call here raise `OSError("servo port n is used by an RGBLED strip")`. A strip's `close()` frees the port about 1–3 ms later (its black frame drains first), so wait a few ms (`wait(5)`) between `leds.close()` and `Servo(port)`.

```python
from evn import Servo
arm = Servo(1)                   # Geekservo 270°, starts at 135°
arm.move(270, speed=200)         # sweep at 200 deg/s, returns at the end
wheel = Servo(2, "geekservo_cr")
wheel.duty(50)                   # about 185 deg/s unloaded; wheel.stop() to stop
```

A servo has no feedback line, so nothing detects an unplugged servo. After `close()` every call except `done()`, `profile()` and `close()` itself raises `ValueError("Servo is closed")`.

**Bench-validated 2026-09-17**, both Geekservo profiles against an encoder coupled to the horn: the 270° servo travels 277..281° over its 0..270 command, linear, and follows `move(270, 200)` at 200..206 deg/s; the continuous-rotation servo shows no creep at duty 0, about 185 / 315 / 450 deg/s at duty 50 / 75 / 100, starts in about 100 ms and stops in about 150 ms (under a heavy load it is torque-limited below duty 50).

## DriveBase (two motors as a robot)

`evn.DriveBase` follows [`pybricks.robotics.DriveBase`](https://docs.pybricks.com/en/latest/robotics.html): two `Motor` objects, the wheel diameter and the axle track in mm. Distances are mm, speeds mm/s, accelerations mm/s²; headings are degrees, deg/s, deg/s², **positive = clockwise seen from above** (the `Pose` / compass convention). Each motor's `positive_direction` is its forward direction (a mirrored left motor: `Motor(4, Direction.COUNTERCLOCKWISE)`) and its `gears=` make the values wheel degrees. With an IMU on the chassis, `use_gyro(True)` (below) makes the robot itself follow the path over an `evn.Pose` built on the same motors — `examples/10_drive_base_pose.py` is the whole set-up, the **robot follows its gyro** block the same in blocks.

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
| `done()`, `stalled()` | both wheels finished — `Motor.done()`'s meaning: profile complete and inside `control.target_tolerances()` — or passive; like `Motor`, a `wait=True` maneuver otherwise returns only on the stall timeout. With `use_gyro(True)` the wheels are judged against target + trim and `done()` also waits for the pose to settle (or the trim at its bound, or 2 s after the profiles — an escape that exists only under `use_gyro`) / either wheel stalled. |
| `use_gyro(True)` / `use_gyro()` | close the loop over an `evn.Pose` built on the same two motors: the robot itself follows the path the program asked for — scrub on a turn, a dragged cable and the gyro's drift are corrected as they happen, at the pose rate (100 Hz with the IMU, 200 Hz on the wheels alone), instead of adding up over minutes. Needs the `Pose` running (an IMU on it for the heading). What the pose cannot see (a robot pushed sideways) is not corrected. |
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
| `sources()` / `configured()` | the sources contributing right now / the ones the object was built with: subsets of `('wheels', 'imu', 'compass')`. A source whose driver is lost leaves the set by itself and rejoins when running; `'compass'` is also absent while the compass's field is being rejected (`Compass.heading_confidence()` 0) — **the heading then has no absolute reference and drifts with the gyro/wheels** until the field is the Earth's again (`_stats()[8]` counts the dropped samples) |
| `close()` | stop the estimator so another `Pose` can start; `with Pose(...) as pose:` closes on exit and is the idiom. A `Pose` dropped without `close()` (a function-local, a re-run cell) is stopped at the next garbage collection — and the next `Pose(...)` runs one collection before it decides, so a Pose dropped inside a function is released at once (no `gc.collect()` needed). A bare temporary in the same statement scope (`Pose(...).heading()` then `Pose(...)`) can survive that one collection and still raise "already exists" — use a function, `with`, or `close()`. Keep the object referenced while `DriveBase.use_gyro(True)` is on — the base holds no reference to it, and once it is collected the base raises `OSError` at its next maneuver and turns `use_gyro` off |
| `reset(x=0, y=0, heading=0)` | set the pose (mm, mm, degrees clockwise from north); biases and wheel parameters are kept. A re-framing, never a command: a `DriveBase` with `use_gyro(True)` re-anchors its ideal on the new pose and nothing moves — close an offset an outside reference revealed with an explicit `straight()`/`turn()` |
| `close()` | release the estimator |

Bench diagnostics, not for programs: `_stats()` (nine counters: steps, rejected wheel / lateral / magnetometer updates, the yaw-rate row's reject run near rest, wheel-gate escapes taken, steps with a stale IMU, steps that integrated a time gap — a Core 0 stall over 100 ms, whose exact encoder travel is integrated as one arc instead of being lost — and compass samples dropped for a field that is not the Earth's), `_bias()` (the filter's gyro bias and its sigma in deg/s, counter-clockwise positive — the filter's frame, not the heading's) and `_step(...)` (one filter step on SI values, for a `Pose(_test=True)` object).

## Timing

| Call | Notes |
| :--- | :--- |
| `evn.wait(ms)` | pause the program; motors keep doing what they were told |
| `evn.StopWatch()` | `time()` ms since construction, `pause()`, `resume()`, `reset()` |

## Files and `main.py`

An 11 MB file system is mounted at `/`. `open()`, `import`, `os` and `vfs` work as in MicroPython. `boot.py` runs at power-on and after Ctrl-D; `main.py` then waits for a press of the user button (LED blinking fast) and runs again at the next press once it has ended. Anything typed at the port during the wait (the extension's own connections, `mpremote`) gives the REPL instead, so a session never runs `main.py`; with the extension's live console attached, only *Upload and run now* starts it. When `main.py` ends, every motor coasts. `evn.autostart(True)` in `boot.py` starts it without the press; `evn.reset(start=True)` does so for one boot. Hold the user button while powering on to skip `main.py` once; after a watchdog reboot it is skipped automatically. **A file write is refused while a motor is driving**: `open(...).write(...)`, `flush()`, `close()`, `os.remove()` and any other flash write raise `OSError: [Errno 16] EBUSY` while any motor is in `run()`/`dc()`, in an unfinished `run_angle`/`run_target`/`run_time`/DriveBase maneuver, or tracking a moving target (a flash write would stall the 1 kHz motion engine for 45–400 ms, so the firmware refuses instead). A holding, braked or coasting motor does not block a write. Write your log after the move (`stop()`, `hold()` or `wait=True`, then write), or catch `OSError` with `e.errno == 16` and write later; keep readings in a list meanwhile. Reads (`open(...).read()`, `import`) are never refused.

## Safety behaviour

- **Ctrl-C** coasts all four motors, whether a program is running or not. Connecting `mpremote` (which every extension command does) sends Ctrl-C too.
- **Ctrl-D** (soft reboot) coasts all motors.
- The **user button** coasts all motors; held 2 s it reboots the board.
- A 3 s hardware **watchdog** reboots a frozen board; motors coast on reset and `main.py` is skipped on that boot.
- A program run from the extension (**Run**, Ctrl+F5, in VS Code or the browser IDE) ends with every motor coasting, finished or raised, and the REPL that follows still has the program's variables. Typing at the REPL yourself is different: there is no program boundary, so motors keep their last command until you `stop()` or `close()` them (or use `with Motor(1) as m:`), press Ctrl-C, or call `evn.stop_all()`.

## Deviations from Pybricks

| Topic | Pybricks | EVN ALPHA |
| :--- | :--- | :--- |
| `Motor(port)` | `Port.A`..`Port.D` | port numbers 1..4 (`Port.A`..`D` exist as the same integers) |
| `Motor(port)` model | the motor identifies itself over the port | `model="EV3 Medium"` / `"EV3 Large"` / `"NXT"` / `"JGA25-370 6V 77RPM"` (keyword-only) names it; without it the port keeps the model its stored calibration was made for, else the firmware's fallback (EV3 Large on 1-2, EV3 Medium on 3-4). The gain base is the model, never the port; `calibrate()` stores its record with the model, so nothing is re-run at boot |
| `reset_angle()` with no argument | resets to the absolute marker angle | makes the current position 0 (EV3/NXT encoders have no absolute marker) |
| `speed(window)` | averages over `window` ms | `speed()` only; the controller's own estimate is reported |
| `control.pid()` `integral_rate` | caps integral growth | not offered; `integral_limit` and `integral_deadzone` are the real anti-windup knobs |
| `control.pid()` units | torque controller | converted through the nominal pack voltage and the model's torque constant; EVN-specific terms live in `control.evn()` |
| `run_until_stalled` | any obstruction; `duty_limit` is the stall torque | the same: the stall is reported once the drive sits at `duty_limit` (or the pack) and the shaft does not turn; the first 150 ms of a move are ignored |
| Absolute angle range | unbounded | unbounded (64-bit) |
| `settings()` | may return more fields | `(max_voltage, stall_timeout)` — the stall timeout is EVN's own (a `wait=True` move returns once `stalled()` has held that long; 0 = wait for ever, as Pybricks) |
| Program end | motors stop | the same for a program run from the extension and for `main.py`: every motor coasts when it ends or raises. Lines typed at the REPL have no program end: motors keep their last command until Ctrl-C, Ctrl-D, `evn.stop_all()` or a connecting tool coasts them |
