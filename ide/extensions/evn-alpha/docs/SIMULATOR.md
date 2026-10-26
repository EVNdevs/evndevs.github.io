# The robot simulator

The simulator is an EVN ALPHA you can run programs on without a board: a robot on a line-following course, in a
panel next to your program - with the RoboCup Junior Rescue Line course's 3D elements (ramps, raised tiles and bridges,
seesaws, speed bumps, debris, obstacles), which the robot climbs, rides, scrapes over and bumps into. It is a board like any other to the extension - you connect to it, Run your program,
watch it in the Board view, open the REPL, stop it - and the same program file runs on a real EVN ALPHA built like
the simulated robot.

## Opening it

Any of these opens the **EVN Simulator** panel and makes the simulated board the one in use:

- **Simulator** under *Start*, in the EVN ALPHA side bar;
- the **Simulator** row of the *Board* view (under the port row);
- **EVN: Open the simulator (a simulated robot to run programs on)** from the Command Palette;
- **EVN: Select board port** and then **EVN simulator** (in the browser IDE: the last entry of the port list).

While the panel is open the simulated board is "plugged in": it is listed as the port **EVN simulator**, the status
bar names it, and the *Board* view's live console connects to it. Close the panel and it is unplugged: the window
goes back to the board it used before (the board you chose, or auto-detect), and other VS Code windows never
switch to the simulator. A real board plugged in while the simulator is open is listed too; **EVN: Select board
port** chooses between them. A board in BOOTSEL mode can be flashed while the simulator is open.

The simulator needs no Python and no mpremote on your computer (a real board does), and it runs in the browser IDE
as it does on the desktop. It is free until the end of 2026; from 2027 it has a 14-day trial, then opens with a licence
key ([Licence](#licence)).

## Licence

The simulator is **free until 31 December 2026**. From 1 January 2027 it is free for **14 days from the first time it
opens** (the trial), and after that it opens with a **licence key**. The panel's header shows which (*Free until 31 Dec
2026*, or the trial's days left: click it to see the licence), and so does the *Simulator* row of the *Board* view (in
its tooltip while the panel is open). A panel that is open when the trial ends stays open: the next opening asks for the
key.

- **Entering a key.** Once the trial is over, opening the simulator asks for one: **Enter licence key**, and paste the
  key - one line of text that starts with `EVNSIM1.` (line breaks that a mail put into it are taken out). It is
  checked as you paste it, and kept once it is right; **EVN: Enter a simulator licence key** does the same at any time.
  A key needs no internet connection and works in the browser IDE as on the desktop; on the desktop, with Settings
  Sync on, it reaches your other computers too.
- **Your licence.** **EVN: Show the simulator licence** says who the licence is for and its last day (or that it does
  not end) - or, without one, until when the simulator is free or the trial's days left. **EVN: Remove the simulator
  licence key** takes the key off this computer.
- **Getting a licence.** Schools in Singapore can buy them through Vendors@Gov. Anyone else: write to
  [kenneth@coresg.tech](mailto:kenneth@coresg.tech).

Turning the computer's clock back does not give the trial's days back. With the clock more than a week before the day
the trial began, the simulator stays shut and says the day it opens again.

## Running a program

Everything you do with a board works on the simulated one:

- **Run** (Ctrl+F5, the Run button, *Run on the board* on a file or an example, Run of a blocks program) runs the
  program in the simulator. Its prints and its traceback come to the **EVN ALPHA** terminal; a line number in the
  traceback jumps to the line. **Ctrl-C** in the terminal, the red **Stop** in the status bar, **EVN: Stop all
  motors** or the panel's **Stop** button stop it, and every motor coasts.
- **Upload as main.py** puts the file on the simulated board and starts it, as the board does after
  `evn.reset(start=True)`. Files uploaded to the board can be imported by your programs.
- **The REPL** (the REPL button in the status bar) is the simulated board's prompt.
- **The Board view** shows the simulated robot live: the motors' angles and speeds, the battery, the colour sensors,
  the distance sensors and the IMU under *I2C devices*. Its buttons drive the motors (a jog turns a wheel, and the robot moves), and *Read this
  device live* reads a colour sensor over the course. The command line runs Python on the simulated board, with
  `m1`..`m4` and `d<port>` for each colour sensor.

**New program** in the panel's header writes a first line follower for the robot you configured
(`line_follower.py` in your projects folder) and opens it: press Ctrl+F5 to watch it drive. It follows the curves
and the sharp corners; the Rescue Line course's tight zigzags are where a better program starts
(`tools/linefollow/programs/lf_recommended.py` in the firmware repository finishes the whole course). Neither looks
for the 3D elements: on the *Hazards sample* a line follower meets what a real course gives it - a speed bump that
lifts its sensors, the top of a ramp where they read the white as dark, and last an obstacle on the line (on the
straight to the Goal, with floor on both sides for a detour round it) - and a program that handles them (a distance
sensor for the obstacle, the IMU's pitch for the ramp) is the next step.

## The panel

- **Course**: the floor. *Rescue Line* is 28 RoboCup Junior Rescue Line style tiles (300 mm, a 20 mm black line on
  white): curves, sharp corners, zigzags, bumps, hairpins, gaps and a crossing, about 9 m. *Tile set sample* is a map
  of 21 tiles of a real competition set (below), from its Start tile to its Goal, 7.7 m. *Hazards sample (3D)* is a
  map of the rules' 3D elements (below): a speed bump and debris, a long ramp up to a bridge 275 mm over the floor, a
  long ramp down, a seesaw, the way back under the bridge (another bump), and an obstacle on the straight to the Goal. The *Oval* is a closed
  loop for timing laps; *Straight*, *Curves*, *Corners*, *Zigzag*, *Bumps*, *Hairpins*, *Gaps* and *Crossings* are
  one kind of tile each; *Empty floor* has no line, for driving and turning. The maps you build are listed under
  *Your maps*.
- **Speed**: how fast simulated time runs against the clock (¼× to 4×). Your program's clock - `wait()`,
  `StopWatch`, `time.ticks_ms()` - is the simulated one, so a program behaves the same at every speed.
- **Back to start** puts the robot back on the course's start. **Drag the robot** to put it anywhere, and its
  handle (the dot in front of it) to turn it (Shift: 15° steps). The robot can be moved when no program runs.
- **Follow** keeps the robot in the middle of the view; drag the floor to pan, scroll to zoom.
- **3D** shows the course and the robot in 3D: the tiles at their heights with their line on them, the obstacles,
  bumps and debris, the robot at its height, pitch and roll, and its distance sensors' beams. Drag to turn the view,
  Shift+drag (or a right drag) to move it, scroll to zoom; with **Follow** on, the view follows the robot from behind.
  The robot is put down and turned in the 2D view.
- **Button** is the board's user button (hold it): `evn.button.pressed()` reads it while the program runs (see
  "Good to know" for where). With no program running, pressing and releasing it starts `main.py` when the board has
  one (Upload as main.py, then press the Button). One difference from the board: the board's button starts `main.py`
  only while the board waits for it after a boot, before a computer speaks to it (then it is the REPL's), and again
  after `main.py` ends; the simulator's starts it whenever no program runs. The simulator's button does not stop a
  program (`set_stop_button()` changes nothing here): Stop does.
- The figures in the top left: the run's **time** (from the moment the robot first moves after it was put down;
  it stops when the robot reaches the end of the course, which shows as *finished in ... s*), how far the robot is
  **off the line**, how much of the **course** it has done (laps on the oval), the **battery**, on a course with 3D
  elements the robot's **height** (mm) and its pitch and roll, and each colour sensor's reading, each distance
  sensor's range, the IMU's heading and each motor's speed. When the robot drives off an edge or tips over, the panel
  says so. **Back to start** also puts the seesaws, the obstacles and the debris back where the map has them.

## Building a map

**Map builder** in the panel's header opens the map builder beside the floor: the tiles of a RoboCup Junior Rescue
Line competition set ("Tile List for Single Set": 37 kinds of tile, 104 tiles), each drawn as it is printed.

- **Place a tile**: click it in the list, then click the grid; it stays picked, so you can place several (Esc puts it
  down). A tile placed on others replaces them.
- **Turn** it with **R** (Shift+R the other way) or a right click, before or after you place it; **drag** a placed
  tile to move it; **Delete** removes the selected one.
- **Green markers** (RoboCup Junior Rescue Line 2026 rules, 3.6): click it, and every junction of the placed tiles
  shows dashed squares where a marker can go - a 25 mm square in the corner between two arms at right angles, just
  before the junction. Click one to put a marker down, click it again to take it up. A robot coming to a junction
  turns left for a marker on its left, right for one on its right, turns round for one on each side (a dead end),
  and goes straight on with none - so one marker serves the two arms on either side of it, as in the rules'
  figures. The T (#70), the crossings (#80, #81), the Y (#71) and the roundabouts (#49, #50: one junction where the
  stem meets the circle, one where the exit leaves it) have them.
- **Heights** (rules 3.2, 3.7): select a tile to give it a **height** (mm, its top over the floor; a ramp's, at its
  drawn bottom end, where the line enters it as drawn: turned round, it is a ramp down). A ramp climbs the height its
  slope makes over its plan: 137.5 mm for a short ramp (#91, #92), 275 mm for a long one (#93, #94). A tile placed
  next to another takes that tile's height where they meet, so a course carries on at the top of a ramp by itself. A
  tile 260 mm or more up (250 mm clear under its 10 mm slab) stands on four 25 mm pillars at its corners and another tile may lie under it - a **bridge**
  (rules 3.2.3: the robot drives under it; Shift+click picks the lower of two tiles); a lower raised tile is solid down
  to the floor. The builder says where the line steps more than the rules' 3 mm from one tile to the next.
- **Seesaw** (rules 3.8): a selected straight (#10, #10E) can be a seesaw: it pivots about a hinge across its middle,
  15° either way, its drawn bottom end down at the start (turn the tile round for the other end), a 3 mm board.
- **Obstacle**, **Speed bump**, **Debris** (rules 3.5): click one, then click where it goes; select one to set its
  size (an obstacle's shape, width, depth, height and mass - 0 g fixes it to the floor; a bump's length, width and
  height, at most 10 mm; a piece of debris's length and diameter, at most 3 mm); R turns it 15°, drag moves it,
  Delete removes it. Each lies on the tile under it (on a ramp: along its slope); what lies on a tile moves with it.
- **Set start**, then click a tile near the side the robot comes in by (on a Start tile, #1, near its middle: the
  robot starts on its bar). Without a start the robot starts on the Start tile, else on the first tile you placed.
- The dashed blue line is the line the robot is scored along, from the start (the green arrow) tile by tile: across
  each tile on its line (through the gaps), into the tile it leads to, turning at each junction as its green markers
  say, until it reaches the Goal (#99), a tile with no line where it arrives, or its own start again (a loop). Under
  the buttons the builder says how long that line is, how many tiles it crosses, and what is wrong: a tile not on
  the line, a line that stops at the edge of a tile, a junction with no marker and no way straight on (a T entered by
  its stem), a roundabout with no marker to leave it by (the line would go round for ever), no Goal at its end, more
  of a tile than the set has (each tile in the list shows how many the map uses of how many the set has), a step
  between tiles, an obstacle under the rules' 150 mm. It also counts the map's 3D elements.
- **Save** keeps the map (in every window, as the robot is); **Drive this map** saves it and makes it the course.
  **Open…** reopens a saved map or a copy of the tile set sample or the hazards sample, **New** starts an empty one, **Delete** forgets a
  saved one. **Export…** writes the map to a `.evnmap.json` file to share, **Import…** reads one.

The progress, the "off the line" figure and the finish time work on a map as on the named courses. The progress
follows the line in its order. A dead end's arm is on the scoring line twice, out to its end and back. A robot
that turns round within about 100 mm of the end carries on down the arm and on along the line. One that turns
round further from the end, backs down the arm still facing it, or is put down on the way back is not scored on
the way back: its progress counts back down the arm to the junction. One that skips the arm is not given it,
except an arm shorter than about 100 mm, which the progress search reaches across. A robot that leaves the line is scored again where it comes back on if the line it skipped is no longer than 200 mm plus how far
it drove (forward, back and round alike) since its progress last moved. A detour round an obstacle always is, so it
picks up where the robot rejoins. A cut across to a part of the course further on is not: the progress stays where
the robot left the line for the rest of the run, as it follows the line on from there (so a cut is never scored,
and the run does not finish). The one way round that is to drive back and forth off the line for as long as the
part skipped - the distance counts every way the robot goes. The finish time is taken when the robot arrives at the
end of the course from short of it, after it first moved: a robot put down at the end and moved there does not
finish until it leaves and comes back.

What the simulator makes of the tiles:

- **A ramp is 24.6° steep**: 300 mm of floor for its 330 mm of slope (under the rules' 25°: the tile list gives only
  the length along the slope, so the plan is an assumption), so a long ramp covers two cells and climbs 275 mm. The
  *elevated* tiles (#10E, #41E) are the tiles a raised course is built of; any tile can be given a height.
- **Green markers are part of the floor**: the colour sensors see them (green on white: a TCS34725 reads them with
  green above red and blue), so a program finds them as on a real course. The starter program (**New program**)
  does not look for them: it goes straight over a crossing, which is right only where the course has no markers.
- The tiles' geometry comes from the drawings' dimensions and is checked against the drawings' own ink: every
  tile matches within 2 mm (`scripts/test_simulator.js`; the ink is taken out of the PDF by
  `tools/rescue_tiles/extract_masks.py` in the firmware repository).

## The 3D elements

The RoboCup Junior Rescue Line 2026 rules' 3D elements, as the simulator builds them and as the robot meets them:

| Element | Rules | In the simulator |
|---|---|---|
| Ramp | 3.7: up to 25°, one or more tiles | a slope of 24.6° (a short ramp climbs 137.5 mm, a long one 275 mm), solid down to the floor; its sides are walls |
| Raised tile, bridge | 3.2: tiles on a backing, bridges at least 25 cm high on 25 x 25 mm pillars | a tile at a height: under 260 mm solid to the floor, from 260 mm a 10 mm slab (250 mm clear under it) on corner pillars that the robot drives under; its edges are walls from below and drops from above |
| Seesaw | 3.8: pivots about its middle, under 20°, a straight line | a straight tile tilting 15° either way, its low end 3 mm up; it tips when the robot's weight passes its hinge, and stays where it tipped |
| Speed bump | 3.5.1: at most 1 cm, white, black where it crosses the line, fixed | a rounded bump (a circular segment) of the size given, the line's paint on it |
| Debris | 3.5.3: at most 3 mm, toothpicks and dowels, not fixed | a dowel of the size given, light brown (the sensors see it on the line); a wheel rolling over it kicks it back a little |
| Obstacle | 3.5.4-3.5.6: 15 cm or more, may be heavy or fixed, may be moved | a box or a cylinder of the size and mass given: fixed (0 g) or too heavy to push, the robot stops against it (its wheels slip); light, the robot pushes it, and it slides to rest on the floor |

What the robot does on them:

- **It rolls over the heights.** Each wheel rolls over the floor as a circle would - up a bump's edge before it is over
  it - the caster rests on the floor, and the robot's pitch, roll and height follow; where the body or a colour
  sensor would go into the floor (at the foot of a ramp, over a bump) it scrapes over it instead, the caster in the
  air. A robot that drives off an edge lands at once on what is below it (the height is worked out tick by tick: there
  is no falling or bouncing).
- **Gravity pulls it along a slope**: up a ramp the motors push harder (2.3 V more for the default robot at its 0.6 kg)
  and slow down when they cannot; held on a ramp, the robot stays (the tyres grip); left coasting, it rolls back down.
- **Solid things stop it**: obstacles, pillars, the side of a raised tile or a ramp, a seesaw's raised end. A light
  obstacle is pushed, and is stopped in turn by the side of a raised tile, a ramp or a seesaw (it slides onto what
  is at most 20 mm over the surface it stands on, so up a ramp onto the tile at its top; pushed off a raised tile, it
  slides off the edge a few mm a tick rather than tipping, and the side goes on pushing it out after it has come to
  rest, shoving the loose obstacles it then meets - a row of them, up to 8 deep - as far as they can go, at most
  3 mm a tick; a box jammed between the side and a fixed obstacle, or a row stopped by one, stays where it is; a row
  of 12 or more touching loose boxes does not move and stops the robot). What it can climb is about a third of its wheel's diameter (a 3 mm step, a speed bump).
- **Its sensors see the heights**: a colour sensor's view widens and its light falls with its height over the floor
  (half its reading at about 12 mm for one calibrated at 8 mm: a sensor lifted at the top of a ramp reads the white as
  dark), and it sees the line of the tile it is over (not a bridge's over it); a distance sensor's beam stops at the
  first solid thing, the floor ahead of a robot pitched down included; the IMU reads the robot's pitch and roll.

The robot's **mass**, **body** and **caster** (the configurator's *Chassis*) decide how it climbs, scrapes and
fits under a bridge.

## Configuring the robot

**Configure robot** in the panel (or **EVN: Configure the simulated robot**, or the gear on the Board view's
*Simulator* row) opens the hardware configurator:

- **Drive base**: the motor model of the two wheels (any motor of the library: EV3 Large, EV3 Medium, NXT, JGA25-370,
  Pololu 25D, CHR-GM16, CM22-2230), the motor port of each wheel, whether each motor is **mounted mirrored**, the
  **wheel diameter** and the **axle track** (mm). A mirrored motor turns its wheel backwards for a positive
  (clockwise) turn of its shaft, as one motor of a usual robot is mounted: the program needs
  `Direction.COUNTERCLOCKWISE` on that motor, exactly as on the real robot (forget it, and the robot spins on the
  spot when it should drive straight).
- **Chassis**: the robot's **mass** (g), its body's **front** and **rear** (mm ahead of the axle and behind it) and
  **width**, its **height** over the floor (what passes under a bridge), the **clearance** under the body and where the
  **caster** is (mm ahead of the axle, negative behind). Front, rear, width and caster left empty are worked out from
  the wheels and the sensors.
- **Colour sensors**: up to four TCS34725 colour sensors looking down, each on an I2C port, placed from the middle of
  the axle: **forward** and to the **left** (negative: to the right), in mm. The **height** above the floor sets
  how big a patch of floor the sensor sees (half of its light comes from within about half the height).
- **Distance sensors**: up to four VL53L0X time-of-flight sensors, each on an I2C port: where it sits (forward, left,
  its height over the floor) and the way it looks (degrees from straight ahead, to the left).
- **IMU**: an MPU-6500 lying flat on the robot, on an I2C port.

**Apply** checks the configuration and restarts the simulated board with it: a running program stops, the robot
stays where it is and the Board view reconnects. The robot is kept for you (in every window, and after a restart).
**Copy setup code** puts the lines that build this robot in a program on the clipboard, for example:

```python
from evn import Motor, Direction, DriveBase, ColorSensor, wait

left = Motor(1, Direction.COUNTERCLOCKWISE)
right = Motor(2)
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=178)
sensor1 = ColorSensor(1)
sensor2 = ColorSensor(2)
```

The default robot is the line-following robot the simulator was first built for: two EV3 Medium wheels (left on
port 1, mounted mirrored; right on port 2), 62.4 mm wheels 178 mm apart, 0.6 kg, two line sensors 24 mm ahead of the
axle and 32 mm apart (ports 1 and 2), two more 24 mm further ahead (ports 3 and 4), and a distance sensor looking
ahead on port 5, 40 mm up. No IMU: add one in the configurator. A robot configured before distance sensors were
offered keeps what it had (no distance sensor is added).

## What the simulated board has

The simulated board's `evn` module has what the simulated robot has, with the firmware's names, arguments, units
and errors:

- `Motor`: `run`, `dc`, `run_angle`, `run_target`, `run_time`, `run_until_stalled`, `track_target`, `stop`,
  `brake`, `hold`, `angle`, `reset_angle`, `speed`, `done`, `stalled`, `control.limits()` (its torque limit caps the
  voltage, as on the board), `control.target_tolerances()` / `stall_tolerances()`, `gears=`, `speed_unit=`,
  `full_speed()` (and `full_speed(deg_s)`), `settings()`; a second `Motor(port)` takes the port over, as on the board.
  A port without a wheel has a free motor of the default model on it (EV3 Large on 1-2, EV3 Medium on 3-4).
  `run_time(speed, time)` goes the distance the firmware gives it - the one a run from rest at that speed would cover in
  the time - from wherever the motor is, at whatever speed it turns (a motor already turning too fast to stop within
  that distance is braked as hard as the motor can and brought back), and is done at `time`; with `then=Stop.NONE` the
  distance is the one a run from rest reaches at full speed with no slowing down, and once there the motor runs on and
  goes on up to `speed` (from the lower speed it has reached when `time` was too short to reach it), as the board does;
  it is done (and a `wait=True` call returns) once `time` is up, and `run_angle()` / `run_target()` with
  `then=Stop.NONE` once they reach the target and run on. A `wait=True` move returns at the 1 ms tick it is done,
  never before its `time`. `run_time(0, t)`, and a `run_time` with a time of 0 (no distance), holds the motor where it
  is and is done when `t` is up, as on the board. A `run_angle()`, `run_target()` or `run_time()` given while the
  motor turns faster than 5 degrees/s carries its speed on only when the motor is held by a command (`run()`, a move,
  or `dc()`, whose measured speed it takes) and there is room to stop before the target; otherwise - coasting, braked,
  or the target too close or behind - it starts from rest where the shaft is and brakes, as the board does. Slower
  than that, a move counts from where the motor is held: after `track_target()` (or `hold()`) from the held target,
  where the board counts from the shaft (unchanged). The drive base's wheels keep their own rule: a maneuver given
  while the base moves carries each wheel's speed on when it has room to stop, also after `stop()` / `brake()`, where
  the board starts the wheels from rest.
  `control.pid()`, `control.evn()` and `model.settings()` keep and read back what you set (the firmware's defaults
  for the motor's model until then), but the simulated motor's controller is the simulator's own and does not use
  them; `control.state()` and `model.state()` read the measured angle and speed in deg/s (no observer estimates,
  current 0).
- `DriveBase`: `straight`, `turn`, `curve`, `arc`, `drive` (deg/s or `SpeedUnit.PERCENT` steering), `stop`,
  `brake`, `hold`, `distance`, `angle`, `state`, `reset`, `done`, `stalled`, `settings()`. `curve(0, angle)` turns
  on the spot, as on the board. A maneuver given while the robot still moves (a `turn()` during a `drive()`, a
  maneuver chained onto one in progress) starts as the board starts it, a move per wheel from where each wheel is: a
  wheel whose target is a stopping distance ahead carries its speed into its move, the other is braked as hard as its
  motor can and brought back. A `turn(90)` during `drive(400, 0)` runs on about 30 mm and comes back to where it was
  called, and the tyres slip while the inner wheel brakes (the robot turns about 86 degrees for `angle()`'s 90, as
  a real robot slips). Two drive bases (on four motors) run at once, as the firmware allows.
- `ColorSensor`: `normalized`, `percent`, `raw`, `read`, `rgb`, `hsv`, `color`, `color_match`,
  `detectable_colors`, `ambient`, `lux`, `age`, `gain`, `integration_time`, `wait_time`, `ranges`,
  `calibrate_black`, `calibrate_white`, `clear_calibration`. Each port's stored calibration is the course's own black
  and white, so `normalized()` reads about 0 on the line and 100 on the floor.
- `DistanceSensor`: `distance`, `read`, `raw`, `status`, `timing_budget`, `signal_rate_limit`, `vcsel_periods`,
  `inter_measurement`, `profile`, `age`, `close`: a range (mm) once a timing budget (33 ms; `None` and
  `'phase fail'` with nothing within 1.2 m, 2 m in the long-range profile), with the VL53L0X's noise.
- `IMU`: `heading`, `reset_heading`, `tilt`, `euler`, `quaternion`, `up`, `acceleration`, `linear_acceleration`,
  `gravity`, `angular_velocity`, `raw`, `read`, `stationary`, `ready`, `heading_confidence`, `settings`, `dmp`,
  `sample_rate`, `ranges`, `filter`, `axes`, `age`, `temperature`, `close`, and `calibrate` / `calibration` /
  `clear_calibration` / `calibrate_gyro` (the simulated module is calibrated: they return at once): the chassis'
  motion at the module's rate (200 Hz), with a little noise. Its acceleration is the mean over each sample's period,
  as the chip's filter gives it, so a crash into something solid shows: every reading made from the chip's counts
  (`acceleration()`, `linear_acceleration()`, `angular_velocity()`, `read()`, `raw()`) reads up to its range in
  `ranges()`: 2000 deg/s and +-2 g with the DMP on (the board's pin), 2000 deg/s and +-16 g after `dmp(False)` turns
  the DMP off, and what `ranges()` sets after that (a `dmp(False)` with the DMP already off keeps it), as on the
  board. `tap()` and `screen_orientation()` return `None`.
- `PID`, `StopWatch`, `wait`, `stop_all`, `battery`, `button`, `led` (the panel shows the board's LED), `Color`,
  `Port`, `Direction`, `Stop`, `SpeedUnit`, `Side`.

A colour sensor, distance sensor or IMU opened on a port the configurator has none on raises the firmware's error
(`OSError: no MPU-6500 on port 3 (I2C 0x68)`). Hardware the simulator does not have is there by name, and says so when a
program opens it: `Compass(3)` raises `OSError: no compass on port 3: the simulated robot has a drive base, colour and
distance sensors and an IMU (the hardware configurator)`. So do the other I2C devices, the servos, the serial ports,
`Pose`, `DataLog` and `ADRC` in this version; a `DriveBase` drives on its encoders (its `imu=`, `compass=` and `pose=`
are not simulated yet: read an `IMU()` for the heading). `Motor.calibrate()` returns at once (the simulated motor
is known exactly); `evn.configure_motor()` is the configurator's job. `read()` returns at the sensor's next sample,
as on the board, to the simulator's 1 ms step (a colour cycle of 4.8 ms reads every 5 ms). Arguments the firmware
takes by position only are positional-only here too (`m.run(speed=100)` is a `TypeError`).

**Files.** A program's files are the board's: what it writes at the top of the flash stays on the simulated board at
the next Run (the board keeps its flash), as a file uploaded from the Board view does, and the Board view lists it once
the program ends: its download gives the program's version, its delete removes it, and an upload of the same name
replaces it. A Stop that restarts the simulated board, and closing and opening the panel again, keep them too; what a
program wrote before a Stop that restarted the board is lost (that run never ended). Kept are files whose names are
letters, digits, `_`, `.` and `-` only (`log_1.txt`, not `my log.txt`). A folder a program makes stays, with the files in it, until the simulated
board restarts (the Board view does not list it). A file a program leaves open is closed by the next Run's reset, as the
board's reset does, and keeps what was written to it. Each Run starts in the flash's top folder, as the board's does
after its reset.

While a motor drives (`run()`, `dc()` at any duty, `dc(0)` too, a move under way, a `then=Stop.NONE` move running on
after it reads done, a `track_target()` while its shaft turns at 1 deg/s or more or just given, a drive base's move, a
wheel run by itself, a motor the Board view's buttons turn) the flash refuses writes with `OSError: 16` (EBUSY), where the board's
LittleFS does (a `dc()` drives until another command or a coast: `stop_all()`, Stop, the next Run's reset, the coast
after a run):
- creating a file, at `open()`; and the `os` module's writes (remove, rename, mkdir, rmdir), at once;
- a `write()` that takes a file past 512 bytes (LittleFS keeps a smaller file in its directory, and a bigger one
  needs a block erased), or any write to a file already past that, at that `write()`;
- a smaller write waits in the file's cache until `flush()` or `close()`, and is refused there. A refused `close()`
  still closes the file, and what had not been committed is lost (an existing file keeps its old content).

Holding, braked and coasting motors do not block a write. An upload or a delete in the Board view is never refused
here (on the board it is, while a motor drives). A file error carries MicroPython's number and type
(`OSError: [Errno 2] ENOENT`, `errno.ENOENT` is 2).

**The Python is CPython 3.13, made to look like the board's MicroPython.** The simulator runs your program in Pyodide
(CPython compiled to WebAssembly), with the board's `time` / `utime` on the simulated clock (`sleep`, `sleep_ms`,
`sleep_us`, `ticks_ms`, `ticks_us`, `ticks_cpu`, `ticks_diff`, `ticks_add` - and, as on the board, no `time()`,
`time_ns()`, `localtime()`, `gmtime()` or `mktime()`), MicroPython's `errno`, `sys.print_exception()`, `help()` with
the board's text, `micropython.const`, `gc.mem_free()` and the `u`-names (`ujson`, `ustruct`, ...), and tracebacks in
MicroPython's layout with the program's frames only. A program written for the board runs unchanged; what differs is
what differs between the two Pythons - the wording of some error messages, CPython's syntax (a `match` statement runs
here and is a `SyntaxError` on the board; so is anything newer than MicroPython's grammar), and the standard library,
which is CPython's (a program that only runs in the simulator because it uses a CPython module, or a name such as
`FileNotFoundError` the board does not have, will not run on the board). MicroPython's own WebAssembly build is not used because it cannot free memory while a program runs, and a
robot's loop runs for minutes.

## How close to the real robot it is

The simulator is a model, built from the firmware's own numbers (the motor library's no-load speeds, rated voltages,
default limits and calibration results) and from the line-following simulation of the firmware repository
(`tools/linefollow`, `docs/LINE_FOLLOWING_SIM.md`), whose optics and courses it uses. What it gets right is what a
line follower's design depends on: the robot's geometry, the sensors' positions and the size of the patch they see,
a sensor cycle of 4.8 ms with its age, the motors' top speeds and accelerations at the pack's voltage, `drive()`'s
ramps and the profiled moves, a mirrored motor's sign. What it leaves out:

- the motors run a simpler control law than the board's ADRC (the same references and limits, a different
  transient; like the ADRC it takes up a steady load, so a move ends on a ramp), with no gear backlash and no encoder
  steps; a wheel's law is tuned for the inertia it carries, its motor's plus half the robot's mass at the wheel's
  radius (the configured mass and wheel), so a heavy robot or a large wheel settles too;
- the tyres grip and slip as tools/linefollow's model has them (a creep force and the tread's stretch, up to the
  grip, 0.7 of the weight on the wheels), with no sideways slip; the caster drags a little;
- the 3D elements are worked out in height tick by tick (the robot lands at once off an edge, does not bounce over a
  bump or fly off a crest), a body scraping the floor drags a little but does not wedge, and a pushed obstacle slides
  without tipping;
- a call into the board takes a fixed small time (tens of µs, as the board's do), but Python itself runs at your
  computer's speed, not the board's;
- the sensors read a perfect floor through their calibration (no room light, no shadows, no mains flicker), with
  0.8 % noise;
- the battery stays near 7.9 V.

So a program that works in the simulator is the right program; its constants (speeds, gains) may still need a
little tuning on the real robot.

## Good to know

- **Stopping a program, and the panel while one runs.** Stop (Ctrl-C) raises one `KeyboardInterrupt` in the program, as
  on the board: every motor coasts as the program takes the press (a press that lands inside a motor command coasts
  that motor too, just after the command), its `finally:` and `except KeyboardInterrupt:` run to their end (board
  calls in them included), and the run ends after them. One exception, with shared memory: a press in a
  `while <condition>:` loop inside a `try:` can skip that `try`'s `except` and `finally` - nearly always when the loop's
  body calls nothing, about half the time when it calls a function, rarely when it calls the board. CPython 3.13 repeats
  the condition at the loop's end, and the jump back there, where the press can be raised, lies outside the `try`. A
  `while True:` or `for` loop is caught. `import signal` fails as on the board; a program that reaches the module
  another way (`__import__("signal")`, `exec(..., {})`, `importlib`) can turn Stop off for that run only - the next run
  gets the simulator's handler back. The Button, the Speed and the Course reach a running program too. How depends on
  the page the panel is in, and a window can have both of the first two:
  - **Shared memory** (a page that is cross-origin isolated): the Button and the Speed reach the program at its
    next board call, Stop even in a loop that never calls the board. Without JS Promise Integration as well, the
    Course list waits until no program runs.
  - **JS Promise Integration** (WebAssembly stack switching, in the editor's JavaScript engine; most VS Code windows
    have no shared memory): the program hands the simulator a turn at its board calls and in its waits, every few
    milliseconds at most, so the Button, the Speed, the Course and Stop reach it there. A loop that never calls the
    board takes no turn: without shared memory, Stop then waits 3 s and ends the simulated board as below.

  Either way the turns do not stretch the program's clock: a wait ends where it asked, whatever the computer's timers do (a
  late timer makes the run slower on the wall, not longer on the program's clock), and the turns cost about 0.1 µs
  of the computer's time per board call.
  - **Neither:** the Button and the Speed wait for the program's end, the Course list waits until no program runs,
    and Stop ends the simulated board and starts it again from where the robot is: the program's `finally:` does not
    run, and its variables are gone afterwards, as after a reset.

  The Output channel's "simulator: the board is up (...)" line says which one this window has. Closing the panel
  stops everything.
- **A map is a file you can share.** It is plain JSON: `{"version": 1, "name": ..., "tiles": [{"id": "10", "col": 0,
  "row": 0, "rot": 0, "green": [3], "z": 275, "seesaw": true}, ...], "start": {"col": 0, "row": 0, "side": "S"},
  "objects": [...]}` - each tile's number in the set, its grid cell (300 mm, x to the right, y up), its quarter turns
  counter-clockwise, its green markers (the places in its library tile's `markers` list), its height (mm, absent: 0)
  and whether it is a seesaw; the start's side is S, E, N, W of its cell, or C for a Start tile's own start. Each
  object is `{"type": "obstacle", "x", "y", "rot", "shape": "box" or "cylinder", "w", "d", "h", "mass"}`,
  `{"type": "bump", "x", "y", "rot", "length", "width", "height"}` or `{"type": "debris", "x", "y", "rot", "length",
  "diameter"}` (mm, g, degrees; `z`, the height of the tile it was put on, optional).
- **The simulated board runs the extension's own firmware version**, so the Board view never offers a flash for it,
  and **EVN: Flash MicroPython firmware** explains that there is nothing to flash.
- **The developer mode's simulated board** (the hidden setting `evn.developer.simulatedBoard`, docs/WEB.md) is a
  different, older thing: a wire-level stand-in for testing the extension, which runs no Python. While it is on, it
  takes the port name "EVN simulator" over.
