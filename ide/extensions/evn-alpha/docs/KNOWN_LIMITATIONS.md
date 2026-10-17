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
  `wait=True` move, or catch the `OSError` and write later. Reading files and `import` are never refused.
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

<!-- Owner item SITE-09: the report channel (site repository issues, an e-mail address or a form) is not chosen
     yet. Add where to send a report here, and to the footer, when it is. Do not invent one. -->

Please send:

1. The output of **EVN: Collect board diagnostics** (it opens as a document).
2. The program you ran, and what the motors (or the sensor) did against what you expected.
3. If VS Code showed an error, the *EVN ALPHA* output panel (*View, Output*, then *EVN ALPHA*).
4. For a *Help us test* item: the part you used (its name and where you bought it) and what you saw.
