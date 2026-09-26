# The board, the motors, the drive base and the pose

Part 1 of the [EVN ALPHA MicroPython API reference](API.md), which has the units, the port numbers and the differences from Pybricks. Previous: [API reference](API.md) · Next: [Standard peripherals: sensors](API_SENSORS.md).

The board itself (`battery`, `button`, `led`, `clock`), the motors on ports 1–4 (`Motor`), two of them as a robot (`DriveBase`), where that robot is (`Pose`) and the calibration records the board keeps.

## Board: `battery`, `button`, `led` and `clock`

The board itself, as parts of the `evn` module (`import evn`, or `from evn import battery, button, led`). Nothing to construct.

### Battery, button and LED

| Call | Returns / does |
| :--- | :--- |
| `evn.battery.voltage()` | the pack voltage in mV; **0** when no pack is connected |
| `evn.battery.cells()` | `(cell1, cell2)` mV (the pack is always two cells); `None` when no pack is connected |
| `evn.battery.age()` | ms since the battery reading was taken; `None` when no pack is connected |
| `evn.battery.present()` | `True` while a pack is connected and reporting |
| `evn.button.pressed()` | `True` while the user button is pressed (it is also the emergency stop, see [Safety](API.md#safety-behaviour)) |
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
| `evn.core1_status()` | the motion engine's health counters (a diagnostic, see the [appendix](API_SYSTEM.md#diagnostics)) |

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
| `profile` | `None` (1°) | position tolerance in degrees for `done()`, must be positive; the default is two encoder edges and at least 1° (the controller lands inside its own 1.5-edge deadband): 1° on a LEGO motor, the JGA25 or the CHR-GM16; on a motor whose rotor cogs (a library motor with detents, or a custom motor whose `calibrate()` measured them) it is half the detent pitch plus a quarter edge, 3.3° on the Pololu 25D, whose shaft rests in its nearest detent (the controller no longer fights the detents at the endpoint) |
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
| `Stop.COAST_SMART` | release, and start the next relative move from this target — only while the shaft still stands within twice the position tolerance (`control.target_tolerances()`: 2° by default on a LEGO motor) of it, as in Pybricks; a shaft moved further while coasting (a slope, a hand, an unwinding gearbox) starts from where it is |

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
| `calibrate()`, `calibrate(wait=True)` | the self-calibration of this port: about 11 s with the shaft free to turn (it moves up to about a turn and a half each way and ends near where it started). Returns `(b0, tau_ms, v_break_mv, v_f_mv)` |
| `calibrate(wait=False)` | start it and return `None` at once; a later `calibrate()` on the same port waits for it and returns its result |

- **What it measures:** `b0` (deg/s² per volt: how strongly the motor accelerates), `tau_ms` (its time constant), `v_break_mv` (the voltage that breaks the shaft free) and `v_f_mv` (the running-friction voltage), plus the motor's no-load speed, the direction its encoder counts and the encoder's phase widths in each direction of turning (these keep `speed()`, `Pose.velocity()` and the position between two encoder steps exact), and whether the rotor **cogs**: a detent survey at the end (20 short kicks, the shaft resting after each) finds a rotor that always comes to rest in a magnetic detent, and the detent period in encoder edges (the Pololu 25D: every 8 edges).
- **What it changes:** the result drives the port at once, is stored in the board's flash for that port and comes back at every boot. The measured no-load speed becomes this motor's 100 % (`full_speed()`) and, when higher than the model's default, its speed limit — on the open `Motor` object too. An encoder found counting against the drive (a non-LEGO motor wired the other way round, such as the JGA25 on the EVN cable) is flipped, and `evn.calibration(port)["encoder_reversed"]` says so. A **custom** motor whose rotor cogs gets what a library motor with detents has, from the measured period: the cogging feed-forward (its amplitude is the breakaway voltage minus the running friction) and the detent rest at the end of a move (half a detent pitch of endpoint band and `done()` tolerance) — `evn.calibration(port)["cogging_edges"]`. A library motor keeps its library figure; the measurement only checks it (`cogging_note` says when they disagree).
- **Several motors at once:** `calibrate(wait=False)` starts a port and returns at once; the motion engine measures the started ports one after another while the program waits, so the program writes one loop instead of four. Wait with `evn.calibration(port)["busy"]` (or `calibrate()` on a port whose run is still going, which joins it — on a port that has already finished it starts a new run): `for m in motors: m.calibrate(wait=False)`, then `while any(evn.calibration(p)["busy"] for p in (1, 2, 3, 4)): wait(50)`.
- **Errors:** `RuntimeError("calibration failed: …")` when the shaft does not break away or the fit fails (the reason is also in `evn.calibration(port)["error"]`); `RuntimeError("port cannot calibrate (no motor model)")`. Ctrl-C, the user button or a soft reboot abort it: the motor coasts and `calibrate()` raises `KeyboardInterrupt`.
- **When:** once per motor and port, and again after swapping the motor. Choosing a different motor for the port (`evn.configure_motor()` or the Board view's gear) clears the port's calibration. The step-by-step guide, including the Board view's pulse button, is [Calibrating your robot](CALIBRATION.md#motors); the stored record is `evn.calibration(port)` ([Calibration records](#calibration-records-evncalibration)).

### Settings and control

| Method | Does |
| :--- | :--- |
| `settings(max_voltage, stall_timeout=)`, `settings()` | `max_voltage`: the voltage cap in mV applied to every command, 0..12000 (default 9000, above any 2S pack, so no effect until lowered; a value that rounds to 0 becomes the smallest cap, not "no cap"). `stall_timeout` (keyword-only, ms, 0 or 1..60000, default 1000): a `wait=True` move returns once the motor has been stalled this long — the hold keeps pushing and `stalled()` is `True`, but the program is not stuck on a gripper closed on a brick; 0 waits forever (Pybricks). The getter returns `(max_voltage, stall_timeout)` |
| `close()` | coast and free the port; later calls raise `RuntimeError("motor closed; create a new Motor")`. `with Motor(1) as m:` closes on exit |
| `control.limits(speed, acceleration, torque)`, `control.limits()` | `speed` caps every speed argument. `acceleration` is a number or an `(accel, decel)` tuple in deg/s²: the profiler honours the two independently (ramp up at `accel`, down at `decel`; `run()` ramps at `decel` whenever the speed magnitude shrinks); the getter returns the tuple when they differ. `torque` (mNm) becomes an equivalent voltage cap through the motor model. New limits apply to the next command; a non-positive limit is `ValueError` |
| `control.target_tolerances(speed, position)`, `control.target_tolerances()` | the `done()` criterion; defaults 50 deg/s, 1° (3.3° on the Pololu 25D, which rests in its nearest detent). Both read back as the floats that were set |
| `control.stall_tolerances(speed, time)`, `control.stall_tolerances()` | stall detection below `speed` for `time` ms (0..10000); defaults 50 deg/s, 50 ms. The speed reads back as a float, the time as int ms |
| `control.law()`, `control.law(law)` | the control law: `"adrc"` (the default, active disturbance rejection, self-calibrated) or `"pid"` (the tuned cascade that `control.pid()` and `control.evn()` set); anything else is `ValueError("law must be 'adrc' or 'pid'")`. Positional. While the motor is driving, the new law is applied by its next command; the getter reports the law that command will use |
| `control.pid(kp, ki, kd, integral_deadzone, integral_limit)`, `control.pid()` | **`"pid"` law only** (the default `"adrc"` law ignores these). Pybricks units; `kd` is the cascade's velocity gain. `integral_deadzone` (deg, 0..5, default 0.75) is the endpoint deadzone and reads back as a float; `integral_limit` (% duty, 0..100, default 20) is the largest contribution the integrator may make. Pybricks' `integral_rate` is not accepted (`TypeError`); a negative gain is `ValueError`. Per motor object; the compiled per-model values are untouched |
| `control.evn(endpoint_kd, start_duty, hold_duty, friction_ff)`, `control.evn()` | **`"pid"` law only**: EVN ALPHA's own parameters of that law; the getter returns the compiled per-model values. `endpoint_kd`: velocity gain inside the endpoint window. `start_duty` / `hold_duty` (% duty, 0..100): the breakaway push and the least duty held near the target. `friction_ff` (%, 0..200): Coulomb friction feed-forward |
| `control.scale` | motor degrees per output degree (from `gears`; read-only) |
| `control.done()`, `control.stalled()`, `control.load()` | the same as the motor methods |
| `control.state()`, `model.state()`, `model.settings()` | controller and observer internals for tuning: see [Diagnostics](API_SYSTEM.md#diagnostics) |

Default limits, at the motor shaft:

| | EV3 Large | EV3 Medium |
| :--- | :--- | :--- |
| speed limit | 1000 deg/s (or the calibrated no-load speed when higher) | 1400 deg/s (or the calibrated no-load speed when higher) |
| acceleration limit | 2400 deg/s² | 3000 deg/s² |
| torque limit | 449 mNm | 206 mNm |
| `control.pid()` | (73837, 295, 3692, 0.75, 20) | (31402, 184, 342, 0.75, 20) |
| `control.evn()` | (923, 12, 20, 50) | (170, 83, 50, 20) |

Every library motor's default `control.limits()` speed and acceleration (the speed rises to the calibrated no-load speed when that is higher):

| | EV3 Large | EV3 Medium | NXT | JGA25-370 6V 77RPM | Pololu 25D 9.7:1 HP 12V | CHR-GM16-030PA 9V 1:63 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| speed limit | 1000 deg/s | 1400 deg/s | 1000 deg/s | 460 deg/s | 3000 deg/s | 900 deg/s |
| acceleration limit | 2400 deg/s² | 3000 deg/s² | 2400 deg/s² | 2400 deg/s² | 20000 deg/s² | 5000 deg/s² |

The rated no-load speeds behind `full_speed()` are EV3 Large 1050, EV3 Medium 1560 and NXT 1020 deg/s at 9 V, the JGA25 462 deg/s at its 6 V cap, the Pololu 25D 6000 deg/s at 12 V and the CHR-GM16 1290 deg/s at its 9 V cap, scaled by the voltage the motor sees (the pack, or its cap). The firmware also caps every move at what the calibrated motor can do at the present battery voltage, so a program never asks for a speed the battery cannot deliver. Higher limits are accepted but are outside the tested range.

### Motor configuration (`configure_motor`)

Say once what is plugged into a port, and every `Motor(port)` — in any program, from any computer, after every reboot — runs that motor. The Board view's gear button does the same.

| Call | Does |
| :--- | :--- |
| `evn.configure_motor(port, model, *, counts_per_rev=None, rated_voltage=0, no_load_speed=None)` | store on the board which motor is on port 1..4; `model=None` removes the configuration (back to the fallback) |
| `evn.motor_config(port)` | what the port runs now, as a dict (below) |

| `configure_motor` argument | Meaning |
| :--- | :--- |
| `model` | a library motor — `"EV3 Large"`, `"EV3 Medium"`, `"NXT"`, `"JGA25-370 6V 77RPM"` (`"jga25"`: a 6 V, 77 rpm, 1:78 gearmotor with an 11 cpr hall encoder, 3432 counts per revolution, the port capped at 6 V, EV3 Large control class, limits 460 deg/s and 2400 deg/s²), `"Pololu 25D 9.7:1 HP 12V"` (`"pololu25d_9_7"`: Pololu #4842, a 12 V high-power 9.68:1 gearmotor with a 48 CPR encoder, 464.64 counts per revolution, 1000 rpm = 6000 deg/s no-load at 12 V — about 3500 deg/s on the pack, its 12 V rating above the pack so no cap binds —, EV3 Medium control class, limits 3000 deg/s and 20000 deg/s²; its stall current is above the port's 3 A rating, so never hold it stalled), `"CHR-GM16-030PA 9V 1:63"` (`"chr16_63"`: a 16 mm 9 V gearmotor, 1:63, with a 7 ppr hall encoder on the motor shaft, 1764 counts per revolution, 215 rpm = 1290 deg/s no-load at 9 V, the port capped at 9 V, above the 2S pack, so it never binds, EV3 Large control class, limits 900 deg/s and 5000 deg/s²; the family runs 1:10 to 1:360, and another ratio is a custom motor with 7 × 4 × the ratio counts) — or `"custom"` for any other DC motor with a quadrature encoder, or `None` |
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

**Notes.** Every call after `close()` raises `RuntimeError`, and every `control` call raises `RuntimeError` when the motion engine is not running. Setters of `control` return once the motion engine has applied the value (at most 5 ms), so a getter straight after a setter reads the new value. A direct `Motor` command on a wheel that belongs to a `DriveBase` ends the base's maneuver. What happens at the end of a program, Ctrl-C and the user button: [Safety behaviour](API.md#safety-behaviour).

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
- Bench diagnostics (`_stats()`, `_bias()`, `_step()`): see [Diagnostics](API_SYSTEM.md#diagnostics).

## Calibration records (evn.calibration)

Three things on a robot are calibrated once and remembered by the board, per port, with the date: each **motor** (`Motor.calibrate()`), the **IMU** (`IMU.calibrate()`) and the **compass** (`Compass.calibrate()` … `calibrate_stop()`). [Calibrating your robot](CALIBRATION.md) is the step-by-step guide (from the extension's Board view, from Python and from blocks). These module functions read and clear the stored records without opening the device:

| Call | Returns / does |
| :--- | :--- |
| `evn.calibration(port)` | the calibration motor port 1..4 runs, as a dict (below) |
| `evn.clear_calibration(port)` | forget motor port 1..4's calibration (record and running numbers): back to the motor's compiled defaults as if `calibrate()` had never run. Nothing moves; the port must be free (`OSError(EBUSY)` while a `Motor` holds it) and every motor stopped; `RuntimeError` says why a refusal changed nothing |
| `evn.imu_calibration(port)` | the stored IMU calibration of I2C port 1..16, the same dict as [`IMU.calibration()`](API_SENSORS.md#imu-calibration) |
| `evn.compass_calibration(port)` | the stored compass calibration of I2C port 1..16, the same dict as [`Compass.stored_calibration()`](API_SENSORS.md#compass-calibration) |
| `evn.clock()` | the date source of every record's `stamp` ([Board](#clock-version-and-restarts)) |

`evn.calibration(port)` returns `{"port", "calibrated", "busy", "stored", "stamp", "b0", "tau_ms", "v_break_mv", "v_f_mv", "no_load_speed", "vbus_mv", "encoder_reversed", "cogging_edges", "cogging_measured", "cogging_confidence", "cogging_note", "warning", "error"}`:

- `calibrated`: a `calibrate()` result drives the port; `busy`: a `calibrate(wait=False)` is running on it; `stored`: it is in flash.
- `stamp`: seconds since 1970 UTC when it was made; 0 when the board's clock was not set then (the extension's console sets the clock at connect, so a calibration run from the Board view carries its date; a bare program's `calibrate()` does not).
- `b0` (deg/s² per V), `tau_ms`, `v_break_mv`, `v_f_mv`: what `calibrate()` returned; `no_load_speed`: deg/s at 9 V, or at the motor's rated voltage; `vbus_mv`: the pack during the calibration.
- `encoder_reversed`: `True` when the calibration found the encoder counting **against** the drive and flipped the port's decoder. The flip is stored with the record, comes back at boot, and goes when the record is cleared or the motor changed. It belongs to the port's record, not to the motor: swapping a LEGO motor onto a port whose record says *reversed* without changing the port's configuration would run it flipped (positive feedback) — change the motor in the Board view (which clears the record) or `clear_calibration(port)` first.
- `cogging_edges`: the rotor's detent period the port runs on, in encoder edges (0 = none): the library motor's figure (8 on the Pololu 25D), or the period `calibrate()` measured on a custom motor. Non-zero widens the endpoint band and the `done()` tolerance to half a detent pitch and, when the calibration's breakaway voltage is above its running friction (it is on the Pololu), turns on the cogging feed-forward and the detent hold. `cogging_measured`: what the calibration's detent survey found (0 = the rotor did not rest in detents; `None` = a record older than the survey, calibrate again, or a survey that was abandoned); `cogging_confidence`: how sure it was, 0–1 (how tightly the 20 rests line up at that period; `None` after a reboot, it is not stored); `cogging_note`: `None`, or why the measurement and the motor library disagree (the library figure is kept) or why the survey was abandoned (a kick that did not cover its travel within a second, or a shaft that did not come to rest: no cogging assumed — a slow motor with a coarse encoder, whose kicks of 25–63 edges are long turns, ends here).
- `warning`: what is wrong with the record found in flash (made for another motor: refused; implausible for the model: applied anyway), else `None`; `error`: why the last `calibrate()` on this port failed or was refused, else `None`.
