# What's new

The main changes of each release, in a few lines. The [full changelog](../CHANGELOG.md) lists every change, including
the tools and the measurements behind each release. What is not tested yet is on
[Known limitations and help us test](KNOWN_LIMITATIONS.md).

## 0.2.72 (2026-10-31)

- **New in the simulator: challenges.** Three *Obstacle course* levels, each run many times from a start moved a
  little at random and scored on reaching the goal, speed and touching nothing; a run can be saved as a sealed
  submission for a teacher to check ([Challenges](SIMULATOR.md#challenges)).
- **New: EVN: Open lessons** opens the EVN lessons site in your browser, signed in if your licence key unlocks the
  lessons ([Lessons](SIMULATOR.md#lessons)).
- **New: `imu.find_front()`** finds the MPU-6500 `IMU`'s front axis from one nose-down tip after a level
  `calibrate()`, and stores it with the port's calibration; in Blocks, *calibrate IMU*'s *front: tip it nose-down*
  ([Sensors](API_SENSORS.md)).
- **Fixed: a `DistanceSensor` (VL53L0X) left mid-setup recovers without switching the board off and on** (it used to
  answer with the wrong ID, `lost`, until a power cycle).
- **The LSM6DSV comes in a later release:** `evn.LSM6DSV(port)` is not in this release's firmware, so programs on
  the MPU-6500 `IMU` keep their speed.
- **New on the OLED display:** the EVN mark when a `Display` opens, until your program draws; `ports(True)`, a live
  map of the 16 I2C ports that names each device or shows its reading; `set_font('small')` for `draw_text()` in a
  4x6 font ([Displays](API_DISPLAYS.md)).
- **Fixed: `Motor.calibrate()` returns once its result is in flash**, so switching the board off straight after it
  no longer loses the calibration (with another motor driving, it says so and stores the result once the motors stop).

## 0.2.71 (2026-10-26)

- **New: the robot simulator.** No board needed: the **EVN Simulator** panel is a simulated EVN ALPHA robot on a
  line-following course (the Rescue Line tiles with ramps, a seesaw, bumps and obstacles, an oval, or a map you build),
  with a 3D view. While the panel is open the simulated board is the port **EVN simulator**: Run, Upload as main.py, the
  REPL, Stop, the Board view and the Console all reach it, on the desktop and in the browser IDE. Your program runs in
  Python that ships inside the extension (Pyodide), so nothing else needs installing. Open it from *Start*, the Board
  view's **Simulator** row, **EVN: Open the simulator** or the port picker ([The robot simulator](SIMULATOR.md)).
- **New: the simulator's licence.** The simulator is free until 31 December 2026. From 1 January 2027 it is free for 14 days
  from the first time it opens, and after that it opens with a licence key, checked with no internet connection. The
  panel's header and the Board view's *Simulator* row say until when it is free, or the trial's days left. Schools in
  Singapore can buy licences through Vendors@Gov; anyone else: [kenneth@coresg.tech](mailto:kenneth@coresg.tech)
  ([Licence](SIMULATOR.md#licence)).
- **Fixed: a file write while a motor drives no longer damages the file.** The write is still refused with
  `OSError: 16` (EBUSY), but nothing is written or lost: repeat it once the motors stop. A refused `close()` keeps its
  data and writes it when the motors stop. Close files or use `with`: a file left open still loses its unwritten
  bytes if it is freed while a motor drives.
- **Fixed: a rare file system error when moving a file between folders.** `os.rename()` of a folder's only file into
  another folder could fail with `OSError: 84` (about once in 1 600 renames) and, from the second time on, damage the
  file system. The firmware carries a fix to LittleFS, the file system MicroPython uses.
- **Fixed: updating the extension from inside VS Code** ("No Servers"). Updating from 0.2.70 may still show it once:
  use the message's **Download** button and install the downloaded VSIX by hand.
  **Known issue:** single calls such as `motor.load()` or `db.done()` take a few tens of microseconds longer than on
  0.2.70; a program's loops as a whole run as fast or faster.

## 0.2.70 (2026-10-21)

- **New: the user button stops a program.** A press coasts every motor at once and ends the running program with
  `SystemExit`, as on Pybricks hubs. A program that uses the button as an input calls `evn.set_stop_button(None)`
  first, or the press ends it; the button blocks do this for you.
- **Fixed: the drive-base and motor bugs #2-#17.** Among them, `use_gyro(True)` corrects a `drive()` loop again,
  `done()` no longer turns True during a gyro `drive()`, `run_until_stalled()` returns in reverse on the PID law, a
  new `Motor` starts from the defaults after a soft reset, and maneuvers use the full acceleration you set. Your
  program also gets more time than on 0.2.69: a drive program's polling loop takes about 40 % less time a pass.
- **Changed: `main.py` and the user button with VS Code connected.** While `main.py` waits for the button the LED
  double-blinks, VS Code no longer ends the wait, and a press runs `main.py` with its prints in the Console view.
  **Pause** keeps listening to the board, and **Disconnect** frees the port. New blocks programs drive one standard
  robot (motors 4 and 3); programs saved earlier keep the robot they drove.
  The colour calibration panel keeps up with many sensors: only the cards on screen are read, and only changes
  are sent.
  The editor's **Run** button now runs a Python file on the board (it ran it on your computer first; in a workspace where
  you picked the computer's Run before, pick **Run on the board** once from its menu).
- **Docs:** the BOOTSEL steps are corrected: the USB replug way works only with the board switched on (or hold
  BOOTSEL and press RESET).
- **Known issue:** one calculation that runs 3 s without a wait (such as `3**100000`) reboots the board, and
  `evn.reset_cause()` then says `"watchdog"`. The CHR-GM16-030PA motor settles about 1.3 ms later than on 0.2.69,
  and the `DriveBase` default speeds ask more than wheels under a robot's load can give.

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
