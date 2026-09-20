# EVN ALPHA Blocks (early access)

A block editor for the EVN ALPHA, built on [Blockly](https://github.com/RaspberryPiFoundation/blockly) (the block library maintained by the Raspberry Pi Foundation, the same engine behind Scratch-style editors). Blocks are turned into a MicroPython program for the `evn` module and run on the board through the same path as a hand-written `.py` file. The generated Python is always visible next to the blocks, so a program can be read, copied and, with *Export Python*, continued as text.

## Using it

- **EVN: New blocks program** (command palette, or right-click a folder in the Explorer) creates a `.evnblocks` file and opens it in the block editor. **EVN: New project** puts the examples in `examples/blocks/`: `first_moves`, `two_motors`, `stall_stop` and `blink` for the motors and the board, then `colour_line` (a line-follower stub, no motors), `spirit_level` (IMU on the OLED display), `compass_lights` (the compass on the RGB strip and the 7-segment display) and `bluetooth_grabber` (touch pads, a servo, the LED matrix and Bluetooth); `drive_base` (two motors as a robot) and `drive_base_gyro` (the same robot following its gyro).
- Drag blocks from the toolbox on the left. The **Python** pane on the right shows the generated program as you build it; **Copy** puts it on the clipboard.
- **Run on board** (or **Ctrl+F5**) saves the file, writes the program to `<name>.evnblocks.py` next to it and runs it in the *EVN ALPHA* terminal. **Stop motors** (Ctrl+Shift+F5) interrupts it and coasts every motor.
- **Upload as main.py** puts the program on the board, where a press of the user button starts it after every power-on; **Export Python** saves it as a `.py` file you can edit as text.
- A `.evnblocks` file is JSON (the Blockly workspace); it can be committed, diffed and shared. `<name>.evnblocks.py` is rewritten at every run: edit the blocks, not that file.

The editor uses the CORE colour scheme (white or dark, tan accent) and follows the VS Code colour theme; the scheme button at the right of the toolbar forces light or dark.

Settings: `evn.blocks.renderer` (look of the blocks: `zelos` rounded/Scratch-like, `geras` or `thrasos` classic Blockly), `evn.blocks.showCode` (the Python pane) and `evn.blocks.theme` (`auto`, `light`, `dark`).

## The blocks and the Python they generate

Motors are `motor_1` .. `motor_4`, one object per port, created once at the top of the program (`motor_1 = Motor(1)`). The **set up motor** block sets the constructor options for a port; without it a port uses clockwise as positive and speeds in deg/s. Ports are the numbers printed on the board, 1 to 4; angles are degrees, speeds deg/s (or % of full speed after *set up motor*), times ms.

### Motors

| Block | Python |
| :--- | :--- |
| set up motor *1* positive direction *counterclockwise* speeds in *% of full speed* | `motor_1 = Motor(1, positive_direction=Direction.COUNTERCLOCKWISE, speed_unit=SpeedUnit.PERCENT)` |
| turn motor *1* by *360* degrees at speed *500* then *hold* wait ☑ | `motor_1.run_angle(500, 360)` |
| turn motor *1* to angle *0* at speed *500* then *coast* wait ☐ | `motor_1.run_target(500, 0, then=Stop.COAST, wait=False)` |
| run motor *1* for *1000* ms at speed *500* then *hold* wait ☑ | `motor_1.run_time(500, 1000)` |
| run motor *1* at speed *300* | `motor_1.run(300)` |
| stop (coast) / brake / hold motor *1* | `motor_1.stop()` / `.brake()` / `.hold()` |
| run motor *1* at speed *200* until stalled then *coast* duty limit *50* % | `motor_1.run_until_stalled(200, duty_limit=50)` |
| wait until motor *1* is done | `while not motor_1.done():` `wait(10)` |
| set motor *1* angle to *0* | `motor_1.reset_angle()` (a non-zero value: `reset_angle(value)`) |
| stop all motors | `stop_all()` |

`then` is *hold* (default), *coast*, *brake*, *keep running* (`Stop.NONE`) or *coast (smart)* (`Stop.COAST_SMART`); it is only written when it differs from the default. `wait` unticked adds `wait=False` (the move continues while the program goes on: use it to move two motors together, then **wait until motor is done**).

### Robot (a drive base: two wheel motors driven together)

| Block | Python |
| :--- | :--- |
| set up robot: left motor *4* right motor *3* wheel diameter *62.4* mm wheels *170* mm apart | `drive_base = DriveBase(motor_4, motor_3, wheel_diameter=62.4, axle_track=170)` (after the two motors' lines; a mirrored motor gets its direction from its own **set up motor** block) |
| drive straight *300* mm then *hold* wait ☑ | `drive_base.straight(300)` |
| turn robot *90* degrees then *hold* wait ☑ | `drive_base.turn(90)` (positive = right, clockwise seen from above) |
| drive an arc of radius *150* mm through *90* degrees then *hold* wait ☑ | `drive_base.arc(150, angle=90)` (a negative radius curves left, a negative angle drives backwards) |
| drive at *200* mm/s turning *0* deg/s | `drive_base.drive(200, 0)` |
| stop the robot *coast* / *brake* | `drive_base.stop()` / `drive_base.brake()` |
| set robot speed *300* mm/s turn rate *150* deg/s | `drive_base.settings(straight_speed=300, turn_rate=150)` |
| reset robot distance and angle | `drive_base.reset()` |
| robot follows its gyro: IMU on port *3* | `imu_3 = IMU(3)` … `pose = Pose(4, 3, wheel_diameter=62.4, axle_track=170, reverse_left=True, imu=3)` at the top (the robot's ports and geometry, a mirrored motor as `reverse_left=` / `reverse_right=`, after the IMU's line), then `drive_base.use_gyro(True)` where the block sits |

One robot per program. Without a **set up robot** block the robot is left motor 1, right motor 2, 56 mm wheels 112 mm apart. `then` here is *hold*, *coast*, *brake* or *coast (smart)* (a drive base has no *keep running*: use **drive at**). Both wheels run on one time base, so a straight is straight and an arc is an arc; the distance between the wheels is measured between the tyres' contact patches — check it with one *turn robot 360 degrees* against a mark on the floor.

**Robot follows its gyro** makes the robot itself, not just its wheels, drive the path: the wheel encoders and an EVN IMU fixed to the chassis track where the robot really is (`evn.Pose`), and every straight, turn and arc is corrected as it goes, so scrub on a turn, a dragged cable and the gyro's drift no longer add up over minutes (on the floor, 40 moves ended about a centimetre from the mark with no visible heading error; the pose's own closure was 3 mm / 0.24 degrees). Put it before the first move and keep the robot still while the program starts: it waits, up to 30 s, for the IMU to settle (an `OSError` if the robot was moving). A robot pushed sideways is the one thing the pose cannot see. The `drive_base_gyro` example is the `drive_base` one with this block.

### Sensing (values)

| Block | Python |
| :--- | :--- |
| motor *1* angle / speed / load (mNm) / full speed (deg/s) | `motor_1.angle()` / `.speed()` / `.load()` / `.full_speed()` |
| motor *1* is done / is stalled | `motor_1.done()` / `motor_1.stalled()` |
| robot distance (mm) / angle (deg) | `drive_base.distance()` / `drive_base.angle()` |
| robot is done / is stalled | `drive_base.done()` / `drive_base.stalled()` |
| button pressed? | `button.pressed()` |
| battery voltage (mV) | `battery.voltage()` |
| stopwatch time (ms) | `stopwatch.time()` (a `StopWatch` created at the top of the program) |

### Timing

| Block | Python |
| :--- | :--- |
| wait *1000* ms | `wait(1000)` |
| forever … | `while True:` … |
| reset stopwatch | `stopwatch.reset()` |
| wait for a button press | `while not button.pressed(): wait(10)` then `while button.pressed(): wait(10)` (the press also coasts every motor: a start trigger, not something to do mid-move) |

### Board

| Block | Python |
| :--- | :--- |
| turn LED on / off / toggle | `led.on()` / `led.off()` / `led.toggle()` |
| print *hello* | `print('hello')` (Blockly's standard print block; join text and values with the Text blocks) |

### Sensors (the EVN Standard Peripherals you read)

Every peripheral works like a motor: one object per port, created once at the top of the program with the port in its name (`color_sensor_1 = ColorSensor(1)`). Each block carries its own port, so the **set up …** block is only there to say which ports a program uses — and, for the RGB LEDs, the servo and the display, to carry the option that has nowhere else to go. Ports are the numbers printed on the board: **I2C 1 to 16**, servos 1 to 4, serial 1 to 2. Each device has its own sub-category under *Sensors* or *Outputs*.

| Block | Python |
| :--- | :--- |
| set up colour sensor on port *1* | `color_sensor_1 = ColorSensor(1)` |
| colour sensor *1* sees *white* | `color_sensor_1.color() == Color.WHITE` (the six colours `color()` picks from: red, yellow, green, blue, white, nothing) |
| colour sensor *1* colour | `color_sensor_1.color()` |
| colour sensor *1* reflection (%) | `color_sensor_1.ambient()` |
| colour sensor *1* hue / saturation / brightness | `color_sensor_1.hsv().h` / `.hsv().s` / `.hsv().v` |
| colour sensor *1* red / green / blue | `color_sensor_1.rgb()[0]` / `[1]` / `[2]` |
| set up distance sensor on port *1* | `distance_sensor_1 = DistanceSensor(1)` |
| distance sensor *1* distance (mm) | `distance_sensor_1.distance()` (`None` when nothing is in range) |
| set distance sensor *1* to *long range* | `distance_sensor_1.profile('long_range')` (*normal* `'default'`, *fast* `'high_speed'`, *accurate* `'high_accuracy'`) |
| set up gesture sensor on port *1* | `gesture_sensor_1 = GestureSensor(1)` |
| gesture sensor *1* gesture | `gesture_sensor_1.gesture()` (`'up'`, `'down'`, `'left'`, `'right'` or `None`) |
| gesture sensor *1* wait up to *5000* ms for a gesture | `gesture_sensor_1.read_gesture(5000)` |
| gesture sensor *1* proximity | `gesture_sensor_1.proximity()` |
| gesture sensor *1* colour | `gesture_sensor_1.color()` |
| set up weather sensor on port *1* | `env_sensor_1 = EnvSensor(1)` |
| weather sensor *1* temperature (C) / humidity (%) / air pressure (Pa) | `env_sensor_1.temperature()` / `.humidity()` / `.pressure()` |
| set up compass on port *1* | `compass_1 = Compass(1)` |
| compass *1* heading | `compass_1.heading()` |
| call this way north on compass *1* | `compass_1.north()` |
| start calibrating compass *1* spinning flat ☑ | `compass_1.calibrate(True)` (unticked: `calibrate()`, tumble the sensor by hand) |
| finish calibrating compass *1* | `compass_1.calibrate_stop()` (raises when the sensor did not turn far enough) |
| set up touch pads on port *1* | `touch_1 = TouchArray(1)` |
| touch pads *1* any touched | `touch_1.pressed()` |
| touch pads *1* pad *0* touched | `touch_1.read(0)` (pads 0 to 11) |
| set up IMU on port *1* | `imu_1 = IMU(1)` |
| IMU *1* heading / pitch / roll | `imu_1.heading()` / `imu_1.tilt()[0]` / `imu_1.tilt()[1]` |
| IMU *1* has *the top* facing up | `imu_1.up() == Side.TOP` (`BOTTOM`, `FRONT`, `BACK`, `LEFT`, `RIGHT`) |
| IMU *1* is still | `imu_1.stationary()` |
| set IMU *1* heading to 0 | `imu_1.reset_heading()` |
| set up ADC on port *1* | `adc_1 = ADC(1)` followed by `adc_1.inputs((0, 1, 2, 3))` — the driver scans AIN0 only by default, and the voltage block would raise `ValueError` for any other input |
| ADC *1* voltage of input *0* | `adc_1.voltage(0)` (input 0 to 3, all four scanned by the setup block; volts; never more than 3.3 V on a pin) |

### Outputs (displays, lights, servos, Bluetooth)

| Block | Python |
| :--- | :--- |
| set up display on port *1* mirror the console ☐ | `display_1 = Display(1)` (ticked, it also writes `display_1.mirror(True)`: every `print()` appears on the display too) |
| display *1* print *hello* | `display_1.print('hello')` |
| display *1* show *hello* at column *0* row *0* | `display_1.text(0, 0, 'hello')` (16 columns, 8 rows) |
| clear display *1* | `display_1.clear()` |
| set up LED matrix on port *1* | `matrix_1 = MatrixLED(1)` |
| LED matrix *1* show *heart* | `matrix_1.icon(Icon.HEART)` (happy, sad, yes, no, the four arrows and triangles, square, circle, clockwise, counterclockwise, pause, all on, all off) |
| LED matrix *1* show number *7* | `matrix_1.number(7)` (-99 to 99) |
| LED matrix *1* show text *hi* | `matrix_1.text('hi')` (one letter at a time; the program waits) |
| LED matrix *1* pixel row *0* column *0* *on* | `matrix_1.pixel(0, 0, True)` (row from the top, column from the left, 0 to 7) |
| LED matrix *1* brightness *8* | `matrix_1.brightness(8)` (1 to 16) |
| clear LED matrix *1* | `matrix_1.clear()` |
| set up 7-segment display on port *1* | `seven_segment_1 = SevenSegmentLED(1)` |
| 7-segment *1* show number *1234* | `seven_segment_1.number(1234)` |
| 7-segment *1* show text *EVN* | `seven_segment_1.text('EVN')` (up to 4 characters) |
| 7-segment *1* brightness *8* | `seven_segment_1.brightness(8)` |
| clear 7-segment *1* | `seven_segment_1.clear()` |
| colour *red* | `Color.RED` (orange, yellow, green, cyan, blue, violet, magenta, brown, white, gray, black, *off* `Color.NONE`) |
| colour red *255* green *120* blue *0* | `(255, 120, 0)` |
| set up RGB LEDs on servo port *1* with *8* LEDs | `rgb_1 = RGBLED(1, 8)` (1 to 64 LEDs — the firmware's limit; a servo port, which cannot drive a servo while this is open) |
| RGB LEDs *1* set all to *colour red* | `rgb_1.fill(Color.RED)` |
| RGB LEDs *1* set LED *0* to *colour green* | `rgb_1.set(0, Color.GREEN)` (LED 0 is the one at the plug) |
| RGB LEDs *1* brightness *64* | `rgb_1.brightness(64)` (0 to 255) |
| turn RGB LEDs *1* off | `rgb_1.off()` |
| set up servo on port *1* type *Geekservo 270 degrees* | `servo_1 = Servo(1)` (*generic 180 degrees*: `Servo(1, 'generic')`, *Geekservo continuous*: `Servo(1, 'geekservo_cr')`) |
| move servo *1* to *90* degrees | `servo_1.angle(90)` |
| set servo *1* pulse to *1500* us | `servo_1.pulse(1500)` |
| stop servo *1* | `servo_1.stop()` |
| set up Bluetooth on serial port *2* | `bluetooth_2 = Bluetooth(2)` |
| Bluetooth *2* send *hello* | `bluetooth_2.write((str('hello') + '\n').encode())` |
| Bluetooth *2* has something to read | `bluetooth_2.any() > 0` |
| Bluetooth *2* received line | `(bluetooth_2.readline(5000) or b'').decode()` — waits up to 5 s for a line, gives it without its newline (empty text on timeout) and leaves whatever arrived behind it in the receive buffer, where `read()` can still find it |

The colour input of the RGB LED blocks takes either colour block: **colour *red*** (an `evn` `Color`) or **colour red / green / blue** (an `(r, g, b)` tuple, 0 to 255 each). Blockly's own colour-picker field is not part of Blockly 13 core, so there is no swatch picker.

### Advanced

| Block | Python |
| :--- | :--- |
| calibrate motor *1* | `motor_1.calibrate()` (about 4.5 s, shaft free to turn; stored on the board for that port) |
| limit motor *1* speed *1000* acceleration *2400* torque *400* | `motor_1.control.limits(speed=1000, acceleration=2400, torque=400)` (an empty input is left out) |
| set motor *1* duty to *50* % | `motor_1.dc(50)` |
| track motor *1* to angle *0* | `motor_1.track_target(0)` |
| use *ADRC* / *PID* control for motor *1* | `motor_1.control.law('adrc')` |
| Python *…* (statement) | the line as written |
| Python *…* (value) | the expression as written |

The two **Python** blocks are the escape hatch. `motor_1` .. `motor_4`, `drive_base` and every peripheral object (`color_sensor_1`, `display_3`, `rgb_2`, …) are available: a Python block that mentions one has it created at the top of the program like a block would. A Python block always imports the core names (`Motor`, `Port`, `Stop`, `Direction`, `SpeedUnit`, `wait`, `StopWatch`, `battery`, `button`, `led`, `stop_all`) and adds a bare `import evn`, plus any other name from the module it spells out (`ColorSensor`, `Color`, `Icon`, `Side`, `DriveBase`, `Pose`, `UART`, `I2C`, `Flash`, `core1_status`, …), so the import line stays readable and nothing in the module is out of reach. A device named inside a string or a `#` comment is *not* opened, and a port outside the device's range is ignored. `pose` exists only when a **robot follows its gyro** block is in the program (a Python block does not create it).

### What has no block

Each device has the few calls a program usually needs; everything else in the API reference is a **Python** block away, with the object already created:

- **Motors**: `gears`, `control.pid()`, `settings(max_voltage=…)`, `model`, `close()`.
- **Robot**: `curve()` (the older Pybricks sign convention of `arc()`), `state()`, `reset(distance, angle)`, the accelerations in `settings()`, `then=Stop.COAST_SMART` chains, `close()`.
- **Every peripheral**: `close()`, `age()`, `read()` (the "wait for a new reading" form of each getter), `raw()`, and the tuning calls — colour sensor `gain()`, `integration_time()`, `ranges()` / `normalized()`, `detectable_colors()`, `thresholds()`, `lux()`, `color_temperature()`; distance sensor `timing_budget()`, `signal_rate_limit()`; gesture sensor `engines()`, `gain()`, `led()`, `gesture_config()`; weather sensor `oversampling()`, `filter()`, `standby()`, `forced()`; compass `field()`, `axes()`, `calibration()` (storing and restoring a calibration), `calibrate_progress()`; touch pads `touched()`, `events()`, `data()`, `thresholds()`, `electrodes()`, `autoconfig()`; IMU `euler()`, `acceleration()`, `angular_velocity()`, `tap()`, `ready()`, `settings()`, `axes()`, `dmp()`; ADC `raw()`, `inputs()`, `range()`, `data_rate()`, `continuous()`.
- **Displays**: the OLED's drawing calls (`pixel`, `line`, `rect`, `draw_circle`, `draw_text`, `splash`, `contrast`, `flip`, `invert`, `scroll`), the matrix's `bitmap()` / `animate()` / `orientation()` / `blink()` / `hline()` / `vline()` / `rect()`, the 7-segment's `digit()`, `char()`, `point()`, `colon()`, `segments()`.
- **RGB LEDs**: `range()`, `on()` with a list, `blink()`, `animate()`, `hsv()`, `get()`, `invert()`, `count()`.
- **Servo**: `move()` (a timed sweep), `duty()` for the continuous-rotation profile, `done()`, `set_range()`, `enable()` / `disable()`.
- **Bluetooth**: `read()`, `read_all()`, `wait_until()`, `repl()`, `command()`, `address()`, `configured()`, `set_baudrate()`, and the constructor's `name=` / `baud=` / `mode=` (a block always uses the defaults).
- **The rest of the module**: `Pose` (the pose estimator: position and heading from the encoders, an IMU and a compass), `I2C`, `UART`, `Flash`, `reset()`, `reset_cause()`, `bootloader()`, `autostart()`, `core1_status()`, `evn.version`.

### Logic, Loops, Math, Text, Variables, Functions

Blockly's standard blocks, generating standard Python (`if`, `while`, `for count in range(…)`, arithmetic, `str(…)` joins, variables, `def`). MicroPython runs all of it; `math_number` values are ints when whole.

## Safety

The same rules as for Python programs apply: **Ctrl+C** in the terminal and **Stop motors** interrupt a running program and coast every motor; the board's **user button** coasts every motor (the program keeps running; holding it 2 s reboots the board); connecting a tool to the board also coasts the motors. A **forever** loop only ends one of those ways. Keep wheels off the ground for the first run of any program.
