# Programs: run, stop, ports and units

How to run, stop and organise your programs, in Python or in blocks, and how the motor and sensor ports are named. New to the board? Start with [Getting started](GETTING_STARTED.md).

## The EVN ALPHA side bar

Open the **EVN ALPHA** tab in the activity bar (the ℕ icon). It has three sections:

- **Start**: **New Python program**, **New blocks program**, **Board panel**, **Documentation** and **Getting started**, then the [update row](COMMANDS.md#updates). The extension's version is beside the title; quote it in a bug report.
- **My projects**: your own programs.
- **Examples**: a folder for every part of the API.

Two more views, *Board* and *Console*, are in the secondary side bar on the other side of the window ([The Board view](BOARD_VIEW.md)).

## Running a program

Open a program and press **Ctrl+F5** (*EVN: Run current file on the board*). Your own files also have a **Run on the board** button next to their name, and examples a **Run example on the board** button.

The output appears in the *EVN ALPHA* terminal. While the program runs, the status bar reads `Running motor_minimal.py`; click it to bring the terminal back. Afterwards it reads `motor_minimal.py finished`, `motor_minimal.py: error` or `stopped`.

If the program raises an error, the traceback is clickable: `File "<stdin>", line 12` opens your program at line 12.

When a program ends, finished or stopped by an error, every motor coasts. The terminal says `program finished; the motors are coasting`, as a Pybricks program ends stopped.

### The prompt after a run

The terminal then stays at the board's prompt (the REPL), with the program's variables. Type `motor_1.angle()` and press Enter, for example.

**Ctrl+]** leaves the prompt and coasts every motor. A `m.run(300)` typed there does not keep driving, and a line you had half typed is cleared, never run. Every other way the terminal ends coasts the motors too: closing its tab, pressing Run or another board command, closing or reloading the VS Code window.

If the board cannot be reached when you leave, the terminal says so in red. **Enter** tries the coast again.

## Stopping a program

- **Ctrl+C** in the terminal, **Ctrl+Shift+F5** (*EVN: Stop all motors*) or the red **Stop** button in the status bar. Each stops the program and coasts every motor.
- The board's **user button** coasts every motor and ends the program (`SystemExit`), with no computer at all; no motor moves again until the next program starts. A program that reads the button calls `evn.set_stop_button(None)` first, and then the button stops nothing until it ends: stop it with Ctrl+C or **Stop motors**.
- Closing the program's terminal stops the program on the board that terminal was using, even with a second VS Code window on another board.
- Connecting a tool to the board also coasts the motors.

The stop goes straight to the board's port. If the port cannot be reached, the terminal says so in red and a message names the port: a stop that did not happen is never reported as done. Then use the user button.

**In the browser IDE, press Stop before you close or reload the tab.** The browser closes the page at once, with no time to reach the board. A running program, or a motor started at the prompt, keeps driving. If you forgot, press the user button or switch the board off.

## Your own programs

**New Python program** (under *Start*, or in the *My projects* header) asks for a name and creates the file in your projects folder. That is `EVN Projects` in your Documents folder; the setting `evn.projectsFolder` moves it.

*My projects* lists everything in that folder: Python programs in its **Python** folder, blocks programs in its **Blocks** folder. Each file has **Run on the board** and **Upload as main.py** next to it. Its right-click menu has Rename, Duplicate, Delete and **Show in the file explorer**.

A Python program cannot be named `something.evnblocks` (or `.evnblocks.py`). That name belongs to the file a blocks program writes when it runs, so the name box refuses it and says why.

## Examples

*Examples* has one folder per part of the API: the board, the motor, the robot, the pose, the serial and I2C ports, files, the data log, the controllers (`PID`, `ADRC`) and every standard peripheral. Each has a `…_minimal` program (the few lines you need) and a `…_complete` one (every call of that object), in Python and in blocks. Each is one row: click it and choose *Minimal* or *Complete*, in *Python* or *Blocks* (the language you picked last comes first); **Run** and **Save as my program** on the row ask the same. The *Extended Peripherals* group has one folder per device.

Every example says what hardware it needs, next to its name and in its tooltip: `Needs: one motor on port 1, wheels off the ground`.

An example can be edited but is never overwritten. Saving asks for a name and makes it a new program of yours under *My projects*. **Save a copy to my projects** in its right-click menu does the same without editing first. Running an example saves nothing.

On disk the folders are `examples/01_board/` to `examples/23_controllers/` and `examples/extended_peripherals/`.

## Autocomplete and help while you type

Autocomplete for `evn` works inside the projects folder once it is the workspace: choose **Open my projects folder as the workspace** in the *My projects* `...` menu. The folder already has the stubs and settings it needs.

Hover over an `evn` name (`Motor`, `run_angle`, `imu.heading`) to see its signature and documentation. Where Pylance does not show it (the browser IDE, an example opened from *Examples*), the extension shows the same text itself. The setting `evn.python.hover` is `auto`, `always` or `off`.

**Ctrl+F1** on a word (`Motor`, `run_angle`, `battery`, `StopWatch`) opens the online API reference at that word's section. It is also *Open online documentation for the symbol under the cursor* in the right-click menu. The setting `evn.docsUrl` names the site it opens.

`evn` underlined in red? See [Troubleshooting](TROUBLESHOOTING.md#if-evn-is-not-found).

## Blocks instead of Python

Click **Motor** under *Examples* and choose *Minimal · Blocks*, or press **New blocks program** for an empty one.

The block editor shows Scratch-style blocks on the left and the MicroPython they make on the right. Drag blocks from the toolbox, then press **Run on board** in the editor's toolbar (or **Ctrl+F5**). **Stop motors** stops it.

- **Upload as main.py** puts it on the board as the program the [user button starts](MAIN_PY.md).
- **Export Python** turns it into a `.py` file you can go on editing as text.
- A blocks example saves the way a Python one does: under a new name, into your projects folder.

Every block and the Python it makes: **EVN: Open blocks reference**, or the [Blocks reference](BLOCKS.md).

## Ports and units

Motor ports are the numbers printed on the board, **1 to 4**: `Motor(1)`. `Port.A` to `Port.D` exist as the same numbers.

Angles are degrees, speeds deg/s, accelerations deg/s², times ms, duty %, torque mNm and voltage mV. Positive is clockwise looking at the shaft; `Direction.COUNTERCLOCKWISE` flips a motor.

```python
from evn import Motor, Stop, wait

m = Motor(1)
m.run_angle(500, 360)                     # 500 deg/s, one turn, then hold
m.run_target(500, 0, then=Stop.COAST)     # back to 0, then release
m.run(300); wait(1000); m.stop()          # 1 s at 300 deg/s
print(m.angle(), m.speed(), m.load())
```

Speeds can also be in **percent** of the motor's full speed:

```python
from evn import Motor, SpeedUnit

m = Motor(1, speed_unit=SpeedUnit.PERCENT)
m.run(50)                                 # half of full speed
```

100 % is the motor's no-load speed at the present battery voltage. It is an estimate until `m.calibrate()` measures your motor: about 12–13 s per port, shaft free to turn ([Calibrating your robot](CALIBRATION.md)). See `examples/02_motor/motor_complete.py`.

## Sensors, displays and servos

A standard peripheral is plug-and-play. Put it on an I2C port (any of 1 to 16; only SDA and SCL are used), name the port, read.

```python
from evn import ColorSensor, Display, Color

cs = ColorSensor(5)                       # OSError if nothing answers on port 5
d = Display(11)
if cs.color() == Color.RED:
    d.write(0, "red!")
```

The RGB LED module and the servos go on the servo ports 1 to 4; the Bluetooth module on Serial 1 or 2. [The board](BOARD.md) shows where each port is.

Each device has a folder of examples, `examples/05_colour_sensor/` to `examples/18_bluetooth/`, with a minimal and a complete program. Every call is in the [API reference](API.md) (**EVN: Open API reference**).

### Extended peripherals

Kit you may already own works too:

| Device | In your program |
| :--- | :--- |
| HiTechnic NXT Color Sensor (V1 or V2), through an NXT cable adapter | `HiTechnicColorSensor(port)` |
| HiTechnic NXT Compass Sensor, through an NXT cable adapter | `HiTechnicCompass(port)` |
| DFRobot HuskyLens camera, its Protocol Type set to I2C | `HuskyLens(port)` |
| ST VL53L1X distance sensor (up to 4 m) | `VL53L1X(port)` |
| ams-OSRAM TCS3430 XYZ colour sensor | `TCS3430(port)` |

The board runs a HiTechnic sensor's port at 100 kHz by itself. The *Board* view names these devices, the block editor has an *Extended* category, and the data logger records them. The colour sensors keep a black / white calibration for their port, and the VL53L1X an offset calibration ([Calibrating your robot](CALIBRATION.md#vl53l1x-distance-sensor)).

```python
from evn import HuskyLens

cam = HuskyLens(11)
cam.algorithm(HuskyLens.OBJECT_TRACKING)
print(cam.blocks())                       # [(x, y, width, height, id), ...]
```

The calls are in the API reference, [Extended peripherals](API_EXTENDED.md).
