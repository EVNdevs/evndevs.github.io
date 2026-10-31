# EVN ALPHA MicroPython API reference (early access)

Everything a program needs comes from the `evn` module:

```python
from evn import Motor, Port, Stop, Direction, SpeedUnit, wait, StopWatch
```

The `Motor` class follows the Pybricks `Motor` reference (https://docs.pybricks.com/en/latest/pupdevices/motor.html) for names, argument order, keyword defaults and units, so the Pybricks documentation also applies here. A function that the EVN ALPHA has and Pybricks does not has its own name (`calibrate()`). No argument is accepted that would silently do nothing. The differences are listed in [Deviations from Pybricks](#deviations-from-pybricks).

**How each object is described.** Every object has its own section, with the same layout:

1. What it is and where it plugs in.
2. The **constructor**.
3. The **methods**, grouped by task (one line each; a getter and its setter share a row).
4. An **example**.
5. **Notes**: errors, unplugging, closing, and how it works with other objects.

Objects that can be calibrated link to [Calibrating your robot](CALIBRATION.md), the step-by-step guide. The diagnostic calls are in the [appendix](API_SYSTEM.md#appendix-diagnostics). The REPL, the board's Python prompt, has a page of its own: [Using the REPL](REPL.md). What is not tested yet is listed on [Known limitations and help us test](KNOWN_LIMITATIONS.md).

## Start here

| What | Where it plugs in | Numbers |
| :--- | :--- | :--- |
| Motors (`Motor`, `DriveBase`) | motor ports M1–M4 | **1–4** (`Port.A`–`Port.D` are the same integers) |
| Sensors and displays (`ColorSensor`, `IMU`, `Display`, …, and the extended `HiTechnicColorSensor`, `HiTechnicCompass`, `HuskyLens`, `VL53L1X`, `TCS3430`) | I2C ports | **1–16** |
| `Servo`, `RGBLED` | servo ports | **1–4** |
| `Bluetooth`, `UART` | serial headers Serial 1 / Serial 2 | **1–2** |

Units: angle **deg**, speed **deg/s**, acceleration **deg/s²**, time **ms**, duty **%**, torque **mNm**, voltage **mV**, PID gains **µNm/deg**, **µNm/(deg·s)**, **µNm/(deg/s)**. Measurements return `int` unless a row says otherwise. A robot's distances are **mm** and its headings **degrees, clockwise positive** seen from above.

**Coming from Pybricks:** the names and arguments are Pybricks' wherever Pybricks has the same function. The differences that matter first: motor ports are numbers; `reset_angle()` with no argument makes the current position 0; motors coast when a program ends; there is no import from `pybricks` — `wait` and `StopWatch` come from `evn`. The whole list is in [Deviations from Pybricks](#deviations-from-pybricks).

## The reference in five parts

Each part is a page of its own; every object keeps its complete section, with its constructor, a row per method, an example and its notes.

| Part | Sections |
| :--- | :--- |
| [The board, the motors, the drive base and the pose](API_ROBOT.md) | [Board](API_ROBOT.md#board-battery-button-led-and-clock) · [Motor](API_ROBOT.md#motor) · [DriveBase](API_ROBOT.md#drivebase--two-motors-as-a-robot) · [Pose](API_ROBOT.md#pose--where-the-robot-is) · [PID](API_ROBOT.md#pid--a-controller-for-your-own-loops) · [ADRC](API_ROBOT.md#adrc--disturbance-rejection-for-your-own-loops) · [Calibration records](API_ROBOT.md#calibration-records-evncalibration) |
| [Standard peripherals: sensors](API_SENSORS.md) | [Standard peripherals](API_SENSORS.md#standard-peripherals) · [IMU](API_SENSORS.md#imu--gyro-and-accelerometer-mpu-6500) · [Compass](API_SENSORS.md#compass--magnetometer-qmc5883l--hmc5883l) · [ColorSensor](API_SENSORS.md#colorsensor--colour-sensor-tcs34725) · [DistanceSensor](API_SENSORS.md#distancesensor--time-of-flight-distance-sensor-vl53l0x) · [GestureSensor](API_SENSORS.md#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960) · [TouchArray](API_SENSORS.md#toucharray--capacitive-touch-array-mpr121) · [EnvSensor](API_SENSORS.md#envsensor--temperature-pressure-and-humidity-bme280) · [ADC](API_SENSORS.md#adc--analogue-to-digital-converter-ads1115) |
| [Standard peripherals: displays, lights, servo and Bluetooth](API_DISPLAYS.md) | [Display](API_DISPLAYS.md#display--12864-oled-ssd1306--ssd1315) · [MatrixLED](API_DISPLAYS.md#matrixled--88-led-matrix-ht16k33) · [SevenSegmentLED](API_DISPLAYS.md#sevensegmentled--4-digit-seven-segment-display-ht16k33) · [RGBLED](API_DISPLAYS.md#rgbled--rgb-led-module-ws2812b) · [Servo](API_DISPLAYS.md#servo--hobby-servo-geekservo-270--continuous-rotation) · [Bluetooth](API_DISPLAYS.md#bluetooth--bluetooth-module-hc-05) |
| [Extended peripherals: HiTechnic, HuskyLens, VL53L1X and TCS3430](API_EXTENDED.md) | [EVN Extended Peripherals](API_EXTENDED.md#evn-extended-peripherals) · [HiTechnicColorSensor](API_EXTENDED.md#hitechniccolorsensor--hitechnic-nxt-color-sensor-v1--v2) · [HiTechnicCompass](API_EXTENDED.md#hitechniccompass--hitechnic-nxt-compass-sensor) · [HuskyLens](API_EXTENDED.md#huskylens--dfrobot-huskylens-ai-camera) · [VL53L1X](API_EXTENDED.md#vl53l1x--time-of-flight-distance-sensor-up-to-4-m) · [TCS3430](API_EXTENDED.md#tcs3430--xyz-colour-and-ambient-light-sensor) |
| [Ports, programs, the data logger and timing](API_SYSTEM.md) | [UART](API_SYSTEM.md#uart--raw-serial-port) · [I2C](API_SYSTEM.md#i2c--raw-i2c-port) · [Programs, files and main.py](API_SYSTEM.md#programs-files-and-mainpy) · [DataLog](API_SYSTEM.md#datalog--recording-on-the-board) · [Timing](API_SYSTEM.md#timing-wait-and-stopwatch) · [Appendix](API_SYSTEM.md#appendix-diagnostics) |

## Safety behaviour

- **Ctrl-C** coasts all four motors, whether a program is running or not. Connecting `mpremote` (which every extension command does) sends Ctrl-C too.
- **Ctrl-D** (soft reboot) coasts all motors.
- The **user button** coasts all motors and ends the running program (`SystemExit`, as Pybricks); no motor moves again until the next program starts; held 2 s it reboots the board. A program that reads the button (`evn.button.pressed()`) calls `evn.set_stop_button(None)` first, as with Pybricks' `hub.system.set_stop_button(None)`: the press is then an input and stops nothing, until the program ends (`evn.set_stop_button(evn.button)` turns the stop on again). Ctrl-C and `evn.stop_all()` still stop the motors. Closing the port (DTR drop) while no program runs coasts the motors a REPL line left running; a running program is never cut.
- A 3 s hardware **watchdog** reboots a frozen board; motors coast on reset and `main.py` is skipped, after soft reboots too, until the board next restarts. It is fed between Python steps and in every wait, and while one huge integer calculation runs (such as `3**100000`, about 4 s) for at most 30 s; printing a huge number (`print(3**100000)`, or `3**100000` typed at the REPL) takes longer than that and still reboots the board, and so does any other single operation that runs longer than 3 s without reaching a wait ([details](TROUBLESHOOTING.md#known-limitations-of-this-build)).
- A motor whose encoder counts against its drive (a non-LEGO motor before its first `calibrate()`) is **coasted by the runaway guard** within about a quarter of a second of running away under a closed-loop command, and the program gets a `RuntimeError` telling it to calibrate the motor ([details](API_ROBOT.md)).
- A program run from the extension (**Run**, Ctrl+F5, in VS Code or the browser IDE) ends with every motor coasting, whether it finished or raised an exception. The REPL that follows still has the program's variables. Typing at the REPL yourself is different: there is no program boundary. Motors keep their last command until you `stop()` or `close()` them (or use `with Motor(1) as m:`), press Ctrl-C, or call `evn.stop_all()`.

## Deviations from Pybricks

| Topic | Pybricks | EVN ALPHA |
| :--- | :--- | :--- |
| `Motor(port)` | `Port.A`..`Port.D` | port numbers 1..4 (`Port.A`..`D` exist as the same integers) |
| `Motor(port)` model | the motor identifies itself over the port | `model="EV3 Medium"` / `"EV3 Large"` / `"NXT"` / `"JGA25-370 6V 77RPM"` / `"Pololu 25D 9.7:1 HP 12V"` / `"CHR-GM16-030PA 9V 1:63"` / `"CM22-2230 12V 1:49"` (keyword-only) names it for the session; without it the port runs the motor it was configured for (`evn.configure_motor()` or the Board view's gear), else the model its stored calibration was made for, else the firmware's fallback (EV3 Large on 1-2, EV3 Medium on 3-4). The gain base is the model, never the port; `calibrate()` stores its record with the model, so nothing is re-run at boot |
| Port in use | a second `Motor(port)` raises `OSError(EBUSY)` until the first is closed (its `close()`, or the end of the program) | a second `Motor(port)` (or `Servo(n)`) **takes the port over**: the motor coasts, a `DriveBase` the older object belongs to closes, and every call on the older object raises `RuntimeError("Motor(n) was replaced by a newer Motor(n)")` (a `Servo`: `ValueError`) while its `close()` does nothing - so re-running a cell works ([details](API_ROBOT.md#motor)). A second `IMU(port)` takes the running IMU over the same way (no restart, the heading and the gyro bias kept; the older object raises `ValueError`; [details](API_SENSORS.md)); a program run again from the button keeps the IMU running too, with the settings the last run gave it, but starts it at heading 0, as Pybricks does, and starts a kept `DriveBase` at `distance()` / `angle()` 0 and its `Pose` at x, y and heading 0 ([details](API_ROBOT.md#drivebase--two-motors-as-a-robot)) |
| `reset_angle()` with no argument | resets to the absolute marker angle | makes the current position 0 (EV3/NXT encoders have no absolute marker) |
| `reset_angle(angle=…)` | `angle` may be given as a keyword | `angle` is positional only: `reset_angle(90)` (a keyword raises `TypeError`) |
| `speed(window)` | averages over `window` ms | `speed()` only; the controller's own estimate is reported |
| `control.pid()` | the position controller's gains, set by hand | not offered: every motor runs the self-calibrated ADRC law; `calibrate()` measures each motor |
| `run_until_stalled` | any obstruction; `duty_limit` is the stall torque | the same: the stall is reported once the drive sits at `duty_limit` (or the pack) and the shaft does not turn; the first 150 ms of a move are ignored |
| Absolute angle range | unbounded | unbounded (64-bit) |
| `settings()` | may return more fields | `(max_voltage, stall_timeout)` — the stall timeout is EVN's own (a `wait=True` move returns once `stalled()` has held that long; 0 = wait for ever, as Pybricks) |
| Program end | motors stop | the same for a program run from the extension and for `main.py`: every motor coasts when it ends or raises. Lines typed at the REPL have no program end: motors keep their last command until Ctrl-C, Ctrl-D, `evn.stop_all()` or a connecting tool coasts them |
| `DataLog` | Pybricks writes each `log()` row to its file at once | rows and samples wait in RAM and reach the file at `save()` or autosave (when `main.py` ends, the editor's Run finishes, the board soft-reboots or a `with` block ends, once the motors coast): the flash is not written while a motor drives (`save()` raises `OSError(EBUSY)` then). `add()` records motors and sensors on the board at their own rates; values are in physical units (never `SpeedUnit.PERCENT`), motor angles unrounded |
