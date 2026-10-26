# Troubleshooting

What to check when something does not work, and how to report a problem.

## The status bar says "EVN: no board"

1. **Is the board switched on?** The red LED is lit while it is. Switched off, the USB cable only charges the cells and the computer never sees the board. Press ON/OFF.
2. **Is the cable a data cable?** Some USB-C cables only charge. Try another cable.
3. **Is the firmware on it?** A new board has none yet: [put the firmware on the board](GETTING_STARTED.md#4-put-the-firmware-on-the-board).
4. **Does the status bar say `EVN: mpremote missing`?** Run **EVN: Install mpremote**. On Linux, see [below](#linux-mpremote-will-not-install).

The status bar can take up to ten seconds to catch up after a change. *View → Output*, then **EVN ALPHA log** in the list, shows what the extension tried.

## The port is "in use"

Only one program can hold the board's port at a time. One board at a time works per VS Code window; the *EVN ALPHA* terminal holds the port, and every other command closes that terminal first.

If another tool holds the port (a serial monitor, a second VS Code window), close it. **Disconnect the live console (free the port)** lets go of the port when you want another tool to use it (a paused console still reads the port).

## Linux: the board is found but cannot be opened

Linux lets only members of one group open a serial port: `dialout` on Debian, Ubuntu and Fedora, `uucp` on Arch. Add yourself once, then log out and in again:

    sudo usermod -aG dialout $USER     # Arch: uucp instead of dialout

The board's port is then a name such as `/dev/ttyACM0`.

## Linux: mpremote will not install

On recent Debian and Ubuntu, `pip` refuses to install into the system's Python (*externally-managed-environment*). Make a Python of your own for the extension, then point the extension at it:

    python3 -m venv ~/evn-python
    ~/evn-python/bin/python -m pip install mpremote

Set the `evn.pythonPath` setting to that Python's full path, for example `/home/you/evn-python/bin/python`.

## Linux: no RPI-RP2 drive during a flash

Flashing needs neither the serial port nor Python, so it works before mpremote is installed.

The extension looks for the `RPI-RP2` drive where the desktop mounts USB drives (`/media/<you>`, `/run/media/<you>`, `/mnt`, `/media`). Without a desktop that mounts drives by itself, mount it by hand while the board is in BOOTSEL mode.

## Flashing

**No `RPI-RP2` drive appears.** With the board on and USB connected, hold BOOTSEL, press and release RESET, then let go of BOOTSEL. Or, also with the board switched on: unplug USB, hold BOOTSEL, plug USB back in, then let go. A board that is switched off does not run on USB power alone (USB only charges the cells), so switch it on first. If the drive still does not appear, try another cable: a charge-only cable carries no data.

![The other way into BOOTSEL mode, with the board switched on, in four steps: unplug the USB-C cable, press and hold BOOTSEL, plug the cable back in still holding, release BOOTSEL; the RPI-RP2 drive appears and the status bar offers the flash](images/bootsel-gesture.webp)

**The board is in BOOTSEL mode by mistake** (BOOTSEL held during a reset or while plugging in). A board that already has its firmware does not need a flash. Press **Restart the board without flashing** on the *Board* view's port row (also *EVN: Restart the board without flashing*): it starts the firmware already on the board and writes nothing. The board's RESET button does the same.

A board with no firmware comes back in BOOTSEL mode, and the extension says so: flash it.

**The flash says the board did not come back.** The extension reports **firmware flashed** only when the board answers with the new version within 40 s. A board that stays in BOOTSEL mode, comes back silent or answers with another version is reported as such. Flash again; if it fails again, [report it](#reporting-problems).

### More than one board on USB

The flash confirmation names the board it flashes. The board selected in the status bar is restarted into BOOTSEL mode, and only the `RPI-RP2` drive *it* brings up is written. A board already sitting in BOOTSEL mode is left alone; with exactly one, the confirmation offers to flash that one instead.

With no running board selected and several in BOOTSEL mode, the extension asks which drive to flash. The drives look alike, so if you are not sure which board is which, **unplug the others first**.

<details>
<summary>Slow drives and drive letters (Windows)</summary>

A drive letter that does not answer within 2 s (a network or sleeping drive) is never written; the extension then asks which drive to flash. That letter is used again only once it answers quickly and is seen empty twice in a row.

A slow letter is skipped for up to a minute.

A drive that was there before the flash stays another board's, even when one read of it is slow. A board unplugged before you click frees its letter, and the selected board may then come up on it.

If the flash ends with "did not appear as a new RPI-RP2 drive", flash again, or unplug the other drives first. On macOS and Linux a second board's drive (`RPI-RP2 1`, `RPI-RP21`) is looked for too. One flash, or restart, runs at a time, also across VS Code windows.

</details>

## If `evn` is not found

`evn` exists only on the board; the editor reads its description from `typings/evn.pyi`. A red *Import "evn" could not be resolved* (or *…from source*) means that description did not reach your file.

Run **EVN: Check Python setup** with the file open. It says what applies and offers the fix. The usual causes:

- **The file is not in your projects folder, or you opened a parent folder.** Only a `typings/` at the top of the opened folder counts. Use **Open my projects folder as the workspace**, or **EVN: Enable evn autocomplete in every Python file**.
- **BasedPyright is installed.** It ignores Pylance's settings and shows the stub as an error. The projects folder is set up for it; elsewhere, the check command's *Fix* adds its settings. Keep one Python language server, not two.
- **Your folder has a `pyrightconfig.json`, or a `pyproject.toml` with `[tool.pyright]`.** Pylance then ignores its settings there. In `pyrightconfig.json` add `"stubPath": "typings"` and `"reportMissingModuleSource": "none"`. In `pyproject.toml`, under `[tool.pyright]`, add `stubPath = "typings"` and `reportMissingModuleSource = "none"`.
- **Pylint or mypy report it.** The projects folder has `.pylintrc` and `.mypy.ini` for them, and *Set up this folder* adds them elsewhere. If you already have a configuration of your own for that tool, a file of ours would switch yours off. The check command then names the one line to add to yours instead. Ruff and Flake8 never report it.

## The motors do not move

- **Are the cells in and charged?** The motors run from the cells, not from USB. The *Board* view's battery row shows the pack voltage.
- **Is the program on the right port?** `Motor(1)` is the port marked **1** on the board.
- **A non-LEGO motor runs away and stops with a `RuntimeError`.** Its encoder counts the other way. [Calibrate it](CALIBRATION.md#motors) once.

## Known limitations of this build

- One board at a time per VS Code window.
- `run_until_stalled` needs a real obstruction; an unloaded shaft never stalls. **`duty_limit` is the force it pushes with before the stall is reported.** Without one the motor pushes with the whole pack.
- A file write on the board is **refused while a motor drives**: it raises `OSError: [Errno 16] EBUSY`, because a write would stall the motor control for 45–400 ms. Motors that hold, brake or coast do not block it. Collect your readings in a list while the robot moves, and write the file after `stop()`, `hold()` or a `wait=True` move. `stop()` returns once the motor coasts, so the write can follow at once; or catch the `OSError` and write later. A refused `close()` keeps its data and writes it once the motors stop; a file never closed loses its buffered bytes if it is freed while a motor drives, so close files or use `with`. Reading files and `import` are not refused (except a file opened for writing that still holds unwritten data, or one whose refused `close()` is still waiting).
- A peripheral that is unplugged raises `OSError` from its next reading. It recovers by itself when plugged back into the **same** port; a different port is not followed.
- `Compass.calibrate_stop()` refuses a calibration until the sensor has been through enough directions, and keeps collecting: turn it more and stop again, or `calibrate_cancel()`.
- In the browser IDE, closing the tab does not stop a running motor. Press **Stop** first.
- **A single calculation longer than 3 s reboots the board.** The 3 s hardware watchdog is fed between Python steps and in every wait (`time.sleep()`, a `wait=True` move, a file write), so those may take as long as they need. One calculation that runs for 3 s without reaching any of them is not fed: `3**100000`, one huge integer calculation, rebooted the board. The console loses the board, the motors coast, and after the reboot `evn.reset_cause()` returns `"watchdog"`; `main.py` is skipped, after soft reboots (Ctrl-D) too, until the board next restarts. For scale, `3**32000` took about 0.4 s.

## Reporting problems

Report a problem as an issue on the site's GitHub repository: **[Report a problem](https://github.com/EVNdevs/evndevs.github.io/issues/new?template=report-a-problem.yml)**. It opens a form with a field for each of these (you need a free GitHub account; the issue is public, so leave out passwords and personal data):

1. The output of **EVN: Collect board diagnostics** (it opens as a document). The command then offers **Report a problem**: it copies the diagnostics to the clipboard and opens the form, so you paste them into its first field.
2. The program you ran, and what the motors did compared with what you expected.
3. If VS Code showed an error, the *EVN ALPHA log* output panel (*View → Output*, then *EVN ALPHA log*).

Something wrong or unclear on a page of this site? Use **Suggest a change** at the top of the page: it opens an issue there with the page and the section you are reading filled in.
