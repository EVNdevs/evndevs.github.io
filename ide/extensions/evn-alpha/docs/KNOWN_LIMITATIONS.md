# Known limitations and help us test

This is early-access software. This page lists what does not work the way you might expect today, and what has not
been tried on real hardware yet. If you have the parts for one of the untested items, a short report is a real help.

## Known limitations

### Motors

- **A held motor can keep a small back-and-forth.** After `hold()` from speed (also `DriveBase.hold()`, and a move
  that ends with `then=Stop.HOLD`), some motors keep swinging a few degrees each way instead of settling, in a small
  share of holds: up to about 1 hold in 9 on some motors, and about 1 in 5 on an EV3 Large with nothing on its shaft.
  Use `stop()` when the motor need not hold.
- **A held motor cannot feel a load taken away.** If a weight is lifted off a holding arm, or the arm is lowered onto
  a rest, the motor keeps pushing as if the load were still there (it draws current), and the next command starts
  with that push.
- **A Pololu 25D (or any motor whose rotor cogs) overshoots about 1°** at the end of a move, because it comes to rest
  in the detent nearest its target; its final position is the better for it.
- **`run_until_stalled` needs a real obstruction:** a free shaft never stalls. `duty_limit` is how hard it pushes
  before the stall is reported; without one the motor pushes with the whole battery.
- **A non-LEGO motor whose encoder counts the other way cannot run a move until it is calibrated:** the board coasts
  it within about a quarter of a second of running away, and the program gets a `RuntimeError` asking for `calibrate()`
  ([Motor](API_ROBOT.md#motor)).

### Files, ports and the extension

- **A file write is refused while a motor drives:** it raises `OSError: [Errno 16] EBUSY`. Motors that hold, brake or
  coast do not block it. Keep readings in a list while the robot moves and write the file after `stop()` or a
  `wait=True` move, or catch the `OSError` and write later. A refusal loses nothing already accepted from a file you
  close: a refused `close()` keeps the data and writes it once the motors stop. A log that catches the error and
  carries on can have a gap where its refused lines were. Reading is refused only for a file opened for writing that
  still holds unwritten data, or one whose refused `close()` is still waiting.
- **A file object never closed loses its buffered bytes if it is freed while a motor drives** (as in 0.2.70): the
  garbage collector's late close is refused, with no error. The board runs a collection at the 9th `open()` while 8
  files are open, so `open(p, 'a').write(line)` in a loop while a motor drives loses lines at every 9th call. Close
  each file, or use `with`.
- **After a refused `os.rmdir()` or `os.rename()` on a file system of about 100 folders,** the first file call once
  the motors stop can take about a second: the board completes the refused change there.
- **If a mounted file system's guard block cannot be allocated** (a user `os.mount()` on a full heap; the board's own
  file system is mounted at a fresh heap), every write to it raises `OSError: [Errno 16] EBUSY`, motors stopped or
  not. Free memory (`gc.collect()`) and mount it again.
- **A file-system repair can wait for the next reset:** after a folder change (`os.mkdir()`, `os.rmdir()`,
  `os.rename()`) refused while a motor drove, or cut by a power loss, or, rarely, any refused write that moved a worn
  folder block, on a board with many folders in all (more than about 48 nested, or about 125 in one folder), the
  first file call after the stop takes about 2 s and every file write raises `OSError: [Errno 16] EBUSY` for the rest
  of that program, with the motors stopped. Reads still work; a refused `close()` waits. After that warning,
  soft-reset (Ctrl-D, the next run from the editor) or power-cycle once: a program's end does not repair (a `main.py`
  started again by the user button cannot write either). The soft reset or power cycle finishes the repair before
  `boot.py`, once: about 15 s on a board of about 100 folders in a shallow tree, about 26 s if they are nested 100
  deep, at most about 80 s. The editor waits for the board and says "repairing the file system" past 5 s: the console
  and the browser IDE up to 90 s (270 s over Bluetooth), Run and Upload up to 90 s over either link. Run and Upload
  need `mpremote` 1.23 or later for that wait; an older `mpremote`, like `mpremote` run by hand, waits 10 s and may
  report a connection error once during the repair (run again). The waiting `close()` is then written and writes work
  again. Beyond about 175 folders nested in one chain, or with a damaged folder list, writes
  stay refused (and a waiting close loses its data), and every power-on waits about 75 s before `boot.py`: a damaged
  folder list is formatted at the next reset (every file lost); otherwise copy your files off the board, reformat
  with `vfs.VfsLfs2.mkfs(evn.Flash(), progsize=256)` and press Ctrl-D.
- **A board that keeps its port open but never answers after a soft reset** (a `boot.py` that hangs, or a board stuck
  after `soft reboot`) is now reported by the editor after 90 s (the console and the browser IDE over Bluetooth:
  270 s; Run and Upload with an `mpremote` older than 1.23: 10 s, as before), not after 8-10 s: the same wait gives a
  file-system repair its time.
- **At most 8 open files and directories per file system:** the 9th raises `OSError: [Errno 24] EMFILE` (the board
  runs one garbage collection first, so a file object dropped without `close()` frees its place). Each mounted file
  system sets about 1.6 KB of heap aside for this. A `vfs.VfsLfs2` you create yourself keeps that memory and its
  caches (about 4 KB) until you call its `umount()` (or `os.umount()` once mounted), or until the next soft reset, even
  after your program drops it: unmount it before you make another.
- **A rename refused half-way while a motor drives** can hide, from `os.listdir()` and from `open()` for reading
  (`ENOENT`), the files listed after the renamed one in its old folder, or, when the rename reported success, still
  list the file under its old name too, until the motors stop and the next file call runs. Nothing is lost. Rarely
  (a worn flash block moved inside the rename), a rename onto a file with the same bytes and the same time stamp
  raises `EBUSY` although it landed; trying it again then raises `ENOENT`.
- **After a power loss in the middle of a rename or a folder update**, the first file write runs the file system's
  repair first; while a motor drives it raises `OSError: [Errno 16] EBUSY` until the motors stop.
- A `close()` refused while `micropython.heap_lock()` is in force, or whose later write fails because the file system
  is full, keeps the file's last written bytes only (as before this release).
- **One board at a time per VS Code window.** The *EVN ALPHA* terminal holds the board's port, and every other
  command closes that terminal first.
- **In the browser IDE, closing or reloading the tab does not stop the motors.** The browser gives the page no time to
  send anything: a program that is still running, or a motor started at the REPL, keeps its last command. Stop the
  program (or leave the REPL) first, or press the board's user button.
- **A peripheral moved to another port is not followed.** An unplugged peripheral raises `OSError` from its next
  reading and recovers by itself when it is plugged back into the **same** port.

### Sensors

- **`Compass.calibrate_stop()` refuses a calibration** until the sensor has been turned through enough directions,
  and keeps collecting: turn it more and stop again, or `calibrate_cancel()`.
- **`GestureSensor.thresholds()`:** the flags `status()` reads may never be set, because the chip's threshold
  interrupts are not switched on ([GestureSensor](API_SENSORS.md#gesturesensor--gesture-proximity-and-colour-sensor-apds-9960)).
- **`VL53L1X.detected()` with nothing in range** never reports a detection, under `'above'` and `'outside'` too. To
  wait for a clear path, use no threshold and test `tof.status() != 'valid' or tof.distance() > mm`
  ([VL53L1X](API_EXTENDED.md#vl53l1x--time-of-flight-distance-sensor-up-to-4-m)).

## Help us test

Each item below works on the host and in the simulated board, or follows the chip's datasheet, but has not been
tried with the real part yet. If you have it, run the test and send what you saw ([Reporting problems](#reporting-problems)).

| What | What you need | What to try |
| :--- | :--- | :--- |
| Colour calibration of the gesture sensor | an APDS-9960 gesture sensor | the gesture sensor's steps in [Calibrating your robot](CALIBRATION.md#the-gesture-sensor-is-different); then `gs.color()` over a few coloured cards |
| Auto exposure on other colour sensors | a gesture sensor, a TCS3430 or a HiTechnic colour sensor | **Calibrate colour sensors...** in the *Board* view, **Take white** under the module's light, then **Take black**; the colour readings after a reset |
| The QMC5883L compass | a QMC5883L module (the EVN compass is an HMC5883L) | `Compass(port)`, `c.chip()` reads `'QMC5883L'`; a calibration and a slow full turn ([Compass](API_SENSORS.md#compass--magnetometer-qmc5883l--hmc5883l)) |
| The HiTechnic Color Sensor V1 | an NXT HiTechnic Color Sensor V1 and an NXT cable adapter | `hc.version()` reads 1; `color()`, `reflection()` and `color_number()` over coloured cards ([HiTechnicColorSensor](API_EXTENDED.md#hitechniccolorsensor--hitechnic-nxt-color-sensor-v1--v2)) |
| `I2C` `stop=False` with an SMBus-style chip | a chip that forgets its register at a STOP, such as an MLX90614 | the register read `i2c.writeto(addr, bytes([reg]), False)` then `i2c.readfrom(addr, n)` ([I2C](API_SYSTEM.md#i2c--raw-i2c-port)) |
| `VL53L1X.detected()` in open air | a VL53L1X with nothing in front for several metres | `tof.distance_threshold('above', 500)`, then `tof.detected()` while the sensor points at open space |
| A held motor settling after `hold()` | an EV3 Medium, an NXT motor, a JGA25-370, a CHR-GM16-030PA or a CM22-2230 | `m.run(400)`, then `m.hold()`, twenty times: does the shaft settle, or keep swinging? |
| A motor holding an arm's weight from one command to the next | an EV3 Medium or Large with an arm (a beam with a weight at its end) | `m.run_target(200, 90)`, then `m.hold()`, then `m.run_target(200, 60)`: does the arm sag when the next command starts? |
| `UART` with another device at the other end | a serial device, or a second board, wired to Serial 1 or 2 | `u = UART(1, 9600, timeout=1000)`, then `u.write()` and `u.readline()` both ways ([UART](API_SYSTEM.md#uart--raw-serial-port)) |
| The Pololu 25D and CHR-GM16 motors on this release | one of them | the examples in `examples/02_motor/` after `calibrate()` |

## Reporting problems

Report a problem as an issue on the site's GitHub repository: **[Report a problem](https://github.com/EVNdevs/evndevs.github.io/issues/new?template=report-a-problem.yml)**. It opens a form with a field for each of these (you need a free GitHub account; the issue is public):

1. The output of **EVN: Collect board diagnostics** (it opens as a document; its **Report a problem** button copies them to the clipboard and opens the form).
2. The program you ran, and what the motors (or the sensor) did against what you expected.
3. If VS Code showed an error, the *EVN ALPHA log* output panel (*View, Output*, then *EVN ALPHA log*).
4. For a *Help us test* item: the part you used (its name and where you bought it) and what you saw.
