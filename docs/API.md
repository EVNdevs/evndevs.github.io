# EVN ALPHA MicroPython API reference (early access)

Everything a program needs comes from the `evn` module:

```python
from evn import Motor, Port, Stop, Direction, SpeedUnit, wait, StopWatch
```

The `Motor` class follows the Pybricks `Motor` reference (https://docs.pybricks.com/en/latest/pupdevices/motor.html) for names, argument order, keyword defaults and units, so that documentation reads across. Where the EVN ALPHA has something Pybricks does not, it is exposed under its own name (`control.evn()`), and nothing is accepted that would silently do nothing. The differences are listed in [Deviations from Pybricks](#deviations-from-pybricks).

**How each object is described.** Every object has its own section, laid out the same way: what it is and where it plugs in, the **constructor**, the **methods** grouped by task (one line each; a getter and its setter share a row), an **example**, then **notes** (errors, unplugging, closing, how it works with other objects). Objects that can be calibrated link to [Calibrating your robot](CALIBRATION.md), the step-by-step guide. Test logs, bench figures and diagnostics are collected in the [appendix](#appendix-diagnostics-and-validation), out of the way.

## Start here

| What | Where it plugs in | Numbers |
| :--- | :--- | :--- |
| Motors (`Motor`, `DriveBase`) | motor ports M1–M4 | **1–4** (`Port.A`–`Port.D` are the same integers) |
| Sensors and displays (`ColorSensor`, `IMU`, `Display`, …) | I2C ports | **1–16** |
| `Servo`, `RGBLED` | servo ports | **1–4** |
| `Bluetooth`, `UART` | serial headers Serial 1 / Serial 2 | **1–2** |

Units: angle **deg**, speed **deg/s**, acceleration **deg/s²**, time **ms**, duty **%**, torque **mNm**, voltage **mV**, PID gains **µNm/deg**, **µNm/(deg·s)**, **µNm/(deg/s)**. Measurements return `int` unless a row says otherwise. A robot's distances are **mm** and its headings **degrees, clockwise positive** seen from above.

**Coming from Pybricks:** the names and arguments are Pybricks' wherever Pybricks has the thing. The differences that matter first: motor ports are numbers; reset_angle with no argument makes the current position 0; motors coast when a program ends; there is no import from pybricks — wait and StopWatch come from evn. The whole list is in [Deviations from Pybricks](#deviations-from-pybricks).

Contents: [Board](#board-battery-button-led-and-clock) · [Motor](#motor) · [DriveBase](#drivebase--two-motors-as-a-robot) · [Pose](#pose--where-the-robot-is) · [Calibration records](#calibration-records-evncalibration) · [Standard peripherals](#standard-peripherals) · [IMU](#imu--gyro-and-accelerometer-mpu-6500) · [Compass](#compass--magnetometer-qmc5883l--hmc5883l) · [ColorSensor](#colorsensor--colour-sensor-tcs34725) · [DistanceSensor](#distancesensor--time-of-flight-distance-sensor-vl53l0x) · [GestureSensor](#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960) · [TouchArray](#toucharray--capacitive-touch-array-mpr121) · [EnvSensor](#envsensor--temperature-pressure-and-humidity-bme280) · [ADC](#adc--analogue-to-digital-converter-ads1115) · [Display](#display--12864-oled-ssd1306--ssd1315) · [MatrixLED](#matrixled--88-led-matrix-ht16k33) · [SevenSegmentLED](#sevensegmentled--4-digit-seven-segment-display-ht16k33) · [RGBLED](#rgbled--rgb-led-module-ws2812b) · [Servo](#servo--hobby-servo-geekservo-270--continuous-rotation) · [Bluetooth](#bluetooth--bluetooth-module-hc-05) · [UART](#uart--raw-serial-port) · [I2C](#i2c--raw-i2c-port) · [Files and main.py](#programs-files-and-mainpy) · [DataLog](#datalog--recording-on-the-board) · [Timing](#timing-wait-and-stopwatch) · [Safety](#safety-behaviour)

## Board: `battery`, `button`, `led` and `clock`

The board itself, as parts of the `evn` module (`import evn`, or `from evn import battery, button, led`). Nothing to construct.

### Battery, button and LED

| Call | Returns / does |
| :--- | :--- |
| `evn.battery.voltage()` | the pack voltage in mV; **0** when no pack is connected |
| `evn.battery.cells()` | `(cell1, cell2)` mV (the pack is always two cells); `None` when no pack is connected |
| `evn.battery.age()` | ms since the battery reading was taken; `None` when no pack is connected |
| `evn.battery.present()` | `True` while a pack is connected and reporting |
| `evn.button.pressed()` | `True` while the user button is pressed (it is also the emergency stop, see [Safety](#safety-behaviour)) |
| `evn.led.on()`, `.off()`, `.toggle()`, `.set(bool)` | the board LED. Until a program touches it, it is the board's heartbeat; once a program has touched it, the heartbeat stays off until the next reboot (Ctrl-D does not bring it back) |
| `evn.stop_all()` | coast every motor |

### Clock, version and restarts

| Call | Returns / does |
| :--- | :--- |
| `evn.version` | the firmware's API version string |
| `evn.clock()`, `evn.clock(seconds)` | the board's wall clock as seconds since 1970 UTC, 0 until a host sets it (there is no battery-backed clock); with an argument it is set first, to a date in 2025..2105 (`ValueError` otherwise, `TypeError` for anything but an int). The extension's console sets it at every connect; calibration records carry it as their date. `time.localtime()` / `time.gmtime()` are not in the build: turn the seconds into a date yourself |
| `evn.reset(*, start=False)` | coast the motors and reboot; `start=True` makes that one boot run `main.py` at once instead of waiting for the user button |
| `evn.bootloader()` | coast the motors and reboot into the RPI-RP2 drive, for flashing |
| `evn.autostart()`, `evn.autostart(on)` | whether `main.py` starts at boot without the user-button press (default `False`, reset at every boot and soft reboot). It is read once, after `boot.py`: set it in `boot.py` — set in a program it does not change the boot already running |
| `evn.reset_cause()` | `"watchdog"` after a watchdog reboot, else `"normal"` |
| `evn.core1_status()` | the motion engine's health counters (a diagnostic, see the [appendix](#diagnostics)) |

**Example**

```python
import evn
if evn.battery.voltage() < 7200:
    evn.led.on()                     # a low pack: light the LED
print(evn.version, evn.battery.cells())
```

More in `examples/01_board/`.

## Motor

An EV3, NXT or other encoder motor on a motor port. The motor **model** (EV3 Large, EV3 Medium, NXT, JGA25-370, Pololu 25D, CHR-GM16-030PA or a custom motor) is the base of every gain and limit; a short self-calibration (`calibrate()`) then refines them for your motor. More in `examples/02_motor/`.

**Constructor**

```python
Motor(port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None, speed_unit=SpeedUnit.DEG_S, *, model=None)
```

| Parameter | Default | Meaning |
| :--- | :--- | :--- |
| `port` | — | motor port **1–4** (M1–M4); `Port.A`–`Port.D` are the same integers. A port outside 1..4 raises `ValueError`; a port already held by an open `Motor` raises `OSError(EBUSY)` until that object is `close()`d |
| `positive_direction` | `Direction.CLOCKWISE` | `CLOCKWISE` is physically clockwise looking at the shaft; `COUNTERCLOCKWISE` flips angle, speed, load, duty and targets |
| `gears` | `None` | `[12, 36]` or `[[12, 36], [20, 16, 40]]`; every value is then in output degrees and the limits are divided by `control.scale` |
| `reset_angle` | `True` | `True` zeroes `angle()` at construction; `False` keeps the count accumulated since power-on |
| `profile` | `None` (1°) | position tolerance in degrees for `done()`, must be positive; the default is two encoder edges and at least 1° (the controller lands inside its own 1.5-edge deadband): 1° on a LEGO motor, the JGA25 or the CHR-GM16, 1.55° on the Pololu 25D |
| `speed_unit` | `SpeedUnit.DEG_S` | or `SpeedUnit.PERCENT`: the unit of every speed this motor takes or reports (see [Speed in percent](#speed-in-percent)) |
| `model` | `None` | keyword-only: `"EV3 Large"`, `"EV3 Medium"`, `"NXT"`, `"JGA25-370 6V 77RPM"`, `"Pololu 25D 9.7:1 HP 12V"` or `"CHR-GM16-030PA 9V 1:63"` (`"large"`, `"medium"`, `"nxt"`, `"jga25"`, `"pololu25d_9_7"`, `"chr16_63"` also work; an unknown name is `ValueError`). `None` runs the motor the port is set up for (below) |

**Which motor a port runs.** With `model=None` the port runs, in this order: the motor it was **configured** for (`evn.configure_motor()` or the gear button in the extension's Board view, stored on the board: a library model or a custom motor), else the model its stored calibration was made for, else the firmware's fallback — EV3 Large on ports 1–2, EV3 Medium on 3–4. Naming another model with `model=` switches the port to that model's compiled defaults until the next reboot (`evn.motor_config(port)["session"]` is then `True`) and prints a `WARNING` that the stored calibration, made for the other model, is not applied until `calibrate()` runs again. `print(m)` shows the model: `Motor(1, EV3 Large)`, `Motor(3, custom)`.

Constants: `Port.A..D` = 1..4, `Direction.CLOCKWISE=0 / COUNTERCLOCKWISE=1`, `Stop.COAST=0 / BRAKE=1 / HOLD=2 / NONE=3 / COAST_SMART=4`, `SpeedUnit.DEG_S=0 / PERCENT=1`.

### Measuring

| Method | Returns |
| :--- | :--- |
| `angle()` | deg, 64-bit, never wraps |
| `reset_angle()`, `reset_angle(angle)` | makes the current position read `angle`; with no argument (or `None`) it becomes the **0 reference** every later move counts from. `angle` is positional only: `reset_angle(90)`, not `reset_angle(angle=90)` (`TypeError`) |
| `speed()` | deg/s, the controller's own estimate |
| `load()` | mNm; positive opposes the motor in the positive direction |
| `stalled()` | `True` while the motor pushes as hard as it is allowed to (the voltage cap, or the `duty_limit` of `run_until_stalled`) and the shaft does not turn, for `control.stall_tolerances()` (the Pybricks meaning) |
| `done()` | `True` when the motor is passive, or a profiled move has finished with the shaft within `control.target_tolerances()`; `False` while the motor runs at a constant speed |

### Moving

| Method | Does |
| :--- | :--- |
| `run(speed)` | run at a constant speed until the next command, ramped at the acceleration limit (and the deceleration limit when slowing) |
| `dc(duty)` | open loop, −100..100 % |
| `run_time(speed, time, then=Stop.HOLD, wait=True)` | a timed move: it takes `time` ms, then does `then` (Pybricks). `time` is 0..2147483647 ms (24.8 days), else `ValueError` |
| `run_angle(speed, rotation_angle, then=Stop.HOLD, wait=True)` | a relative move by `rotation_angle` degrees; a negative `speed` reverses |
| `run_target(speed, target_angle, then=Stop.HOLD, wait=True)` | an absolute move to `target_angle`; the sign of `speed` is ignored |
| `run_until_stalled(speed, then=Stop.COAST, duty_limit=None)` | run until the shaft is blocked, then return the angle; `duty_limit` (%) is how hard it pushes |
| `track_target(target_angle)` | unprofiled position servo: the reference jumps to the target |

`then` is carried out by the motion engine when the profile completes, so it works with `wait=False` too:

| `then` | At the end of the profile |
| :--- | :--- |
| `Stop.HOLD` | keep regulating at the target (default) |
| `Stop.COAST` | release |
| `Stop.BRAKE` | passive brake |
| `Stop.NONE` | no deceleration phase: reach the target at speed and keep running until the next command; `done()` is `True` from the target on |
| `Stop.COAST_SMART` | release, and start the next relative move from this target — only while the shaft still stands within twice the position tolerance (`control.target_tolerances()`, 2° by default) of it, as in Pybricks; a shaft moved further while coasting (a slope, a hand, an unwinding gearbox) starts from where it is |

**How the moves count.**

- `run_angle` counts from the aim the motor is holding, so chained relative moves are exact (ten `run_angle(200, 90)` are 900°); after a coast, brake or stall it counts from the measured angle.
- `run_time` covers the distance a trapezoid of `speed` covers in `time` at the speed and acceleration the controller will actually allow at the present pack voltage, so a limit shortens the distance, never the duration. `speed` 0 is a timed hold of the measured angle (`done()` is `False` until `time` has passed). A float `time` is exact only below about 2147483520 (32-bit floats: `2147483647.0` rounds up and is refused, and the message says why).
- `run_until_stalled` is `run(speed)` with the voltage capped at `duty_limit` % of `settings()`; it returns the angle once `stalled()` is true, ignoring the first 150 ms (the breakaway). **`duty_limit` is the stall force**: the motor pushes up to that cap before the stall is reported, and without one it pushes with the whole pack (an EV3 Large gripper closes hard — pass `duty_limit=30` or so for a gentle grip). It needs a real obstruction: an unloaded shaft creeps and the call does not return (Ctrl-C aborts); a `duty_limit` below the breakaway returns at once, where the shaft stands.
- `wait=True` polls every 2 ms; Ctrl-C and the user button keep working while a program waits.

### Stopping

| Method | Does |
| :--- | :--- |
| `stop()` | coast |
| `brake()` | passive brake |
| `hold()` | actively hold the current angle |

### Speed in percent

With `speed_unit=SpeedUnit.PERCENT` (constructor) or `speed_unit(SpeedUnit.PERCENT)` (any time), every speed argument and result of that motor is a percentage of `full_speed()`: `run`, `run_time`, `run_angle`, `run_target`, `run_until_stalled`, `speed()`, the speed in `control.limits`, `control.target_tolerances` and `control.stall_tolerances`. Accelerations stay in deg/s², `dc()` stays % duty.

| Method | Does |
| :--- | :--- |
| `speed_unit()`, `speed_unit(unit)` | read or switch the unit; switching converts nothing, it changes how numbers are read and reported |
| `full_speed()`, `full_speed(deg_s)` | what 100 % means in deg/s **at the present battery voltage**. Default: the motor model's rated no-load speed scaled by the pack voltage (the theoretical full speed), or the no-load speed `calibrate()` measured on this motor. Setting it stores deg/s per volt, so 100 % keeps tracking the battery |

The speed limit still applies, but a calibrated motor's default limit is its measured no-load speed when that is above the model's default, so `run(100)` is not clamped (`control.limits` reads 100 % on such a port).

### Calibrating the motor (`calibrate`)

| Method | Does |
| :--- | :--- |
| `calibrate()`, `calibrate(wait=True)` | the self-calibration of this port: about 7 s with the shaft free to turn (it moves up to about a turn and a half each way and ends near where it started). Returns `(b0, tau_ms, v_break_mv, v_f_mv)` |
| `calibrate(wait=False)` | start it and return `None` at once; a later `calibrate()` on the same port waits for it and returns its result |

- **What it measures:** `b0` (deg/s² per volt: how strongly the motor accelerates), `tau_ms` (its time constant), `v_break_mv` (the voltage that breaks the shaft free) and `v_f_mv` (the running-friction voltage), plus the motor's no-load speed, the direction its encoder counts and the encoder's phase widths in each direction of turning (these keep `speed()`, `Pose.velocity()` and the position between two encoder steps exact).
- **What it changes:** the result drives the port at once, is stored in the board's flash for that port and comes back at every boot. The measured no-load speed becomes this motor's 100 % (`full_speed()`) and, when higher than the model's default, its speed limit — on the open `Motor` object too. An encoder found counting against the drive (a non-LEGO motor wired the other way round, such as the JGA25 on the EVN cable) is flipped, and `evn.calibration(port)["encoder_reversed"]` says so.
- **Several motors at once:** `calibrate(wait=False)` starts a port and returns at once; the motion engine measures the started ports one after another while the program waits, so the program writes one loop instead of four. Wait with `evn.calibration(port)["busy"]` (or `calibrate()` on a port whose run is still going, which joins it — on a port that has already finished it starts a new run): `for m in motors: m.calibrate(wait=False)`, then `while any(evn.calibration(p)["busy"] for p in (1, 2, 3, 4)): wait(50)`.
- **Errors:** `RuntimeError("calibration failed: …")` when the shaft does not break away or the fit fails (the reason is also in `evn.calibration(port)["error"]`); `RuntimeError("port cannot calibrate (no motor model)")`. Ctrl-C, the user button or a soft reboot abort it: the motor coasts and `calibrate()` raises `KeyboardInterrupt`.
- **When:** once per motor and port, and again after swapping the motor. Choosing a different motor for the port (`evn.configure_motor()` or the Board view's gear) clears the port's calibration. The step-by-step guide, including the Board view's pulse button, is [Calibrating your robot](CALIBRATION.md#motors); the stored record is `evn.calibration(port)` ([Calibration records](#calibration-records-evncalibration)).

### Settings and control

| Method | Does |
| :--- | :--- |
| `settings(max_voltage, stall_timeout=)`, `settings()` | `max_voltage`: the voltage cap in mV applied to every command, 0..12000 (default 9000, above any 2S pack, so no effect until lowered; a value that rounds to 0 becomes the smallest cap, not "no cap"). `stall_timeout` (keyword-only, ms, 0 or 1..60000, default 1000): a `wait=True` move returns once the motor has been stalled this long — the hold keeps pushing and `stalled()` is `True`, but the program is not stuck on a gripper closed on a brick; 0 waits forever (Pybricks). The getter returns `(max_voltage, stall_timeout)` |
| `close()` | coast and free the port; later calls raise `RuntimeError("motor closed; create a new Motor")`. `with Motor(1) as m:` closes on exit |
| `control.limits(speed, acceleration, torque)`, `control.limits()` | `speed` caps every speed argument. `acceleration` is a number or an `(accel, decel)` tuple in deg/s²: the profiler honours the two independently (ramp up at `accel`, down at `decel`; `run()` ramps at `decel` whenever the speed magnitude shrinks); the getter returns the tuple when they differ. `torque` (mNm) becomes an equivalent voltage cap through the motor model. New limits apply to the next command; a non-positive limit is `ValueError` |
| `control.target_tolerances(speed, position)`, `control.target_tolerances()` | the `done()` criterion; defaults 50 deg/s, 1°. Both read back as the floats that were set |
| `control.stall_tolerances(speed, time)`, `control.stall_tolerances()` | stall detection below `speed` for `time` ms (0..10000); defaults 50 deg/s, 50 ms. The speed reads back as a float, the time as int ms |
| `control.law()`, `control.law(law)` | the control law: `"adrc"` (the default, active disturbance rejection, self-calibrated) or `"pid"` (the tuned cascade that `control.pid()` and `control.evn()` set); anything else is `ValueError("law must be 'adrc' or 'pid'")`. Positional. While the motor is driving, the new law is applied by its next command; the getter reports the law that command will use |
| `control.pid(kp, ki, kd, integral_deadzone, integral_limit)`, `control.pid()` | **`"pid"` law only** (the default `"adrc"` law ignores these). Pybricks units; `kd` is the cascade's velocity gain. `integral_deadzone` (deg, 0..5, default 0.75) is the endpoint deadzone and reads back as a float; `integral_limit` (% duty, 0..100, default 20) is the largest contribution the integrator may make. Pybricks' `integral_rate` is not accepted (`TypeError`); a negative gain is `ValueError`. Per motor object; the compiled per-model values are untouched |
| `control.evn(endpoint_kd, start_duty, hold_duty, friction_ff)`, `control.evn()` | **`"pid"` law only**: EVN ALPHA's own parameters of that law; the getter returns the compiled per-model values. `endpoint_kd`: velocity gain inside the endpoint window. `start_duty` / `hold_duty` (% duty, 0..100): the breakaway push and the least duty held near the target. `friction_ff` (%, 0..200): Coulomb friction feed-forward |
| `control.scale` | motor degrees per output degree (from `gears`; read-only) |
| `control.done()`, `control.stalled()`, `control.load()` | the same as the motor methods |
| `control.state()`, `model.state()`, `model.settings()` | controller and observer internals for tuning: see [Diagnostics](#diagnostics) |

Default limits, at the motor shaft:

| | EV3 Large | EV3 Medium |
| :--- | :--- | :--- |
| speed limit | 1000 deg/s (or the calibrated no-load speed when higher) | 1400 deg/s (or the calibrated no-load speed when higher) |
| acceleration limit | 2400 deg/s² | 3000 deg/s² |
| torque limit | 449 mNm | 206 mNm |
| `control.pid()` | (73837, 295, 3692, 0.75, 20) | (31402, 184, 342, 0.75, 20) |
| `control.evn()` | (923, 12, 20, 50) | (170, 83, 50, 20) |

The rated no-load speeds behind `full_speed()` are EV3 Large 1050, EV3 Medium 1560 and NXT 1020 deg/s at 9 V. The firmware also caps every move at what the calibrated motor can do at the present battery voltage, so a program never asks for a speed the battery cannot deliver. Higher limits are accepted but are outside the tested range.

### Motor configuration (`configure_motor`)

Say once what is plugged into a port, and every `Motor(port)` — in any program, from any computer, after every reboot — runs that motor. The Board view's gear button does the same.

| Call | Does |
| :--- | :--- |
| `evn.configure_motor(port, model, *, counts_per_rev=None, rated_voltage=0, no_load_speed=None)` | store on the board which motor is on port 1..4; `model=None` removes the configuration (back to the fallback) |
| `evn.motor_config(port)` | what the port runs now, as a dict (below) |

| `configure_motor` argument | Meaning |
| :--- | :--- |
| `model` | a library motor — `"EV3 Large"`, `"EV3 Medium"`, `"NXT"`, `"JGA25-370 6V 77RPM"` (`"jga25"`: a 6 V, 77 rpm, 1:78 gearmotor with an 11 cpr hall encoder, 3432 counts per revolution, the port capped at 6 V, EV3 Large control class), `"Pololu 25D 9.7:1 HP 12V"` (`"pololu25d_9_7"`: Pololu #4842, a 12 V high-power 9.68:1 gearmotor with a 48 CPR encoder, 464.64 counts per revolution, 1000 rpm = 6000 deg/s no-load at 12 V — about 3500 deg/s on the pack, its 12 V rating above the pack so no cap binds —, EV3 Medium control class; its stall current is above the port's 3 A rating, so never hold it stalled), `"CHR-GM16-030PA 9V 1:63"` (`"chr16_63"`: a 16 mm 9 V gearmotor, 1:63, with a 7 ppr hall encoder on the motor shaft, 1764 counts per revolution, 215 rpm = 1290 deg/s no-load at 9 V, the port capped at 9 V, above the 2S pack, so it never binds, EV3 Large control class, limits 900 deg/s and 5000 deg/s²; the family runs 1:10 to 1:360, and another ratio is a custom motor with 7 × 4 × the ratio counts) — or `"custom"` for any other DC motor with a quadrature encoder, or `None` |
| `counts_per_rev` | custom only, **required**: encoder edges per **output** revolution (one channel's pulses × 4 × the gear ratio; a LEGO motor is 720) |
| `rated_voltage` | custom only: mV, 1000..12000, the port's voltage cap (0 = no cap) |
| `no_load_speed` | custom only: deg/s at the rated voltage (left out or 0 = not known). It is the speed limit, 100 % and the control's first guess until `calibrate()` measures the motor; a custom motor runs on the EV3 Large control class, or the EV3 Medium class from 1300 deg/s |

- The three custom arguments with a library model raise `ValueError("counts_per_rev, rated_voltage and no_load_speed are for model='custom'")`; a custom motor without `counts_per_rev` raises `ValueError`.
- **A change to a different motor clears the port's calibration** — the old motor's numbers must not run the new one — so `calibrate()` afterwards. Until a custom, JGA25, Pololu 25D or CHR-GM16 motor is calibrated the firmware only knows the wiring convention for its encoder direction, so calibrate before the first closed-loop move; the constructor warns once that a custom motor is not calibrated.
- Nothing moves. The port must be free (`OSError(EBUSY)` while a `Motor` holds it) and every motor stopped (it is a flash write); `RuntimeError` says why a refusal changed nothing.
- `evn.motor_config(port)` returns `{"port", "model", "custom", "control_class", "counts_per_rev", "rated_voltage", "no_load_speed", "stored", "session"}`: `model` is `'EV3 Large'`, `'EV3 Medium'`, `'NXT'`, `'JGA25-370 6V 77RPM'`, `'Pololu 25D 9.7:1 HP 12V'`, `'CHR-GM16-030PA 9V 1:63'` or `'custom'`; `control_class` the standard model the control starts from (a custom motor's, or a library motor's own — the JGA25 and the CHR-GM16 run the EV3 Large class, the Pololu 25D the EV3 Medium class); `rated_voltage` the port's voltage cap (a custom motor's rated voltage, the JGA25's 6000, the CHR-GM16's 9000, the Pololu 25D's 12000 — above the pack, so it never binds —, 0 for a LEGO motor); `no_load_speed` at that voltage (at 9 V when uncapped); `stored` whether it is in flash; `session` whether a program's `Motor(port, model=)` runs a library model in its place until the next reboot.

**Example**

```python
from evn import Motor, Stop, wait
m = Motor(1)
m.run_angle(500, 360)                   # one turn at 500 deg/s, then hold
m.run_target(500, 0, then=Stop.COAST)   # back to 0, then release
m.run(300); wait(1000); m.stop()
print(m.angle(), m.speed(), m.load())
```

**Notes.** Every call after `close()` raises `RuntimeError`, and every `control` call raises `RuntimeError` when the motion engine is not running. Setters of `control` return once the motion engine has applied the value (at most 5 ms), so a getter straight after a setter reads the new value. A direct `Motor` command on a wheel that belongs to a `DriveBase` ends the base's maneuver. What happens at the end of a program, Ctrl-C and the user button: [Safety behaviour](#safety-behaviour).

## DriveBase — two motors as a robot

`evn.DriveBase` follows [`pybricks.robotics.DriveBase`](https://docs.pybricks.com/en/latest/robotics.html): two `Motor` objects, the wheel diameter and the axle track in mm. Distances are mm, speeds mm/s, accelerations mm/s²; headings are degrees, deg/s, deg/s², **positive = clockwise seen from above** (the `Pose` / compass convention). More in `examples/03_robot/`.

**Constructor**

```python
DriveBase(left_motor, right_motor, wheel_diameter, axle_track, *, imu=None, compass=None, declination=None, pose=None)
```

| Parameter | Meaning |
| :--- | :--- |
| `left_motor`, `right_motor` | two open `Motor` objects. Each motor's `positive_direction` is its forward direction (a mirrored left motor: `Motor(4, Direction.COUNTERCLOCKWISE)`), and its `gears=` make the values wheel degrees |
| `wheel_diameter` | mm |
| `axle_track` | mm, the **effective** track between the tyres' contact patches: measure it with one `turn(360)` against a floor mark, then rebuild the base with the measured value (its `Pose` is built from it) |
| `imu`, `compass` | the I2C ports 1–16 of existing `IMU` / `Compass` objects (keyword-only; `OSError` if no object is on that port). Either one makes the base build and own a `Pose` |
| `declination` | degrees added to the compass heading, east positive; needs `compass=` (`ValueError` without it) |
| `pose` | a `Pose` the program built, adopted by the base after a geometry check (keyword-only; not together with `imu=` / `compass=` / `declination=`) |

A new `DriveBase` on a motor that still belongs to one takes the pair over (the old base is closed, and with it its own `Pose` — unless you pass that Pose on as `pose=old.pose`, which hands it over with its ownership). So re-running the `DriveBase(...)` line with the same `Motor` objects works; re-running a whole cell raises `OSError(EBUSY)` at its first `Motor(port)` whose port is still held.

**The robot's pose.** `DriveBase(left, right, wheel_diameter=62.4, axle_track=170, imu=3)` builds an `evn.Pose` from the base's own geometry — the two motor ports, the wheel diameter and axle track, each motor's `positive_direction` (so no `reverse_left` to type) and the motors' gears as the gear ratio — so the geometry is typed once and cannot disagree between the two objects. `compass=` (with `declination=`) adds the compass the same way. `pose=` adopts a `Pose` you built instead, after checking it was built on the same physics: the same two ports as left and right, `reverse_left` / `reverse_right` matching the motors' directions, the gear ratio equal to the motors' gears and the same wheel diameter and axle track (`ValueError` naming what differs, `TypeError` for something that is not a `Pose`, `ValueError("pose= is closed")`). Read the pose as **`robot.pose`** — the same `Pose` object as ever (`position()`, `heading()`, `reset()`, …), or `None` when the base has none. The base holds that `Pose`, so it is never collected under the loop; `robot.close()` closes a `Pose` the base built and leaves one you built and gave it to the program; a `Pose` an old base built and handed over (`pose=old.pose`) comes with its ownership, so the new base's `close()` closes it. `OSError("a Pose object already exists: pass it as pose=, or close() it")` when your own `Pose` is already running; the two wheels must have the same gears for the base to build one (`ValueError`). Everything is checked before an old base on the same wheels is closed (the `declination=` value too: finite, -180..180, else `ValueError`), so a failed constructor leaves the old base working.

**The geometry has one home, the base.** A measured axle track (or wheel diameter) for a robot with a `DriveBase` goes into `DriveBase(..., axle_track=t_eff, imu=3)`: rebuild the base, and it builds its `Pose` from it. `robot.pose.settings(axle_track=...)` on the base's Pose is refused at the next `use_gyro(True)`, and if `use_gyro` is already on, the next maneuver raises `OSError` and turns it off (below). `Pose.settings()` is for a `Pose` without a base.

### Driving

| Method | Does |
| :--- | :--- |
| `straight(distance, then=Stop.HOLD, wait=True)` | drive `distance` mm (negative = backwards). `then`: `HOLD`, `COAST`, `BRAKE`, `COAST_SMART` (the next relative move counts from this move's aim); `Stop.NONE` raises `ValueError` (use `drive()`). `wait=False` returns at once — poll `done()` |
| `turn(angle, then=Stop.HOLD, wait=True)` | turn in place by `angle` degrees, clockwise positive |
| `arc(radius, distance=None, angle=None, then=Stop.HOLD, wait=True)` | drive along a circle of \|`radius`\| mm on the right (positive radius) or left (negative) for `distance` mm of path **or** `angle` degrees of heading (one of the two); negative = backwards |
| `curve(radius, angle, then=Stop.HOLD, wait=True)` | the same circle with the older Pybricks signs: the angle's sign picks the side (positive = right), the radius's sign the direction (negative = backwards), so `curve(-r, a)` retraces `curve(r, a)` |
| `drive(speed, turn_rate)` | mm/s along the path and deg/s of heading until the next command (positional, or `speed=` / `turn_rate=` as in Pybricks); both wheels ramp together (the path during the ramp is the steady-state arc), and if a wheel would exceed the weaker motor's limit both are scaled so the radius is kept |
| `stop()`, `brake()` | coast / brake both wheels |

### Measuring

| Method | Returns |
| :--- | :--- |
| `distance()`, `angle()` | mm driven and degrees turned since `reset()`, from the two encoders (ints) |
| `state()` | `(distance, drive_speed, angle, turn_rate)` as floats |
| `reset(distance=0, angle=0)` | start the readings again from these values |
| `done()` | `True` when both wheels have finished — `Motor.done()`'s meaning: profile complete and inside `control.target_tolerances()` — or are passive, or either wheel is stalled. With `use_gyro(True)` the wheels are judged against target + trim, and `done()` also waits for the pose to settle (or the trim to reach its bound, or 2 s after the profiles) |
| `stalled()` | `True` while either wheel is stalled; like `Motor`, a `wait=True` maneuver on a stalled robot returns on the stall timeout (the shorter of the two wheels' `settings()` timeouts) |

### Following the gyro (`use_gyro`)

| Method | Does |
| :--- | :--- |
| `use_gyro(True)`, `use_gyro(False)`, `use_gyro()` | close the loop over the base's `Pose` (`robot.pose`: built from `imu=` / `compass=` or given as `pose=`): the robot itself follows the path the program asked for — scrub on a turn, a dragged cable and the gyro's drift are corrected as they happen, at the pose rate (100 Hz with the IMU, 200 Hz on the wheels alone). An IMU on the pose gives the heading. `use_gyro(False)` drops the corrections accumulated so far, so a holding robot's wheels move back to their uncorrected targets (a small motion) |
| `follower(...)`, `follower()` | the loop's knobs, one set per robot (shared by every `DriveBase` object), keyword-only: `b` (400), `zeta` (0.7), `k_min` (4), `correction_speed` (150 mm/s), `correction_rate` (90 deg/s), `trim_limit` (180°), `trim_slew` (600 deg/s), `position_tolerance` (1 mm), `heading_tolerance` (0.3°), `settle_time` (100 ms). Every value must be positive and `zeta` in (0, 1), else `ValueError` |
| `pose_error()` | `(forward mm, left mm, heading deg, settled, trim_left, trim_right)`: where the ideal robot is, seen from the pose; `ValueError("use_gyro(True) first")` without the loop |

- With a pose on the base, `use_gyro(True)` re-checks that its geometry still agrees with the base's: a `Pose.settings()` since the base took it raises `ValueError("use_gyro: the Pose's wheel_diameter and axle_track must equal the base's (rebuild the DriveBase with the measured values; it builds its Pose from them)")`. One made while `use_gyro` is on makes the next maneuver raise `OSError("use_gyro: the Pose's geometry no longer matches the base's (use_gyro is now off; rebuild the DriveBase with the measured wheel_diameter / axle_track - it builds its Pose from them)")`, with `use_gyro` turned off and nothing moved.
- With no pose on the base but a `Pose` your program built running, `use_gyro(True)` adopts that one after the full check (ports, directions, gears, wheel diameter and axle track; a `ValueError` names what differs) and holds it from then on, so `robot.pose` returns it — the older form `pose = Pose(...)`, `robot = DriveBase(...)`, `robot.use_gyro(True)` keeps working and is now validated.
- With no pose anywhere it raises `ValueError("use_gyro needs a pose: DriveBase(..., imu=port) builds one, pose= takes yours")`; before the pose's first estimate, `OSError("the Pose has no estimate yet")`.
- With an IMU in the `Pose`, `use_gyro(True)` first waits (up to 30 s) until the gyro has calibrated (`IMU.ready()`: keep the robot still), else raises `OSError`. A calibrated IMU ([Calibrating your robot](CALIBRATION.md#imu)) is ready as soon as the robot is still.
- What the pose cannot see (a robot pushed sideways) is not corrected. The base holds its `Pose`, so it is never collected under the loop; if that `Pose` is closed (or replaced by another) while `use_gyro(True)` is on, the next maneuver raises `OSError` and `use_gyro` is off — the loop never trims on an estimate that is not its own. `robot.close()` closes a `Pose` the base built (or was handed by the base it replaced, `pose=old.pose`), never one you built and gave it or it adopted.
- `examples/03_robot/` is the whole set-up; the **robot follows its gyro** block does the same in blocks.

### Settings

| Method | Does |
| :--- | :--- |
| `settings(straight_speed, straight_acceleration, turn_rate, turn_acceleration)`, `settings()` | mm/s, mm/s², deg/s, deg/s²; an acceleration may be `(accel, decel)`. **Defaults: the weaker motor's `control.limits()`, the straight acceleration at 75 % of it** — about 770 mm/s, 1230 mm/s², 520 deg/s, 1100 deg/s² on two EV3 Mediums with 62.4 mm wheels 170 mm apart. Lower them for a heavier robot or a slick floor (the straight acceleration is where tyre slip starts); a value above the motor's limit is clamped to it |
| `close()` | coast both wheels and release them (the `Motor` objects stay open) |

**Example**

```python
from evn import Motor, Direction, DriveBase
left, right = Motor(4, Direction.COUNTERCLOCKWISE), Motor(3)
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=170)
robot.straight(300); robot.turn(45); robot.arc(-150, angle=90)
robot.drive(200, 30)                     # until the next command
robot.stop()
```

**How it drives.** A maneuver is two profiled moves on one time base: the wheel with the longer travel gets the maneuver's speed and acceleration, the other the same numbers scaled by the ratio of the travels, both started on the same 1 kHz tick — so a straight is straight and an arc is an arc, and each wheel then tracks its own reference with the calibrated controller. By default the wheels follow their encoders only: `imu=` (or `pose=`) gives the base a `Pose`, `robot.pose` gives you its position and heading, and `use_gyro(True)` puts that pose (and its gyro) into the loop. A direct `Motor` command on one wheel while a maneuver runs coasts the other wheel (Pybricks). A maneuver started while the robot is still moving lets each wheel blend from its own speed for one ramp; the endpoints stay exact.

## Pose — where the robot is

`evn.Pose` estimates the robot's position and heading on the floor from any subset of the two drive encoders, an `IMU` and a `Compass` — all eight combinations work; the sources not attached are simply left out. One object per robot. More in `examples/04_pose/`.

**Constructor**

```python
Pose(left=None, right=None, wheel_diameter=None, axle_track=None, *, gear_ratio=1.0, imu=None, compass=None, reverse_left=False, reverse_right=False, declination=0.0, imu_offset=None)
```

| Parameter | Default | Meaning |
| :--- | :--- | :--- |
| `left`, `right` | `None` | motor ports 1–4 of the two drive wheels; both or neither |
| `wheel_diameter`, `axle_track` | `None` | mm, both or neither, with the ports. The axle track that matters is the **effective** one (between the two contact patches as the robot really turns), see `settings()` |
| `gear_ratio` | 1.0 | motor turns per wheel turn |
| `imu`, `compass` | `None` | the I2C ports of existing `IMU` / `Compass` objects (`OSError` if no object is on that port; the compass counts once a calibration is installed). Set the module's `axes(top=, front=)` from its silkscreen **before** building the `Pose` — the filter takes the body frame those objects publish |
| `reverse_left`, `reverse_right` | `False` | that motor's positive direction is backwards (a mirrored mount) |
| `declination` | 0.0 | degrees added to the compass heading |
| `imu_offset` | `None` | `(x_mm, y_mm)`: where the IMU sits, forward and left of the axle mid-point (`(-50, 60)` is 50 mm behind, 60 mm left); a tape-measure value is enough. Needs `imu=` and **no motor ports** (`ValueError` with wheels: the accelerometer is not used then) |

Frames: `x` East / `y` North in mm (without a compass, `x` is +90° from the heading at `reset()`), heading clockwise from north in degrees, speed mm/s, yaw rate deg/s clockwise.

### Reading the pose

| Method | Returns |
| :--- | :--- |
| `position()` | `(x, y)` in mm |
| `heading()` | degrees clockwise from north, 0..360 |
| `velocity()` | `(speed, yaw_rate)`: mm/s, deg/s clockwise |
| `state()` | `(x, y, heading, speed, yaw_rate)`: the above in one call |
| `covariance()` | `(sigma_x, sigma_y, sigma_heading)`: mm, mm, degrees, the filter's own uncertainty |
| `parameters()` | `(r_left, r_right, track)` in mm, as the filter estimates them (they only move with turns) |
| `bounded()` | `False` while the live sources cannot bound the position (IMU alone, IMU + compass, none) |
| `sources()` | the sources contributing right now: a subset of `('wheels', 'imu', 'compass')` |
| `configured()` | the sources the object was built with |

### Setting it up

| Method | Does |
| :--- | :--- |
| `reset(x=0, y=0, heading=0)` | set the pose (mm, mm, degrees clockwise from north); biases and wheel parameters are kept. A re-framing, never a command: a `DriveBase` with `use_gyro(True)` re-anchors its ideal on the new pose and nothing moves — close an offset an outside reference revealed with an explicit `straight()`/`turn()` |
| `settings()`, `settings(wheel_diameter=, axle_track=)` | read or apply a calibrated geometry in mm (1..1000 / 1..2000), keyword-only. Measure the effective track with one commanded 360° turn against a floor mark: `t_eff = t * turned_by_the_encoders / 360`. This is the recipe for a `Pose` **without** a base: with a `DriveBase`, rebuild the base with `axle_track=t_eff` (it builds its Pose from it) — `settings()` on the base's Pose is refused at the next `use_gyro(True)` (see [Following the gyro](#following-the-gyro-use_gyro)). The pose, the heading and the gyro bias are kept; the wheel estimates (`parameters()` and their uncertainty) restart at every call, even with the values already in force. **Not stored** — a power cycle brings back the constructor's numbers, so a program sets it at start-up. The setter raises `ValueError` without motor ports |
| `close()` | stop the estimator so another `Pose` can start; `with Pose(...) as pose:` closes on exit and is the idiom |

**Example**

```python
from evn import Pose, IMU
imu = IMU(3)
with Pose(1, 2, 56, 112, imu=3) as pose:
    print(pose.position(), pose.heading(), pose.sources())
```

**Notes**

- A second `Pose` raises `OSError` until the first is closed; every call after `close()` raises `ValueError("Pose is closed")`.
- A `Pose` dropped without `close()` (a function-local, a re-run cell) is stopped at the next garbage collection — and the next `Pose(...)` runs one collection before it decides, so a Pose dropped inside a function is released at once (no `gc.collect()` needed). A bare temporary in the same statement scope (`Pose(...).heading()` then `Pose(...)`) can survive that one collection and still raise "already exists" — use a function, `with`, or `close()`.
- A `DriveBase` holds the `Pose` it built (`imu=` / `compass=`), was given (`pose=`) or adopted (`use_gyro(True)`), so you need not keep your own reference to it (see [DriveBase](#following-the-gyro-use_gyro)). A robot with a `DriveBase` normally does not build a `Pose` at all: `DriveBase(..., imu=port)` builds it, and `robot.pose` is it.
- A source whose driver is lost leaves `sources()` by itself and rejoins when running. `'compass'` is also absent while the compass's field is being rejected (`Compass.heading_confidence()` 0: a motor's magnets, a steel table) — **the heading then has no absolute reference and drifts with the gyro/wheels** until the field is the Earth's again.
- The compass counts only once it is calibrated, and a calibrated IMU starts with its gyro corrected: [Calibrating your robot](CALIBRATION.md).
- Bench diagnostics (`_stats()`, `_bias()`, `_step()`): see [Diagnostics](#diagnostics).

## Calibration records (evn.calibration)

Three things on a robot are calibrated once and remembered by the board, per port, with the date: each **motor** (`Motor.calibrate()`), the **IMU** (`IMU.calibrate()`) and the **compass** (`Compass.calibrate()` … `calibrate_stop()`). [Calibrating your robot](CALIBRATION.md) is the step-by-step guide (from the extension's Board view, from Python and from blocks). These module functions read and clear the stored records without opening the device:

| Call | Returns / does |
| :--- | :--- |
| `evn.calibration(port)` | the calibration motor port 1..4 runs, as a dict (below) |
| `evn.clear_calibration(port)` | forget motor port 1..4's calibration (record and running numbers): back to the motor's compiled defaults as if `calibrate()` had never run. Nothing moves; the port must be free (`OSError(EBUSY)` while a `Motor` holds it) and every motor stopped; `RuntimeError` says why a refusal changed nothing |
| `evn.imu_calibration(port)` | the stored IMU calibration of I2C port 1..16, the same dict as [`IMU.calibration()`](#imu-calibration) |
| `evn.compass_calibration(port)` | the stored compass calibration of I2C port 1..16, the same dict as [`Compass.stored_calibration()`](#compass-calibration) |
| `evn.clock()` | the date source of every record's `stamp` ([Board](#clock-version-and-restarts)) |

`evn.calibration(port)` returns `{"port", "calibrated", "busy", "stored", "stamp", "b0", "tau_ms", "v_break_mv", "v_f_mv", "no_load_speed", "vbus_mv", "encoder_reversed", "warning", "error"}`:

- `calibrated`: a `calibrate()` result drives the port; `busy`: a `calibrate(wait=False)` is running on it; `stored`: it is in flash.
- `stamp`: seconds since 1970 UTC when it was made; 0 when the board's clock was not set then (the extension's console sets the clock at connect, so a calibration run from the Board view carries its date; a bare program's `calibrate()` does not).
- `b0` (deg/s² per V), `tau_ms`, `v_break_mv`, `v_f_mv`: what `calibrate()` returned; `no_load_speed`: deg/s at 9 V, or at the motor's rated voltage; `vbus_mv`: the pack during the calibration.
- `encoder_reversed`: `True` when the calibration found the encoder counting **against** the drive and flipped the port's decoder. The flip is stored with the record, comes back at boot, and goes when the record is cleared or the motor changed. It belongs to the port's record, not to the motor: swapping a LEGO motor onto a port whose record says *reversed* without changing the port's configuration would run it flipped (positive feedback) — change the motor in the Board view (which clears the record) or `clear_calibration(port)` first.
- `warning`: what is wrong with the record found in flash (made for another motor: refused; implausible for the model: applied anyway), else `None`; `error`: why the last `calibrate()` on this port failed or was refused, else `None`.

## Standard peripherals

Every device below is an *EVN Standard Peripheral*: plug it in, name the port, read. The firmware identifies the chip by its ID register, configures it, keeps the latest reading in a cache refreshed in the background (reading adds no bus traffic of its own; the refresh runs at up to 1 kHz inside waits, prints and the getters themselves) and re-attaches it after an unplug. All fifteen have been tested on hardware (the dates are in the [appendix](#validation-record)); `docs/STANDARD_PERIPHERALS.md` in the firmware repository is the full reference, with a function-by-function comparison to the EVN Arduino classes.

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
| [`Display`](#display--12864-oled-ssd1306--ssd1315) | EVN 128×64 OLED (SSD1306 / SSD1315) | I2C 1–16 | `examples/13_display/` |
| [`MatrixLED`](#matrixled--88-led-matrix-ht16k33) | EVN 8×8 LED matrix (HT16K33) | I2C 1–16 | `examples/14_led_matrix/` |
| [`SevenSegmentLED`](#sevensegmentled--4-digit-seven-segment-display-ht16k33) | EVN 4-digit display (HT16K33) | I2C 1–16 | `examples/15_seven_segment/` |
| [`RGBLED`](#rgbled--rgb-led-module-ws2812b) | EVN RGB LED module / WS2812B strip | servo 1–4 | `examples/16_rgb_leds/` |
| [`Servo`](#servo--hobby-servo-geekservo-270--continuous-rotation) | Geekservo 270° / continuous-rotation | servo 1–4 | `examples/17_servo/` |
| [`Bluetooth`](#bluetooth--bluetooth-module-hc-05) | EVN Bluetooth module (HC-05) | serial 1–2 | `examples/18_bluetooth/` |

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

## Display — 128×64 OLED (SSD1306 / SSD1315)

Plug the EVN OLED into an I2C port; only SDA and SCL are used. Text sits on a grid of 16 columns × 8 rows of 8×8 characters; drawing uses pixels, x 0..127 from the left and y 0..63 from the top. The `draw_*` calls and `print()` are Pybricks' EV3 screen names.

**Constructor**

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
| `oled.draw_pixel(x, y, color=Color.BLACK)` | one pixel in EV3 colours: the EV3 draws `Color.BLACK` on a white screen, so here a colour **lights** the pixel and `Color.WHITE`, `Color.GRAY` (any grey of 50 % value or more) and `Color.NONE` **erase** it; `True` / `False` work too. A pixel off the screen is skipped, not refused |
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

**Example**

```python
from evn import Display
oled = Display(16)
oled.write(0, "Distance")
oled.label(1, "mm:")
oled.data(1, 123)
```

**Notes**

Drawing changes a picture held in the firmware and returns at once (50 `write()` calls take about 28 ms); the changed parts are streamed to the panel in the background, a whole new picture in about 60 ms, or at once with `show()`. Drawing and `contrast()`, `flip()`, `invert()`, `on()` / `off()` keep working while the display is unplugged, and a replugged display gets its picture and settings back by itself; `show()`, `scroll()`, `scroll_stop()`, `fade()`, `zoom()`, `all_on()` and `command()` need the panel and raise `OSError("display on port N not responding")` while it is unplugged.

The constructor raises `OSError` when nothing answers on the port or two displays are already open. The getters read the firmware's copy and do not raise while the display is unplugged. After `close()` every call except `close()` raises `ValueError("Display is closed")`.

## MatrixLED — 8×8 LED matrix (HT16K33)

Plug the EVN 8×8 LED matrix into an I2C port; only SDA and SCL are used. The names follow Pybricks' `hub.display` (row first, `icon()`, `number()`, `text()`, `animate()`, `orientation()`).

**Constructor**

| Call | Notes |
| :--- | :--- |
| `m = MatrixLED(port, addr=None)` | `port` 1..16. `addr=None` is the EVN matrix's 0x71; another HT16K33 board 0x71..0x77. **0x70 raises `ValueError`**: it is the board's own I2C multiplexer. `OSError` if nothing answers at the address (the chip has no ID register: an answer at the address is taken as the display), `OSError` when four LED displays (`MatrixLED` and `SevenSegmentLED` together) are already open, `OSError(ETIMEDOUT)` if the chip does not come up. One LED display per port: a second `MatrixLED` or `SevenSegmentLED` on the same port re-attaches the one slot at its own address. Returns with the matrix cleared and on, brightness 16, no blink (≈ 6 ms) |

### Drawing

| Call | Notes |
| :--- | :--- |
| `m.pixel(row, column, brightness=100)` | row 0..7 from the top, column 0..7 from the left (else `ValueError`); `brightness` 0, 0.0 or `False` turns the pixel off, any other value lights it (the chip has one brightness for the whole matrix: `m.brightness()`) |
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
| `m.orientation([up])`, `m.orientation(*, invert_x=False, invert_y=False, swap_xy=False)` | which edge of the matrix is up: `Side.TOP` (as wired, the default), `Side.RIGHT`, `Side.BOTTOM` or `Side.LEFT`; any other `Side` raises `ValueError`. The keyword form is for a mirrored mounting (the flags left out are reset to `False`). `m.orientation()` returns the `Side` (an int, so `m.orientation() == Side.RIGHT` works), or `(invert_x, invert_y, swap_xy)` when the setting is not a rotation. It applies to the drawing calls that follow it: a picture already drawn keeps its LEDs |
| `m.clear()` | every LED off |
| `m.fill()` | every LED on |
| `m.show()` | send the picture to the chip now and wait (≈ 1.2 ms) instead of within the next 10 ms; `OSError` while the display is unplugged |
| `m.raw([frame])`, `m.raw(led, on)` | the chip's 16 display-RAM bytes: `m.raw()` returns them (as held by the firmware), `m.raw(frame)` writes all 16 (another length raises `ValueError`), `m.raw(led, on)` sets one LED 0..127 (= byte × 8 + bit). Not affected by `orientation()` |

### Panel

| Call | Notes |
| :--- | :--- |
| `m.brightness([level])` | 1 (dim) .. 16 (default), the whole matrix |
| `m.blink([hz])` | 0 (off, the default), 2, 1 or 0.5 Hz; any other value raises `ValueError` |
| `m.on(enable=True, /)` | switch the display on (or off with `False`); the picture is kept |
| `m.off()` | switch the display off; the picture is kept and comes back with `on()` |
| `m.keys([enable])` | the chip's key scan: `m.keys(True)` / `m.keys(False)` turns it on or off (off by default), `m.keys()` returns the six key-scan bytes, or raises `ValueError("key scan is off: keys(True)")` while it is off or before its first scan. The EVN matrix has no keys wired: six zero bytes |
| `m.close()` | switch the display off (chip in standby) and free the port. Two objects on one port share the display, so closing one closes both |

### Icon

`Icon` (from `evn`) is Pybricks' icon set redrawn at 8×8, for `m.icon()`, `m.image()`, `m.bitmap()` and `m.animate()`. Each member is 8 `bytes`, one per row, top row first, bit 7 = leftmost pixel, so your own `bytes` of the same form work in the same places.

`Icon.UP`, `DOWN`, `LEFT`, `RIGHT`, `ARROW_UP`, `ARROW_DOWN`, `ARROW_LEFT`, `ARROW_RIGHT`, `ARROW_RIGHT_UP`, `ARROW_RIGHT_DOWN`, `ARROW_LEFT_UP`, `ARROW_LEFT_DOWN`, `HAPPY`, `SAD`, `EYE_LEFT`, `EYE_RIGHT`, `EYE_LEFT_BLINK`, `EYE_RIGHT_BLINK`, `EYE_LEFT_BROW`, `EYE_RIGHT_BROW`, `EYE_LEFT_BROW_UP`, `EYE_RIGHT_BROW_UP`, `HEART`, `PAUSE`, `EMPTY`, `FULL`, `SQUARE`, `TRIANGLE_UP`, `TRIANGLE_DOWN`, `TRIANGLE_LEFT`, `TRIANGLE_RIGHT`, `CIRCLE`, `CLOCKWISE`, `COUNTERCLOCKWISE`, `TRUE`, `FALSE`.

**Example**

```python
from evn import MatrixLED, Icon, Side
m = MatrixLED(1)
m.orientation(Side.RIGHT)   # the matrix is mounted with its right edge up
m.animate([Icon.HAPPY, Icon.SAD], 500)
```

**Notes**

Drawing calls change a picture held in the firmware, which reaches the chip within 10 ms (1.2–3.8 ms measured); `show()` sends it at once. Drawing calls and settings keep working while the display is unplugged, and a replugged display gets its picture, brightness, blink and orientation back by itself (the firmware looks for it every 250 ms); a chip reset without an unplug (a supply dip) is healed within about 110 ms.

The constructor raises `OSError` when nothing answers on the port or the display pool is full. The display's getters read the firmware's copy and do not raise while it is unplugged; `show()` does, and so does a setting sent while the chip stops answering. After `close()` every call except `close()` raises `ValueError("MatrixLED is closed")`.

## SevenSegmentLED — 4-digit seven-segment display (HT16K33)

Plug the EVN 4-digit seven-segment display into an I2C port; only SDA and SCL are used. Positions are 0..3 from the left.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `seg = SevenSegmentLED(port, addr=None)` | `port` 1..16. `addr=None` is the EVN seven-segment board's 0x74; another HT16K33 board 0x71..0x77. **0x70 raises `ValueError`**: it is the board's own I2C multiplexer. `OSError` if nothing answers at the address (the chip has no ID register: an answer at the address is taken as the display), `OSError` when four LED displays (`MatrixLED` and `SevenSegmentLED` together) are already open, `OSError(ETIMEDOUT)` if the chip does not come up. One LED display per port: a second `MatrixLED` or `SevenSegmentLED` on the same port re-attaches the one slot at its own address. Returns with the display cleared and on, brightness 16, no blink (≈ 6 ms) |

### Numbers and letters

| Call | Notes |
| :--- | :--- |
| `seg.number(value)` | a float with the point after the integer part and the remaining positions filled with decimals, cut off rather than rounded (the EVN Arduino layout): `12.5` → `12.50`, `3.14159` → `3.141`, `1234.5` → `1234.`, `-1.5` → `-1.50`; a float of 10000 or more shows `9999`, of −1000 or less `-999`. An int goes to the `integer()` layout and raises `ValueError("number must be -999..9999")` outside that range; NaN or infinity raise `ValueError`. Clears the colon |
| `seg.integer(value)` | −999..9999, right-aligned, a minus before a negative number (`-42` → ` -42`); outside the range `ValueError`. Clears the points and the colon |
| `seg.text(text)` | up to 4 characters, left-aligned (any after the fourth are ignored); a `'.'` after a character lights that character's point (`"12.5"`). Every position is cleared first (the colon is kept). Lower case is accepted; a character without a glyph (see `char()`) raises `ValueError`, with the characters before it already drawn |
| `seg.digit(position, value)` | `value` 0..9 at `position` 0..3 (else `ValueError`); the position's point is kept |
| `seg.char(position, letter)` | the first character of `letter`: `0`–`9`, `A B C D E F G H J L N O P R T U Y` (either case), `-`, `_` or a space; anything else, or an empty string, raises `ValueError`. The position's point is kept |
| `seg.point(position, on=True, /)` | the decimal point after that position; a `False` last argument turns it off |
| `seg.colon(on=True, /)` | the colon between positions 1 and 2; `False` turns it off |
| `seg.segments(position, mask)` | raw segments, `mask` 0..255: a..g = bits 0..6, the point = bit 7 |
| `seg.clear_position(position, clear_point=True, /)` | blank one position; a `False` last argument keeps its point |
| `seg.clear()` | every segment, point and the colon off |
| `seg.fill()` | every segment, point and the colon on |
| `seg.show()` | send the picture to the chip now and wait (≈ 1.1 ms) instead of within the next 10 ms; `OSError` while the display is unplugged |
| `seg.raw([frame])`, `seg.raw(led, on)` | the chip's 16 display-RAM bytes: `seg.raw()` returns them (as held by the firmware), `seg.raw(frame)` writes all 16 (another length raises `ValueError`), `seg.raw(led, on)` sets one LED 0..127 (= byte × 8 + bit) |

### Panel

| Call | Notes |
| :--- | :--- |
| `seg.brightness([level])` | 1 (dim) .. 16 (default), the whole display |
| `seg.blink([hz])` | 0 (off, the default), 2, 1 or 0.5 Hz; any other value raises `ValueError` |
| `seg.on(enable=True, /)` | switch the display on (or off with `False`); what it shows is kept |
| `seg.off()` | switch the display off; what it shows is kept and comes back with `on()` |
| `seg.keys([enable])` | the chip's key scan: `seg.keys(True)` / `seg.keys(False)` turns it on or off (off by default), `seg.keys()` returns the six key-scan bytes, or raises `ValueError("key scan is off: keys(True)")` while it is off or before its first scan. The EVN board has no keys wired: six zero bytes |
| `seg.close()` | switch the display off (chip in standby) and free the port. Two objects on one port share the display, so closing one closes both |

**Example**

```python
from evn import SevenSegmentLED
seg = SevenSegmentLED(2)
seg.text("1234"); seg.colon(True)   # 12:34
seg.number(3.14159)                  # 3.141 (number() clears the colon)
```

**Notes**

Every call changes a picture held in the firmware, which reaches the chip within 10 ms (1.7–4.9 ms measured; many changes in a row go out as one write); `show()` sends it at once. The calls and settings keep working while the display is unplugged, and a replugged display gets its digits, brightness and blink back by itself (the firmware looks for it every 250 ms).

The constructor raises `OSError` when nothing answers on the port or the display pool is full. The display's getters read the firmware's copy and do not raise while it is unplugged; `show()` does, and so does a setting sent while the chip stops answering. After `close()` every call except `close()` raises `ValueError("SevenSegmentLED is closed")`.

## RGBLED — RGB LED module (WS2812B)

Plug the EVN RGB LED module (or any WS2812B strip) into a servo port; the strip borrows that port's servo channel while the object is open.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `leds = RGBLED(port, count=8, *, invert=False)` | `port` is the servo port, 1..4; `count` 1..64 LEDs (8 = the EVN module), brightness starts at 255 and every LED off. `invert` is keyword-only: `True` makes LED 0 the far end of the strip. `ValueError` for a port or count out of range; `OSError` while a `Servo` object holds the port (`"servo port n is used by a Servo object"`), while another `RGBLED` already has it (`"... already has an RGBLED strip"`) or when the channel cannot be taken (`"... is not available for an LED strip"`) |

### Colours

| Call | Notes |
| :--- | :--- |
| `leds.on(color)` | every LED this colour (Pybricks `hub.light.on`): a `Color`, an `(r, g, b)` tuple, or `None` for off |
| `leds.on([c0, c1, ...])` | one colour per LED from LED 0 on (Pybricks `ColorLightMatrix`); `None` in the list turns that LED off, LEDs past the end of the list keep their colour, entries past `count` are ignored |
| `leds.off()` | every LED off (ends a pattern) |
| `leds.set(led, r, g, b)`, `leds.set(led, color)` | one LED; `color` is a `Color` or an `(r, g, b)` tuple, components 0..255. `led` 0..`count`−1, else `ValueError("led index out of range")` |
| `leds.fill(r, g, b)`, `leds.fill(color)` | every LED the same colour |
| `leds.range(first, last, r, g, b)`, `leds.range(first, last, color)` | LEDs `first`..`last` inclusive |
| `leds.clear()` | every LED off |
| `leds.get(led)` | `(r, g, b)` stored for that LED, before the brightness scale |
| `leds.hsv(h, s, v)` | colour helper, does not touch the strip: `h` degrees (wrapped into 0..359), `s` and `v` 0..100 → `(r, g, b)`; `ValueError` for `s` or `v` outside 0..100 |

### Patterns

| Call | Notes |
| :--- | :--- |
| `leds.blink(color, durations)` | background pattern, the whole strip: `color` on / off for `[on1, off1, on2, off2, ...]` ms, repeated until something else is written. 2..16 entries, an even number of them, each ≥ 2 ms, else `ValueError`. `leds.blink(Color.BLUE, [500, 500])` |
| `leds.animate(colors, interval)` | background pattern: the colours one after another for `interval` ms each (≥ 2 ms), repeated. 1..16 colours; `None` is off. `leds.animate([Color.RED, Color.GREEN], 250)` |
| `leds.pattern()` | `'blink'`, `'animate'` or `None` |
| `leds.stop()` | end the pattern and keep the colours it was showing |

### Settings

| Call | Notes |
| :--- | :--- |
| `leds.brightness([value])` | global scale 0..255 (default 255, very bright on the EVN module: 40 or so is plenty indoors) applied as the frame is sent; the stored colours keep their full values |
| `leds.count([n])` | LEDs on the strip, 1..64. An LED re-exposed by a larger count is off until it is set; LEDs beyond a smaller count are no longer sent, so they keep showing their last colour (clear them before shrinking the count) |
| `leds.invert([enable])` | `True`: LED 0 is the far end of the strip (a module mounted the other way round) |
| `leds.show()` | send the frame now and return once the strip has it (0.6 ms on the 8-LED module: 30 µs per LED + 340 µs latch). Not needed: every change goes out by itself within a millisecond. `OSError(ETIMEDOUT)` if the previous frame blocks it for 20 ms |
| `leds.close()` | a black frame goes out (to the `count()` LEDs only) and the servo channel is handed back once it has drained, so the strip is dark and the port free about 1–3 ms later: `Servo(port)` then works without a soft reset, straight away too (its constructor waits up to 10 ms for the hand-back). A second `close()` does nothing, and never touches a strip a newer `RGBLED(port)` has opened |

**Example**

```python
from evn import RGBLED, Color
leds = RGBLED(1)                      # servo port 1, the 8-LED module
leds.on([Color.RED, Color.GREEN, None, Color.BLUE])
leds.blink(Color.YELLOW, [200, 200, 200, 800])   # double blink, in the background
```

**Notes**

Any `set()`, `fill()`, `range()`, `clear()`, `on()` or `off()` ends a running `blink()` / `animate()`. A pattern is stepped by the firmware's 1 kHz poll in the background, so it keeps time while the program waits, prints or computes; a step below 2 ms is refused rather than silently stretched. Colours accept the whole `Color` set, including `Color(h, s, v)`, `c * 0.5` (dimmer) and `c >> 30` (hue shifted).

The servo port has one owner at a time: `Servo(n)` raises `OSError("servo port n is used by an RGBLED strip")` while the strip is open, and `RGBLED(n)` raises while a `Servo` object holds the port (`Servo.close()` gives it back). A servo port pulses nothing until a `Servo` object is built, so a strip plugged in at power-on stays dark.

Nothing is read back from the strip, so there is no unplug detection: writes to an unplugged strip simply go nowhere. After `close()` every call except `close()` itself raises `ValueError("RGBLED is closed")`, even once a new `RGBLED(port)` has opened the same port: an old object never acts on the new one's strip.

## Servo — hobby servo (Geekservo 270° / continuous-rotation)

Plug a servo into servo port 1..4 and name its profile; `Servo(port)` is the kit's Geekservo 270° servo. The port sends 50 Hz pulses, and a new position is on the wire within one 20 ms frame.

| Profile | Travel | Pulse | Start | Sweep limit | Drive with |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `"geekservo_270"` (default) | 0..270° | 600..2400 µs | 135° | 500 deg/s | `angle()`, `move()` |
| `"generic"` | 0..180° | 500..2500 µs | 90° | 500 deg/s | `angle()`, `move()` |
| `"geekservo_cr"` | continuous rotation | 600..2400 µs, stop = 1500 µs | stopped | — | `duty()` |

**Constructor**

| Call | Notes |
| :--- | :--- |
| `servo = Servo(port, profile="geekservo_270", reverse=False, *, range=None, min_us=None, max_us=None, start=None, max_dps=None)` | `port` 1..4; `profile` one of the three above. `reverse=True` mirrors the direction (0° at the `max_us` end; a positive duty the other way). The keyword-only overrides replace one field of the profile: `range` 0..3600 degrees (0 = continuous rotation), `min_us` / `max_us` 200..2800 with `min_us < max_us`, `start` degrees within the range, `max_dps` ≥ 1. `range=R` without `start=` starts at R/2. The servo goes to its start position (or its stop pulse) at once. `ValueError` for any value out of range, an unknown profile or a non-finite number; `OSError` while an `RGBLED` strip holds the port or the port is not available |

### Moving

| Call | Notes |
| :--- | :--- |
| `servo.angle([deg, reverse=False])` | fixed-range profiles: jump to `deg` (0..range, else `ValueError`); `reverse` (positional) mirrors this one write's pulse, but the tracked position stays `deg`, so a later `move()` starts from the unmirrored `deg` and the servo jumps first — use the constructor's `reverse=True` for a mirrored mounting. `servo.angle()` → the tracked position in degrees (float) — what was last commanded, not a measurement. `TypeError` on a continuous profile |
| `servo.move(angle, speed=None, wait=True)` | fixed-range profiles: sweep from the tracked position to `angle` at `speed` deg/s (default and upper limit the profile's `max_dps`; a higher speed is capped to it, a negative one counts as positive). `wait=True` returns at the end of the sweep; `wait=False` returns at once — poll `done()`. `speed=0` raises `ValueError` (use `angle()` to jump); `TypeError` on a continuous profile |
| `servo.done()` | `True` when no sweep is running |
| `servo.duty([pct])` | continuous profile: −100..100 % (0 = the stop pulse), pulse = (1 − \|pct\|/100) × half the span from the `min_us` end for a positive duty and from the `max_us` end for a negative one (duty 50 → 1050 µs). `servo.duty()` → the current duty (float). `ValueError` outside −100..100; `TypeError` on a fixed-range profile |
| `servo.stop()` | continuous: the stop pulse (duty 0); fixed-range: end a sweep where it is and hold that position |
| `servo.pulse([us])` | the raw pulse width, 200..2800 µs (`ValueError` outside); the tracked position follows it. `servo.pulse()` → the current width (int) |

### Settings

| Call | Notes |
| :--- | :--- |
| `servo.profile()` | `(name, range, min_us, max_us, start, max_dps, reverse)` in force, overrides and `set_range()` included |
| `servo.set_range(min_us, max_us)` | new pulse endpoints for this servo, 200 ≤ `min_us` < `max_us` ≤ 2800 (`ValueError` otherwise); the current position or duty is re-sent under them at once |
| `servo.enable()` | pulses on again, at the last width |
| `servo.disable()` | pulses off and the pin low: the servo goes limp. Sticky until `enable()` (a later write does not revive it) or a new `Servo` object on the port |
| `servo.close()` | give the port back: the pulse stops and the pin goes low, so an `RGBLED` strip or a new `Servo` object can take it without a soft reset |

**Example**

```python
from evn import Servo
arm = Servo(1)                   # Geekservo 270°, starts at 135°
arm.move(270, speed=200)         # sweep at 200 deg/s, returns at the end
wheel = Servo(2, "geekservo_cr")
wheel.duty(50)                   # about 185 deg/s unloaded; wheel.stop() to stop
```

**Notes**

The emergency stop (Ctrl-C, the board button) ends every sweep and sends a continuous servo its stop pulse; a fixed-range servo keeps holding its position, the way a motor keeps its brake. A servo port pulses nothing until the first `Servo` object on it is built, and a new object drives its port even after `disable()` on an earlier one.

The port has one owner at a time: `RGBLED(n)` raises `OSError("servo port n is used by a Servo object")` while this object is open, and while a strip holds the port the constructor and every writing call here raise `OSError("servo port n is used by an RGBLED strip")`. A strip's `close()` frees the port about 1–3 ms later (its black frame drains first); `Servo(port)` straight after `leds.close()` waits up to 10 ms for that, and raises only if the strip is still open or has not handed the port back within those 10 ms.

A servo has no feedback line, so nothing detects an unplugged servo. After `close()` every call except `close()` itself raises `ValueError("Servo is closed")`.

## Bluetooth — Bluetooth module (HC-05)

Plug the EVN Bluetooth module into Serial 1 or Serial 2. Once a peer is connected the module is a transparent serial link: bytes written on one end come out of the other.

The module has two modes. **Hold its button while switching the board on** and it boots in command mode: the constructor then programs the baud, name and role, reboots the module (about 1 s) and switches to data mode. Switched on without the button it is already in data mode, and the constructor only opens the port at `baud` after a 300 ms `AT` probe that goes unanswered. `configured()` says which happened. The settings persist in the module, so it only needs programming once.

**Constructor**

| Call | Notes |
| :--- | :--- |
| `bt = Bluetooth(port, baud=230400, name="EVN Bluetooth", mode="remote", addr=None, *, stay_in_command=False, wait=True)` | `port` is the serial port, 1 or 2. Applied only in command mode (button held): `baud` 4800..1382400, rounded down to the module's table (4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1382400) — 230400 is the highest the module sustains without losing data; `name` 1..32 characters; `mode` `'remote'` (a PC or a host module connects to it) or `'host'` (it connects by itself to the module at `addr`, `'NAP,UAP,LAP'` as `address()` prints it, `:` accepted). `stay_in_command=True` leaves the module in command mode for `command()`, `address()`, `version()`. `wait=True` returns once the module is ready (`OSError(ETIMEDOUT)` after 3 s); `wait=False` returns at once — poll `ready()`. `ValueError` for any value out of range; `OSError` while an `evn.UART` object or another live `Bluetooth` object holds the port, `OSError(EIO)` when the port cannot be opened |

### Sending and receiving

| Call | Notes |
| :--- | :--- |
| `bt.write(data)` | queue `bytes` for the peer; returns `len(data)`. Every byte is queued, never dropped: it waits only while the 1 KiB transmit queue is full. `OSError(EIO)` if the module leaves data mode meanwhile. Bytes written with no peer connected are lost inside the module |
| `bt.read(n=-1, timeout=0)` | up to `n` bytes (everything buffered when `n` is −1) as `bytes`. `timeout=0` returns at once (`b""` when nothing is waiting), `timeout=None` waits for `n` bytes (at least one when `n` is −1), a value in ms waits at most that long and returns what arrived. `ValueError` for a negative timeout |
| `bt.readline(timeout=5000)` | the next line without its `b"\n"` (and a `b"\r"` in front of it), or `None` on timeout or if the module leaves data mode. Only the line leaves the buffer; `timeout=0` never waits; `ValueError` for a negative timeout. A line longer than 255 bytes never completes and `overflow()` counts the drop |
| `bt.read_all()` | everything buffered, at once (`b""` when nothing) |
| `bt.any()`, `bt.waiting()` | bytes buffered (`waiting` is the Pybricks `UARTDevice` name) |
| `bt.overflow()` | bytes the 256-byte receive buffer had to drop since the last call because the program read too slowly; read-and-clear, 0 means nothing was lost |
| `bt.clear()` | drop everything buffered |
| `bt.wait_until(pattern, timeout=None)` | wait for the byte sequence `pattern` (1..32 bytes), discarding everything up to and including it; `True` when it arrived, `False` after `timeout` ms. `OSError(EIO)` if the module leaves data mode |
| `bt.set_baudrate(baud)` | the board side's speed, 1200..1382400, for a module already set to another baud (the module's own baud only changes through the constructor). Queued bytes leave at the old speed first. Data mode only, `ValueError` otherwise |

### The module

| Call | Notes |
| :--- | :--- |
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

**Example** — the REPL over the air, in `boot.py`:

```python
import evn
bt = evn.Bluetooth(2)
bt.repl(True)
```

**Notes**

**Pairing with a PC.** Pair the module in the Windows Bluetooth settings (it shows as `HC-05` or `EVN Bluetooth`, PIN `1234`); Windows then lists a *Standard Serial over Bluetooth link (COMxx)* port, and a PC program that opens it talks to `bt.read()` / `bt.write()`. Only a module in the `'remote'` role can be reached from a PC.

**Two modules, no PC.** Program one module as the host bound to the other's address, once: switch on with the host module's button held and run `Bluetooth(1, mode="host", addr="98D3:41:F71802")` (the address the other module's `address()` gave). From then on the host connects to that module by itself at every power-up.

**The REPL over the air.** `bt.repl(True)` lets the PC's Bluetooth COM port carry the prompt, Run and Stop, so the USB cable can come out ([Getting started](GETTING_STARTED.md), §5a; the *Board* view does the whole set-up). In `boot.py`:

A module that already carries the REPL — even one whose object was dropped, as in `evn.Bluetooth(2).repl(True)` — is adopted as it stands by a plain `Bluetooth(n)`: at the port's own baud, nothing sent to the module, `configured()` `False`. Any configuration argument (a `baud` equal to the port's own is accepted) then raises `ValueError("the module carries the REPL; call repl(False) before changing its configuration")`; a program that needs the module for its own traffic calls `bt.repl(False)` first.

One object per serial header: `Bluetooth(n)` raises `OSError("serial port n is used by a UART object")` while an `evn.UART` object holds the port, `OSError("serial port n is already open")` while another live `Bluetooth` object does, and `UART(n)` raises the mirror error while this object holds it. The module does not answer from the serial side in data mode, so the constructor does not detect an absent module, and nothing detects an unplug. After `close()` every call except `close()` itself raises `ValueError("Bluetooth is closed")`, even once a new `Bluetooth(n)` has opened the same port: an old object never acts on the new one's module, and its second `close()` does nothing.

## UART — raw serial port

A serial header (Serial 1 or Serial 2) as a plain UART, for anything that talks serial: a USB-serial adapter, another controller, a GPS. The EVN Bluetooth module has its own class, [`Bluetooth`](#bluetooth--bluetooth-module-hc-05). More in `examples/19_uart/`.

**Constructor**

```python
evn.UART(port, baudrate=115200)
```

| Parameter | Default | Meaning |
| :--- | :--- | :--- |
| `port` | — | 1 or 2 (Serial 1 / Serial 2), else `ValueError` |
| `baudrate` | 115200 | 300..3000000, else `ValueError`. **Positional only**: `UART(1, 9600)`, not `UART(1, baudrate=9600)` (`TypeError`) |

**Methods**

| Call | Does |
| :--- | :--- |
| `write(buf)` | queue bytes to send; every byte is queued, never dropped |
| `read()`, `read(n)` | up to `n` bytes received (everything buffered without `n`) |
| `readline(timeout=5000)` | the next line, waiting at most `timeout` ms |
| `any()` | bytes waiting |
| `overflow()` | bytes the 256-byte receive ring dropped since the last call (read and clear; 0 = nothing lost) |
| `flush_rx()` | drop buffered input |
| `repl(True)`, `repl(False)`, `repl()` | the MicroPython REPL on this port as well as USB (a USB-serial adapter on the header); survives a soft reboot |
| `close()` | release the port — it keeps running and keeps its queued bytes — so a `Bluetooth` object or another `UART` at a different baud can take it; every later call raises `ValueError("UART is closed")` |

**Example**

```python
from evn import UART
u = UART(1, 9600)
u.write(b"hello\n")
print(u.readline(timeout=1000))
```

**Notes.** One object per header: `UART(n)` raises `OSError` while an `evn.Bluetooth` object holds the port, `OSError("serial port N is already open")` while another `UART` object does, and the other way round. Re-opening a port that is already open never resets it and never drops queued bytes.

## I2C — raw I2C port

Any I2C device on I2C port 1..16, through the board's multiplexers, for chips that are not standard peripherals. More in `examples/20_i2c/`.

**Constructor**

```python
evn.I2C(port)
```

**Methods**

| Call | Does |
| :--- | :--- |
| `scan()` | the addresses that answer (never lists 0x70) |
| `probe(addr)` | `True` if something answers at `addr` |
| `readfrom(addr, n)`, `writeto(addr, buf)` | read or write 1..4096 bytes |
| `readfrom_mem(addr, reg, n)`, `writeto_mem(addr, reg, buf)` | the same, at a register |
| `stats()` | `((errors, recoveries, stuck), (...))` per bus. `errors` are failed transactions since boot; the expected NACK of a probe, of a constructor's ID-register identify on an empty port or of a driver's re-probe of an unplugged device is not one, so a climbing count means a real fault |

**Example**

```python
from evn import I2C
bus = I2C(5)
print([hex(a) for a in bus.scan()])
```

**Notes.** **0x70** (the multiplexers) is refused everywhere, and **0x6A on port 16** (the battery charger), with `ValueError`. Errors: `OSError(ENODEV)` nothing answered, `OSError(EIO)` present but refused a byte, `OSError(ETIMEDOUT)` the bus was held and has been reset. The transaction deadline grows with the length (1 ms + 40 µs per byte, at least 5 ms), so a long transfer never times out by being long. An `I2C(port).scan()` of a port with an IMU on it costs the IMU one FIFO byte (see [IMU](#imu--gyro-and-accelerometer-mpu-6500)).

## Programs, files and main.py

An 11 MB file system is mounted at `/`. `open()`, `import`, `os` and `vfs` work as in MicroPython. More in `examples/21_files/`.

- **Start-up:** `boot.py` runs at power-on and after Ctrl-D; `main.py` then waits for a press of the user button (LED blinking fast) and runs again at the next press once it has ended. Anything typed at the port during the wait (the extension's own connections, `mpremote`) gives the REPL instead, so a session never runs `main.py`; with the extension's live console attached, only *Upload and run now* starts it. `evn.autostart(True)` in `boot.py` starts it without the press; `evn.reset(start=True)` does so for one boot.
- **Skipping it:** hold the user button while powering on to skip `main.py` once; after a watchdog reboot it is skipped automatically.
- **When it ends:** every motor coasts.
- **A file write is refused while a motor is driving:** `open(...).write(...)`, `flush()`, `close()`, `os.remove()` and any other flash write raise `OSError: [Errno 16] EBUSY` while any motor is in `run()`/`dc()`, in an unfinished `run_angle`/`run_target`/`run_time`/DriveBase maneuver, or tracking a moving target (a flash write would stall the 1 kHz motion engine for 45–400 ms, so the firmware refuses instead). A holding, braked or coasting motor does not block a write. The refusal surfaces from whichever call reaches the flash first — `open()`, `write()`, `flush()` or `close()`. Write your log after the move (`stop()`, `hold()` or `wait=True`, then write), or catch `OSError` and compare `e.errno == 16` (the board's `errno` module has no `EBUSY` name: `errno.EBUSY` raises `AttributeError`) and write later; keep readings in a list meanwhile, or record them with [`DataLog`](#datalog--recording-on-the-board), which holds them in RAM and saves once the motors coast. Reads (`open(...).read()`, `import`) are never refused. (`evn.Flash` is the block device behind the file system and follows the same rule.)

## DataLog — recording on the board

`evn.DataLog` records motors, sensors, the battery, the user button and rows of the program's own values **on the board**: each source at the rate it makes new readings, kept in RAM, and written to a CSV file on the board once the motors coast. The same logger records for the extension's data logger (the graph button on the *Board* view). More in `examples/22_data_log/`.

**Constructor**

```python
DataLog(*headers, name='log', timestamp=True, extension='csv', append=False, size=32768, autosave=True, on_full='halve')
```

| Parameter | Default | Meaning |
| :--- | :--- | :--- |
| `*headers` | none | the columns of `log()`: at most 8 strings. Without headers the log has no `log()` |
| `name` | `'log'` | the file is `/data/<name>.<extension>`; without the clock (or `timestamp=False`) the name gets `_1`, `_2` ... rather than overwrite a file. `save(path)` does not create the folder |
| `timestamp` | `True` | add `_<date>_<time>` to the file name (`/data/run1_2026-09-26_14-03-11.csv`), only when the board's clock is set: the extension's live console sets it when it connects |
| `extension` | `'csv'` | the file's extension |
| `append` | `False` | add the samples to an existing file, without a new header (a header first when the file does not exist yet) |
| `size` | 32768 | bytes of RAM for the samples, 1024..1000000, taken from the heap at the first `start()` (`MemoryError` if the heap cannot give it). A sample of one value is 8 bytes: the default holds about 4 s of one 1 kHz channel before its first halving |
| `autosave` | `True` | a DataLog **not yet saved** (still recording, or stopped) is stopped and saved by itself when `main.py` ends, the editor's Run finishes, the board soft-reboots or its `with` block ends, once the motors coast; a stopped one still owed its autosave is saved first when another DataLog `start()`s; a motor still driving is reported (`DataLog: not saved ...`) and the samples stay for a `save()` |
| `on_full` | `'halve'` | what a channel whose share of the RAM is full does: `'halve'` keeps every second sample and halves its rate, so the recording never stops by itself and a long run comes back evenly thinned; `'drop'` drops the newest samples and counts them |

The first five are Pybricks' (`pybricks.tools.DataLog`); `size`, `autosave`, `on_full` and every method but `log()` are EVN's own.

### Channels

| Method | Does |
| :--- | :--- |
| `add(source, quantity, rate=0, *, input=None)` | add a channel and return its index (before `start()`: `RuntimeError` while recording; at most 16). `source` is a `Motor`, `evn.battery`, `evn.button` or a standard-peripheral object; `quantity` the method name (table below); `rate` samples a second, **0 = every new reading**. A rate above the source's own gives the source's. `input=` (0..7, 4..7 the differential pairs as in `ADC.voltage()`) picks an `ADC` input (default: the one `voltage()` reads) |
| `DataLog.quantities(source)` | a staticmethod: the quantity names `add()` takes for this source, e.g. `('angle', 'speed', 'load', 'stalled')` for a `Motor` |

| Source | Quantities (unit) | New readings a second |
| :--- | :--- | :--- |
| `Motor` | `angle` (deg), `speed` (deg/s), `load` (mNm) - unrounded, where the methods round to an int - `stalled` (0/1) | every new reading: up to 1000 (the motor engine's tick; about 460 with an IMU on the bus) |
| `evn.battery` | `voltage` (mV), `cells` (mV: `cells.cell1`, `cells.cell2`) | 25 |
| `evn.button` | `pressed` (0/1) | 1000 |
| `IMU` | `heading` (deg), `tilt` (deg: `.pitch`, `.roll`), `euler` (deg: `.heading`, `.pitch`, `.roll`), `acceleration` (mm/s²: `.x`, `.y`, `.z`), `angular_velocity` (deg/s: `.x`, `.y`, `.z`), `up` (the side's name), `stationary` (0/1), `temperature` (°C) | 200 |
| `Compass` | `heading` (deg), `heading_confidence`, `field` (G: `.x`, `.y`, `.z`), `raw` (`.x`, `.y`, `.z`), `temperature` (°C, QMC5883L) | 75 |
| `ColorSensor` | `hsv`, `rgb`, `raw` / `read` (`.c`, `.r`, `.g`, `.b`), `percent` (%: `.c`, `.r`, `.g`, `.b`), `color` (the colour's name, from the object's detectable colours; a colour outside the named set is written as its palette index), `ambient` (%), `lux` (lx), `color_temperature` (K) | its integration time |
| `DistanceSensor` | `distance` (mm; empty when out of range), `status` (the status's name) | its timing budget |
| `GestureSensor` | `gesture` (its name), `proximity`, `hsv`, `rgb`, `ambient` (%) | its cycle |
| `EnvSensor` | `temperature` (°C), `pressure` (Pa), `humidity` (%), `all` (the three) | its cycle |
| `TouchArray` | `touched` (the bit mask of the pads), `proximity` (0/1), `pressed` (0/1: any pad) | its cycle |
| `ADC` | `voltage` (V), `raw` | its data rate |

A multi-part quantity is one channel of several values, written as `quantity.part` in the file (`acceleration.x`). Values are recorded in the physical units above, never in `SpeedUnit.PERCENT`.

### Recording

| Method | Does |
| :--- | :--- |
| `start()` | start a new recording (the samples of an earlier one are gone) and return the seconds the fastest-filling channel records before its first halving (`None` if it was already recording). `ValueError` with no channel and no headers, or when `size` cannot give every channel room for 8 samples; `RuntimeError` while another DataLog records |
| `stop()` | stop recording; the samples stay in RAM for `save()`. With `autosave` a stopped log not yet saved is saved by itself when `main.py` ends, the editor's Run finishes, the board soft-reboots or a `with` block ends, once the motors coast |
| `running()` | `True` while recording |
| `log(*values)` | Pybricks: one row of the program's own numbers, one per header, stamped with the board's time (`ValueError` for another count; `None` is an empty cell, `True`/`False` are 1/0). Starts the log if it was never started; after `stop()` it raises `RuntimeError` (`start()` again for a new recording) |
| `info()` | a dict: `running`, `size`, `saved` (since the last start), `channels` (one dict each: `device`, `port`, `quantity`, `unit`, `rate` (samples a second now), `halvings`, `samples` (the rows held), `taken` (the samples taken), `same` (the samples folded into a run's end row, see *Notes*), `dropped` (the samples lost with `on_full='drop'`)); once started also `seconds`, `polls`, `cost_us` (the longest poll) and `cost_mean_us` |

### Saving

| Method | Does |
| :--- | :--- |
| `save(path=None)` | write the recording and return the file's path: `/data/<name>[_<date>_<time>].<extension>`, or `path` (positional). A coast the program just issued is given up to 5 ms to land, so `motor.stop(); log.stop(); log.save()` works; **while a motor still drives it is refused**, with `OSError(EBUSY)` (errno 16) and nothing written: stop or coast the motors first. `RuntimeError` while recording (`stop()` first), `ValueError` before anything was recorded |
| `close()` | stop and free the RAM, **without saving**. `with DataLog(...) as log:` stops, saves if `autosave` is on and nothing was saved yet, then closes on exit |

The file is the extension's CSV: `# key: value` header lines (the firmware, the RAM, one `# channel:` line per channel with its rate, how often it was halved and its rows and samples, e.g. `| 1081 rows of 1221 samples`; the `log()` rows' line ends `| 2 columns | 5 rows`), then `time_s,device,port,quantity,value,unit,note`, one line per value; the program's rows are under device `log` with the header names as quantities. `time_s` is the source's own time stamp since `start()`, in seconds, to the microsecond. Copy it to the computer with `mpremote cp :/data/run1.csv .` and open it with **Open in data viewer** (right-click the `.csv`), or `pandas.read_csv(f, comment='#')`.

**Example**

```python
from evn import Motor, IMU, DataLog
motor = Motor(1)
imu = IMU(1)
log = DataLog('turn', 'heading', name='run1')
log.add(motor, 'angle')              # every new reading (up to 1000 a second)
log.add(imu, 'heading', 50)          # 50 a second
log.start()
for turn in range(4):
    motor.run_angle(500, 180)
    log.log(turn, imu.heading())     # one row of your own values
motor.stop()
log.stop()
print(log.save())                    # /data/run1_2026-09-26_14-03-11.csv
```

**Notes**

- **Best effort, lowest priority.** The sampler runs on Core 0 after every other service, reads only what the drivers already hold (no extra I2C traffic, no waiting) and records only **new** readings, each stamped with its source's own time — a stale value is never recorded twice. It never delays the motors or your program: Core 1 missed no tick while recording on the bench (2026-09-26).
- **What it costs and how fast it gets** (measured on the board, 2026-09-26): about 11–14 µs per poll with one motor channel, about 100 µs with seven channels at max including an IMU, 17–30 µs under a Python loop that never sleeps. The poll, and so a motor channel at max, runs at about 820 Hz with nothing on I2C and about 460 Hz with an IMU attached (its FIFO read holds Core 0). An IMU's acceleration at max records about 180 samples a second beside five other channels through the console (about 60 Hz for the heading with a compass also on the bus in the program bench), never twice within 2 ms.
- **A run of identical samples is two rows.** A sample bit-identical to the channel's previous row (every part of a multi-part quantity; numbers and names alike) adds no row: the run's first row stays, and its second row, the run's end, has its time stamp moved forward to the newest sample. However many samples of one source do not change, they cost two rows, and the file and the viewer show the value flat from the first stamp to the last. The window is exact, not a dead-band: every sample in it was taken and compared, and a change of one bit is recorded. `info()` counts the folded samples in `same`, so `taken` is more than `samples`. `log()` rows are never folded: every call is a row. Measured on the board (2026-09-26): a motor at rest recorded at max for 1.5 s is 2 rows of 1284 samples, the second stamped 1.499 s; a motor turning at 300 deg/s keeps about 88 % of its samples as rows (its 0.5° encoder steps repeat between ticks); the sampler's cost is unchanged.
- **When the RAM is full** (`on_full='halve'`), a channel keeps every second sample it holds and records at half its rate from then on; `info()` counts the `halvings`, and the file's `# channel:` line names the rate it ended at. Folded runs make a channel's share fill more slowly. Each channel's share of `size` is set at `start()` from its expected rate, so a slow channel is not thinned by a fast one.
- **Why the file waits.** A Pybricks hub writes each `log()` row at once; the EVN ALPHA must not write its flash while a motor drives (a sector erase stalls the 1 kHz motor loop), so rows and samples wait in RAM for `save()` or autosave. A `save()` of a few kB costs Core 1 about 45 missed ticks per flash sector it erases, which is why it is refused while a motor drives.
- One recording at a time: `start()` of another DataLog raises `RuntimeError` while one records; the same object's second `start()` returns `None`. A recording object is kept alive while it records, so `DataLog(...).start()` without a name records until the program ends. Every other call after `close()` raises `ValueError('DataLog is closed')`; `running()` answers `False` and `close()` is idempotent.
- The extension's data logger drives this same class through the live console (`on_full='drop'` for a light set it streams live, `'halve'` for a heavier one it holds on the board): see [GETTING_STARTED §3c](GETTING_STARTED.md#3c-recording-data-the-data-logger).

## Timing: `wait` and `StopWatch`

| Call | Does |
| :--- | :--- |
| `evn.wait(time)` | pause the program for `time` ms (positional, or `time=` as in Pybricks); motors keep doing what they were told |
| `evn.StopWatch()` | `time()` ms since construction, `pause()`, `resume()`, `reset()` |

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
| `Motor(port)` model | the motor identifies itself over the port | `model="EV3 Medium"` / `"EV3 Large"` / `"NXT"` / `"JGA25-370 6V 77RPM"` / `"Pololu 25D 9.7:1 HP 12V"` / `"CHR-GM16-030PA 9V 1:63"` (keyword-only) names it for the session; without it the port runs the motor it was configured for (`evn.configure_motor()` or the Board view's gear), else the model its stored calibration was made for, else the firmware's fallback (EV3 Large on 1-2, EV3 Medium on 3-4). The gain base is the model, never the port; `calibrate()` stores its record with the model, so nothing is re-run at boot |
| `reset_angle()` with no argument | resets to the absolute marker angle | makes the current position 0 (EV3/NXT encoders have no absolute marker) |
| `reset_angle(angle=…)` | `angle` may be given as a keyword | `angle` is positional only: `reset_angle(90)` (a keyword raises `TypeError`) |
| `speed(window)` | averages over `window` ms | `speed()` only; the controller's own estimate is reported |
| `control.pid()` `integral_rate` | caps integral growth | not offered; `integral_limit` and `integral_deadzone` are the real anti-windup knobs |
| `control.pid()` units | torque controller | converted through the nominal pack voltage and the model's torque constant; EVN-specific terms live in `control.evn()` |
| `run_until_stalled` | any obstruction; `duty_limit` is the stall torque | the same: the stall is reported once the drive sits at `duty_limit` (or the pack) and the shaft does not turn; the first 150 ms of a move are ignored |
| Absolute angle range | unbounded | unbounded (64-bit) |
| `settings()` | may return more fields | `(max_voltage, stall_timeout)` — the stall timeout is EVN's own (a `wait=True` move returns once `stalled()` has held that long; 0 = wait for ever, as Pybricks) |
| Program end | motors stop | the same for a program run from the extension and for `main.py`: every motor coasts when it ends or raises. Lines typed at the REPL have no program end: motors keep their last command until Ctrl-C, Ctrl-D, `evn.stop_all()` or a connecting tool coasts them |
| `DataLog` | Pybricks writes each `log()` row to its file at once | rows and samples wait in RAM and reach the file at `save()` or autosave (when `main.py` ends, the editor's Run finishes, the board soft-reboots or a `with` block ends, once the motors coast): the flash is not written while a motor drives (`save()` raises `OSError(EBUSY)` then). `add()` records motors and sensors on the board at their own rates; values are in physical units (never `SpeedUnit.PERCENT`), motor angles unrounded |

## Appendix: diagnostics and validation

This part is for bench work and bug reports, not for programs.

### Diagnostics

| Call | Returns |
| :--- | :--- |
| `evn.core1_status()` | `(ticks, period_min_us, period_max_us, exec_max_us, missed, late)` of the 1 kHz motion engine, or `None` when it is not running — `missed` = deadlines the alarm ISR skipped (a flash lockout gap), `late` = loop-body overruns (a body that ran past its 1 ms; the count `exec_max_us` alone cannot give). Both should read 0 |
| `control.state()` | `(reference_deg, x1_deg, x2_degs, x3_degs2, applied_mv, hold, assist)`: the position reference, the ADRC observer's position / speed / total-disturbance estimates (output units; `x3` is the unmodelled acceleration being cancelled — `load()` is it through the torque constant), the voltage applied last tick, and whether the observer is at its hold bandwidth / the breakaway assist is armed. A 1 kHz diagnostic for tuning and benches. `model.state()` (below) is the legacy Luenberger observer, not this estimator |
| `model.state()` | `(angle, speed, current, stalled)`: the legacy observer's estimates in deg, deg/s, mA and a flag |
| `model.settings()`, `model.settings(values)` | the observer's settings in firmware units; only the first four can be written (the four gain constants must be passed back unchanged, else `ValueError`); debug use |

Bench diagnostics, not for programs: `_stats()` (nine counters: steps, rejected wheel / lateral / magnetometer updates, the yaw-rate row's reject run near rest, wheel-gate escapes taken, steps with a stale IMU, steps that integrated a time gap — a Core 0 stall over 100 ms, whose exact encoder travel is integrated as one arc instead of being lost — and compass samples dropped for a field that is not the Earth's), `_bias()` (the filter's gyro bias and its sigma in deg/s, counter-clockwise positive — the filter's frame, not the heading's) and `_step(...)` (one filter step on SI values, for a `Pose(_test=True)` object).

### Validation record

What the defaults and figures in this reference were measured on.

- **Motor defaults:** the default limits and the `control.pid()` / `control.evn()` values are the fastest moves of the validation harness.
- **Motor figures on the reference rig:** `calibrate()` at 8.16 V measured EV3 Large 967 deg/s and EV3 Medium 1560 deg/s no-load. `run_until_stalled` breakaway: EV3 Medium ≈ 50 %, EV3 Large < 40 % duty. `run_time(0, 10**10)` used to finish at once (bug B-035); the `time` bound came from it.
- **DriveBase:** endpoints within 1°, the two wheel profiles ending within 5 ms of each other on the reference robot. The straight-acceleration default: at the full 1630 mm/s² five 30 cm out-and-backs left the robot 8 mm off its floor mark from tyre slip the encoders cannot see; at 1230 and below it came back within 1–3 mm, and the turns showed no such dependence.
- **Standard peripherals:** all fifteen on hardware — colour sensor, distance sensor, gesture sensor, environment sensor, compass, seven-segment display and OLED 2026-09-17; ADC, touch array, IMU, LED matrix, RGB LED module 2026-09-18; the Bluetooth module and both Geekservo profiles 2026-09-17; the compass on the HMC5883L (the QMC5883L path has not been benched yet). Per device:

- **ColorSensor:** Bench-validated 2026-09-17 on three TCS34725 sensors at once: every setting and derived value against the datasheet, `age` ≤ 5 ms with three attached, hot-plug with the settings re-applied.
- **ADC:** Bench-validated 2026-09-18 on the EVN ADC module with three decoys: 0 V, 3.3 V and ±3.3 V differential at every range, a servo-pulse average as a mid-scale signal, hot-plug with the settings kept; re-benched 2026-09-18 on the loaded rig with all four motors running (68 / 68, no pickup on an open input) and 2026-09-19 on firmware 0.2.23 (74 / 74).
- **EnvSensor:** Bench-validated 2026-09-17 on the EVN module with three decoys: every getter and setter, the noise figures against the datasheet, forced mode (99.4–100.4 ms, never a repeat), a breath and a fingertip, hot-plug with the settings kept; re-benched 2026-09-19 on firmware 0.2.23 (91 / 91).
- **DistanceSensor:** Bench-validated 2026-09-17 on three sensors at once with a colour sensor as a decoy at the same address: every setting with its effect, `age` ≤ 30 ms with three attached, hot-plug with the settings kept; re-benched 2026-09-18 with a target at 59 mm (58 / 58) and 2026-09-19 on firmware 0.2.23 (57 / 58, the target band since widened).
- **Compass:** Bench-validated 2026-09-17 on the EVN HMC5883L module with three decoys: every setter and refusal against the datasheet, heading sign by a clockwise turn, a 25 s tumble calibration (coverage 22/26, residual 3.7 %), heading noise 0.14° RMS when still, hot-plug with the settings kept; on the loaded rig (2026-09-18), away from the motors, the field moved ≤ 0.015 G with every motor running. The QMC5883L path has not been on hardware yet.
- **IMU:** Bench-validated 2026-09-17 (104 self-checks on an upside-down module with a decoy: frames, every setting and refusal, the DMP's gyro calibration at 14.2 s, drift 0.2° per 5 s, `age` ≤ 6 ms) **and 2026-09-18 by hand**: a quarter turn clockwise → `heading()` +89.8°, unwrapped past 360°; pitch and roll signs; `up()` on every side; taps and the orientation events; same-socket hot-plug.
- **TouchArray:** Bench-validated 2026-09-18 on the EVN touch module with decoys on other ports: every default and setter cross-read from the chip's registers, single pads, three pads at once, a 3 s hold without chatter, five taps counted by `events()`, proximity with the electrodes summed, hot-plug; re-benched the same evening next to the drive motors — no touch or event from four running motors, the deepest dip 4 counts against the threshold of 12.
- **GestureSensor:** Bench-validated 2026-09-17 on the EVN module (ID 0xA8) with two VL53L0X and a TCS34725 as decoys: every setting against the datasheet's scaling, 12/12 swipes named the way the hand moved, `age` ≤ 3 ms, hot-plug with gain and integration time kept, 88/88 checks.
- **MatrixLED:** Bench-validated 2026-09-18 on the EVN 8×8 module with two decoy devices: every drawing call checked on the chip's own RAM, the pictures read by eye (corners, `-42`, `HI`, the arrow after `orientation(Side.RIGHT)`, dim and bright, the heart), a forced chip reset healed in 107 ms, an unplug and replug restoring the picture, brightness and orientation.
- **SevenSegmentLED:** Bench-validated 2026-09-17 on the EVN seven-segment board with three decoy devices: every call checked on the chip's own RAM and read by eye (`12.50`, ` -42`, `HELP`, `12:34`, brightness 1 and 16, blinking at 1 Hz), an unplug and replug restoring the brightness, blink and number.
- **Display:** Bench-validated 2026-09-17 on the EVN OLED (an SSD1315) with three decoy devices: every drawing call checked in the firmware's picture and the panel read by eye (the logo, the text grid, flip, invert, contrast, the shapes, the `print()` console, the hardware scroll, blink, zoom), an unplug and replug restoring the contrast, flip and picture.
- **RGBLED:** Bench-validated 2026-09-18 on the EVN RGB LED module (servo ports 1, 2 and 4): colour order, LED 0 at the module's connector end, `invert`, brightness, `count`, blink / animate confirmed by eye; 83 / 83 self-checks, frames at the wire time (620 µs for 8 LEDs), patterns within 1 ms of the requested times.
- **Bluetooth:** Bench-validated 2026-09-17 with two modules on both serial ports: the PC's own adapter as the peer (64 KiB echoed intact full duplex and 21 ms round trips at 230400), command mode 12 / 12 with the address matching the PC's inquiry, module to module 8 / 8 (32 KiB host → remote intact at 12.9 KB/s), 96 KB of back-to-back writes intact at 230400, and the REPL, Run and Ctrl-C over the air.
- **Servo:** Bench-validated 2026-09-17, both Geekservo profiles against an encoder coupled to the horn: the 270° servo travels 277..281° over its 0..270 command, linear, and follows `move(270, 200)` at 200..206 deg/s; the continuous-rotation servo shows no creep at duty 0, about 185 / 315 / 450 deg/s at duty 50 / 75 / 100, starts in about 100 ms and stops in about 150 ms (under a heavy load it is torque-limited below duty 50).
