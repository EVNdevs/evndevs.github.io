# What's new

The main changes of each release, in a few lines. The [full changelog](../CHANGELOG.md) lists every change, including
the tools and the measurements behind each release. What is not tested yet is on
[Known limitations and help us test](KNOWN_LIMITATIONS.md).

## 0.2.69 (2026-10-18)

- **Firmware:** the motor-control tick does the same work with fewer instructions (issues #106-#108). Motors behave
  as on 0.2.68, and the `Pose` filter step is lighter too (#117, #119). The drive-base and motor fixes (#2-#17)
  are still held back for a later release.
- **Faster: Run and Upload as main.py** (#123, #125). Run opens the board once and keeps it for the program and the
  REPL; Upload as main.py sends checked chunks and keeps the old `main.py` if anything goes wrong. These have been
  checked on the host and on a board.

## 0.2.68 (2026-10-18)

- **Firmware:** the same as 0.2.67, with the new version number. The fixes for the drive-base and motor issues found
  on 2026-10-17 (#2-#17) are held back for a later release, because a firmware with them left your program less time
  than 0.2.67 does.
- **Fixed: 42 extension bugs.** Among them, leaving VS Code should stop a running program, Run and Upload should work
  on an unsaved file, and the console and other commands should no longer fight over the board's port. These have been
  checked without a board.
- **Changed: calibration and the Board view.** One page shows every calibration with a one-click and an Advanced
  path, the colour panel guides you from white to black, the Board view puts live values first, and a motor row has
  a one-click ±90° jog. These should work as described: they have been tried on the simulated board only.
- **Changed: the website** has a step-by-step Getting started, a search, and pages for each task. Closing a browser
  IDE tab still does not stop the motors: press **Stop** first.

## 0.2.67 (2026-10-17)

- **New: `DriveBase.hold()`.** Stops the robot and holds it where it is, both wheels at once, until the next
  command, as in Pybricks. With `use_gyro(True)` the heading is held too. The *stop the robot* block has a third
  choice, *hold* ([DriveBase](API_ROBOT.md#drivebase--two-motors-as-a-robot)).
- **Changed:** `DriveBase.reset()` takes its arguments by keyword too (`reset(angle=90)`). `HiTechnicCompass.age()`
  answers while the compass calibrates. `integration_time()` of the `TCS3430` and the `GestureSensor` takes 2.78 to
  711.7 ms and refuses anything else.
- **Changed:** an `RGBLED` strip and a `Display` take their memory from the Python heap only while they are open. A
  program whose heap is full gets a `MemoryError` when it opens one.
- **Known issue:** a held wheel can keep a small back-and-forth of 3-5° in up to about 1 hold in 9 on some motors, as
  `Motor.hold()` can.

## 0.2.66 (2026-10-17)

- **New: the colour calibration panel.** **Calibrate colour sensors...** in the *Board* view opens a live card for
  every colour sensor: bars for each channel, **Take white** (which picks an exposure so a white sheet close under the
  sensor's light no longer saturates), **Take black**, and a colour check
  ([Calibrating your robot](CALIBRATION.md#quick-calibration-the-colour-calibration-panel)).
- **New in Python and blocks:** `calibrate_white(auto=...)`, `exposure()`, `auto_exposure()` and `store_exposure()` on
  the colour sensors; an *auto exposure* tick on the colour calibration blocks.
- **Faster:** a program that drives a `DriveBase` with a gyro has about half again as much processor time for its own
  code.
- **Changed:** a deeply recursive Python function raises `RuntimeError: maximum recursion depth exceeded` a few levels
  earlier.
- **Known issue:** auto exposure has been tried on hardware with the `ColorSensor` only
  ([help us test](KNOWN_LIMITATIONS.md#help-us-test)).

## 0.2.65 (2026-10-16)

- **Changed:** a held motor that keeps up a small back-and-forth against friction at the end of a move should now
  settle, on every library motor except the EV3 Large. This is not yet shown on a board: [help us test](KNOWN_LIMITATIONS.md#help-us-test).
- **Docs:** `PID` and `ADRC` each have their own section in the API reference.
- **Known issue:** the EV3 Large can still keep that back-and-forth after `hold()`.

## 0.2.64 (2026-10-10)

- **New: speeds in percent on a `DriveBase`.** `DriveBase(..., speed_unit=SpeedUnit.PERCENT)` drives with speed and
  steering in %, like LEGO's move steering. The *set up robot* block has a *speeds in* choice.
- **New: `PID` and `ADRC`**, controllers for your own loops: build one, call `update(setpoint, measurement)` each time
  round the loop, and send the output where you like. A *Controllers* block category, and `examples/23_controllers/`
  ([PID](API_ROBOT.md#pid--a-controller-for-your-own-loops), [ADRC](API_ROBOT.md#adrc--disturbance-rejection-for-your-own-loops)).

## 0.2.63 (2026-10-09)

- **Faster:** the robot's position estimate (`Pose`) runs on the motor core, so a busy program no longer slows it.
- **New:** `IMU.heading_confidence()` says when the heading can still creep after `ready()`; a block *has calibrated
  its gyro* goes with it.
- **Changed:** a program run again from the user button starts a kept `DriveBase` and `Pose` afresh, as Pybricks
  does. A second `IMU(port)` or `Pose(...)` on the same sources takes the running one over instead of starting again.
- **Changed:** the Python heap is 128 KB (139 KB before): a program close to the old limit may now raise
  `MemoryError`.

## 0.2.62 (2026-10-03)

- **New:** the CM22-2230 12V 1:49 gearmotor joins the motor library (`Motor(port, model="cm22_49")`, or the gear on
  the *Board* view's motor row).
- **Faster:** a drive base with an IMU and a compass is back to the speed of 0.2.59.
- **Known issue:** a Pololu 25D overshoots its target by about 1° at the end of a move, as on 0.2.61.

## 0.2.61 (2026-10-03)

- **Changed:** a motor holding a load (an arm's weight) should keep holding it when the next command comes, instead
  of sagging first. So far this is shown in a model of the EV3 Medium and Large, not with a real arm: [help us test](KNOWN_LIMITATIONS.md#help-us-test).
- **Fixed:** a `Pose` with a compass takes the compass's heading as soon as the compass joins, and with the IMU and
  the wheels it stops following a compass that disagrees by more than about 5° (a steel table leg, a motor's field).
- **Fixed:** most of 0.2.60's slowdown of programs that read the IMU and the compass.
- **Known issue:** a holding motor cannot feel a load taken away.

## 0.2.60 (2026-09-29)

- **New:** `evn.UART` is MicroPython's `machine.UART`, and `evn.I2C` has `machine.I2C`'s methods and a `timeout`.
  New block categories: *Pose*, *Serial and I2C*, *Files*.
- **Changed:** `UART.readline()` keeps the line's `b"\n"` and waits only as long as the object's `timeout` (0 unless
  you set one) instead of 5 s: `.strip()` the line, and give the wait to the constructor.
- **Improved:** `calibrate()` refuses a result that is not plausible instead of storing it. Gear play should no
  longer spoil a calibration, a `DriveBase` should keep both wheels on one clock when one is held back, and a still
  IMU should keep its heading: each of these is shown in a model so far.
- **Known issue (mostly fixed in 0.2.61):** programs that read the IMU and the compass ran slower than on 0.2.59.

## 0.2.59 (2026-09-28)

- **Changed:** a second `Motor(port)` or `Servo(n)` takes the port over instead of raising `OSError`, so running a
  cell again works. `stop()`, `brake()` and `close()` return once the motor has taken the command.
- **Improved:** the IMU starts right side up and rides through busy moments; `wait()` is never shorter than asked.
- **New:** the TCS3430, the HiTechnic sensors and the VL53L1X have their full set of settings, the VL53L1X an offset
  and crosstalk calibration, and `evn.DataLog` records all of them.
- **Known issue (improved in 0.2.61):** reading a motor (`angle()`, `speed()`) from Python took longer than on 0.2.58.

## Earlier releases

See the [full changelog](../CHANGELOG.md).
