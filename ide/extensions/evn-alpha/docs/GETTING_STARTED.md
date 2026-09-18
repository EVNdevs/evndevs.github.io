# EVN ALPHA MicroPython: getting started

This is an early-access build for user testing. It covers the **motor layer** (four EV3/NXT motor ports, the `evn.Motor` API), the battery, button and LED, a file system on the board, the servo and serial ports, raw `evn.I2C`, and the fifteen **EVN Standard Peripherals** — colour, distance, gesture, environment, touch, compass and IMU sensors, the ADC, the OLED, the 8x8 matrix and the seven-segment display, the RGB LED module, the Bluetooth module and the two Geekservo profiles. All of them are now bench-validated on EVN modules.

**The quickest way through all of this is the guided walkthrough:** **EVN: Getting started walkthrough** in the command palette, or the link under *Start* in the **EVN ALPHA** sidebar. Five steps — install mpremote, flash the firmware, run an example, write your own program, learn more — and they tick themselves off as you go: the first two as soon as mpremote is found and the board appears, the rest when you run the matching command. It opens by itself the first time the extension starts with no board connected. This document covers the same ground in writing, with more detail.

## 1. What you need

- VS Code 1.106 or newer, this extension installed (`.vsix` file: *Extensions* view, `...` menu, *Install from VSIX...*).
- Python 3.8+ on your PC. The extension talks to the board through `mpremote`, a small Python tool. Run **EVN: Install mpremote** from the command palette once (it runs `pip install mpremote`), or install it yourself.
- Recommended: the Microsoft *Python* and *Pylance* extensions, for autocomplete and inline docs.
- An EVN ALPHA board, a USB cable, a battery pack (the motors run from the pack, not from USB).

## 2. Put the firmware on the board

Run **EVN: Flash MicroPython firmware**. The extension carries the firmware (`firmware/EVN_ALPHA_MicroPython.uf2`; `firmware/BUILD.txt` says which build).

- If the board already runs the MicroPython firmware, the extension reboots it into the bootloader by itself.
- Otherwise: unplug USB, **hold the BOOTSEL button**, plug USB back in, release the button. A drive named `RPI-RP2` appears and the extension copies the firmware onto it.

The board reboots and shows up as a COM port. The status bar reads `EVN: COM7` (the number varies). The LED blinks once a second while no program is talking to the board, five times a second while one is.

Files on the board (`main.py` and anything else you copied) survive a firmware flash.

The **Board** section tells you which firmware the board is actually running, next to the build this extension brings, together with the battery and the files on the board. It lives in the **secondary side bar** (*View → Appearance → Secondary Side Bar*, or **Ctrl+Alt+B**), with the **Console** view under it (§3b), so both can stay open beside your program; drag them somewhere else if you prefer. Most of the time it fills itself in: whenever no program is running and the REPL is closed, the extension keeps a **live console** open to the board (§3b), and the rows follow the board as it changes. **Read the board** in the section's header re-reads the firmware, the files and the I2C scan when you ask for it.

When the board's firmware is older than the bundled one, the firmware row becomes a warning with a **Flash** button next to it, and the extension offers the flash once. The battery row shows the pack — it is always two cells — with the pack voltage and both cell voltages: it turns into a warning under 7.2 V and an error under 6.6 V, worth a look when motors behave oddly. A read is refused while a program is running, because the program holds the port: stop it, or close the *EVN ALPHA* terminal, first. If `mpremote` is not installed yet, the section offers an **Install mpremote** button.

If the board is in UF2 (BOOTSEL) mode it has no COM port at all: the status bar reads `EVN: BOOTSEL mode — click to flash` and the port row says *Board in UF2 (BOOTSEL) mode* with a **Flash** button. Flashing from there needs neither a COM port nor Python.

Give the board a name once with **EVN: Name this board** (or the tag button on the port row, or in the port picker): the status bar then reads `EVN: Kenneth's robot (COM7)`. The extension remembers boards by their USB serial number, so yours is found again whatever COM number Windows gives it next time.

## 3. Your first program

Open the **EVN ALPHA** tab in the activity bar (the ℕ glyph). It has three sections: *Start* (five rows: **New Python program**, **New blocks program**, **Board panel**, **Documentation**, **Getting started**), *My projects* and *Examples*. Two more, *Board* and *Console*, are in the secondary side bar on the other side of the window (§2, §3b).

1. Plug a motor into **port 1** and keep the wheel off the ground.
2. Under *Examples*, click `01_first_moves` to open it, then press **Ctrl+F5** (*EVN: Run current file on the board*), or use the **Run example on the board** button next to its name.
3. The program's output appears in the *EVN ALPHA* terminal. When it finishes, the terminal stays attached to the board's REPL: type `m.angle()` and press Enter, for example. **Ctrl+]** leaves the REPL.

Every example says what hardware it needs next to its name and in its tooltip (`Needs: one motor on port 1, wheels off the ground`), so you can tell before you run it whether you have the parts on the board.

While a program runs, the status bar reads `Running 01_first_moves.py` — click it to bring the terminal back up — and a red **Stop** button sits next to it (the same as **Ctrl+Shift+F5**). Afterwards it reads `01_first_moves.py finished`, or `01_first_moves.py: error`, or `stopped`; while the REPL is open only the board's port and the **REPL** button are shown, since they already say where the prompt is. If the program raises, the traceback in the terminal is clickable: `File "<stdin>", line 12` opens your program at line 12.

To write your own, press **New Python program** under *Start* (or in the *My projects* header): it asks for a name and creates the file in your projects folder, `EVN Projects` in your Documents folder (the setting `evn.projectsFolder` puts it elsewhere). Everything in that folder is listed under *My projects*, with **Run on the board** and **Upload as main.py** next to each file, and Rename, Duplicate, Delete and **Show in the file explorer** in the right-click menu.

An example can be edited, but it is never overwritten: a save asks for a name and becomes a new program of yours under *My projects* (the tab switches to it). **Save a copy to my projects** in its right-click menu does the same without editing first. Running an example saves nothing.

Autocomplete for `evn` works inside the projects folder once it is the workspace: **Open my projects folder as the workspace** in the *My projects* `...` menu (the folder already carries the stubs and the settings for it).

**Stopping things:** **Ctrl+C** in the terminal, or **Ctrl+Shift+F5** (*EVN: Stop all motors*), interrupts the program and coasts every motor. The board's **user button** does the same without a PC. Connecting a tool to the board also coasts the motors.

## 3a. Blocks instead of Python

Open `first_moves` under *Examples → Blocks*, or press **New blocks program** for an empty one. The block editor shows Scratch-style blocks on the left and the MicroPython they generate on the right. Build a program by dragging blocks from the toolbox, then press **Run on board** in the editor's toolbar (or **Ctrl+F5**); **Stop motors** interrupts it. **Upload as main.py** makes it the power-on program, **Export Python** turns it into a `.py` file you can keep editing as text. A blocks example saves the same way a Python one does: under a new name, into your projects folder. Every block and the Python it produces: **EVN: Open blocks reference**.

**Every standard peripheral has blocks too.** Four of the block examples are peripheral programs you can open and run: `colour_line` (a line follower on the colour sensor), `spirit_level` (the IMU's tilt drawn on the 8x8 LED matrix), `compass_lights` (the compass heading on the RGB LED module) and `bluetooth_grabber` (a robot driven from a phone or PC over the Bluetooth module).

## 3b. The live console, the command line and the Console view

Whenever no program is running and the REPL is closed, the extension keeps a **live console** open to the board, and the *Board* section comes alive. The line above the rows then reads **live · connected 3 minutes ago** (or **live over Bluetooth · connected 3 minutes ago** when the board is on its wireless link, §5a); with the console off it reads "read 12 seconds ago" instead, because what you see is then one read, not a live link.

Every row is also a way to drive that port. The buttons only appear while the live console is connected, and only once you have said with the gear what is plugged in:

- **Motors** shows the angle and the speed of ports 1 to 4, four times a second. Turn a shaft by hand and watch the number move — a quick way to check wiring and direction. Press the gear and say which motor you plugged in (*EV3 Large*, *EV3 Medium*, *NXT*), and four buttons appear: **Run this motor at a speed...** (it asks for deg/s, negative runs backwards), **Run this motor to an angle...** (a speed, then a target angle), **Run this motor for a time...** (a speed, then how many milliseconds to run) and **Stop this motor**. The row keeps counting while the motor turns, because neither move blocks the telemetry.
- **Servo ports**: press the gear on a port and say what is on it — *Geekservo 270°*, *Geekservo continuous*, *generic 180°*, *RGB LED strip*, or *nothing*. The console then builds the object for you, so servo port 3 is `s3` (an LED strip is `l3`). **Drive this servo port...** then asks for an angle (the 270° and generic profiles), a duty in percent (the continuous one) or a colour (an LED strip), and **Stop this servo port** ends it.
- **Serial ports** are Serial 1 and Serial 2. The gear says what is on the header: *EVN Bluetooth module*, *UART (raw serial)* or *nothing*, and the console creates `bt1` / `bt2` or `u1` / `u2` for it. A UART is asked for its baud rate straight after (9600, 19200, 38400, 57600, 115200, which is what most things use, 230400, 460800, 921600, or *Other...* for anything from 300 to 3000000), and the row then reads `UART 9600 · 0 bytes waiting`. Change it later with the same gear: the board reopens the port at the new baud and keeps whatever was already queued. A Bluetooth row says what state the module is in, whether the board's REPL is on it, how many bytes are waiting and which COM port is this board's wireless link; its three buttons pair it in Windows, put the REPL on the module and pick its COM port for the board: that is §5a, the way to work without the USB cable.
- **I2C devices** lists the sensors and displays it found on ports 1 to 16, each identified by its own ID register, and re-checks about every 5 s. Plug a colour sensor in and it appears with its name and port. On a device it recognises, **Set a property of this device...** offers what that device can be set to (the colour sensor's gain 1, 4, 16 or 60, its integration time, and so on) and then asks for the value, and **Read this device live...** asks what the row should show — `hsv`, `rgb`, `lux`, `distance`, `heading`, whatever that sensor has — and the row shows it four times a second from then on, with a small chart of it in the *Console* view. The eye-closed button stops it. A live reading is remembered for that board and comes back by itself when the console reconnects.
- the **battery** row, the **firmware** row and **Files on the board**, kept up to date without you pressing anything. If the pack falls below `evn.battery.warnVolts` while the console is connected — 7.0 V by default, and the pack is two cells, so that is 3.5 V each — a warning appears in the status bar as well, with both cell voltages in its tooltip. Set it to 0 if you would rather not be told.

**Command line** is the row to try things with: click it (or **EVN: Send a command to the board**), type one line of Python and press Enter. `m1` to `m4` are the four motors, `s1` to `s4` the servos you configured (`l1` to `l4` for an LED strip), `bt1` / `bt2` and `u1` / `u2` the serial ports, `d5` the device on I2C port 5, and `evn` is already imported, so `m1.run_angle(200, 90)` turns port 1 by 90°, and `m1.angle()` prints where it is. The answer, and anything the board prints, appear in the **EVN Console** panel (**EVN: Show the console output**). The last 20 commands are offered again when you open the row.

**The Console view** under the Board tree is the same thing with a prompt and a transcript, for when one line at a time through a box gets tiring. Type Python, press **Enter**, and it runs on the board in the same namespace — a variable you set on one line is still there on the next. **Shift+Enter** adds a line instead of sending, so a small block (a `for` loop over three lines, say) goes over at once; **Up** and **Down** walk the lines you sent before, **Ctrl+L** clears the transcript, **Esc** empties the prompt. While the console is not live the prompt is greyed out and says why ("the board is running its own program (main.py)", "connecting to the board..."). It shows the same lines as the **EVN Console** panel, including what a program the board started by itself is printing.

**The charts.** Whenever a device is being read live (**Read this device live...** on an I2C row), a small strip chart of it appears between the transcript and the prompt: about the last minute of readings, one line for each number the reading gives (up to four), the scale at the right edge, and the latest value in the header next to the port and what is being read — `port 5 · lux · 123.4`. It is a quick way to see whether a sensor is steady, drifting or noisy while you move something in front of it. The chart appears with the reading and goes when you stop it; if the sensor starts raising instead of answering, the curve stands still and the header turns red. Readings that are not a single number or a short list of them (`hsv`, which comes back as a dict) have no chart, only the row. Nothing extra is asked of the board: the charts are drawn from the same telemetry the *Board* rows already use.

This is not the board's REPL. The REPL is still the **REPL** button and the terminal it opens (**Open REPL** is in the Console view's `...` menu too); the Console view is a prompt on top of the live link, which is why it can keep the port while the tree goes on updating.

Two things to know:

- **A program the board started by itself is never interrupted.** If `main.py` is running at power-on, the console row says so and only watches: its output still reaches the **EVN Console** panel. Press the stop button on that row (*Stop the board's program and connect*) when you do want to take the board over.
- **The link gets out of the way.** When you run a program, open the REPL, upload a file, reset or flash the board, the console lets go of the port and comes back a second after it is free. If you would rather it never held the port at all, turn `evn.console.enabled` off.

## 4. Ports and units

Motor ports are the numbers printed on the board, **1 to 4**: `Motor(1)`. (`Port.A` to `Port.D` exist as the same numbers.)

Angles are degrees, speeds deg/s, accelerations deg/s², times ms, duty %, torque mNm, voltage mV. Positive is clockwise looking at the shaft; `Direction.COUNTERCLOCKWISE` flips a motor.

```python
from evn import Motor, Port, Stop, Direction, wait, StopWatch

m = Motor(1)
m.run_angle(500, 360)                     # 500 deg/s, one turn, then hold
m.run_target(500, 0, then=Stop.COAST)     # back to 0, then release
m.run(300); wait(1000); m.stop()          # 1 s at 300 deg/s
print(m.angle(), m.speed(), m.load())
```

Speeds can also be given in **percent** of the motor's full speed instead of deg/s: `Motor(1, speed_unit=SpeedUnit.PERCENT)`. 100 % is the motor's no-load speed at the present battery voltage (a model estimate until `m.calibrate()` measures it on your motor, about 4.5 s with the shaft free to turn). See `examples/06_percent_speed.py`.

### Sensors, displays and servos

A standard peripheral is plug-and-play: put it on an I2C port (any of 1 to 16, only SDA and SCL are used), name the port, read.

```python
from evn import ColorSensor, Display, Color

cs = ColorSensor(5)                       # OSError if nothing answers on port 5
d = Display(11)
if cs.color() == Color.RED:
    d.write(0, "red!")
```

The RGB LED module and the servos sit on the servo ports 1 to 4, the Bluetooth module on Serial 1 or 2. `examples/07_color_sensor.py` and `examples/08_standard_peripherals.py` walk through the lot. The full list of calls is in **EVN: Open API reference**.

**Looking a call up while you type:** put the cursor on a word in a Python file — `Motor`, `run_angle`, `battery`, `StopWatch` — and press **Ctrl+F1** (or use *Open online documentation for the symbol under the cursor* in the right-click menu). The online documentation opens at that section of the API reference. The site it opens is the `evn.docsUrl` setting, so a staging copy can be used instead.

## 5. A program that starts at power-on

**EVN: Upload current file as main.py** copies the open file to the board as `main.py`. It runs every time the board powers up (and after a reset). Choose *Upload and run now* to reset the board immediately.

Escapes, in case the program misbehaves:

- Hold the **user button while powering on**: `main.py` is skipped once.
- **EVN: Stop all motors** interrupts it from VS Code (the extension's own connections never start `main.py`).
- The *Board* section's console row says when the board is running its own program, and its stop button (**Stop the board's program and connect**) ends it and hands the board back to you. Nothing else the extension does interrupts it.
- **EVN: Remove main.py from the board** deletes it.
- After a watchdog reboot (a program that froze the board), `main.py` is skipped automatically.

## 5a. Working without the USB cable (REPL over Bluetooth)

With an EVN Bluetooth module on Serial 1 or 2, the board's prompt can come to the PC over the air, and everything above (Run, the REPL, Upload as main.py) works the same way.

**The easy way is the *Serial ports* section of the *Board* tree** (§3b), with the board still on USB and the live console connected:

1. Press the gear on **Serial 1** or **Serial 2** and choose **EVN Bluetooth module**. The row then shows the module's state and whether the REPL is on it.
2. **Pair the Bluetooth module in Windows** (the link button, also in the palette) opens the Windows Bluetooth settings. Add the device shown as `HC-05` or `EVN Bluetooth` — the PIN is `1234`. Windows then lists an outgoing *Standard Serial over Bluetooth link (COMxx)* port for it.
3. **Put the REPL on this Bluetooth module** (the broadcast button) does the switch on the board. It offers **Make it permanent**, which writes the two lines into `boot.py` on the board for you, so the REPL is on the module every time it is switched on. Only one module carries the REPL at a time.
4. **Use the Bluetooth COM port for the board** (the plug button) lists the *Standard Serial over Bluetooth link (COMxx)* ports; pick the module's. That COM port is now this board's **wireless link** (the serial row says `link COM11 (98:D3:41:F7:18:02)` — the module's own Bluetooth address next to the port), and you never have to pick it again: the link is kept by that address, so it still finds the board if Windows gives the port another COM number later. The list leaves out Windows' *incoming* Bluetooth ports, the ones it makes per adapter, because they can never reach a module.

Then simply **unplug the USB cable**. The extension notices within about 4 s and comes back over Bluetooth in about 6 s: the status bar reads `EVN: Kenneth's robot (Bluetooth)`, the console row *Live console: connected over Bluetooth* with the COM port, and the line above the tree *live over Bluetooth · connected 3 minutes ago*. The same telemetry, the same buttons, and the REPL, Run and Stop all motors all go over the air; Ctrl+C is still the emergency stop.

**Put the cable back in and everything moves back to USB by itself**: USB is preferred at every look, and it is faster. Nothing to switch, and nothing to set up again: the motor models, the servo profiles, the serial headers, the live reads and the last speeds and angles you typed are kept for *that board*, by its USB serial number, and the wireless link is what tells the extension which board is on the far end of a Bluetooth COM port (a Bluetooth port has no USB descriptor to ask). If the link drops, out of range or the board switched off, the console row says *the Bluetooth link dropped* and keeps trying by itself; Windows keeps the COM port listed either way, so nobody else notices. A board that has never been on USB has no serial to key anything to: plug it in once, then pick the link.

**To try all this without pulling the cable**, press the arrow-swap button on the Bluetooth serial row: **Switch the board to Bluetooth now**. The live console moves onto the wireless link with the cable still in, so you can see the wireless side working at your desk: the console row reads *Live console: connected over Bluetooth (USB ignored)* and the serial row ends `· on the wireless link by choice`. The same button, now **Switch the board back to USB**, ends it. So does restarting VS Code: the choice is never saved on purpose, because the rule the extension otherwise follows is USB whenever it is there.

**Over the air the telemetry is deliberately slower**: 2 updates a second instead of the 4 USB gets. The module's link is shared with whatever your own program sends through it, and four updates a second of motor angles, battery and live device reads leave little room. `evn.console.bluetoothRate` takes 1, 2 or 4 if you would rather have it another way, and the console row always says which rate is in force (`2 updates/s · COM11`); a change applies the next time the console connects.

**By hand**, if you would rather do it yourself or you are not on Windows:

1. Pair the module once in Windows *Bluetooth & devices* (it shows as `HC-05` or `EVN Bluetooth`, PIN `1234`). Windows then lists a *Standard Serial over Bluetooth link (COMxx)* port for it — the outgoing one (Bluetooth settings → *More Bluetooth settings* → *COM Ports* shows which).
2. On the board, once per power-up, switch the REPL onto the module. Over USB, in the REPL: `import evn; evn.Bluetooth(2).repl(True)` (the module's serial port number). To make it permanent, put those two lines in a `boot.py` on the board — from the USB REPL: `open('boot.py','w').write("import evn\nevn.Bluetooth(2).repl(True)\n")` (or `mpremote cp boot.py :` from a terminal).
3. In VS Code click the port in the status bar and choose the Bluetooth COM port (marked with a broadcast icon). If the board has been on USB before, the extension keeps that port as its wireless link and keeps `evn.port` on the board's serial number, so USB is used again as soon as the cable is in. Unplug the cable; the REPL button, Run and Stop all motors now go over Bluetooth. Ctrl+C is still the emergency stop.

Notes: the first connection to the module takes a second or two (Windows opens the Bluetooth link when the port is opened); a program that uses the same module for its own traffic should turn the REPL off first (`bt.repl(False)`), because bytes the REPL consumes never reach `read()`; the USB prompt keeps working alongside. Over Bluetooth a board that answers nothing is ambiguous (it may be running its own `main.py`, or its REPL may not be on this module), and the console row says both rather than guessing; it never interrupts a running program to find out.

## 6. Other commands (command palette, type `EVN:`)

| Command | What it does |
| :--- | :--- |
| Select board port | choose which board to use when several are connected (it is remembered by its USB serial number, so it is found again on any COM number) |
| Name this board | give this board a name; the status bar then shows it, as `EVN: Kenneth's robot (COM7)` |
| Open REPL | interactive prompt on the board (Ctrl+] to leave); also the `REPL` button in the status bar and the terminal icon next to Run |
| List files on the board | `ls` of the board's file system, in the *EVN ALPHA* output panel |
| Reset the board | reboot (motors coast; `main.py` runs again) |
| Collect board diagnostics | firmware version, battery, motion-engine counters, files: paste it into a bug report |
| Read the board (firmware, battery, files) | re-read the firmware, the files and the I2C scan into the *Board* section; also its refresh button |
| Send a command to the board | one line of Python on the board through the live console (§3b); the *Command line* row |
| Show the console output | the *EVN Console* panel: what the command line answered, and what a program the board started by itself is printing |
| Clear the console view | empty the *Console* view's transcript (Ctrl+L in the view does the same) |
| Connect the live console / Pause the live console (free the port) | take the port for the live console, or let go of it (for another tool, say) |
| Pair the Bluetooth module in Windows | open the Windows Bluetooth settings to add the module (`HC-05` or `EVN Bluetooth`, PIN `1234`); §5a |
| Switch the board to Bluetooth now (test the wireless link) / Switch the board back to USB | move the live console onto the wireless link with the cable still in, and back again; also the arrow-swap button on a Bluetooth serial row (§5a) |
| Getting started walkthrough | the five guided steps |
| Enable evn autocomplete in every Python file | point Pylance's global stub path at the `typings` folder of your projects folder, so `evn` autocompletes anywhere, not only inside that folder. The extension offers this once by itself when you open a `.py` file that imports `evn` outside a folder that has the stubs (*Turn it on*, *Not now* — it asks again in a week — or *Never*) |
| Open online documentation for the symbol under the cursor | **Ctrl+F1** in a Python file: the online API reference, at the section for the word under the cursor (§4) |
| Check for extension and firmware updates | ask the documentation site whether a newer extension or firmware has been published |
| Open API reference / getting started | these documents |

The buttons on the *Board* rows — run a motor, drive a servo port, set or read a device, put the REPL on the Bluetooth module — are not in the palette: each belongs to its row and needs the live console (§3b).

## 6a. Updates

**EVN: Check for extension and firmware updates** asks the documentation site whether a newer extension or firmware has been published, and offers the download. With `evn.updates.check` on (the default) the same look-up happens quietly once a day, and says something only when there is something newer (once per version; *Remind me later* is a week). Nothing is ever downloaded or installed without you pressing a button. While the public site is not yet serving its `latest.json`, the check will simply report that it could not check — that is expected in this early-access build, not a fault.

## 7. Reporting problems

Please send:

1. The output of **EVN: Collect board diagnostics** (it opens as a document).
2. The program you ran, and what the motors did versus what you expected.
3. If VS Code showed an error, the *EVN ALPHA* output panel (*View, Output*, pick *EVN ALPHA*).

Known limitations of this build:

- One board at a time per VS Code window; the *EVN ALPHA* terminal holds the port, and every other command closes that terminal first.
- `run_until_stalled` needs a real obstruction; an unloaded shaft never stalls.
- The motion engine pauses for the duration of a file write on the board (tens of milliseconds); write files while the motors are idle.
- A peripheral that is unplugged raises `OSError` from the next reading and recovers by itself when it is plugged back into the **same** port; a replug into a different port is not followed.
- `Compass.calibrate_stop()` refuses a calibration until the sensor has been through enough directions, and keeps collecting: turn it more and stop again, or `calibrate_cancel()`.
