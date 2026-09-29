/* EVN ALPHA blocks: block definitions and the MicroPython generators for the `evn` module.
 *
 * Loaded by the block editor webview (script tag: globals `Blockly` and `python`) and by
 * scripts/test_blocks.js under Node (require). Every block generates code against the API in
 * stubs/evn.pyi; a motor is `motor_<port>`, created once at the top of the program from the
 * "set up motor" block for that port (or `Motor(port)` when there is none). A program has two sections,
 * "set up" and "program", as in Pybricks: see "a program in two sections" below.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;                        // Node: require(...)(Blockly, pythonGenerator, Order)
    } else {
        factory(root.Blockly, root.python.pythonGenerator, root.python.Order);
    }
}(typeof self !== 'undefined' ? self : this, function (Blockly, generator, Order) {
    'use strict';

    /* Block colours: one per toolbox category, chosen around the CORE tan (#a8977b) so the
     * workspace reads as one palette on the white and the dark scheme. Blocks refer to them by
     * style name; editor.js puts them into the Blockly theme (see PALETTE below). */
    const PALETTE = {
        evn_motor: '#9a8763',       // tan: the brand accent, deepened for white text
        evn_sense: '#3f9fb4',       // cyan
        evn_output: '#8d5b8f',      // plum: displays, LEDs, servos, Bluetooth, and the Serial and I2C category (UART, I2C)
        evn_time: '#c25e4f',        // terracotta
        evn_board: '#5f9e88',       // jade
        evn_advanced: '#5f6368',    // graphite
        evn_start: '#b07a0c',       // amber: the two section hats, "set up" and "program" (Pybricks' yellow, deepened for white text)
        evn_comment: '#7a7f84',     // grey: the comment block
        logic: '#5f7fb8',           // slate blue
        loop: '#5a9c5f',            // green
        math: '#7c6ab5',            // violet
        text: '#b8678c',            // rose
        variable: '#d38a3a',        // orange
        variable_dynamic: '#d38a3a',
        procedure: '#8c6d55',       // brown
        list: '#7a8f9c',
        colour: '#9e9e9e',
    };
    const BLOCK_STYLES = {};
    const CATEGORY_STYLES = {};
    for (const key of Object.keys(PALETTE)) {
        BLOCK_STYLES[key + '_blocks'] = { colourPrimary: PALETTE[key] };
        CATEGORY_STYLES[key + '_category'] = { colour: PALETTE[key] };
    }
    // The two section hats have a flat top (no 'cap' hat style): the cap's dome made them half as tall
    // again as a block, a mushroom on labels as short as "set up" (owner, 2026-09-24). Their amber
    // colour and icon mark them, and nothing attaches above them either way (no previous connection).

    const PORTS = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']];
    const THEN = [['hold', 'HOLD'], ['coast', 'COAST'], ['brake', 'BRAKE'], ['keep running', 'NONE'], ['coast (smart)', 'COAST_SMART']];

    /* Ports for the EVN Standard Peripherals, always the numbers printed on the board:
     * I2C sensors and displays 1..16, servos (and the RGB LED strip) 1..4, serial 1..2. */
    const I2C_PORTS = [];
    for (let i = 1; i <= 16; i += 1) { I2C_PORTS.push([String(i), String(i)]); }
    const SERVO_PORTS = PORTS;
    const SERIAL_PORTS = [['1', '1'], ['2', '2']];

    /** The port dropdown every peripheral block starts with. */
    function portField(options) {
        return { type: 'field_dropdown', name: 'PORT', options: options };
    }

    /* The six colours ColorSensor.color() chooses from by default (detectable_colors()). */
    const SENSOR_COLORS = [['red', 'RED'], ['yellow', 'YELLOW'], ['green', 'GREEN'], ['blue', 'BLUE'],
        ['white', 'WHITE'], ['nothing', 'NONE']];
    /* Every named Color, for the RGB LEDs. */
    const ALL_COLORS = [['red', 'RED'], ['orange', 'ORANGE'], ['yellow', 'YELLOW'], ['green', 'GREEN'],
        ['cyan', 'CYAN'], ['blue', 'BLUE'], ['violet', 'VIOLET'], ['magenta', 'MAGENTA'],
        ['brown', 'BROWN'], ['white', 'WHITE'], ['gray', 'GRAY'], ['black', 'BLACK'], ['off', 'NONE']];
    const SIDES = [['the top', 'TOP'], ['the bottom', 'BOTTOM'], ['the front', 'FRONT'],
        ['the back', 'BACK'], ['the left side', 'LEFT'], ['the right side', 'RIGHT']];
    /* A friendly subset of evn.Icon for the 8x8 matrix. */
    const ICONS = [['heart', 'HEART'], ['happy', 'HAPPY'], ['sad', 'SAD'], ['yes', 'TRUE'], ['no', 'FALSE'],
        ['arrow up', 'ARROW_UP'], ['arrow down', 'ARROW_DOWN'], ['arrow left', 'ARROW_LEFT'], ['arrow right', 'ARROW_RIGHT'],
        ['triangle up', 'TRIANGLE_UP'], ['triangle down', 'TRIANGLE_DOWN'], ['square', 'SQUARE'], ['circle', 'CIRCLE'],
        ['clockwise', 'CLOCKWISE'], ['counterclockwise', 'COUNTERCLOCKWISE'], ['pause', 'PAUSE'],
        ['all on', 'FULL'], ['all off', 'EMPTY']];

    /* ---- block definitions --------------------------------------------------------------- */

    Blockly.common.defineBlocksWithJsonArray([
        {
            type: 'evn_motor_setup',
            message0: 'set up motor %1 positive direction %2 speeds in %3',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'field_dropdown', name: 'DIRECTION', options: [['clockwise', 'CW'], ['counterclockwise', 'CCW']] },
                { type: 'field_dropdown', name: 'UNIT', options: [['deg/s', 'DEG_S'], ['% of full speed', 'PERCENT']] },
            ],
            style: 'evn_motor_blocks',
            tooltip: 'Options for one motor port. Put it under "set up"; without one a port uses clockwise and deg/s. Ports are the numbers on the board, 1 to 4.',
        },
        {
            type: 'evn_motor_run',
            message0: 'run motor %1 at speed %2',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'SPEED', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Run at a speed (deg/s, or % of full speed) until the next command for this motor. Negative reverses.',
        },
        {
            type: 'evn_motor_run_angle',
            message0: 'turn motor %1 by %2 degrees at speed %3',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'ANGLE', check: 'Number' },
                { type: 'input_value', name: 'SPEED', check: 'Number' },
            ],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Turn by an angle relative to where the shaft is now. A negative angle or speed turns the other way. "wait" pauses the program until the move is done.',
        },
        {
            type: 'evn_motor_run_target',
            message0: 'turn motor %1 to angle %2 at speed %3',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'ANGLE', check: 'Number' },
                { type: 'input_value', name: 'SPEED', check: 'Number' },
            ],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Turn to an absolute angle (0 is where the motor started, or where "set motor angle" put it).',
        },
        {
            type: 'evn_motor_run_time',
            message0: 'run motor %1 for %2 ms at speed %3',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'TIME', check: 'Number' },
                { type: 'input_value', name: 'SPEED', check: 'Number' },
            ],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Run at a speed for a time (ms) as a profiled move.',
        },
        {
            type: 'evn_motor_run_until_stalled',
            message0: 'run motor %1 at speed %2 until stalled',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'SPEED', check: 'Number' },
            ],
            message1: 'then %1 duty limit %2 %%',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: [['coast', 'COAST'], ['hold', 'HOLD'], ['brake', 'BRAKE']] },
                { type: 'input_value', name: 'DUTY', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Run until the shaft is blocked (an end stop, or your hand), then do the "then" action. The duty limit caps the push; leave it empty for full push. Read "motor angle" afterwards to know where it stopped.',
        },
        {
            type: 'evn_motor_stop',
            message0: '%1 motor %2',
            args0: [
                { type: 'field_dropdown', name: 'ACTION', options: [['stop (coast)', 'stop'], ['brake', 'brake'], ['hold', 'hold']] },
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'stop: release the motor (it spins freely). brake: passive brake. hold: actively keep the current angle.',
        },
        {
            type: 'evn_motor_wait_done',
            message0: 'wait until motor %1 is done',
            args0: [{ type: 'field_dropdown', name: 'PORT', options: PORTS }],
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Pause the program until this motor has finished its move (use after a move with "wait" unticked, for example to move two motors together).',
        },
        {
            type: 'evn_motor_reset_angle',
            message0: 'set motor %1 angle to %2',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'ANGLE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Make the current position read this angle (0 makes it the new reference). The shaft does not move.',
        },
        {
            type: 'evn_stop_all',
            message0: 'stop all motors',
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Coast every motor.',
        },
        {
            type: 'evn_motor_measure',
            message0: 'motor %1 %2',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'field_dropdown', name: 'WHAT', options: [['angle', 'angle'], ['speed', 'speed'], ['load (mNm)', 'load'], ['full speed (deg/s)', 'full_speed']] },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'angle in degrees (never wraps), speed in deg/s or %, load torque in mNm (positive = opposing the motor), full speed = what 100 % means at the present battery voltage.',
        },
        {
            type: 'evn_motor_is',
            message0: 'motor %1 %2',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'field_dropdown', name: 'WHAT', options: [['is done', 'done'], ['is stalled', 'stalled']] },
            ],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'is done: the last move is complete and the shaft is within tolerance. is stalled: the motor is pushing but the shaft does not move.',
        },
        {
            type: 'evn_wait',
            message0: 'wait %1 ms',
            args0: [{ type: 'input_value', name: 'TIME', check: 'Number' }],
            previousStatement: null, nextStatement: null, style: 'evn_time_blocks',
            tooltip: 'Pause the program; motors keep doing what they were told.',
        },
        {
            type: 'evn_forever',
            message0: 'forever %1 %2',
            args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
            previousStatement: null, style: 'evn_time_blocks',
            tooltip: 'Repeat forever. Ctrl+C in the terminal or "EVN: Stop all motors" ends the program.',
        },
        /* Pybricks' Flow palette has "wait until" and "wait forever" (pybricks.com/learn/flow-basics/waiting-repeating) */
        {
            type: 'evn_wait_until',
            message0: 'wait until %1',
            args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
            previousStatement: null, nextStatement: null, style: 'evn_time_blocks',
            tooltip: 'Pause the program until the condition is true (checked every 10 ms); motors keep doing what they were told.',
        },
        {
            type: 'evn_wait_forever',
            message0: 'wait forever',
            previousStatement: null, style: 'evn_time_blocks',
            tooltip: 'Keep the program running without doing anything more, so moves that were started with "wait" off go on. Nothing can follow it; Stop motors ends the program.',
        },
        {
            type: 'evn_stopwatch_time',
            message0: 'stopwatch time (ms)',
            output: 'Number', style: 'evn_time_blocks',
            tooltip: 'Milliseconds since the program started or the stopwatch was reset.',
        },
        {
            type: 'evn_stopwatch_reset',
            message0: '%1 stopwatch',
            args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['reset', 'reset'], ['pause', 'pause'], ['resume', 'resume']] }],
            previousStatement: null, nextStatement: null, style: 'evn_time_blocks',
            tooltip: 'reset: back to 0 (a paused stopwatch stays paused: resume it); pause: stop counting; resume: count on from where it paused.',
        },
        {
            type: 'evn_led',
            message0: 'turn LED %1',
            args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['on', 'on'], ['off', 'off'], ['toggle', 'toggle']] }],
            previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'The user LED on the board.',
        },
        {
            type: 'evn_led_set',
            message0: 'set LED to %1',
            args0: [{ type: 'input_value', name: 'ON', check: 'Boolean' }],
            previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'The user LED on (true) or off (false): plug in a comparison or a sensor block.',
        },
        {
            type: 'evn_button_pressed',
            message0: 'button pressed?',
            output: 'Boolean', style: 'evn_board_blocks',
            tooltip: 'True while the user button is held. A press also coasts every motor (the emergency stop), so use it to start things, not in the middle of a move.',
        },
        {
            type: 'evn_wait_for_button',
            message0: 'wait for a button press',
            previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'Pause until the user button is pressed and released (a good way to start a program from the board; the press also coasts every motor).',
        },
        {
            type: 'evn_battery_voltage',
            message0: 'battery voltage (mV)',
            output: 'Number', style: 'evn_board_blocks',
            tooltip: 'Pack voltage in millivolts.',
        },
        {
            type: 'evn_battery_low',
            message0: 'battery low? (below %1 mV)',
            args0: [{ type: 'input_value', name: 'THRESHOLD', check: 'Number' }],
            inputsInline: true, output: 'Boolean', style: 'evn_board_blocks',
            tooltip: 'True when the pack, over about the last second, is below this many millivolts (or one of its two cells is below half of it); it stays true until the pack is 150 mV above it again and its weaker cell at half of that, so it does not flicker. The cell usually decides first, so it can be true while the battery voltage still reads slightly above the level. 6600 is where a pack starts to run out fast: about 30 minutes of driving before the pack switches the board off by itself at about 6.1 V. False with no pack.',
        },
        {
            type: 'evn_motor_dc',
            message0: 'set motor %1 duty to %2 %%',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'DUTY', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Open-loop duty cycle, -100 to 100 %. No speed control.',
        },
        {
            type: 'evn_motor_track_target',
            message0: 'track motor %1 to angle %2',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'ANGLE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Jump the position reference straight to an angle, without a speed profile (for following a joystick or a sensor in a loop).',
        },
        {
            type: 'evn_motor_limits',
            message0: 'limit motor %1 speed %2 acceleration %3 torque %4',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'input_value', name: 'SPEED', check: 'Number' },
                { type: 'input_value', name: 'ACCEL', check: 'Number' },
                { type: 'input_value', name: 'TORQUE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Speed (deg/s or %), acceleration (deg/s^2) and torque (mNm) limits for profiled moves. Leave an input empty to keep its current value.',
        },
        {
            type: 'evn_motor_limit',
            message0: 'set motor %1 %2 limit to %3',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'field_dropdown', name: 'WHAT', options: [['speed (deg/s or %)', 'speed'], ['acceleration (deg/s²)', 'acceleration'], ['torque (mNm)', 'torque']] },
                { type: 'input_value', name: 'VALUE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Change one limit of profiled moves and keep the other two. Speed is in the motor\'s speed unit; the defaults are the motor\'s tested maximum, so a limit is for going slower or gentler.',
        },
        {
            type: 'evn_motor_calibrate',
            message0: 'calibrate motor %1 wait %2',
            args0: [{ type: 'field_dropdown', name: 'PORT', options: PORTS }, { type: 'field_checkbox', name: 'WAIT', checked: true }],
            previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Self-calibration (about 12 s; the shaft must be free to turn, it moves up to about a turn and a half each way). Measures the motor and its full speed; stored on the board for this port. Untick "wait" to start it and go on while it runs (the ports are measured one after another in the background). A later "calibrate motor" with wait ticked on the same port waits for that run if it is still going and, once it has finished, takes its result at once (a block that moves, holds or stops that motor in between - run, stop, hold, a drive base move or stop, stop all motors - drops it: the calibration then runs again; reading its angle or speed or changing a setting does not); "motor ... is calibrated" tells when a port is done.',
        },
        {
            type: 'evn_motor_calibrated',
            message0: 'motor %1 is calibrated',
            args0: [{ type: 'field_dropdown', name: 'PORT', options: PORTS }],
            output: 'Boolean', style: 'evn_advanced_blocks',
            tooltip: 'True when the board has a stored calibration for the motor on this port (evn.calibration(port)).',
        },
        {
            type: 'evn_motor_law',
            message0: 'use %1 control for motor %2',
            args0: [
                { type: 'field_dropdown', name: 'LAW', options: [['ADRC (default)', 'adrc'], ['PID', 'pid']] },
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Control law: ADRC (self-calibrated, the default) or the tuned PID cascade.',
        },
        {
            type: 'evn_python',
            message0: 'Python %1',
            args0: [{ type: 'field_input', name: 'CODE', text: 'motor_1.settings(max_voltage=7000)' }],
            previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'One line of MicroPython, inserted as written. motor_1 .. motor_4 are the motors, drive_base the robot, pose the pose (when a Pose block is in the program) and color_sensor_3, imu_1, uart_1, i2c_5 ... the peripherals (each defined when mentioned); the evn module is imported, so Flash, core1_status() and evn.version are all reachable, and os, struct and json are imported when the line uses them.',
        },
        {
            type: 'evn_python_value',
            message0: 'Python %1',
            args0: [{ type: 'field_input', name: 'CODE', text: 'motor_1.control.limits()' }],
            output: null, style: 'evn_advanced_blocks',
            tooltip: 'A MicroPython expression, inserted as written.',
        },

        /* ---- Standard Peripherals: sensors (I2C ports 1..16) ------------------------------- */
        {
            type: 'evn_colorsensor_setup',
            message0: 'set up colour sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN colour sensor (TCS34725) on an I2C port, 1 to 16. Put it under "set up"; the colour-sensor blocks make the object by themselves, this block just says which ports the program uses.',
        },
        {
            type: 'evn_colorsensor_color',
            message0: 'colour sensor %1 colour',
            args0: [portField(I2C_PORTS)],
            output: null, style: 'evn_sense_blocks',
            tooltip: 'The colour the sensor sees: red, yellow, green, blue, white or nothing.',
        },
        {
            type: 'evn_colorsensor_calibrate',
            message0: 'calibrate colour sensor %1 %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['black (nothing in front)', 'black'], ['white (a white sheet)', 'white']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Take the reading now as the black (nothing in front of the sensor) or the white (a white sheet where the colours will be read). Do black, then white, once: the board keeps the calibration for this port, so later programs start with it.',
        },
        {
            type: 'evn_colorsensor_sees',
            message0: 'colour sensor %1 sees %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'COLOR', options: SENSOR_COLORS }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True when the sensor sees this colour. Hold the sensor a few millimetres above the surface.',
        },
        {
            type: 'evn_colorsensor_ambient',
            message0: 'colour sensor %1 light level (%%)',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'The brightness the sensor sees, in % of its full scale (ambient()): higher over white, lower over black. It is not calibrated: compare it with values measured on your own surface.',
        },
        {
            type: 'evn_colorsensor_detect',
            message0: 'colour sensor %1 only reports red %2 yellow %3 green %4 blue %5 white %6 nothing %7',
            args0: [portField(I2C_PORTS),
                { type: 'field_checkbox', name: 'RED', checked: true }, { type: 'field_checkbox', name: 'YELLOW', checked: true },
                { type: 'field_checkbox', name: 'GREEN', checked: true }, { type: 'field_checkbox', name: 'BLUE', checked: true },
                { type: 'field_checkbox', name: 'WHITE', checked: true }, { type: 'field_checkbox', name: 'NONE', checked: true }],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The colours "colour sensor ... colour" chooses from (Pybricks\' detectable_colors): untick the ones that are not on your field, and a reading is never mistaken for them.',
        },
        {
            type: 'evn_colorsensor_channel',
            message0: 'colour sensor %1 %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'WHAT', options: [
                        ['hue (0-359)', 'hsv().h'], ['saturation (0-100)', 'hsv().s'], ['brightness (0-100)', 'hsv().v'],
                        ['red (0-255)', 'rgb()[0]'], ['green (0-255)', 'rgb()[1]'], ['blue (0-255)', 'rgb()[2]'],
                    ],
                },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'One number out of the reading: hue / saturation / brightness, or one of the red, green and blue channels.',
        },
        {
            type: 'evn_distance_setup',
            message0: 'set up distance sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN distance sensor (VL53L0X time of flight) on an I2C port, 1 to 16.',
        },
        {
            type: 'evn_distance_mm',
            message0: 'distance sensor %1 distance (mm)',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Distance to what is in front, in millimetres. It is None when nothing is in range, so compare it before doing maths with it.',
        },
        {
            type: 'evn_distance_profile',
            message0: 'set distance sensor %1 to %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'PROFILE', options: [
                        ['normal', 'default'], ['long range', 'long_range'], ['fast', 'high_speed'], ['accurate', 'high_accuracy'],
                    ],
                },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'How the sensor measures: normal, long range (further, noisier), fast (quicker readings) or accurate (slower, steadier).',
        },
        {
            type: 'evn_gesture_setup',
            message0: 'set up gesture sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN gesture sensor (APDS-9960) on an I2C port, 1 to 16. It sees a hand swipe, how close something is, and colour.',
        },
        {
            type: 'evn_gesture_gesture',
            message0: 'gesture sensor %1 gesture',
            args0: [portField(I2C_PORTS)],
            output: null, style: 'evn_sense_blocks',
            tooltip: "The last swipe: 'up', 'down', 'left', 'right', or None when there was none. Each swipe is reported once.",
        },
        {
            type: 'evn_gesture_wait',
            message0: 'gesture sensor %1 wait up to %2 ms for a gesture',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'TIMEOUT', check: 'Number' }],
            inputsInline: true, output: null, style: 'evn_sense_blocks',
            tooltip: "Pause until a hand swipes past, and give its direction ('up', 'down', 'left', 'right'), or None when the time runs out.",
        },
        {
            type: 'evn_gesture_proximity',
            message0: 'gesture sensor %1 proximity',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'How close something is, 0 (far) to 255 (touching the sensor).',
        },
        {
            type: 'evn_gesture_color',
            message0: 'gesture sensor %1 colour',
            args0: [portField(I2C_PORTS)],
            output: null, style: 'evn_sense_blocks',
            tooltip: 'The colour in front of the gesture sensor.',
        },
        {
            type: 'evn_gesture_calibrate',
            message0: 'calibrate gesture sensor %1 colour %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['black (sensor covered)', 'black'], ['white (a white sheet)', 'white']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Turn the gesture engine off first (a Python block: gesture_sensor_1.engines(gesture=False)): gesture mode freezes the colour and the calibration refuses a stale reading. The LED of the gesture sensor is infrared, so its colour sees the room light: black = the sensor covered completely (a hand or a black card on it), white = a white sheet a few cm in front in the room light, not shading the module. Do black, then white, once: the board keeps the calibration for this port (one colour calibration per port).',
        },
        {
            type: 'evn_env_setup',
            message0: 'set up weather sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN environment sensor (BME280: temperature, humidity, air pressure) on an I2C port, 1 to 16.',
        },
        {
            type: 'evn_env_value',
            message0: 'weather sensor %1 %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'WHAT', options: [
                        ['temperature (C)', 'temperature'], ['humidity (%)', 'humidity'], ['air pressure (Pa)', 'pressure'],
                    ],
                },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Temperature in degrees Celsius, humidity in percent, air pressure in pascals.',
        },
        {
            type: 'evn_compass_setup',
            message0: 'set up compass on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN compass (magnetometer) on an I2C port, 1 to 16. Keep it away from the motors: their magnets bend the reading.',
        },
        {
            type: 'evn_compass_heading',
            message0: 'compass %1 heading',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Degrees clockwise from north, 0 to 360.',
        },
        {
            type: 'evn_compass_north',
            message0: 'set compass %1 heading to %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'HEADING', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The direction the robot points right now becomes this heading (0 = call it north).',
        },
        {
            type: 'evn_compass_calibrate',
            message0: 'start calibrating compass %1 spinning flat %2',
            args0: [portField(I2C_PORTS), { type: 'field_checkbox', name: 'PLANAR', checked: true }],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Begin collecting samples. Tick "spinning flat" for a robot turning on the floor; untick it and tumble the sensor through every direction by hand. Finish with "finish calibrating compass".',
        },
        {
            type: 'evn_compass_calibrate_stop',
            message0: 'finish calibrating compass %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Work out the calibration, use it and store it on the board for this port. It raises an error when the sensor did not turn through enough directions: wait until "calibration coverage" is high enough first.',
        },
        {
            type: 'evn_compass_coverage',
            message0: 'compass %1 calibration coverage (%%)',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'While calibrating: how many of the directions the fit wants the sensor has seen, 0 to 100. Spinning flat, wait until it is 100; turning it every way, about 75 is enough (the Board view finishes there), then finish.',
        },
        {
            type: 'evn_compass_calibrate_cancel',
            message0: 'cancel calibrating compass %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Stop collecting and keep the calibration the compass had before.',
        },

        /* ---- EVN Extended Peripherals (docs/EXTENDED_PERIPHERALS.md) ---------------------------- */
        {
            type: 'evn_htcolor_setup',
            message0: 'set up HiTechnic colour sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'A HiTechnic NXT Color Sensor (V1 or V2) on an I2C port, 1 to 16, through an NXT cable adapter. The firmware runs that port at 100 kHz, the sensor\'s own speed.',
        },
        {
            type: 'evn_htcolor_calibrate',
            message0: 'calibrate HiTechnic colour sensor %1 %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['black (nothing in front)', 'black'], ['white (a white sheet)', 'white']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Take the reading now as the black (nothing in front of the sensor) or the white (a white sheet where the colours will be read). Do black, then white, once: the board keeps the calibration for this port, so later programs start with it; the colour, hue, saturation and brightness are then measured between the two.',
        },
        {
            type: 'evn_htcolor_color',
            message0: 'HiTechnic colour sensor %1 colour',
            args0: [portField(I2C_PORTS)],
            output: null, style: 'evn_sense_blocks',
            tooltip: 'The colour the sensor sees: red, yellow, green, blue, white or nothing.',
        },
        {
            type: 'evn_htcolor_sees',
            message0: 'HiTechnic colour sensor %1 sees %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'COLOR', options: SENSOR_COLORS }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True when the sensor sees this colour.',
        },
        {
            type: 'evn_htcolor_value',
            message0: 'HiTechnic colour sensor %1 %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'WHAT', options: [
                        ['colour number (0-17)', 'color_number()'], ['reflection (%)', 'reflection()'],
                        ['red (0-255)', 'rgb()[0]'], ['green (0-255)', 'rgb()[1]'], ['blue (0-255)', 'rgb()[2]'],
                        ['hue (0-359)', 'hsv().h'], ['saturation (0-100)', 'hsv().s'], ['brightness (0-100)', 'hsv().v'],
                        ['colour index (0-63, V2)', 'color_index()'],
                        ['normalised red (0-255, V2)', 'normalized_rgb()[0]'], ['normalised green (0-255, V2)', 'normalized_rgb()[1]'],
                        ['normalised blue (0-255, V2)', 'normalized_rgb()[2]'],
                        ['ambient light, LED off (V2)', 'ambient()'], ['ambient red, LED off (V2)', 'ambient_raw()[0]'],
                        ['ambient green, LED off (V2)', 'ambient_raw()[1]'], ['ambient blue, LED off (V2)', 'ambient_raw()[2]'],
                    ],
                },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'One number out of the reading: the sensor\'s own colour number (0 black ... 17 white), the reflected light in %, one of the red, green and blue channels, or hue / saturation / brightness. A V2 also gives its colour index (red, green and blue levels 0-3 packed into 0-63), its normalised red, green and blue (the strongest set to 255), and, with its LED off, the light around it (ambient); switching between LED on and off takes about 0.1 s, so read the ambient values together.',
        },
        {
            type: 'evn_htcompass_setup',
            message0: 'set up HiTechnic compass on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'A HiTechnic NXT Compass Sensor on an I2C port, 1 to 16, through an NXT cable adapter. Keep it away from the motors.',
        },
        {
            type: 'evn_htcompass_heading',
            message0: 'HiTechnic compass %1 heading',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Degrees clockwise, 0 to 359, in whole degrees.',
        },
        {
            type: 'evn_htcompass_north',
            message0: 'set HiTechnic compass %1 heading to %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'HEADING', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The direction the robot points right now becomes this heading (0 = call it north).',
        },
        {
            type: 'evn_htcompass_calibrate',
            message0: 'start calibrating HiTechnic compass %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Start the sensor\'s own calibration: then turn the robot slowly and level through a little more than one full turn, taking at least 20 s, and finish with "finish calibrating HiTechnic compass". The heading cannot be read in between. The sensor stores the result itself.',
        },
        {
            type: 'evn_htcompass_calibrate_stop',
            message0: 'finish calibrating HiTechnic compass %1 (accepted?)',
            args0: [portField(I2C_PORTS)],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'End the calibration: true when the sensor accepted it, false when it rejected it (turn more slowly, keep it level, and calibrate again). Put it in an "if" or print it.',
        },
        {
            type: 'evn_huskylens_setup',
            message0: 'set up HuskyLens on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'A DFRobot HuskyLens AI camera on an I2C port, 1 to 16. Set its Protocol Type to I2C in its General Settings first.',
        },
        {
            type: 'evn_huskylens_algorithm',
            message0: 'set HuskyLens %1 to %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'ALGORITHM', options: [
                        ['face recognition', 'FACE_RECOGNITION'], ['object tracking', 'OBJECT_TRACKING'],
                        ['object recognition', 'OBJECT_RECOGNITION'], ['line tracking', 'LINE_TRACKING'],
                        ['colour recognition', 'COLOR_RECOGNITION'], ['tag recognition', 'TAG_RECOGNITION'],
                        ['object classification', 'OBJECT_CLASSIFICATION'],
                    ],
                },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Switch the camera to one of its algorithms (the same as turning its function dial).',
        },
        {
            type: 'evn_huskylens_count',
            message0: 'HuskyLens %1 objects seen',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'How many objects (blocks or arrows) the camera sees in its latest frame.',
        },
        {
            type: 'evn_huskylens_block',
            message0: 'HuskyLens %1 first block %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'WHAT', options: [
                        ['x (0-319)', '0'], ['y (0-239)', '1'], ['width', '2'], ['height', '3'], ['ID', '4'],
                    ],
                },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'One number of the first block the camera sees: x and y are its centre on the 320 x 240 screen; ID 0 means seen but not learned. It is -1 when the camera sees no block.',
        },
        {
            type: 'evn_huskylens_learn',
            message0: 'HuskyLens %1 learn what it sees as ID %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'ID', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Learn what the camera frames right now as this ID (1 or more), in the current algorithm.',
        },
        {
            type: 'evn_huskylens_forget',
            message0: 'HuskyLens %1 forget everything learned',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Erase every ID the camera has learned in its current algorithm.',
        },
        {
            type: 'evn_huskylens_learned',
            message0: 'HuskyLens %1 IDs learned',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'How many IDs the camera has learned in its current algorithm (0 when none).',
        },
        {
            type: 'evn_huskylens_arrow',
            message0: 'HuskyLens %1 first arrow %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'WHAT', options: [
                        ['x origin (0-319)', '0'], ['y origin (0-239)', '1'], ['x target (0-319)', '2'], ['y target (0-239)', '3'], ['ID', '4'],
                    ],
                },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Line tracking: one number of the first arrow the camera sees, which runs from its origin to its target on the 320 x 240 screen; ID 0 means seen but not learned. It is -1 when the camera sees no arrow.',
        },
        {
            type: 'evn_vl53l1x_setup',
            message0: 'set up VL53L1X distance sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'An ST VL53L1X time-of-flight distance sensor (up to 4 m) on an I2C port, 1 to 16. It starts in long mode, 33 ms per reading.',
        },
        {
            type: 'evn_vl53l1x_distance',
            message0: 'VL53L1X %1 distance (mm)',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Distance to what is in front, in millimetres. It is -1 when the reading is not valid (nothing in range, too much light).',
        },
        {
            type: 'evn_vl53l1x_mode',
            message0: 'set VL53L1X %1 to %2 range',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'MODE', options: [['long (up to 4 m)', 'long'], ['short (up to 1.3 m)', 'short']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Long reaches about 4 m in the dark; short reaches about 1.3 m and copes better with sunlight.',
        },
        {
            type: 'evn_vl53l1x_budget',
            message0: 'set VL53L1X %1 timing budget to %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'MS', options: [
                        ['33 ms', '33'], ['15 ms (short range only)', '15'], ['20 ms', '20'], ['50 ms', '50'],
                        ['100 ms', '100'], ['200 ms', '200'], ['500 ms', '500'],
                    ],
                },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The time per reading: longer is steadier and reaches further, with fewer readings a second. 33 ms is the start-up value. 15 ms works in short range only: set short range first, and 20 ms or more before switching back to long.',
        },
        {
            type: 'evn_vl53l1x_inter',
            message0: 'set VL53L1X %1 time between readings to %2 ms',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'MS', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'How often the sensor measures, from the start of one reading to the next: 0 (the start-up value) measures back to back, a new reading every timing budget; otherwise at least the timing budget, up to 60000 ms. Fewer readings a second, each as steady as the timing budget makes it.',
        },
        {
            type: 'evn_vl53l1x_roi',
            message0: 'set VL53L1X %1 field of view to %2 x %3',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'W', options: [['16', '16'], ['12', '12'], ['8', '8'], ['6', '6'], ['4', '4']] },
                { type: 'field_dropdown', name: 'H', options: [['16', '16'], ['12', '12'], ['8', '8'], ['6', '6'], ['4', '4']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Which part of the sensor\'s 16 x 16 light detectors measures, width x height: 16 x 16 (the start-up value) sees the whole cone of about 27 degrees; a smaller region narrows it, to measure one thing past others beside it, with less signal. The region stays centred (move it in Python: roi(w, h, center)).',
        },
        {
            type: 'evn_vl53l1x_threshold',
            message0: 'set VL53L1X %1 %2 to %3',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['signal threshold (kcps)', 'signal_threshold'], ['sigma threshold (mm)', 'sigma_threshold']] },
                { type: 'input_value', name: 'VALUE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'When a reading counts as valid. Signal threshold: the weakest return accepted, 0 to 65535 kcps (start-up 1024); lower it for dark or far targets. Sigma threshold: the most spread accepted, 0 to 16383 mm (start-up 90); raise it to accept noisier readings. A reading that fails either has no distance (-1).',
        },
        {
            type: 'evn_vl53l1x_detect',
            message0: 'VL53L1X %1 detect things %2 %3 mm',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WINDOW', options: [['closer than', 'below'], ['further than', 'above']] },
                { type: 'input_value', name: 'MM', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The sensor itself checks every reading against this distance: from now on only readings that meet it have a distance, the others have none (-1: "not detected", or a reading the sensor itself rejects). Use "VL53L1X detects" to test it; "report every reading" undoes it.',
        },
        {
            type: 'evn_vl53l1x_detect_window',
            message0: 'VL53L1X %1 detect things %2 %3 to %4 mm',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WINDOW', options: [['between', 'inside'], ['outside', 'outside']] },
                { type: 'input_value', name: 'LOW', check: 'Number' },
                { type: 'input_value', name: 'HIGH', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The sensor itself checks every reading against this window (the first distance smaller than the second): only readings that meet it have a distance, the others have none (-1). Use "VL53L1X detects" to test it.',
        },
        {
            type: 'evn_vl53l1x_detect_off',
            message0: 'VL53L1X %1 report every reading',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Stop detecting: every reading has its distance again (the start-up behaviour).',
        },
        {
            type: 'evn_vl53l1x_detected',
            message0: 'VL53L1X %1 detects',
            args0: [portField(I2C_PORTS)],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True when the latest reading saw something, was valid and met the "detect things" setting (the sensor\'s own check); with nothing in range it stays false. Set one of the "detect things" blocks first.',
        },
        {
            type: 'evn_vl53l1x_calibrate',
            message0: 'calibrate VL53L1X %1 %2 with a flat target at %3 mm',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['offset', 'offset'], ['crosstalk (cover window)', 'crosstalk']] },
                { type: 'input_value', name: 'MM', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'ST\'s calibration, stored on the board for this port: hold a flat grey or white card square to the sensor at exactly this distance (measure it; ST suggests 100 mm for the offset), nothing else in view, for about 2 seconds. Offset: corrects the distance the sensor reads. Crosstalk: only for a sensor behind a cover window, at the distance where the window starts to make it read short. The program stops with an error when too few readings are valid.',
        },
        {
            type: 'evn_vl53l1x_clear_calibration',
            message0: 'VL53L1X %1 clear calibration',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Put the sensor\'s own offset and crosstalk back and erase this port\'s stored calibration.',
        },
        {
            type: 'evn_tcs3430_setup',
            message0: 'set up TCS3430 colour sensor on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'An ams-OSRAM TCS3430 XYZ colour and light sensor on an I2C port, 1 to 16. It starts with its fastest reading (2.78 ms at 64x gain), for a target close in front.',
        },
        {
            type: 'evn_tcs3430_color',
            message0: 'TCS3430 %1 colour',
            args0: [portField(I2C_PORTS)],
            output: null, style: 'evn_sense_blocks',
            tooltip: 'The colour the sensor sees: red, yellow, green, blue, white or nothing.',
        },
        {
            type: 'evn_tcs3430_sees',
            message0: 'TCS3430 %1 sees %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'COLOR', options: SENSOR_COLORS }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True when the sensor sees this colour.',
        },
        {
            type: 'evn_tcs3430_value',
            message0: 'TCS3430 %1 %2',
            args0: [
                portField(I2C_PORTS),
                {
                    type: 'field_dropdown', name: 'WHAT', options: [
                        ['X', 'xyz()[0]'], ['Y (brightness)', 'xyz()[1]'], ['Z', 'xyz()[2]'], ['infrared', 'ir()'],
                        ['far infrared (measured now)', 'ir2()'],
                        ['hue (0-359)', 'hsv().h'], ['saturation (0-100)', 'hsv().s'], ['brightness (0-100)', 'hsv().v'],
                    ],
                },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'One number out of the reading: X, Y and Z (raw counts) follow the way the eye sees colour, Y being the brightness; infrared is the IR channel; far infrared is the second IR channel, measured when asked (it takes about two readings, and X pauses meanwhile); or hue / saturation / brightness.',
        },
        {
            type: 'evn_tcs3430_calibrate',
            message0: 'calibrate TCS3430 %1 %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['black (nothing in front)', 'black'], ['white (a white sheet)', 'white']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Take the reading now as the black (nothing in front of the sensor) or the white (a white sheet where the colours will be read), black first. The board stores it for the port, so later programs start calibrated: once is enough (the Board view\'s Calibrate does the same). Without it the warm LED makes white read yellow.',
        },
        {
            type: 'evn_tcs3430_wait',
            message0: 'set TCS3430 %1 wait between readings to %2 ms',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'MS', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'A pause after each reading, 0 (none, the start-up value) to 8540 ms: a reading then comes every integration time plus this wait.',
        },
        {
            type: 'evn_tcs3430_autozero',
            message0: 'set TCS3430 %1 auto-zero %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'NTH', options: [['at the start only', '127'], ['every reading', '1'], ['every 10 readings', '10'], ['every 100 readings', '100'], ['never', '0']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'How often the sensor re-measures its own dark offset. At the start only is the chip\'s own setting; more often follows a temperature drift.',
        },
        {
            type: 'evn_tcs3430_window',
            message0: 'set TCS3430 %1 Z window %2 to %3 for %4',
            args0: [
                portField(I2C_PORTS), { type: 'input_value', name: 'LOW', check: 'Number' }, { type: 'input_value', name: 'HIGH', check: 'Number' },
                { type: 'field_dropdown', name: 'PERS', options: [['1 reading', '1'], ['2 readings', '2'], ['3 readings', '3'], ['5 readings', '5'], ['10 readings', '10'], ['20 readings', '20'], ['60 readings', '60']] },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Watch the Z channel (raw counts): when it stays below the low end or above the high end for this many readings in a row, "Z left the window" becomes true and stays true until cleared.',
        },
        {
            type: 'evn_tcs3430_left_window',
            message0: 'TCS3430 %1 Z left the window',
            args0: [portField(I2C_PORTS)],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True once Z has stayed outside the window set with "set TCS3430 Z window" (it stays true until cleared).',
        },
        {
            type: 'evn_tcs3430_clear_window',
            message0: 'clear TCS3430 %1 window flag',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Make "Z left the window" false again, ready for the next time.',
        },
        {
            type: 'evn_tcs3430_gain',
            message0: 'set TCS3430 %1 gain to %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'GAIN', options: [['64x', '64'], ['128x', '128'], ['16x', '16'], ['4x', '4'], ['1x', '1']] },
            ],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'How much the sensor amplifies the light: lower it when a bright target close up saturates the readings.',
        },
        {
            type: 'evn_tcs3430_integration',
            message0: 'set TCS3430 %1 integration time to %2 ms',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'MS', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'How long the sensor collects light for each reading, 2.78 to 711.7 ms (the nearest 2.78 ms step is used). The start-up 2.78 ms suits a target close in front, lit by the module\'s own LED; 100 ms or more suits room light or a target further away. A longer time saturates sooner on a bright target: lower the gain then.',
        },
        {
            type: 'evn_touch_setup',
            message0: 'set up touch pads on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN touch array (MPR121, 12 pads) on an I2C port, 1 to 16.',
        },
        {
            type: 'evn_touch_pad',
            message0: 'touch pads %1 pad %2 touched',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'PAD', check: 'Number' }],
            inputsInline: true, output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True while a finger is on that pad. Pads are numbered 0 to 11.',
        },
        {
            type: 'evn_touch_any',
            message0: 'touch pads %1 any touched',
            args0: [portField(I2C_PORTS)],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True while any pad is touched.',
        },
        {
            type: 'evn_imu_setup',
            message0: 'set up IMU on port %1 calibrate at start %2',
            args0: [portField(I2C_PORTS), { type: 'field_checkbox', name: 'CALIBRATE', checked: false }],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN IMU (MPU-6500 gyro and accelerometer) on an I2C port, 1 to 16. It uses the calibration stored on the board for this port. Tick "calibrate at start" to measure a new one every time the program starts (about 2 s: keep the robot still and level); it replaces the stored one each run. Uncalibrated, keep the robot still for the first 15 seconds so it can settle.',
        },
        {
            type: 'evn_imu_angle',
            message0: 'IMU %1 %2',
            args0: [
                portField(I2C_PORTS),
                { type: 'field_dropdown', name: 'WHAT', options: [['heading', 'heading()'], ['pitch (nose up)', 'tilt()[0]'], ['roll (left side up)', 'tilt()[1]']] },
            ],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Heading in degrees, clockwise positive, counting past 360; pitch and roll in degrees from level.',
        },
        {
            type: 'evn_imu_up',
            message0: 'IMU %1 has %2 facing up',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'SIDE', options: SIDES }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True when that side of the IMU points at the ceiling (the top when the robot is level).',
        },
        {
            type: 'evn_imu_stationary',
            message0: 'IMU %1 %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'WHAT', options: [['is still', 'stationary()'], ['is ready (gyro settled)', 'ready()']] }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'is still: the robot is not moving or turning right now. is ready: the gyro has settled and the IMU\'s tilt agrees with gravity (a calibrated IMU about a second after the robot is still; otherwise 10 to 27 s still), which "robot follows its gyro" waits for.',
        },
        {
            type: 'evn_imu_reset_heading',
            message0: 'set IMU %1 heading to %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'ANGLE', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The way the robot points right now becomes this heading (usually 0).',
        },
        {
            type: 'evn_imu_calibrate',
            message0: 'calibrate IMU %1 %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'POSE', options: [
                ['(still and level, about 2 s)', '0'], ['first pose of two', '1'], ['second pose, after half a turn', '2']] }],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'Measure the gyro bias and the accelerometer offsets and store them on the board for this port; the robot must not move. On a surface that is not quite level use two poses: measure the first, turn the robot about half a turn on the same spot, then the second (within 2 minutes).',
        },
        {
            type: 'evn_adc_setup',
            message0: 'set up ADC on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN ADC (ADS1115) on an I2C port, 1 to 16. All four of its inputs (0 to 3) are scanned in turn, which is what the "voltage of input" block needs.',
        },
        {
            type: 'evn_adc_voltage',
            message0: 'ADC %1 voltage of input %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'INPUT', check: 'Number' }],
            inputsInline: true, output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Volts on input 0, 1, 2 or 3. Never put more than 3.3 V on a pin.',
        },

        /* ---- Standard Peripherals: outputs -------------------------------------------------- */
        {
            type: 'evn_display_setup',
            message0: 'set up display on port %1 mirror the console %2',
            args0: [portField(I2C_PORTS), { type: 'field_checkbox', name: 'MIRROR', checked: false }],
            style: 'evn_output_blocks',
            tooltip: 'The EVN OLED display (128x64) on an I2C port, 1 to 16. With "mirror the console" ticked everything the program prints also appears on the display.',
        },
        {
            type: 'evn_display_text',
            message0: 'display %1 show %2 at column %3 row %4',
            args0: [
                portField(I2C_PORTS),
                { type: 'input_value', name: 'TEXT' },
                { type: 'input_value', name: 'COL', check: 'Number' },
                { type: 'input_value', name: 'ROW', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Write at one place on the text grid: 16 columns across (0 to 15), 8 rows down (0 to 7).',
        },
        {
            type: 'evn_display_print',
            message0: 'display %1 print %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'TEXT' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Like print(), but on the display: it goes to the next line each time and scrolls up at the bottom.',
        },
        {
            type: 'evn_display_clear',
            message0: 'clear display %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Wipe the display and put the printing cursor back at the top.',
        },
        {
            type: 'evn_matrix_setup',
            message0: 'set up LED matrix on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_output_blocks',
            tooltip: 'The EVN 8x8 LED matrix on an I2C port, 1 to 16.',
        },
        {
            type: 'evn_matrix_icon',
            message0: 'LED matrix %1 show %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'ICON', options: ICONS }],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Show one of the ready-made pictures.',
        },
        {
            type: 'evn_matrix_pixel',
            message0: 'LED matrix %1 pixel row %2 column %3 %4',
            args0: [
                portField(I2C_PORTS),
                { type: 'input_value', name: 'ROW', check: 'Number' },
                { type: 'input_value', name: 'COL', check: 'Number' },
                { type: 'field_dropdown', name: 'ON', options: [['on', 'TRUE'], ['off', 'FALSE']] },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'One dot: row 0 to 7 from the top, column 0 to 7 from the left.',
        },
        {
            type: 'evn_matrix_number',
            message0: 'LED matrix %1 show number %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'NUMBER', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'A whole number from -99 to 99 in small digits.',
        },
        {
            type: 'evn_matrix_text',
            message0: 'LED matrix %1 show text %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'TEXT' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'One letter at a time, half a second each. The program waits until the word is finished.',
        },
        {
            type: 'evn_matrix_char',
            message0: 'LED matrix %1 show letter %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'CHAR' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'One character, shown until something else is (the text block scrolls instead).',
        },
        {
            type: 'evn_matrix_clear',
            message0: 'clear LED matrix %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Turn every pixel off.',
        },
        {
            type: 'evn_matrix_brightness',
            message0: 'LED matrix %1 brightness %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'LEVEL', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'How bright the matrix is, 1 (dim) to 16 (full).',
        },
        {
            type: 'evn_seven_setup',
            message0: 'set up 7-segment display on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_output_blocks',
            tooltip: 'The EVN 4-digit seven-segment display on an I2C port, 1 to 16.',
        },
        {
            type: 'evn_seven_number',
            message0: '7-segment %1 show number %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'NUMBER', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Show a number on the four digits.',
        },
        {
            type: 'evn_seven_text',
            message0: '7-segment %1 show text %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'TEXT' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Up to four characters: digits and the letters A B C D E F G H J L N O P R T U Y (and - _ space); other letters raise an error. A full stop after a character lights that digit’s dot.',
        },
        {
            type: 'evn_seven_colon',
            message0: '7-segment %1 colon %2',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'ON', options: [['on', 'True'], ['off', 'False']] }],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'The colon between the second and third digit (for a clock). Showing a number or text clears it, so put this block after them.',
        },
        {
            type: 'evn_seven_clear',
            message0: 'clear 7-segment %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Blank all four digits.',
        },
        {
            type: 'evn_seven_brightness',
            message0: '7-segment %1 brightness %2',
            args0: [portField(I2C_PORTS), { type: 'input_value', name: 'LEVEL', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'How bright the digits are, 1 (dim) to 16 (full).',
        },
        {
            type: 'evn_color',
            message0: 'colour %1',
            args0: [{ type: 'field_dropdown', name: 'COLOR', options: ALL_COLORS }],
            output: null, style: 'evn_output_blocks',
            tooltip: 'One of the EVN colours, for the RGB LEDs.',
        },
        {
            type: 'evn_color_rgb',
            message0: 'colour red %1 green %2 blue %3',
            args0: [
                { type: 'input_value', name: 'R', check: 'Number' },
                { type: 'input_value', name: 'G', check: 'Number' },
                { type: 'input_value', name: 'B', check: 'Number' },
            ],
            inputsInline: true, output: null, style: 'evn_output_blocks',
            tooltip: 'Mix your own colour: each of red, green and blue from 0 to 255.',
        },
        {
            type: 'evn_rgb_setup',
            message0: 'set up RGB LEDs on servo port %1 with %2 LEDs',
            // 64 is the firmware's limit (EVN_WS2812_MAX_LEDS): RGBLED(port, count) raises
            // ValueError("count must be 1..64") on the program's first line otherwise
            args0: [portField(SERVO_PORTS), { type: 'field_number', name: 'COUNT', value: 8, min: 1, max: 64, precision: 1 }],
            style: 'evn_output_blocks',
            tooltip: 'A WS2812B strip or the EVN RGB LED module on a servo port, 1 to 4, with 1 to 64 LEDs. LED 0 is the one nearest the plug. While it is in use that servo port cannot drive a servo.',
        },
        {
            type: 'evn_rgb_fill',
            message0: 'RGB LEDs %1 set all to %2',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'COLOUR' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Every LED the same colour.',
        },
        {
            type: 'evn_rgb_set',
            message0: 'RGB LEDs %1 set LED %2 to %3',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'LED', check: 'Number' }, { type: 'input_value', name: 'COLOUR' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'One LED, counting from 0 at the plug.',
        },
        {
            type: 'evn_rgb_off',
            message0: 'turn RGB LEDs %1 off',
            args0: [portField(SERVO_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Every LED off.',
        },
        {
            type: 'evn_rgb_brightness',
            message0: 'RGB LEDs %1 brightness %2',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'LEVEL', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'How bright the whole strip is, 0 to 255. Turn it down: a bright strip draws a lot of current.',
        },
        {
            type: 'evn_servo_setup',
            message0: 'set up servo on port %1 type %2',
            args0: [
                portField(SERVO_PORTS),
                {
                    type: 'field_dropdown', name: 'PROFILE', options: [
                        ['Geekservo 270 degrees', 'geekservo_270'], ['Geekservo 360 degrees', 'geekservo_360'], ['generic 180 degrees', 'generic'], ['Geekservo continuous', 'geekservo_cr'],
                    ],
                },
            ],
            style: 'evn_output_blocks',
            tooltip: 'A hobby servo on a servo port, 1 to 4. The kit’s Geekservo 270 is the default; the servo blocks work without this block.',
        },
        {
            type: 'evn_servo_angle',
            message0: 'move servo %1 to %2 degrees',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'ANGLE', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Go straight to an angle, 0 to the servo’s range (270 degrees for the kit’s servo). Not for a continuous servo: use "run servo at %" for that.',
        },
        {
            type: 'evn_servo_move',
            message0: 'sweep servo %1 to %2 degrees at %3 deg/s wait %4',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'ANGLE', check: 'Number' },
                { type: 'input_value', name: 'SPEED', check: 'Number' }, { type: 'field_checkbox', name: 'WAIT', checked: true }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Turn to an angle at a steady speed instead of at once. "wait" pauses the program until it gets there. Not for a continuous servo.',
        },
        {
            type: 'evn_servo_duty',
            message0: 'run servo %1 at %2 %%',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'DUTY', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'A continuous-rotation servo ("Geekservo continuous" in its set-up block): -100 to 100 %, 0 stops it. Other servo types raise an error.',
        },
        {
            type: 'evn_servo_done',
            message0: 'servo %1 has finished its sweep',
            args0: [portField(SERVO_PORTS)],
            output: 'Boolean', style: 'evn_output_blocks',
            tooltip: 'True once a sweep started with "wait" unticked has arrived.',
        },
        {
            type: 'evn_servo_pulse',
            message0: 'set servo %1 pulse to %2 us',
            args0: [portField(SERVO_PORTS), { type: 'input_value', name: 'US', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Send a pulse width in microseconds (about 600 to 2400 for the kit’s servo) instead of an angle.',
        },
        {
            type: 'evn_servo_stop',
            message0: 'stop servo %1',
            args0: [portField(SERVO_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Cancel a sweep; on a continuous-rotation servo it stops the wheel.',
        },
        {
            type: 'evn_bluetooth_setup',
            message0: 'set up Bluetooth on serial port %1',
            args0: [portField(SERIAL_PORTS)],
            style: 'evn_output_blocks',
            tooltip: 'The EVN Bluetooth module on serial port 1 or 2. Hold the module’s button while switching the board on to program its name and speed.',
        },
        {
            type: 'evn_bluetooth_send',
            message0: 'Bluetooth %1 send %2',
            args0: [portField(SERIAL_PORTS), { type: 'input_value', name: 'TEXT' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Send one line of text; a newline is added at the end so the other side knows the line finished.',
        },
        {
            type: 'evn_bluetooth_any',
            message0: 'Bluetooth %1 has something to read',
            args0: [portField(SERIAL_PORTS)],
            output: 'Boolean', style: 'evn_output_blocks',
            tooltip: 'True when bytes have arrived from the other side.',
        },
        {
            type: 'evn_bluetooth_line',
            message0: 'Bluetooth %1 received line (wait up to %2 ms)',
            args0: [portField(SERIAL_PORTS), { type: 'input_value', name: 'TIMEOUT', check: 'Number' }],
            inputsInline: true, output: 'String', style: 'evn_output_blocks',
            tooltip: 'Wait for a line of text from the other side, and give it without its newline (empty text when nothing arrives in time).',
        },
    ]);

    /* ---- drive base (evn.DriveBase: two motors as a robot; mm, deg clockwise) -------------- */

    /* The data log (evn.DataLog): the board records each source at the rate it makes new readings, in RAM,
     * and save() writes the file once the motors coast. One log per program, `data_log`, built from the
     * "set up data log" block (or `DataLog(name='log')` without one). */
    const DATALOG_SOURCES = [['IMU', 'IMU'], ['compass', 'Compass'], ['colour sensor', 'ColorSensor'],
        ['distance sensor', 'DistanceSensor'], ['gesture sensor', 'GestureSensor'], ['weather sensor', 'EnvSensor'],
        ['touch pads', 'TouchArray'], ['ADC', 'ADC'], ['battery', 'battery'], ['button', 'button'],
        // the EVN Extended Peripherals evn.DataLog records (hal_datalog.c q_ht_color / q_ht_compass): deviceRef()
        // names them as their own set-up blocks do (ht_color_N, ht_compass_N)
        ['HiTechnic colour sensor', 'HiTechnicColorSensor'], ['HiTechnic compass', 'HiTechnicCompass']];
    Blockly.common.defineBlocksWithJsonArray([
        {
            type: 'evn_datalog_setup',
            message0: 'set up data log named %1 columns %2',
            args0: [
                { type: 'field_input', name: 'NAME', text: 'log' },
                { type: 'field_input', name: 'COLUMNS', text: '' },
            ],
            style: 'evn_board_blocks',
            tooltip: 'The data log: the board records what "data log: record" names, each at the rate its source makes new readings, and keeps it in its memory; "save data log" writes /data/<name>_<date>_<time>.csv (open it in the data viewer). Columns (comma separated, e.g. "x, y") are the values "data log: add row" records; leave it empty when the program adds no rows. When a reading\'s share of the memory is full, the board keeps every second sample and halves its rate: the recording never stops by itself.',
        },
        {
            type: 'evn_datalog_add_motor',
            message0: 'data log: record motor %1 %2 %3 times a second (0 = every new reading)',
            args0: [
                { type: 'field_dropdown', name: 'PORT', options: PORTS },
                { type: 'field_dropdown', name: 'WHAT', options: [['angle', 'angle'], ['speed', 'speed'], ['load (mNm)', 'load'], ['stalled', 'stalled']] },
                { type: 'input_value', name: 'RATE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'Add a motor reading to the data log, before "start data log". 0 = every new reading (up to 1000 a second, the motor engine\'s tick; about 460 with an IMU on the bus). Angles in degrees, speeds in deg/s, load in mNm.',
        },
        {
            type: 'evn_datalog_add',
            message0: 'data log: record %1 on port %2 %3 %4 times a second (0 = every new reading)',
            args0: [
                { type: 'field_dropdown', name: 'SOURCE', options: DATALOG_SOURCES },
                portField(I2C_PORTS),
                { type: 'field_input', name: 'QUANTITY', text: 'heading' },
                { type: 'input_value', name: 'RATE', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'Add a sensor reading to the data log, before "start data log": the reading is the sensor\'s method name (IMU: heading, tilt, acceleration, angular_velocity; compass: heading; colour sensor: hsv, rgb, color, lux; distance sensor: distance; weather sensor: temperature, pressure, humidity; HiTechnic colour sensor: rgb, color, color_number, hsv, reflection and, on a V2, color_index, normalized_rgb - each recorded while the program keeps the sensor\'s light on - and ambient, ambient_raw (V2, while the program keeps it off: the log never switches the light); HiTechnic compass: heading; battery: voltage, cells; button: pressed; the full list is in the API reference). The port is the I2C port (ignored for the battery and the button). A rate above the sensor\'s own gives the sensor\'s (an IMU makes 200 readings a second, a compass 75, the battery 25).',
        },
        {
            type: 'evn_datalog_run',
            message0: '%1 data log',
            args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['start', 'start'], ['stop', 'stop']] }],
            previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'start: record from now on (a new recording); stop: stop recording, the samples stay in the board\'s memory for "save data log".',
        },
        {
            type: 'evn_datalog_row',
            message0: 'data log: add row %1 %2 %3',
            args0: [
                { type: 'input_value', name: 'A' },
                { type: 'input_value', name: 'B' },
                { type: 'input_value', name: 'C' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'Record one row of your own values, one per column of "set up data log" (at most three here; an empty slot is an empty cell; a slot beyond the columns is ignored), stamped with the board\'s time. Starts the log if it was never started; after stop it is an error.',
        },
        {
            type: 'evn_datalog_save',
            message0: 'save data log',
            previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'Write the recording to a file on the board (/data/<name>_<date>_<time>.csv), after "stop data log" and with the motors stopped: the board refuses to write its flash while a motor drives. A data log not yet saved (recording or stopped) is saved by itself when main.py ends, the editor\'s Run finishes, the board soft-reboots or a with block ends, once the motors coast.',
        },
    ]);

    /* then= for a drive base: Stop.NONE is refused by DriveBase (use "drive at"). */
    const DB_THEN = [['hold', 'HOLD'], ['coast', 'COAST'], ['brake', 'BRAKE'], ['coast (smart)', 'COAST_SMART']];

    Blockly.common.defineBlocksWithJsonArray([
        {
            type: 'evn_drivebase_setup',
            message0: 'set up robot: left motor %1 right motor %2 wheel diameter %3 mm wheels %4 mm apart',
            args0: [
                { type: 'field_dropdown', name: 'LEFT', options: PORTS },
                { type: 'field_dropdown', name: 'RIGHT', options: PORTS },
                { type: 'field_number', name: 'WHEEL', value: 56, min: 1, max: 999, precision: 0.1 },
                { type: 'field_number', name: 'TRACK', value: 112, min: 1, max: 1999, precision: 0.1 },
            ],
            style: 'evn_motor_blocks',
            tooltip: 'The two wheel motors and the geometry of the robot (one per program). A motor mounted mirrored needs a "set up motor" block with counterclockwise as its positive direction. The distance between the wheels is measured between their contact patches: check it with one "turn robot 360 degrees" against a mark on the floor.',
        },
        {
            type: 'evn_drivebase_gyro',
            message0: 'robot %2 its gyro: IMU on port %1',
            args0: [portField(I2C_PORTS), { type: 'field_dropdown', name: 'ON', options: [['follows', 'True'], ['stops following', 'False']] }],
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'The robot itself, not just its wheels, follows every straight, turn and arc: the wheel encoders and an EVN IMU on this port track where the robot really is (evn.Pose) and each move is corrected as it goes, so scrub on a turn, a dragged cable and the gyro\'s drift no longer add up over minutes. Put it before the first move and keep the robot still: it waits (up to 35 s) for the IMU to settle. Uses the "set up robot" geometry; one per program (a second block only repeats the switch-on).',
        },
        {
            type: 'evn_drivebase_straight',
            message0: 'drive straight %1 mm',
            args0: [{ type: 'input_value', name: 'DISTANCE', check: 'Number' }],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: DB_THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Drive straight by a distance in mm (negative = backwards), both wheels on one time base. "wait" pauses the program until the move is done.',
        },
        {
            type: 'evn_drivebase_turn',
            message0: 'turn robot %1 degrees',
            args0: [{ type: 'input_value', name: 'ANGLE', check: 'Number' }],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: DB_THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Turn on the spot by an angle: positive turns right (clockwise seen from above), negative left.',
        },
        {
            type: 'evn_drivebase_arc',
            message0: 'drive an arc of radius %1 mm through %2 %3',
            args0: [
                { type: 'input_value', name: 'RADIUS', check: 'Number' },
                { type: 'input_value', name: 'ANGLE', check: 'Number' },
                { type: 'field_dropdown', name: 'UNIT', options: [['degrees', 'angle'], ['mm', 'distance']] },
            ],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: DB_THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Drive along a circle, by an angle or by a distance along the arc: a positive radius curves to the right, a negative one to the left; a negative amount drives the arc backwards.',
        },
        {
            type: 'evn_drivebase_drive',
            message0: 'drive at %1 mm/s turning %2 deg/s',
            args0: [
                { type: 'input_value', name: 'SPEED', check: 'Number' },
                { type: 'input_value', name: 'TURN', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Drive at a speed and a turn rate (positive = right) until the next robot block: the block for a line follower loop.',
        },
        {
            type: 'evn_drivebase_stop',
            message0: 'stop the robot %1',
            args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['coast', 'stop'], ['brake', 'brake']] }],
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Coast (let the wheels roll) or brake both wheels.',
        },
        {
            type: 'evn_drivebase_speeds',
            message0: 'set robot speed %1 mm/s turn rate %2 deg/s',
            args0: [
                { type: 'input_value', name: 'SPEED', check: 'Number' },
                { type: 'input_value', name: 'TURN', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'The speed "drive straight" and "drive an arc" use, and the rate "turn robot" uses. Without this block the robot uses the most its motors can do.',
        },
        {
            type: 'evn_drivebase_accel',
            message0: 'set robot acceleration %1 mm/s² turn acceleration %2 deg/s²',
            args0: [
                { type: 'input_value', name: 'ACCEL', check: 'Number' },
                { type: 'input_value', name: 'TURN', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'How quickly the robot speeds up and slows down on straights and arcs, and on turns. Lower is gentler (less wheel slip, a tall robot does not tip).',
        },
        {
            type: 'evn_drivebase_reset',
            message0: 'reset robot distance and angle',
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'The "robot distance" and "robot angle" values count from here.',
        },
        {
            type: 'evn_drivebase_measure',
            message0: 'robot %1',
            args0: [{ type: 'field_dropdown', name: 'WHAT', options: [['distance (mm)', 'distance'], ['angle (deg)', 'angle']] }],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'How far the robot has driven (mm) or turned (degrees, clockwise positive) since the program started or the last reset, from the wheel encoders.',
        },
        {
            type: 'evn_drivebase_is',
            message0: 'robot %1',
            args0: [{ type: 'field_dropdown', name: 'WHAT', options: [['is done', 'done'], ['is stalled', 'stalled']] }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'Whether the last robot move has finished, or a wheel is pushing against something it cannot move.',
        },
    ]);

    /* ---- the pose, the serial ports, raw I2C and files (2026-09-28, the owner: "implement blocks for
     * other categories if feasible"): the four folders of examples that were Python only. -------------- */

    /* The address and register fields of the I2C blocks hold two hex digits after a printed "0x", as a
     * datasheet writes them. A typed "0x" is dropped; anything that is not one hex byte in range is refused
     * (the field keeps the value it had). The firmware refuses the board's own devices (evn_periph.c
     * i2c_addr(), ValueError), so the fields do too: 0x70, the multiplexer that answers on every port, and
     * 0x6A on port 16, the battery charger - there the address and the port refuse each other, whichever
     * is set second. A saved file whose value a field refuses loads with the block's default in its place,
     * and loadWorkspace() names it in its notes (loadRefusals), never silently. */
    function hexByteValidator(min, max, refused) {
        return function (text) {
            const t = String(text).trim().replace(/^0x/i, '');
            if (!/^[0-9a-f]{1,2}$/i.test(t)) { return null; }
            const n = parseInt(t, 16);
            if (n < min || n > max || refused.indexOf(n) >= 0) { return null; }
            return n.toString(16).toUpperCase().padStart(2, '0');
        };
    }
    const CHARGER_PORT = '16', CHARGER_ADDR = '6A';
    /** what a file being loaded held that a field refused, for loadWorkspace()'s notes */
    const loadRefusals = [];
    /** A validator that also records a refusal while a file loads (loadingDepth, below). */
    function noted(what, check) {
        return function (text) {
            const v = check.call(this, text);
            if (v === null && loadingDepth > 0) { loadRefusals.push(what + ' ' + JSON.stringify(String(text))); }
            return v;
        };
    }
    const I2C_HEX = 'evn_i2c_hex_fields';
    if (!Blockly.Extensions.isRegistered(I2C_HEX)) {
        Blockly.Extensions.register(I2C_HEX, function () {
            const addr = this.getField('ADDR');
            const reg = this.getField('REG');
            const port = this.getField('PORT');
            const addrByte = hexByteValidator(0x01, 0x77, [0x70]);
            if (addr) {
                addr.setValidator(noted('I2C address', function (text) {
                    const v = addrByte(text);
                    return v === CHARGER_ADDR && port && port.getValue() === CHARGER_PORT ? null : v;
                }));
            }
            if (reg) { reg.setValidator(noted('I2C register', hexByteValidator(0x00, 0xFF, []))); }
            if (port && addr) {
                port.setValidator(noted('I2C port', function (p) {
                    return String(p) === CHARGER_PORT && addr.getValue() === CHARGER_ADDR ? null : p;
                }));
            }
        });
    }
    const i2cAddr = () => ({ type: 'field_input', name: 'ADDR', text: '68' });
    const i2cReg = () => ({ type: 'field_input', name: 'REG', text: '75' });
    /* UART speeds: the common ones, 115200 (the port's own default) first. The firmware takes 300..3000000. */
    const BAUDS = ['115200', '9600', '4800', '19200', '38400', '57600', '230400', '460800', '921600'].map((b) => [b, b]);

    Blockly.common.defineBlocksWithJsonArray([
        /* Pose (evn.Pose): where the robot is, from its wheels, the IMU of "robot follows its gyro" and the
         * compass of "set up pose". One pose per program, `pose`, built from the "set up robot" geometry;
         * a robot adopts it (DriveBase(..., pose=pose)), so it is the pose the robot follows. */
        {
            type: 'evn_pose_setup',
            message0: 'set up pose: use the compass on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_motor_blocks',
            tooltip: 'Adds an EVN compass to the pose, so its heading has an absolute reference (north) that never drifts. Calibrate the compass on the robot first (the Board view, or the compass blocks), mount it away from the motors, and see "pose is using the compass": near a motor\'s magnets or a steel table the pose leaves it out until the field looks like the Earth\'s again. The pose always uses the wheels of "set up robot", and the IMU of "robot follows its gyro" when the program has one.',
        },
        {
            type: 'evn_pose_value',
            message0: 'pose %1',
            args0: [{
                type: 'field_dropdown', name: 'WHAT', options: [
                    ['x (mm)', 'position()[0]'], ['y (mm)', 'position()[1]'], ['heading (degrees)', 'heading()'],
                    ['speed (mm/s)', 'velocity()[0]'], ['turn rate (deg/s)', 'velocity()[1]'],
                ],
            }],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'Where the robot is: x and y in mm, heading in degrees clockwise (0 to 360), speed in mm/s, turn rate in deg/s clockwise. Without a compass the robot starts at x 0, y 0, heading 0: forward is +y and its right is +x. With a compass the heading starts from north (x East, y North). It keeps counting while the robot drives, turns or is pushed by hand.',
        },
        {
            type: 'evn_pose_uncertainty',
            message0: 'pose uncertainty of %1',
            args0: [{ type: 'field_dropdown', name: 'WHAT', options: [['x (mm)', '0'], ['y (mm)', '1'], ['heading (degrees)', '2']] }],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'How sure the pose is of itself: one standard deviation of x or y in mm, or of the heading in degrees. It grows as the robot drives on its wheels alone and shrinks when a compass pins the heading.',
        },
        {
            type: 'evn_pose_uses',
            message0: 'pose is using the %1',
            args0: [{ type: 'field_dropdown', name: 'SOURCE', options: [['wheels', 'wheels'], ['IMU', 'imu'], ['compass', 'compass']] }],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True while that source counts right now. The compass drops out while its field is not the Earth\'s (a motor\'s magnets, a steel table) and comes back by itself; the heading then has no absolute reference until it does.',
        },
        {
            type: 'evn_pose_reset',
            message0: 'set pose to x %1 y %2 heading %3',
            args0: [
                { type: 'input_value', name: 'X', check: 'Number' },
                { type: 'input_value', name: 'Y', check: 'Number' },
                { type: 'input_value', name: 'HEADING', check: 'Number' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Say where the robot is now (mm, mm, degrees clockwise); nothing moves. Put "pose heading" in the heading slot to move only the origin and keep the heading the pose has. What a heading of your own does while a compass counts: Pose reset() in the API reference.',
        },

        /* UART (evn.UART): a serial header as a plain serial port. One object per port, `uart_<port>`. */
        {
            type: 'evn_uart_setup',
            message0: 'set up UART on serial port %1 at %2 baud',
            args0: [portField(SERIAL_PORTS), { type: 'field_dropdown', name: 'BAUD', options: BAUDS }],
            style: 'evn_output_blocks',
            tooltip: 'Serial 1 or Serial 2 as a plain serial port, for anything that talks serial: a USB-serial adapter, another controller, a GPS. The speed has to be the other device\'s. Without this block a UART block uses 115200 baud. A port the Bluetooth blocks use cannot be a UART as well.',
        },
        {
            type: 'evn_uart_send',
            message0: 'UART %1 send %2 and a new line %3',
            args0: [portField(SERIAL_PORTS), { type: 'input_value', name: 'TEXT' }, { type: 'field_checkbox', name: 'NEWLINE', checked: true }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Send text (a number is sent as its digits). Ticked, a newline follows, so the other side knows the line finished. Every byte is queued and sent in the background; none is dropped.',
        },
        {
            type: 'evn_uart_line',
            message0: 'UART %1 received line (wait up to %2 ms)',
            args0: [portField(SERIAL_PORTS), { type: 'input_value', name: 'TIMEOUT', check: 'Number' }],
            inputsInline: true, output: 'String', style: 'evn_output_blocks',
            tooltip: 'Wait for a line of text from the other side and give it without its line ending (empty text when no whole line arrives in time: the part that did arrive is kept, and the next "received line" gives the whole line). What arrived behind the line stays for the next read. A line of more than 1024 bytes comes in pieces of 1024. Text that is not UTF-8 comes as one character per byte. At 460800 or 921600 baud keep what the other side sends in one go under about 250 bytes (the port holds 255): the block reads a byte at a time, and a longer burst - one long line, or short lines back to back - can arrive faster than that and lose bytes.',
        },
        {
            type: 'evn_uart_read',
            message0: 'UART %1 received text (everything waiting)',
            args0: [portField(SERIAL_PORTS)],
            output: 'String', style: 'evn_output_blocks',
            tooltip: 'Everything that has arrived and not been read yet, as text (empty text when nothing is waiting), a line "received line" gave up on included. It does not wait. Text that is not UTF-8 comes as one character per byte.',
        },
        {
            type: 'evn_uart_any',
            message0: 'UART %1 bytes waiting',
            args0: [portField(SERIAL_PORTS)],
            output: 'Number', style: 'evn_output_blocks',
            tooltip: 'How many bytes have arrived and wait to be read (0 when none). The port keeps up to 255. It is a number: in an "if", compare it (bytes waiting > 0). A part line that "received line" gave up on is not counted, though "received text" still gives it.',
        },
        {
            type: 'evn_uart_clear',
            message0: 'UART %1 throw away what has arrived',
            args0: [portField(SERIAL_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_output_blocks',
            tooltip: 'Forget every byte that has arrived and not been read yet (to start listening afresh).',
        },

        /* I2C (evn.I2C): a raw I2C device on I2C port 1..16. One object per port, `i2c_<port>`. */
        {
            type: 'evn_i2c_setup',
            message0: 'set up I2C on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_output_blocks',
            tooltip: 'Raw I2C on an I2C port, 1 to 16, for a chip the EVN blocks have no category for. Read its datasheet for its address and registers. The I2C blocks work without this block.',
        },
        {
            type: 'evn_i2c_scan',
            message0: 'I2C %1 addresses that answer',
            args0: [portField(I2C_PORTS)],
            output: 'Array', style: 'evn_output_blocks',
            tooltip: 'The addresses (in hex, such as 0x68) of every device that answers on this port: print it. An address alone does not say which chip it is: read the chip\'s ID register to be sure.',
        },
        {
            type: 'evn_i2c_probe',
            message0: 'I2C %1 a device answers at 0x%2',
            args0: [portField(I2C_PORTS), i2cAddr()],
            output: 'Boolean', style: 'evn_output_blocks', extensions: [I2C_HEX],
            tooltip: 'True when something answers at this address (hex, 01 to 77) on this port.',
        },
        {
            type: 'evn_i2c_read',
            message0: 'I2C %1 device 0x%2 register 0x%3 read %4',
            args0: [portField(I2C_PORTS), i2cAddr(), i2cReg(), {
                type: 'field_dropdown', name: 'FORMAT', options: [
                    ['byte (0 to 255)', 'B'], ['signed byte (-128 to 127)', 'b'],
                    ['16 bits, high byte first (0 to 65535)', '>H'], ['signed 16 bits, high byte first', '>h'],
                    ['16 bits, low byte first (0 to 65535)', '<H'], ['signed 16 bits, low byte first', '<h'],
                ],
            }],
            output: 'Number', style: 'evn_output_blocks', extensions: [I2C_HEX],
            tooltip: 'Read a register of the device at this address (both in hex, as the datasheet gives them): one byte, or two bytes from this register on as one 16-bit number, the high or the low byte first as the datasheet says, signed when the value can be negative (an acceleration, a temperature).',
        },
        {
            type: 'evn_i2c_read_bytes',
            message0: 'I2C %1 device 0x%2 register 0x%3 read %4 bytes as a list',
            args0: [portField(I2C_PORTS), i2cAddr(), i2cReg(), { type: 'input_value', name: 'COUNT', check: 'Number' }],
            inputsInline: true, output: 'Array', style: 'evn_output_blocks', extensions: [I2C_HEX],
            tooltip: 'Read this many bytes (1 to 4096) from this register on, as a list of numbers 0 to 255: print it, or take it apart with a Python block.',
        },
        {
            type: 'evn_i2c_write',
            message0: 'I2C %1 device 0x%2 register 0x%3 write %4 %5',
            args0: [portField(I2C_PORTS), i2cAddr(), i2cReg(), {
                type: 'field_dropdown', name: 'FORMAT', options: [
                    ['byte', 'B'], ['16 bits, high byte first', '>H'], ['16 bits, low byte first', '<H'],
                ],
            }, { type: 'input_value', name: 'VALUE', check: 'Number' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_output_blocks', extensions: [I2C_HEX],
            tooltip: 'Write a byte (0 to 255), or a 16-bit number (0 to 65535) as two bytes, to a register of the device; a value outside that stops the program with an error instead of writing something else. A wrong register can change how the chip works until it is switched off: check the datasheet. The board refuses its own addresses (0x70 everywhere, 0x6A on port 16).',
        },

        /* Files: the board's flash file system at "/", with open() and os as in MicroPython. */
        {
            type: 'evn_file_write',
            message0: 'file %1 %2 the line %3',
            args0: [
                { type: 'input_value', name: 'NAME' },
                { type: 'field_dropdown', name: 'MODE', options: [['add', 'a'], ['replace everything with', 'w']] },
                { type: 'input_value', name: 'TEXT' },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'add: put the line at the end of the file. replace everything with: the file holds only this line afterwards. Either makes the file when there is none. The file stays on the board after a power cycle. The board refuses to write its flash while a motor is driving (OSError 16): write after the move, or keep the values in variables until then.',
        },
        {
            type: 'evn_file_read',
            message0: 'text of file %1',
            args0: [{ type: 'input_value', name: 'NAME' }],
            inputsInline: true, output: 'String', style: 'evn_board_blocks',
            tooltip: 'Everything in the file, as text (one line after the other); empty text when there is no such file. It is for small text files: the whole file is read into memory at once, so a big one (a data log in the folder "data") stops the program with MemoryError - read those a line at a time in a Python block. A file that is not UTF-8 text stops it with UnicodeError.',
        },
        {
            type: 'evn_file_exists',
            message0: 'file %1 exists',
            args0: [{ type: 'input_value', name: 'NAME' }],
            inputsInline: true, output: 'Boolean', style: 'evn_board_blocks',
            tooltip: 'True when the board has a file (or a folder) of this name.',
        },
        {
            type: 'evn_file_delete',
            message0: 'delete file %1',
            args0: [{ type: 'input_value', name: 'NAME' }],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'Remove the file from the board (nothing happens when there is none). Like a write, it is refused while a motor is driving (OSError 16).',
        },
        {
            type: 'evn_file_list',
            message0: 'files on the board',
            output: 'Array', style: 'evn_board_blocks',
            tooltip: 'The names of the files and folders on the board (the data logs are in the folder "data"): print it.',
        },
    ]);

    /* ---- a program in two sections, as in Pybricks (owner, 2026-09-24) ---------------------
     * "Mirror how Pybricks implements their block organisation": every workspace has one "set up"
     * hat and one "program" hat, neither deletable (pybricks.com/learn/making-programs/basic-blocks:
     * "Each Pybricks program consists of two parts: Device setup ... Program").
     *   - The set-up blocks stack only under "set up" (and under each other there); nothing else
     *     does, and a set-up never goes into the program, a loop or an if - its object is made once
     *     at the top of the program wherever it sits (deviceRef / motorRef hoist it).
     *   - The program is the stack under "program". Its play icon runs the program on the board
     *     (the editor sets onRunClicked; greyed while no board is connected).
     *   - A stack attached to neither is switched off (greyed, not generated), as a block left
     *     outside a Pybricks program does not run; function definitions stand alone as before, and
     *     a loose comment stays live (it only says something).
     *   - The comment block goes anywhere, in either section.
     * The rules live in the connection checker, so drag, paste and load all obey them: Blockly
     * lets an unchecked connection take any block, so connection checks alone cannot say this. */
    const ICON = (body) => 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>');
    const HAT_ICONS = {
        plug: ICON('<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>'),
        play: ICON('<circle cx="12" cy="12" r="10" fill="#fff" stroke="none"/><path d="M10 8l6 4-6 4z" fill="#b07a0c" stroke="none"/>'),
        playOff: ICON('<circle cx="12" cy="12" r="10" stroke-opacity="0.6"/><path d="M10 8l6 4-6 4z" fill="#fff" fill-opacity="0.6" stroke="none"/>'),
    };
    const SETUP_HAT = 'evn_setup_start';
    const PROGRAM_HAT = 'evn_program_start';
    const COMMENT = 'evn_comment';
    const STANDALONE_ROOTS = ['procedures_defnoreturn', 'procedures_defreturn'];
    Blockly.common.defineBlocksWithJsonArray([
        {
            type: SETUP_HAT,
            message0: '%1 set up',
            args0: [{ type: 'field_image', name: 'ICON', src: HAT_ICONS.plug, width: 20, height: 20, alt: '' }],
            nextStatement: null, style: 'evn_start_blocks',
            tooltip: 'Set-up blocks go here: every motor, the robot and each sensor or output the program uses, with its port. They run first, once, before the program.',
        },
        {
            type: PROGRAM_HAT,
            message0: '%1 program',
            args0: [{ type: 'field_image', name: 'RUN', src: HAT_ICONS.playOff, width: 22, height: 22, alt: 'run' }],
            nextStatement: null, style: 'evn_start_blocks',
            tooltip: 'The program: the blocks under this one run from top to bottom after the set-up. Click the play button to run it on the board. Blocks that are not attached here or under "set up" are greyed out and do not run.',
        },
        {
            type: COMMENT,
            message0: '# %1',
            args0: [{ type: 'field_input', name: 'TEXT', text: 'what this part does' }],
            previousStatement: null, nextStatement: null, style: 'evn_comment_blocks',
            tooltip: 'A note for whoever reads the program. It does nothing on the board; it becomes a # comment in the Python.',
        },
    ]);
    const api = {};                 // filled at the end; onRunClicked / boardConnected are set by the editor
    const baseProgramInit = Blockly.Blocks[PROGRAM_HAT].init;
    Blockly.Blocks[PROGRAM_HAT].init = function () {
        baseProgramInit.call(this);
        const field = this.getField('RUN');
        if (field && field.setOnClickHandler) {
            field.setOnClickHandler(() => { if (typeof api.onRunClicked === 'function') { api.onRunClicked(); } });
        }
        showBoard(this, !!api.boardConnected);
    };
    /** the play icon of a program hat: live while a board is connected */
    function showBoard(block, connected) {
        const field = block.getField('RUN');
        if (!field) { return; }
        // not an edit: no change event, so it is neither on the undo stack nor a reason to save the file
        field.setValue(connected ? HAT_ICONS.play : HAT_ICONS.playOff, false);
        if (field.setAlt) { field.setAlt(connected ? 'Run on the board' : 'Connect a board to run'); }
        if (field.setTooltip) { field.setTooltip(connected ? 'Run this program on the board' : 'No board connected: plug in the EVN ALPHA to run the program'); }
    }
    function setBoardConnected(workspace, connected) {
        api.boardConnected = !!connected;
        for (const b of workspace.getBlocksByType(PROGRAM_HAT, false)) { showBoard(b, api.boardConnected); }
    }

    const SETUP_TYPES = Object.keys(Blockly.Blocks).filter((t) => /^evn_\w+_setup$/.test(t));
    for (const t of SETUP_TYPES) {
        const init = Blockly.Blocks[t].init;
        Blockly.Blocks[t].init = function () {
            init.call(this);
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        };
    }
    for (const t of [SETUP_HAT, PROGRAM_HAT]) {
        const init = Blockly.Blocks[t].init;
        Blockly.Blocks[t].init = function () { init.call(this); this.setDeletable(false); };
    }
    /* One object per serial header: Bluetooth blocks and UART blocks on the same port make
     * `bluetooth_N = Bluetooth(N)` and `uart_N = UART(N, ...)`, and the program stops at the start with
     * OSError("serial port N is used by a ..."). Said in the editor, on every serial block of the clash
     * (review 2026-09-28), rather than only in the set-up block's tooltip. */
    const SERIAL_TYPES = Object.keys(Blockly.Blocks).filter((t) => /^evn_(bluetooth|uart)_/.test(t));
    /** the warning for a serial block whose port also has blocks of the other kind, else null */
    function serialClash(block) {
        if (!block.workspace || block.isInFlyout) { return null; }
        const port = block.getFieldValue('PORT');
        const other = block.type.startsWith('evn_bluetooth_') ? 'evn_uart_' : 'evn_bluetooth_';
        const clash = block.workspace.getAllBlocks(false).some((b) => b.type.startsWith(other) && b.getFieldValue('PORT') === port);
        return clash ? 'Serial port ' + port + ' has Bluetooth blocks and UART blocks: a port is one or the ' +
            'other, so the program would stop at the start. Put the Bluetooth module and the UART on different serial ports.' : null;
    }
    for (const t of SERIAL_TYPES) {
        Blockly.Blocks[t].onchange = function () {
            if (this.isInFlyout || !this.workspace || this.workspace.isDragging && this.workspace.isDragging()) { return; }
            this.setWarningText(serialClash(this));
        };
    }
    const isSetup = (b) => SETUP_TYPES.indexOf(b.type) >= 0;
    /** 'setup' | 'program' | null (a comment, which belongs to either) */
    const kindOf = (b) => (b.type === SETUP_HAT || isSetup(b)) ? 'setup' : b.type === COMMENT ? null : 'program';
    /** false when a connection would mix set-up blocks and program blocks in one stack */
    let loadingDepth = 0;           // loadWorkspace(): a file is read as written, then repaired
    function sectionOk(a, b) {
        if (loadingDepth > 0) { return true; }
        const PREV = Blockly.ConnectionType.PREVIOUS_STATEMENT;
        const child = a.type === PREV ? a : b.type === PREV ? b : null;
        if (!child) { return true; }                       // value / output connections: not ours
        const parent = (child === a ? b : a).getSourceBlock();
        const below = new Set(child.getSourceBlock().getDescendants(false).map(kindOf).filter(Boolean));
        const above = new Set();
        for (let x = parent; x; x = x.getParent()) { const k = kindOf(x); if (k) { above.add(k); } }
        return !((below.has('setup') && above.has('program')) || (below.has('program') && above.has('setup')));
    }
    class EvnConnectionChecker extends Blockly.ConnectionChecker {
        doTypeChecks(a, b) { return super.doTypeChecks(a, b) && sectionOk(a, b); }
    }
    const CONNECTION_CHECKER = 'evn_sections';
    Blockly.registry.register(Blockly.registry.Type.CONNECTION_CHECKER, CONNECTION_CHECKER, EvnConnectionChecker, true);
    const ORPHAN = 'EVN_NOT_IN_PROGRAM';

    const hasOwnReason = (b) => [...b.getDisabledReasons()].some((r) => r !== ORPHAN);
    const HATS = [SETUP_HAT, PROGRAM_HAT];

    /** Switch off every stack attached to neither hat (and back on once it is), and the stack of a hat
     * the user disabled (Blockly would still generate the blocks after a disabled first block). Idempotent. */
    function applySections(workspace) {
        for (const root of workspace.getTopBlocks(false)) {
            const all = root.getDescendants(false);
            const live = (HATS.indexOf(root.type) >= 0 && !hasOwnReason(root)) || STANDALONE_ROOTS.indexOf(root.type) >= 0
                || all.every((b) => b.type === COMMENT);
            for (const b of all) {
                if (b.isShadow()) { continue; }
                if (b.hasDisabledReason(ORPHAN) === live) { b.setDisabledReason(!live, ORPHAN); }
            }
        }
    }

    /** A file that breaks the rules (hand-edited, merged, or from a build with other rules) is loaded as
     * written and put right here, never refused: refusing lost every block after the first bad one, and the
     * next edit saved that.
     *
     * The rule the checker keeps, as a property of the whole workspace: on no path from a top block down
     * through its next blocks and statement inputs do set-up and program blocks meet (comments belong to
     * neither). A path takes the kind of its first block that has one: "set up" is set-up, "program", a
     * function definition or any other block is program. A stack that breaks it cannot be rebuilt through
     * the checker, which paste, duplicate and undo all do, so it would lose blocks later.
     *
     * Repair: one hat of each kind stays (a second one is removed, its stack comes loose); then every
     * run of consecutive wrong-kind blocks (with the comments among them) is cut out as a stack of its
     * own, and the blocks after it close the gap, so nothing that was right moves. Runs while the load is
     * still permissive, so closing a gap is never refused half-way. Returns notes for the user. */
    function repairSections(workspace) {
        const notes = [];
        for (const type of HATS) {
            for (const extra of workspace.getBlocksByType(type, false).slice(1)) {
                const next = extra.getNextBlock();
                if (next) { next.unplug(false); }
                extra.setDeletable(true);
                extra.dispose(false);
                notes.push(`a second "${type === SETUP_HAT ? 'set up' : 'program'}" block was removed; its blocks are loose`);
            }
        }
        /** the first block below whose kind differs from its path's, or null */
        const findConflict = () => {
            const walk = (b, pathKind) => {
                if (b.isShadow()) { return null; }
                const k = kindOf(b);
                if (k && pathKind && k !== pathKind) { return b; }
                const kind = pathKind || k;
                for (const child of b.getChildren(true)) {
                    const hit = walk(child, kind);
                    if (hit) { return hit; }
                }
                return null;
            };
            for (const root of workspace.getTopBlocks(true)) {
                const hit = walk(root, null);
                if (hit) { return hit; }
            }
            return null;
        };
        let cuts = 0;
        const moved = {};
        const limit = workspace.getAllBlocks(false).length;
        for (let bad = findConflict(); bad; bad = findConflict()) {
            const kind = kindOf(bad);
            const gap = bad.previousConnection && bad.previousConnection.targetConnection;
            if (!gap) {                                    // no statement to cut (a value input): take the block out
                bad.unplug(false);
            } else {
                // the run: the wrong-kind blocks in a row, and comments between them; a comment after the run stays
                // (it describes the block below it)
                let last = bad;
                for (;;) {
                    let x = last.getNextBlock();
                    while (x && kindOf(x) === null) { x = x.getNextBlock(); }
                    if (!x || kindOf(x) !== kind) { break; }
                    last = x;
                }
                const after = last.getNextBlock();
                if (after) { after.previousConnection.disconnect(); }
                bad.previousConnection.disconnect();
                if (after) { gap.connect(after.previousConnection); }
            }
            // beside the stack it came from, at its own height, a little further right for each cut
            const root = gap ? gap.getSourceBlock().getRootBlock() : bad;
            const r = root.getRelativeToSurfaceXY(), me = bad.getRelativeToSurfaceXY();
            const w = (root.getHeightWidth && root.getHeightWidth().width) || 520;
            bad.moveBy(r.x + w + 60 + 24 * cuts - me.x, 0);
            cuts++;
            moved[kind] = (moved[kind] || 0) + 1;
            // every cut removes at least one conflict, so this is only reached if that stops being true: then the
            // workspace is not the file put right, and the load fails (the editor shows it read-only, never saves it)
            if (cuts > limit) { throw new Error('the blocks in the wrong part could not all be moved out'); }
        }
        if (moved.setup) { notes.push(`${moved.setup} group(s) of set-up blocks were among program blocks and are now loose`); }
        if (moved.program) { notes.push(`${moved.program} group(s) of blocks that are not set-up blocks were under "set up" and are now loose`); }
        return notes;
    }

    /** Give a workspace its two hats. `legacy` (a version-1 file: no hats, every top block ran, top to
     * bottom then left to right) also stacks its set-ups under "set up" and chains its stacks under
     * "program" in that order, so it generates the same program; anything that cannot be placed that
     * way is left loose and named in the returned notes. A file of a later version only gets a missing
     * hat, empty: its loose stacks were loose on purpose. */
    function upgradeWorkspace(workspace, legacy) {
        const notes = [];
        let setupHat = workspace.getBlocksByType(SETUP_HAT, false)[0];
        let programHat = workspace.getBlocksByType(PROGRAM_HAT, false)[0];
        if (setupHat && programHat) { return notes; }
        const tops = workspace.getTopBlocks(true);        // top to bottom, then left to right: the version-1 run order
        const box = tops.reduce((r, b) => {
            const xy = b.getRelativeToSurfaceXY();
            return { x: Math.min(r.x, xy.x), y: Math.min(r.y, xy.y) };
        }, { x: tops.length ? Infinity : 20, y: tops.length ? Infinity : 20 });
        const make = (type) => {
            const b = workspace.newBlock(type);
            if (b.initSvg) { b.initSvg(); b.render(); }
            return b;
        };
        const size = (b) => (b.getHeightWidth && b.getHeightWidth().height ? b.getHeightWidth()
            : { height: 50 * b.getDescendants(false).length, width: 520 });     // headless: an estimate
        const chainUnder = (hat, blocks) => {
            let tail = hat;
            const left = [];
            for (const b of blocks) {
                while (tail.getNextBlock()) { tail = tail.getNextBlock(); }
                if (!tail.nextConnection) { left.push(b); continue; }
                tail.nextConnection.connect(b.previousConnection);
            }
            // after a "forever": nothing ran there in version 1 either, unless the loop had a "break"
            const LOOPS = ['evn_forever', 'controls_repeat_ext', 'controls_repeat', 'controls_whileUntil', 'controls_for', 'controls_forEach'];
            const ownLoop = (d) => { let x = d.getSurroundParent(); while (x && LOOPS.indexOf(x.type) < 0) { x = x.getSurroundParent(); } return x; };
            if (left.length && tail.getDescendants(false).some((d) => d.type === 'controls_flow_statements' && d.getFieldValue('FLOW') === 'BREAK'
                && ownLoop(d) === tail)) {
                notes.push(`${left.length} stack(s) that ran after "${tail.type}" ended with a break could not be joined to the program (nothing can follow that block); they are loose`);
            }
        };
        if (!setupHat) {
            setupHat = make(SETUP_HAT);
            setupHat.moveBy(box.x, box.y - 60);
            if (legacy) { chainUnder(setupHat, tops.filter(isSetup)); }
        }
        if (!programHat) {
            programHat = make(PROGRAM_HAT);
            programHat.moveBy(box.x, setupHat.getRelativeToSurfaceXY().y + size(setupHat).height + 60);
            if (legacy) {
                // a stack whose first block the user disabled is chained too: version 1 skipped only that block
                chainUnder(programHat, tops.filter((b) => b.previousConnection && !isSetup(b) && kindOf(b) !== null));
                const values = tops.filter((b) => b.outputConnection).length;
                if (values) { notes.push(`${values} loose value block(s) no longer run on their own (a value has to go into a block)`); }
            }
        }
        if (legacy) {
            // what stayed loose moves to the right of the two stacks instead of under them
            const right = Math.max(...[setupHat, programHat].map((h) => h.getRelativeToSurfaceXY().x + size(h).width)) + 60;
            for (const b of workspace.getTopBlocks(false)) {
                if (HATS.indexOf(b.type) < 0 && b.getRelativeToSurfaceXY().x < right) { b.moveBy(right - b.getRelativeToSurfaceXY().x, 0); }
            }
        }
        return notes;
    }

    /** Load a saved workspace state the way the editor does: as written, then repaired, given its hats
     * (a version-1 file upgraded), then its sections applied. Returns notes for the user (empty: nothing to say). */
    function loadWorkspace(state, workspace, version) {
        let notes;
        loadingDepth++;
        loadRefusals.length = 0;
        try {
            if (state && typeof state === 'object') { Blockly.serialization.workspaces.load(state, workspace); }
            notes = repairSections(workspace);
        } finally { loadingDepth--; }
        if (loadRefusals.length) {
            notes.push(`${loadRefusals.length} I2C field(s) held a value the block refuses (${loadRefusals.join(', ')}; 0x70 and 0x6A on port 16 `
                + 'are the board\'s own devices): each kept the block\'s default, so check those blocks before running the program');
            loadRefusals.length = 0;
        }
        notes = notes.concat(upgradeWorkspace(workspace, !(Number(version) >= 2)));
        applySections(workspace);
        separateStacks(workspace);
        return notes;
    }

    /* A file keeps the x/y it was saved with, but a stack's height depends on the renderer and the
     * fonts: the program hat of a file written by hand (or by another version) can land on top of
     * the set-up stack. Drawn stacks that really overlap are pushed down, top to bottom, to GAP
     * below what they hit; stacks that only sit close are left where the user put them. It runs
     * silently, so opening a file does not mark it changed. Blockly.Events.disable/enable is a
     * counter (the editor's load() already holds one): one disable, one enable, always paired -
     * skipping the enable when events were already off left them off for good (no edits saved). */
    function separateStacks(workspace) {
        if (!workspace.rendered || !workspace.getTopBlocks) { return; }
        const GAP = 24;
        if (Blockly.renderManagement && Blockly.renderManagement.triggerQueuedRenders) { Blockly.renderManagement.triggerQueuedRenders(workspace); }
        const tops = workspace.getTopBlocks(false).filter((b) => b.getBoundingRectangle);
        tops.sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);
        Blockly.Events.disable();
        try {
            for (let i = 1; i < tops.length; i++) {
                for (let pass = 0; pass < tops.length; pass++) {
                    const r = tops[i].getBoundingRectangle();
                    const hit = tops.slice(0, i).map((t) => t.getBoundingRectangle())
                        .find((o) => r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom);
                    if (!hit) { break; }
                    tops[i].moveBy(0, hit.bottom + GAP - r.top);
                }
            }
        } finally { Blockly.Events.enable(); }
    }

    /* ---- generator helpers --------------------------------------------------------------- */

    /* The names of the `evn` module a program can use. CORE_NAMES are what a hand-written Python
     * block always gets; a peripheral class is imported only when a block (or a Python block that
     * spells it out) needs it, so the import line stays short. */
    const CORE_NAMES = ['Motor', 'Port', 'Stop', 'Direction', 'SpeedUnit', 'wait', 'StopWatch', 'battery', 'button', 'led', 'stop_all'];
    /* Everything else the module offers. A name is imported when a block needs it or when a Python
     * block spells it out - which is why the list has to hold the classes that have no block of
     * their own as well (Flash, reset / bootloader, the calibration functions: a Python block is the
     * only way a blocks user reaches them).
     * CORE_NAMES + DEVICE_NAMES must cover every public name of micropython/modules/evn_module.c:
     * scripts/test_blocks.js and tools/check.py compare the two (B-036: `autostart` was missing, so
     * a Python block spelling `autostart(True)` raised NameError on the board). */
    const DEVICE_NAMES = ['Color', 'Icon', 'Side', 'ColorSensor', 'DistanceSensor', 'GestureSensor', 'EnvSensor',
        'Compass', 'TouchArray', 'IMU', 'ADC', 'Display', 'MatrixLED', 'SevenSegmentLED', 'RGBLED', 'Servo', 'Bluetooth',
        'HiTechnicColorSensor', 'HiTechnicCompass', 'HuskyLens', 'VL53L1X', 'TCS3430',
        'DriveBase', 'Pose', 'DataLog', 'UART', 'I2C', 'Flash', 'reset', 'reset_cause', 'bootloader', 'autostart', 'core1_status', 'version',
        'configure_motor', 'motor_config', 'calibration', 'clear_calibration', 'imu_calibration', 'compass_calibration', 'color_calibration',
        'vl53l1x_calibration', 'clock'];
    const EVN_NAMES = CORE_NAMES.concat(DEVICE_NAMES);

    /* class -> [variable prefix, "set up" block type]. One object per port, named after the port
     * (`color_sensor_3 = ColorSensor(3)`), created once at the top of the program like the motors. */
    const DEVICES = {
        ColorSensor: ['color_sensor', 'evn_colorsensor_setup'],
        DistanceSensor: ['distance_sensor', 'evn_distance_setup'],
        GestureSensor: ['gesture_sensor', 'evn_gesture_setup'],
        EnvSensor: ['env_sensor', 'evn_env_setup'],
        Compass: ['compass', 'evn_compass_setup'],
        TouchArray: ['touch', 'evn_touch_setup'],
        IMU: ['imu', 'evn_imu_setup'],
        ADC: ['adc', 'evn_adc_setup'],
        Display: ['display', 'evn_display_setup'],
        MatrixLED: ['matrix', 'evn_matrix_setup'],
        SevenSegmentLED: ['seven_segment', 'evn_seven_setup'],
        RGBLED: ['rgb', 'evn_rgb_setup'],
        Servo: ['servo', 'evn_servo_setup'],
        Bluetooth: ['bluetooth', 'evn_bluetooth_setup'],
        HiTechnicColorSensor: ['ht_color', 'evn_htcolor_setup'],
        HiTechnicCompass: ['ht_compass', 'evn_htcompass_setup'],
        HuskyLens: ['huskylens', 'evn_huskylens_setup'],
        VL53L1X: ['vl53l1x', 'evn_vl53l1x_setup'],
        TCS3430: ['tcs3430', 'evn_tcs3430_setup'],
        UART: ['uart', 'evn_uart_setup'],
        I2C: ['i2c', 'evn_i2c_setup'],
    };

    /* The generated object names themselves, not just their prefixes: a user variable called
     * `imu_1` used to overwrite the `imu_1 = IMU(1)` the generator had just made, and the program
     * then failed at `imu_1.heading()` with an AttributeError. `motor_1..4` were reserved and got
     * renamed by Blockly, which is exactly what made the gap invisible. Servo and RGBLED only use
     * ports 1..4, but reserving 1..16 for them costs nothing. */
    const OBJECT_NAMES = [];
    for (const cls of Object.keys(DEVICES)) {
        for (let p = 1; p <= 16; p++) { OBJECT_NAMES.push(DEVICES[cls][0] + '_' + p); }
    }
    // `file` is the name the "file ... the line" block writes through (`with open(...) as file:`); `os` and
    // `struct` are the modules the file and I2C blocks import
    generator.addReservedWords('evn,motor_1,motor_2,motor_3,motor_4,stopwatch,drive_base,pose,data_log,file,os,struct,json,' +
        Object.keys(DEVICES).map((cls) => DEVICES[cls][0]).join(',') + ',' +
        OBJECT_NAMES.join(',') + ',' + EVN_NAMES.join(','));

    generator.INDENT = '    ';

    const baseInit = generator.init;
    generator.init = function (workspace) {
        baseInit.call(this, workspace);
        this.evnNames_ = new Set();
    };

    // Gather the per-port Motor definitions into one block so they come out as consecutive lines,
    // in port order, instead of separated by blank lines; the peripherals are grouped the same way.
    const baseFinish = generator.finish;
    generator.finish = function (code) {
        const group = (test, into, sort) => {
            const keys = Object.keys(this.definitions_).filter(test).sort(sort);
            if (!keys.length) { return; }
            const lines = keys.map((k) => this.definitions_[k]);
            keys.forEach((k) => { delete this.definitions_[k]; });
            this.definitions_[into] = lines.join('\n');
        };
        group((k) => /^motor_[1-4]$/.test(k), 'motors');
        // dev_<prefix>_<port>: by class, then by port as a number (so port 2 comes before port 10).
        group((k) => k.startsWith('dev_'), 'devices', (a, b) => {
            const pa = a.match(/^dev_(.*)_(\d+)$/);
            const pb = b.match(/^dev_(.*)_(\d+)$/);
            return pa[1] === pb[1] ? Number(pa[2]) - Number(pb[2]) : (pa[1] < pb[1] ? -1 : 1);
        });
        // Pybricks' generated code opens with the device lines, under this comment, before anything else
        // the program defines (variables, functions); so does ours. The stopwatch is set up there too.
        // In this order: the pose names the IMU's and the compass's ports (their objects must exist, so it
        // comes after the devices), the drive base is built from two motor objects and adopts the pose
        // (pose=pose), and the data log is made after the devices it will record.
        const SETUP_KEYS = ['motors', 'devices', 'pose', 'drive_base', 'data_log', 'stopwatch'].filter((k) => this.definitions_[k]);
        if (SETUP_KEYS.length) {
            const old = this.definitions_;
            const imports = Object.keys(old).filter((k) => /^(from\s+\S+\s+)?import\s+\S+/.test(old[k]));
            const rest = Object.keys(old).filter((k) => imports.indexOf(k) < 0 && SETUP_KEYS.indexOf(k) < 0);
            this.definitions_ = Object.create(null);
            for (const k of imports.concat(SETUP_KEYS, rest)) { this.definitions_[k] = old[k]; }
            this.definitions_[SETUP_KEYS[0]] = '# Set up all devices.\n' + this.definitions_[SETUP_KEYS[0]];
        }
        return baseFinish.call(this, code);
    };

    /** Record that `name` from the evn module is used; the import line lists exactly the names used. */
    function use(name) {
        generator.evnNames_.add(name);
        const names = EVN_NAMES.filter((n) => generator.evnNames_.has(n));
        generator.definitions_['import_evn'] = 'from evn import ' + names.join(', ');
    }

    /** Name of the Motor object for a port, defining it (once) from the port's "set up motor" block. */
    function motorRef(block, portOverride) {
        const port = portOverride || block.getFieldValue('PORT');
        const name = 'motor_' + port;
        if (!generator.definitions_[name]) {
            const args = [port];
            const setup = block.workspace.getBlocksByType('evn_motor_setup', false)
                .find((b) => b.isEnabled() && b.getFieldValue('PORT') === port);
            if (setup) {
                if (setup.getFieldValue('DIRECTION') === 'CCW') { use('Direction'); args.push('positive_direction=Direction.COUNTERCLOCKWISE'); }
                if (setup.getFieldValue('UNIT') === 'PERCENT') { use('SpeedUnit'); args.push('speed_unit=SpeedUnit.PERCENT'); }
            }
            use('Motor');
            generator.definitions_[name] = name + ' = Motor(' + args.join(', ') + ')';
        }
        return name;
    }

    /** Name of the peripheral object for a port, defining it (once) from the port's "set up" block. */
    function deviceRef(block, cls, portOverride) {
        const port = portOverride || block.getFieldValue('PORT');
        const name = DEVICES[cls][0] + '_' + port;
        const key = 'dev_' + name;
        if (!generator.definitions_[key]) {
            use(cls);
            const setup = block.workspace.getBlocksByType(DEVICES[cls][1], false)
                .find((b) => b.isEnabled() && b.getFieldValue('PORT') === port);
            const args = [port];
            let after = '';
            if (cls === 'RGBLED') {                          // RGBLED(port, count)
                args.push(String(setup ? Math.round(Number(setup.getFieldValue('COUNT'))) : 8));
            }
            if (cls === 'Servo' && setup && setup.getFieldValue('PROFILE') !== 'geekservo_270') {
                args.push(generator.quote_(setup.getFieldValue('PROFILE')));
            }
            if (cls === 'UART') {
                // UART(port, baudrate): the speed always written out (machine.UART's default is not 115200 on
                // every port), positional as the binding takes it; the set-up's, or the port's own 115200
                const baud = setup ? String(setup.getFieldValue('BAUD')) : '115200';
                args.push(/^\d+$/.test(baud) ? baud : '115200');
            }
            if (cls === 'IMU' && setup && setup.getFieldValue('CALIBRATE') === 'TRUE') {   // IMU(port, calibrate=True)
                args.push('calibrate=True');
            }
            if (cls === 'Display' && setup && setup.getFieldValue('MIRROR') === 'TRUE') {
                after = '\n' + name + '.mirror(True)';
            }
            if (cls === 'ADC') {
                // The driver scans AIN0 only by default (hal_ads1115.c: cfg->inputs = 0x01), so
                // `voltage(1)` raises ValueError("input 1 is not enabled: see inputs()") - and the
                // block user has no block for inputs(). The setup block therefore enables all four;
                // the cost is three more conversions per cycle (~3.5 ms at 860 SPS).
                after = '\n' + name + '.inputs((0, 1, 2, 3))';
            }
            generator.definitions_[key] = name + ' = ' + cls + '(' + args.join(', ') + ')' + after;
        }
        return name;
    }

    function value(block, input, fallback) {
        return generator.valueToCode(block, input, Order.NONE) || fallback;
    }

    /** Name of the robot's DriveBase object, defining it (once) from the "set up robot" block; without
     * one the robot is left motor 1, right motor 2, 56 mm wheels 112 mm apart (the Pybricks example). */
    function driveRef(block) {
        const name = 'drive_base';
        if (!generator.definitions_[name]) {
            const g = driveGeometry(block);
            const l = motorRef(block, g.left), r = motorRef(block, g.right);
            use('DriveBase');
            // A pose block anywhere in the program: the program's `pose` (poseRef) is built from this same
            // geometry and the motors' directions, and the base adopts it (pose=pose; the firmware checks
            // that the ports, directions, gears, wheel and track agree), so the pose the blocks read is the
            // one the robot follows. Otherwise a "robot follows its gyro" block makes the base build its own
            // Pose (firmware 0.2.38): the set-up line carries the IMU's port. The IMU object has to exist
            // first (DriveBase raises OSError otherwise): finish() puts the drive_base line after the devices.
            let source = '';
            if (usesPose(block.workspace)) {
                source = ', pose=' + poseRef(block);
            } else {
                const imuPort = gyroImuPort(block);
                if (imuPort) { deviceRef(block, 'IMU', imuPort); source = ', imu=' + imuPort; }
            }
            generator.definitions_[name] = name + ' = DriveBase(' + l + ', ' + r + ', wheel_diameter=' + g.wheel + ', axle_track=' + g.track
                + source + ')';
        }
        return name;
    }

    /* ---- the pose (evn.Pose) ----------------------------------------------------------------------- */

    const POSE_TYPES = ['evn_pose_setup', 'evn_pose_value', 'evn_pose_uncertainty', 'evn_pose_uses', 'evn_pose_reset'];
    /** True when a pose block runs in this program (enabled, attached, not inside a switched-off block). */
    function usesPose(workspace) {
        return workspace.getAllBlocks(false).some((b) => POSE_TYPES.indexOf(b.type) >= 0 && b.isEnabled() && !b.getInheritedDisabled());
    }
    /** True when the "set up motor" block of this port makes counterclockwise its positive direction: the same
     * block motorRef() builds the Motor from (the first enabled one of the port), so the Pose's reverse_* and
     * the Motor's positive_direction always agree (the firmware refuses a DriveBase whose pose disagrees). */
    function motorReversed(block, port) {
        const setup = block.workspace.getBlocksByType('evn_motor_setup', false)
            .find((b) => b.isEnabled() && b.getFieldValue('PORT') === port);
        return !!setup && setup.getFieldValue('DIRECTION') === 'CCW';
    }
    /** The compass port of the first enabled "set up pose" block, or ''. */
    function poseCompassPort(block) {
        const setup = block.workspace.getBlocksByType('evn_pose_setup', false).find((b) => b.isEnabled());
        return setup ? setup.getFieldValue('PORT') : '';
    }
    /** Name of the program's Pose, defining it (once): the robot's wheels from the "set up robot" geometry (or
     * the default robot) with the mirrored motor's reverse_*, the IMU of "robot follows its gyro" and the
     * compass of "set up pose". The IMU and Compass objects are made first (the Pose raises OSError without). */
    function poseRef(block) {
        const name = 'pose';
        if (!generator.definitions_[name]) {
            use('Pose');
            const g = driveGeometry(block);
            const args = [g.left, g.right, 'wheel_diameter=' + g.wheel, 'axle_track=' + g.track];
            if (motorReversed(block, g.left)) { args.push('reverse_left=True'); }
            if (motorReversed(block, g.right)) { args.push('reverse_right=True'); }
            const imuPort = gyroImuPort(block);
            if (imuPort) { deviceRef(block, 'IMU', imuPort); args.push('imu=' + imuPort); }
            const compassPort = poseCompassPort(block);
            if (compassPort) { deviceRef(block, 'Compass', compassPort); args.push('compass=' + compassPort); }
            generator.definitions_[name] = name + ' = Pose(' + args.join(', ') + ')';
        }
        return name;
    }

    /** The IMU port of the first enabled "robot follows its gyro" block that switches the loop ON, or '' when
     * the program has none: that is the port the drive base builds its Pose on. */
    function gyroImuPort(block) {
        const gyro = block.workspace.getBlocksByType('evn_drivebase_gyro', false)
            .find((b) => b.isEnabled() && b.getFieldValue('ON') === 'True');
        return gyro ? gyro.getFieldValue('PORT') : '';
    }

    /** The robot's ports and geometry from the "set up robot" block (or the Pybricks example's defaults). */
    function driveGeometry(block) {
        const setup = block.workspace.getBlocksByType('evn_drivebase_setup', false).find((b) => b.isEnabled());
        return {
            left: setup ? setup.getFieldValue('LEFT') : '1',
            right: setup ? setup.getFieldValue('RIGHT') : '2',
            wheel: setup ? Number(setup.getFieldValue('WHEEL')) : 56,
            track: setup ? Number(setup.getFieldValue('TRACK')) : 112,
        };
    }

    /** The `then=` / `wait=` keyword arguments of a profiled move, omitted at their defaults. */
    function moveTail(block, defaultThen) {
        const then = block.getFieldValue('THEN');
        const wait = block.getFieldValue('WAIT') === 'TRUE';
        let s = '';
        if (then !== defaultThen) { use('Stop'); s += ', then=Stop.' + then; }
        if (!wait) { s += ', wait=False'; }
        return s;
    }

    /* ---- generators ---------------------------------------------------------------------- */

    /* the two sections. "set up" makes nothing itself (each set-up block defines its object at the
     * top); "program" heads the main program with the comment Pybricks' own generated code carries */
    generator.forBlock[SETUP_HAT] = function () { return ''; };
    generator.forBlock[PROGRAM_HAT] = function (block) {
        return block.getNextBlock() ? '# The main program starts here.\n' : '';
    };
    generator.forBlock[COMMENT] = function (block) {
        const text = String(block.getFieldValue('TEXT') || '').replace(/[\r\n]+/g, ' ').trim();
        return text ? '# ' + text + '\n' : '';
    };
    generator.forBlock['evn_motor_setup'] = function (block) {
        motorRef(block);            // the definition is all the setup does
        return '';
    };
    generator.forBlock['evn_motor_run'] = function (block) {
        return motorRef(block) + '.run(' + value(block, 'SPEED', '0') + ')\n';
    };
    generator.forBlock['evn_motor_run_angle'] = function (block) {
        return motorRef(block) + '.run_angle(' + value(block, 'SPEED', '500') + ', ' + value(block, 'ANGLE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_motor_run_target'] = function (block) {
        return motorRef(block) + '.run_target(' + value(block, 'SPEED', '500') + ', ' + value(block, 'ANGLE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_motor_run_time'] = function (block) {
        return motorRef(block) + '.run_time(' + value(block, 'SPEED', '500') + ', ' + value(block, 'TIME', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_motor_run_until_stalled'] = function (block) {
        const m = motorRef(block);
        const then = block.getFieldValue('THEN');
        const duty = generator.valueToCode(block, 'DUTY', Order.NONE);
        let s = m + '.run_until_stalled(' + value(block, 'SPEED', '200');
        if (then !== 'COAST') { use('Stop'); s += ', then=Stop.' + then; }
        if (duty) { s += ', duty_limit=' + duty; }
        return s + ')\n';
    };
    generator.forBlock['evn_motor_stop'] = function (block) {
        return motorRef(block) + '.' + block.getFieldValue('ACTION') + '()\n';
    };
    generator.forBlock['evn_motor_wait_done'] = function (block) {
        use('wait');
        return 'while not ' + motorRef(block) + '.done():\n' + generator.INDENT + 'wait(10)\n';
    };
    generator.forBlock['evn_motor_reset_angle'] = function (block) {
        const angle = generator.valueToCode(block, 'ANGLE', Order.NONE);
        return motorRef(block) + '.reset_angle(' + (angle && angle !== '0' ? angle : '') + ')\n';
    };
    generator.forBlock['evn_drivebase_setup'] = function (block) {
        driveRef(block);            // the definition is all the setup does
        return '';
    };
    generator.forBlock['evn_drivebase_gyro'] = function (block) {
        const db = driveRef(block);   // the set-up line carries this block's IMU port (gyroImuPort)
        if (block.getFieldValue('ON') === 'False') { return db + '.use_gyro(False)\n'; }
        return db + '.use_gyro(True)\n';
    };
    generator.forBlock['evn_drivebase_straight'] = function (block) {
        return driveRef(block) + '.straight(' + value(block, 'DISTANCE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_drivebase_turn'] = function (block) {
        return driveRef(block) + '.turn(' + value(block, 'ANGLE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_drivebase_arc'] = function (block) {
        const by = block.getFieldValue('UNIT') === 'distance' ? 'distance' : 'angle';
        return driveRef(block) + '.arc(' + value(block, 'RADIUS', '100') + ', ' + by + '=' + value(block, 'ANGLE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_drivebase_drive'] = function (block) {
        return driveRef(block) + '.drive(' + value(block, 'SPEED', '0') + ', ' + value(block, 'TURN', '0') + ')\n';
    };
    generator.forBlock['evn_drivebase_stop'] = function (block) {
        return driveRef(block) + '.' + block.getFieldValue('ACTION') + '()\n';
    };
    generator.forBlock['evn_drivebase_speeds'] = function (block) {
        return driveRef(block) + '.settings(straight_speed=' + value(block, 'SPEED', '300') + ', turn_rate=' + value(block, 'TURN', '150') + ')\n';
    };
    generator.forBlock['evn_drivebase_reset'] = function (block) {
        return driveRef(block) + '.reset()\n';
    };
    generator.forBlock['evn_drivebase_measure'] = function (block) {
        return [driveRef(block) + '.' + block.getFieldValue('WHAT') + '()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_drivebase_is'] = function (block) {
        return [driveRef(block) + '.' + block.getFieldValue('WHAT') + '()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_stop_all'] = function () {
        use('stop_all');
        return 'stop_all()\n';
    };
    generator.forBlock['evn_motor_measure'] = function (block) {
        return [motorRef(block) + '.' + block.getFieldValue('WHAT') + '()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_motor_is'] = function (block) {
        return [motorRef(block) + '.' + block.getFieldValue('WHAT') + '()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_wait'] = function (block) {
        use('wait');
        return 'wait(' + value(block, 'TIME', '0') + ')\n';
    };
    generator.forBlock['evn_wait_until'] = function (block) {
        use('wait');
        const cond = generator.valueToCode(block, 'COND', Order.LOGICAL_NOT) || 'False';
        return 'while not ' + cond + ':\n' + generator.INDENT + 'wait(10)\n';
    };
    generator.forBlock['evn_wait_forever'] = function () {
        use('wait');
        return 'while True:\n' + generator.INDENT + 'wait(1000)\n';
    };
    generator.forBlock['evn_forever'] = function (block) {
        const body = generator.statementToCode(block, 'DO') || generator.PASS;
        return 'while True:\n' + body;
    };
    generator.forBlock['evn_stopwatch_time'] = function () {
        use('StopWatch');
        generator.definitions_['stopwatch'] = 'stopwatch = StopWatch()';
        return ['stopwatch.time()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_stopwatch_reset'] = function (block) {
        use('StopWatch');
        generator.definitions_['stopwatch'] = 'stopwatch = StopWatch()';
        const action = ['pause', 'resume'].indexOf(block.getFieldValue('ACTION')) >= 0 ? block.getFieldValue('ACTION') : 'reset';
        return 'stopwatch.' + action + '()\n';
    };
    /** Name of the program's DataLog, defining it (once) from the "set up data log" block. Its columns are the
     * headers of "add row"; with none but an "add row" block in the program, one column called "value". */
    function datalogRef(block) {
        const name = 'data_log';
        if (!generator.definitions_[name]) {
            use('DataLog');
            const setup = block.workspace.getBlocksByType('evn_datalog_setup', false).find((b) => b.isEnabled());
            const args = datalogColumns(block).map((c) => generator.quote_(c));
            const logName = setup ? String(setup.getFieldValue('NAME') || '').trim() : '';
            if (logName && logName !== 'log') { args.push('name=' + generator.quote_(logName)); }
            generator.definitions_[name] = name + ' = DataLog(' + args.join(', ') + ')';
        }
        return name;
    }
    /** The columns of "set up data log" (comma separated), or ['value'] when it names none and a row is added. */
    function datalogColumns(block) {
        const setup = block.workspace.getBlocksByType('evn_datalog_setup', false).find((b) => b.isEnabled());
        const cols = setup ? String(setup.getFieldValue('COLUMNS') || '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 8) : [];
        if (!cols.length && block.workspace.getBlocksByType('evn_datalog_row', false).some((b) => b.isEnabled())) { return ['value']; }
        return cols;
    }
    /** `, rate` unless the rate is 0 (every new reading, the default). */
    function datalogRate(block) {
        const rate = generator.valueToCode(block, 'RATE', Order.NONE);
        return rate && rate !== '0' ? ', ' + rate : '';
    }
    generator.forBlock['evn_datalog_setup'] = function (block) {
        datalogRef(block);          // the definition is all the setup does
        return '';
    };
    generator.forBlock['evn_datalog_add_motor'] = function (block) {
        const log = datalogRef(block);
        return log + '.add(' + motorRef(block) + ', ' + generator.quote_(block.getFieldValue('WHAT')) + datalogRate(block) + ')\n';
    };
    generator.forBlock['evn_datalog_add'] = function (block) {
        const log = datalogRef(block);
        const src = block.getFieldValue('SOURCE');
        let obj;
        if (src === 'battery' || src === 'button') { use(src); obj = src; } else { obj = deviceRef(block, src); }
        const quantity = String(block.getFieldValue('QUANTITY') || '').trim() || 'heading';
        return log + '.add(' + obj + ', ' + generator.quote_(quantity) + datalogRate(block) + ')\n';
    };
    generator.forBlock['evn_datalog_run'] = function (block) {
        return datalogRef(block) + '.' + (block.getFieldValue('ACTION') === 'stop' ? 'stop' : 'start') + '()\n';
    };
    generator.forBlock['evn_datalog_row'] = function (block) {
        const log = datalogRef(block);
        const n = Math.max(1, datalogColumns(block).length);
        const values = [];
        for (let i = 0; i < n; i++) {
            values.push(i < 3 ? (generator.valueToCode(block, 'ABC'[i], Order.NONE) || 'None') : 'None');
        }
        return log + '.log(' + values.join(', ') + ')\n';
    };
    generator.forBlock['evn_datalog_save'] = function (block) {
        return datalogRef(block) + '.save()\n';
    };
    generator.forBlock['evn_drivebase_accel'] = function (block) {
        return driveRef(block) + '.settings(straight_acceleration=' + value(block, 'ACCEL', '500') + ', turn_acceleration=' + value(block, 'TURN', '500') + ')\n';
    };
    generator.forBlock['evn_led_set'] = function (block) {
        use('led');
        return 'led.set(' + (generator.valueToCode(block, 'ON', Order.NONE) || 'False') + ')\n';
    };
    generator.forBlock['evn_led'] = function (block) {
        use('led');
        return 'led.' + block.getFieldValue('ACTION') + '()\n';
    };
    generator.forBlock['evn_button_pressed'] = function () {
        use('button');
        return ['button.pressed()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_wait_for_button'] = function () {
        use('button'); use('wait');
        return 'while not button.pressed():\n' + generator.INDENT + 'wait(10)\n' +
            'while button.pressed():\n' + generator.INDENT + 'wait(10)\n';
    };
    generator.forBlock['evn_battery_voltage'] = function () {
        use('battery');
        return ['battery.voltage()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_battery_low'] = function (block) {
        use('battery');
        return ['battery.low(' + value(block, 'THRESHOLD', '6600') + ')', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_motor_dc'] = function (block) {
        return motorRef(block) + '.dc(' + value(block, 'DUTY', '0') + ')\n';
    };
    generator.forBlock['evn_motor_track_target'] = function (block) {
        return motorRef(block) + '.track_target(' + value(block, 'ANGLE', '0') + ')\n';
    };
    generator.forBlock['evn_motor_limits'] = function (block) {
        const m = motorRef(block);
        const args = [];
        const speed = generator.valueToCode(block, 'SPEED', Order.NONE);
        const accel = generator.valueToCode(block, 'ACCEL', Order.NONE);
        const torque = generator.valueToCode(block, 'TORQUE', Order.NONE);
        if (speed) { args.push('speed=' + speed); }
        if (accel) { args.push('acceleration=' + accel); }
        if (torque) { args.push('torque=' + torque); }
        if (!args.length) { return ''; }
        return m + '.control.limits(' + args.join(', ') + ')\n';
    };
    generator.forBlock['evn_motor_limit'] = function (block) {
        const what = ['speed', 'acceleration', 'torque'].indexOf(block.getFieldValue('WHAT')) >= 0 ? block.getFieldValue('WHAT') : 'speed';
        const limit = generator.valueToCode(block, 'VALUE', Order.NONE);
        if (!limit) { return ''; }                        // an empty input changes nothing (0 would raise)
        return motorRef(block) + '.control.limits(' + what + '=' + limit + ')\n';
    };
    generator.forBlock['evn_motor_calibrate'] = function (block) {
        return motorRef(block) + '.calibrate(' + (block.getFieldValue('WAIT') === 'FALSE' ? 'wait=False' : '') + ')\n';
    };
    generator.forBlock['evn_motor_calibrated'] = function (block) {
        generator.definitions_['import_evn_module'] = 'import evn';
        return ['evn.calibration(' + block.getFieldValue('PORT') + ")['calibrated']", Order.MEMBER];
    };
    generator.forBlock['evn_motor_law'] = function (block) {
        return motorRef(block) + '.control.law(' + generator.quote_(block.getFieldValue('LAW')) + ')\n';
    };
    /* ---- Standard Peripherals ------------------------------------------------------------- */

    /** A "set up" block only records the port's options; the definition is all it does. */
    function setupGenerator(cls) {
        return function (block) { deviceRef(block, cls); return ''; };
    }
    /** A value block that calls one method with no arguments. */
    function call(cls, method) {
        return function (block) { return [deviceRef(block, cls) + '.' + method + '()', Order.FUNCTION_CALL]; };
    }
    /** A statement block that calls one method with no arguments. */
    function doCall(cls, method) {
        return function (block) { return deviceRef(block, cls) + '.' + method + '()\n'; };
    }
    /** A value block whose dropdown holds the code after the dot ("heading()", "tilt()[0]"). */
    function pick(cls, field) {
        return function (block) { return [deviceRef(block, cls) + '.' + block.getFieldValue(field), Order.MEMBER]; };
    }
    /** A statement block that calls one method with one numeric argument. */
    function doNumber(cls, method, input, fallback) {
        return function (block) {
            return deviceRef(block, cls) + '.' + method + '(' + value(block, input, fallback) + ')\n';
        };
    }
    /* X-003: an input whose binding takes an int (mp_obj_get_int refuses 7.0): an integer literal is
     * passed as it is, anything else - a division, a sensor reading, a decimal - is rounded. */
    function intValue(block, input, fallback) {
        const code = value(block, input, fallback);
        return /^-?\d+$/.test(code) ? code : 'int(round(' + code + '))';
    }
    function doInt(cls, method, input, fallback) {
        return function (block) {
            return deviceRef(block, cls) + '.' + method + '(' + intValue(block, input, fallback) + ')\n';
        };
    }

    generator.forBlock['evn_colorsensor_setup'] = setupGenerator('ColorSensor');
    generator.forBlock['evn_colorsensor_color'] = call('ColorSensor', 'color');
    generator.forBlock['evn_colorsensor_ambient'] = call('ColorSensor', 'ambient');
    generator.forBlock['evn_colorsensor_calibrate'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'white' ? 'white' : 'black';
        return deviceRef(block, 'ColorSensor') + '.calibrate_' + what + '()\n';
    };
    generator.forBlock['evn_colorsensor_detect'] = function (block) {
        use('Color');
        const picked = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'WHITE', 'NONE'].filter((c) => block.getFieldValue(c) === 'TRUE').map((c) => 'Color.' + c);
        return deviceRef(block, 'ColorSensor') + '.detectable_colors((' + picked.join(', ') + (picked.length === 1 ? ',' : '') + '))\n';
    };
    generator.forBlock['evn_colorsensor_channel'] = pick('ColorSensor', 'WHAT');
    generator.forBlock['evn_colorsensor_sees'] = function (block) {
        use('Color');
        return [deviceRef(block, 'ColorSensor') + '.color() == Color.' + block.getFieldValue('COLOR'), Order.RELATIONAL];
    };

    generator.forBlock['evn_distance_setup'] = setupGenerator('DistanceSensor');
    generator.forBlock['evn_distance_mm'] = call('DistanceSensor', 'distance');
    generator.forBlock['evn_distance_profile'] = function (block) {
        return deviceRef(block, 'DistanceSensor') + '.profile(' + generator.quote_(block.getFieldValue('PROFILE')) + ')\n';
    };

    generator.forBlock['evn_gesture_setup'] = setupGenerator('GestureSensor');
    generator.forBlock['evn_gesture_gesture'] = call('GestureSensor', 'gesture');
    generator.forBlock['evn_gesture_proximity'] = call('GestureSensor', 'proximity');
    generator.forBlock['evn_gesture_color'] = call('GestureSensor', 'color');
    generator.forBlock['evn_gesture_calibrate'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'white' ? 'white' : 'black';
        return deviceRef(block, 'GestureSensor') + '.calibrate_' + what + '()\n';
    };
    generator.forBlock['evn_gesture_wait'] = function (block) {
        return [deviceRef(block, 'GestureSensor') + '.read_gesture(' + intValue(block, 'TIMEOUT', '5000') + ')', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_env_setup'] = setupGenerator('EnvSensor');
    generator.forBlock['evn_env_value'] = function (block) {
        return [deviceRef(block, 'EnvSensor') + '.' + block.getFieldValue('WHAT') + '()', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_compass_setup'] = setupGenerator('Compass');
    generator.forBlock['evn_compass_heading'] = call('Compass', 'heading');
    generator.forBlock['evn_compass_north'] = function (block) {
        const heading = generator.valueToCode(block, 'HEADING', Order.NONE);
        return deviceRef(block, 'Compass') + '.north(' + (heading && heading !== '0' ? heading : '') + ')\n';
    };
    generator.forBlock['evn_compass_coverage'] = function (block) {
        return ['round(' + deviceRef(block, 'Compass') + '.calibrate_progress()[1] * 100)', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_compass_calibrate_cancel'] = doCall('Compass', 'calibrate_cancel');
    generator.forBlock['evn_compass_calibrate'] = function (block) {
        const planar = block.getFieldValue('PLANAR') === 'TRUE';
        return deviceRef(block, 'Compass') + '.calibrate(' + (planar ? 'True' : '') + ')\n';
    };
    generator.forBlock['evn_compass_calibrate_stop'] = doCall('Compass', 'calibrate_stop');

    /* ---- EVN Extended Peripherals ---------------------------------------------------------- */
    generator.forBlock['evn_htcolor_setup'] = setupGenerator('HiTechnicColorSensor');
    generator.forBlock['evn_htcolor_color'] = call('HiTechnicColorSensor', 'color');
    generator.forBlock['evn_htcolor_value'] = pick('HiTechnicColorSensor', 'WHAT');
    generator.forBlock['evn_htcolor_calibrate'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'white' ? 'white' : 'black';
        return deviceRef(block, 'HiTechnicColorSensor') + '.calibrate_' + what + '()\n';
    };
    generator.forBlock['evn_htcolor_sees'] = function (block) {
        use('Color');
        return [deviceRef(block, 'HiTechnicColorSensor') + '.color() == Color.' + block.getFieldValue('COLOR'), Order.RELATIONAL];
    };

    generator.forBlock['evn_htcompass_setup'] = setupGenerator('HiTechnicCompass');
    generator.forBlock['evn_htcompass_heading'] = call('HiTechnicCompass', 'heading');
    generator.forBlock['evn_htcompass_north'] = function (block) {
        const heading = generator.valueToCode(block, 'HEADING', Order.NONE);
        return deviceRef(block, 'HiTechnicCompass') + '.north(' + (heading && heading !== '0' ? heading : '') + ')\n';
    };
    generator.forBlock['evn_htcompass_calibrate'] = doCall('HiTechnicCompass', 'calibrate');
    generator.forBlock['evn_htcompass_calibrate_stop'] = call('HiTechnicCompass', 'calibrate_stop');

    generator.forBlock['evn_huskylens_setup'] = setupGenerator('HuskyLens');
    generator.forBlock['evn_huskylens_algorithm'] = function (block) {
        return deviceRef(block, 'HuskyLens') + '.algorithm(HuskyLens.' + block.getFieldValue('ALGORITHM') + ')\n';
    };
    generator.forBlock['evn_huskylens_count'] = call('HuskyLens', 'count');
    generator.forBlock['evn_huskylens_block'] = function (block) {
        // blocks() is [] when the camera sees nothing: the stand-in tuple answers -1 instead of an IndexError
        const i = String(Math.max(0, Math.min(4, Number(block.getFieldValue('WHAT')) || 0)));
        return ['(' + deviceRef(block, 'HuskyLens') + '.blocks() or [(-1, -1, -1, -1, -1)])[0][' + i + ']', Order.MEMBER];
    };
    generator.forBlock['evn_huskylens_learn'] = doInt('HuskyLens', 'learn', 'ID', '1');
    generator.forBlock['evn_huskylens_forget'] = doCall('HuskyLens', 'forget');
    generator.forBlock['evn_huskylens_learned'] = call('HuskyLens', 'learned');
    generator.forBlock['evn_huskylens_arrow'] = function (block) {
        // arrows() is [] when the camera sees none (and outside line tracking): -1, as the first-block block
        const i = String(Math.max(0, Math.min(4, Number(block.getFieldValue('WHAT')) || 0)));
        return ['(' + deviceRef(block, 'HuskyLens') + '.arrows() or [(-1, -1, -1, -1, -1)])[0][' + i + ']', Order.MEMBER];
    };

    generator.forBlock['evn_vl53l1x_setup'] = setupGenerator('VL53L1X');
    generator.forBlock['evn_vl53l1x_distance'] = function (block) {
        // distance() is None when the reading is not valid: -1 instead, so a comparison or a sum never
        // raises TypeError (a valid reading is never 0 mm: the sensor's minimum range is ~4 cm)
        return [deviceRef(block, 'VL53L1X') + '.distance() or -1', Order.LOGICAL_OR];
    };
    generator.forBlock['evn_vl53l1x_mode'] = function (block) {
        const mode = block.getFieldValue('MODE') === 'short' ? 'short' : 'long';
        return deviceRef(block, 'VL53L1X') + '.distance_mode(' + generator.quote_(mode) + ')\n';
    };
    generator.forBlock['evn_vl53l1x_budget'] = function (block) {
        const ms = ['15', '20', '33', '50', '100', '200', '500'].includes(block.getFieldValue('MS')) ? block.getFieldValue('MS') : '33';
        return deviceRef(block, 'VL53L1X') + '.timing_budget(' + ms + ')\n';
    };
    generator.forBlock['evn_vl53l1x_inter'] = doInt('VL53L1X', 'inter_measurement', 'MS', '0');
    generator.forBlock['evn_vl53l1x_roi'] = function (block) {
        const side = (f) => (['16', '12', '8', '6', '4'].includes(block.getFieldValue(f)) ? block.getFieldValue(f) : '16');
        return deviceRef(block, 'VL53L1X') + '.roi(' + side('W') + ', ' + side('H') + ')\n';
    };
    generator.forBlock['evn_vl53l1x_threshold'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'sigma_threshold' ? 'sigma_threshold' : 'signal_threshold';
        return deviceRef(block, 'VL53L1X') + '.' + what + '(' + intValue(block, 'VALUE', what === 'sigma_threshold' ? '90' : '1024') + ')\n';
    };
    generator.forBlock['evn_vl53l1x_detect'] = function (block) {
        const w = block.getFieldValue('WINDOW') === 'above' ? 'above' : 'below';
        return deviceRef(block, 'VL53L1X') + '.distance_threshold(' + generator.quote_(w) + ', ' + intValue(block, 'MM', '200') + ')\n';
    };
    generator.forBlock['evn_vl53l1x_detect_window'] = function (block) {
        const w = block.getFieldValue('WINDOW') === 'outside' ? 'outside' : 'inside';
        return deviceRef(block, 'VL53L1X') + '.distance_threshold(' + generator.quote_(w) + ', ' + intValue(block, 'LOW', '100') + ', ' +
            intValue(block, 'HIGH', '300') + ')\n';
    };
    generator.forBlock['evn_vl53l1x_detect_off'] = function (block) {
        return deviceRef(block, 'VL53L1X') + '.distance_threshold(None)\n';
    };
    generator.forBlock['evn_vl53l1x_detected'] = call('VL53L1X', 'detected');
    generator.forBlock['evn_vl53l1x_calibrate'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'crosstalk' ? 'crosstalk' : 'offset';
        return deviceRef(block, 'VL53L1X') + '.calibrate_' + what + '(' + intValue(block, 'MM', '140') + ')\n';
    };
    generator.forBlock['evn_vl53l1x_clear_calibration'] = function (block) {
        return deviceRef(block, 'VL53L1X') + '.clear_calibration()\n';
    };

    generator.forBlock['evn_tcs3430_setup'] = setupGenerator('TCS3430');
    generator.forBlock['evn_tcs3430_color'] = call('TCS3430', 'color');
    generator.forBlock['evn_tcs3430_sees'] = function (block) {
        use('Color');
        return [deviceRef(block, 'TCS3430') + '.color() == Color.' + block.getFieldValue('COLOR'), Order.RELATIONAL];
    };
    generator.forBlock['evn_tcs3430_value'] = pick('TCS3430', 'WHAT');
    generator.forBlock['evn_tcs3430_calibrate'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'white' ? 'white' : 'black';
        return deviceRef(block, 'TCS3430') + '.calibrate_' + what + '()\n';
    };
    generator.forBlock['evn_tcs3430_gain'] = function (block) {
        const g = ['1', '4', '16', '64', '128'].includes(block.getFieldValue('GAIN')) ? block.getFieldValue('GAIN') : '64';
        return deviceRef(block, 'TCS3430') + '.gain(' + g + ')\n';
    };
    // integration_time(ms) takes a float (the nearest 2.78 ms step is set), so the input is not rounded
    generator.forBlock['evn_tcs3430_integration'] = doNumber('TCS3430', 'integration_time', 'MS', '100');
    // wait_time(ms) takes a float as well (2.78 ms steps, then 33.36 ms steps)
    generator.forBlock['evn_tcs3430_wait'] = doNumber('TCS3430', 'wait_time', 'MS', '0');
    generator.forBlock['evn_tcs3430_autozero'] = function (block) {
        const nth = ['127', '1', '10', '100', '0'].includes(block.getFieldValue('NTH')) ? block.getFieldValue('NTH') : '127';
        return deviceRef(block, 'TCS3430') + '.autozero(' + nth + ')\n';
    };
    // thresholds() takes ints: the ends are rounded (intValue), the persistence is one of the chip's counts
    generator.forBlock['evn_tcs3430_window'] = function (block) {
        const pers = ['1', '2', '3', '5', '10', '20', '60'].includes(block.getFieldValue('PERS')) ? block.getFieldValue('PERS') : '1';
        return deviceRef(block, 'TCS3430') + '.thresholds(' + intValue(block, 'LOW', '0') + ', ' + intValue(block, 'HIGH', '65535') + ', ' + pers + ')\n';
    };
    generator.forBlock['evn_tcs3430_left_window'] = call('TCS3430', 'interrupt');
    generator.forBlock['evn_tcs3430_clear_window'] = doCall('TCS3430', 'clear_interrupt');

    generator.forBlock['evn_touch_setup'] = setupGenerator('TouchArray');
    generator.forBlock['evn_touch_any'] = call('TouchArray', 'pressed');
    generator.forBlock['evn_touch_pad'] = function (block) {
        return [deviceRef(block, 'TouchArray') + '.read(' + intValue(block, 'PAD', '0') + ')', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_imu_setup'] = setupGenerator('IMU');
    generator.forBlock['evn_imu_angle'] = pick('IMU', 'WHAT');
    generator.forBlock['evn_imu_stationary'] = function (block) {
        const what = block.getFieldValue('WHAT') === 'ready()' ? 'ready()' : 'stationary()';
        return [deviceRef(block, 'IMU') + '.' + what, Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_imu_reset_heading'] = function (block) {
        const angle = generator.valueToCode(block, 'ANGLE', Order.NONE);
        return deviceRef(block, 'IMU') + '.reset_heading(' + (angle && angle !== '0' ? angle : '') + ')\n';
    };
    generator.forBlock['evn_imu_calibrate'] = function (block) {
        const pose = block.getFieldValue('POSE');
        return deviceRef(block, 'IMU') + '.calibrate(' + (pose === '1' || pose === '2' ? 'pose=' + pose : '') + ')\n';
    };
    generator.forBlock['evn_imu_up'] = function (block) {
        use('Side');
        return [deviceRef(block, 'IMU') + '.up() == Side.' + block.getFieldValue('SIDE'), Order.RELATIONAL];
    };

    generator.forBlock['evn_adc_setup'] = setupGenerator('ADC');
    generator.forBlock['evn_adc_voltage'] = function (block) {
        return [deviceRef(block, 'ADC') + '.voltage(' + intValue(block, 'INPUT', '0') + ')', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_display_setup'] = setupGenerator('Display');
    generator.forBlock['evn_display_clear'] = doCall('Display', 'clear');
    generator.forBlock['evn_display_text'] = function (block) {
        return deviceRef(block, 'Display') + '.text(' + intValue(block, 'COL', '0') + ', ' + intValue(block, 'ROW', '0') +
            ', ' + value(block, 'TEXT', "''") + ')\n';
    };
    generator.forBlock['evn_display_print'] = function (block) {
        return deviceRef(block, 'Display') + '.print(' + value(block, 'TEXT', "''") + ')\n';
    };

    generator.forBlock['evn_matrix_setup'] = setupGenerator('MatrixLED');
    generator.forBlock['evn_matrix_clear'] = doCall('MatrixLED', 'clear');
    generator.forBlock['evn_matrix_number'] = doInt('MatrixLED', 'number', 'NUMBER', '0');
    generator.forBlock['evn_matrix_brightness'] = doInt('MatrixLED', 'brightness', 'LEVEL', '8');
    generator.forBlock['evn_matrix_text'] = function (block) {
        return deviceRef(block, 'MatrixLED') + '.text(' + value(block, 'TEXT', "''") + ')\n';
    };
    generator.forBlock['evn_matrix_char'] = function (block) {
        return deviceRef(block, 'MatrixLED') + '.char((str(' + value(block, 'CHAR', "'A'") + ") + ' ')[:1])\n";   // empty text shows a blank
    };
    generator.forBlock['evn_matrix_icon'] = function (block) {
        use('Icon');
        return deviceRef(block, 'MatrixLED') + '.icon(Icon.' + block.getFieldValue('ICON') + ')\n';
    };
    generator.forBlock['evn_matrix_pixel'] = function (block) {
        return deviceRef(block, 'MatrixLED') + '.pixel(' + intValue(block, 'ROW', '0') + ', ' + intValue(block, 'COL', '0') +
            ', ' + (block.getFieldValue('ON') === 'TRUE' ? 'True' : 'False') + ')\n';
    };

    generator.forBlock['evn_seven_setup'] = setupGenerator('SevenSegmentLED');
    generator.forBlock['evn_seven_clear'] = doCall('SevenSegmentLED', 'clear');
    generator.forBlock['evn_seven_number'] = doNumber('SevenSegmentLED', 'number', 'NUMBER', '0');
    generator.forBlock['evn_seven_brightness'] = doInt('SevenSegmentLED', 'brightness', 'LEVEL', '8');
    generator.forBlock['evn_seven_colon'] = function (block) {
        return deviceRef(block, 'SevenSegmentLED') + '.colon(' + (block.getFieldValue('ON') === 'False' ? 'False' : 'True') + ')\n';
    };
    generator.forBlock['evn_seven_text'] = function (block) {
        return deviceRef(block, 'SevenSegmentLED') + '.text(' + value(block, 'TEXT', "''") + ')\n';
    };

    generator.forBlock['evn_color'] = function (block) {
        use('Color');
        return ['Color.' + block.getFieldValue('COLOR'), Order.MEMBER];
    };
    generator.forBlock['evn_color_rgb'] = function (block) {
        return ['(' + value(block, 'R', '0') + ', ' + value(block, 'G', '0') + ', ' + value(block, 'B', '0') + ')', Order.ATOMIC];
    };

    generator.forBlock['evn_rgb_setup'] = setupGenerator('RGBLED');
    generator.forBlock['evn_rgb_off'] = doCall('RGBLED', 'off');
    generator.forBlock['evn_rgb_brightness'] = doInt('RGBLED', 'brightness', 'LEVEL', '64');
    generator.forBlock['evn_rgb_fill'] = function (block) {
        return deviceRef(block, 'RGBLED') + '.fill(' + value(block, 'COLOUR', '(0, 0, 0)') + ')\n';
    };
    generator.forBlock['evn_rgb_set'] = function (block) {
        return deviceRef(block, 'RGBLED') + '.set(' + intValue(block, 'LED', '0') + ', ' + value(block, 'COLOUR', '(0, 0, 0)') + ')\n';
    };

    generator.forBlock['evn_servo_setup'] = setupGenerator('Servo');
    generator.forBlock['evn_servo_stop'] = doCall('Servo', 'stop');
    generator.forBlock['evn_servo_angle'] = doNumber('Servo', 'angle', 'ANGLE', '90');
    generator.forBlock['evn_servo_pulse'] = doInt('Servo', 'pulse', 'US', '1500');
    generator.forBlock['evn_servo_duty'] = doNumber('Servo', 'duty', 'DUTY', '0');
    generator.forBlock['evn_servo_move'] = function (block) {
        return deviceRef(block, 'Servo') + '.move(' + value(block, 'ANGLE', '90') + ', ' + value(block, 'SPEED', '60') +
            (block.getFieldValue('WAIT') === 'FALSE' ? ', wait=False' : '') + ')\n';
    };
    generator.forBlock['evn_servo_done'] = call('Servo', 'done');

    generator.forBlock['evn_bluetooth_setup'] = setupGenerator('Bluetooth');
    generator.forBlock['evn_bluetooth_send'] = function (block) {
        return deviceRef(block, 'Bluetooth') + '.write((str(' + value(block, 'TEXT', "''") + ") + '\\n').encode())\n";
    };
    generator.forBlock['evn_bluetooth_any'] = function (block) {
        return [deviceRef(block, 'Bluetooth') + '.any() > 0', Order.RELATIONAL];
    };
    /* The binding does have readline() (evn_bluetooth.c registers MP_QSTR_readline), so the block
     * calls it: it waits up to 5 s, gives the line without its newline, and - unlike the 14-line
     * read(-1) helper this replaced - leaves whatever arrived behind it in the receive buffer,
     * where a "read everything" Python block can still find it. None on timeout becomes ''. A line that is
     * not UTF-8 comes back one character per byte (bytesToText) instead of stopping the program. */
    generator.forBlock['evn_bluetooth_line'] = function (block) {
        const timeout = value(block, 'TIMEOUT', '5000');   // readline takes an int: a computed or decimal time is rounded
        const ms = /^\d+$/.test(timeout) ? timeout : 'int(' + timeout + ')';
        const line = deviceRef(block, 'Bluetooth') + '.readline(' + ms + ")";
        return [bytesToText() + '(' + line + " or b'')", Order.FUNCTION_CALL];
    };

    /* ---- the pose, the serial ports, raw I2C and files ------------------------------------------ */

    /** A Python string literal as the Python generator quotes a text block ('...' or "..."). */
    const STRING_LITERAL = /^(['"])(?:(?!\1)[^\\]|\\[\s\S])*\1$/;
    /** A text input as a str: a string literal as it is, anything else (a number, a sensor value) through str(). */
    function textValue(block, input, fallback) {
        const code = value(block, input, fallback);
        return STRING_LITERAL.test(code) ? code : 'str(' + code + ')';
    }
    /** A text input followed by a newline: '...\n' for a literal, str(...) + '\n' for anything else. */
    function lineValue(block, input, fallback) {
        const code = value(block, input, fallback);
        return STRING_LITERAL.test(code) ? code.slice(0, -1) + '\\n' + code.slice(-1) : 'str(' + code + ") + '\\n'";
    }
    /** The module a block needs, imported once at the top (`import os`). */
    function importModule(name) {
        generator.definitions_['import_' + name] = 'import ' + name;
        return name;
    }

    generator.forBlock['evn_pose_setup'] = function (block) {
        poseRef(block);             // the definition is all the setup does
        return '';
    };
    generator.forBlock['evn_pose_value'] = function (block) {
        return [poseRef(block) + '.' + block.getFieldValue('WHAT'), Order.MEMBER];
    };
    generator.forBlock['evn_pose_uncertainty'] = function (block) {
        const i = String(Math.max(0, Math.min(2, Number(block.getFieldValue('WHAT')) || 0)));
        return [poseRef(block) + '.covariance()[' + i + ']', Order.MEMBER];
    };
    generator.forBlock['evn_pose_uses'] = function (block) {
        return [generator.quote_(block.getFieldValue('SOURCE')) + ' in ' + poseRef(block) + '.sources()', Order.RELATIONAL];
    };
    generator.forBlock['evn_pose_reset'] = function (block) {
        const xyh = ['X', 'Y', 'HEADING'].map((n) => value(block, n, '0'));
        return poseRef(block) + '.reset(' + (xyh.every((v) => v === '0') ? '' : xyh.join(', ')) + ')\n';
    };

    /** Bytes as text: UTF-8 when they are, else one character per byte (chr(0..255)). MicroPython checks
     * UTF-8 (MICROPY_PY_BUILTINS_STR_UNICODE_CHECK), so a bare decode() of a peer at the wrong baud or of a
     * binary frame raised UnicodeError and stopped the program; garbled text is what a user can debug. */
    function bytesToText() {
        return generator.provideFunction_('bytes_to_text', `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(data):
  try:
    return data.decode()
  except UnicodeError:
    return ''.join(chr(byte) for byte in data)
`);
    }

    /* UART: only the calls machine.UART has - UART(id, baudrate), write(), read(n), any() - so the blocks
     * run the same on an evn.UART that follows machine.UART (the owner, 2026-09-28: "Follow machine uart"):
     * machine.UART's readline() takes no timeout (the constructor's) and returns a part line when it times
     * out, and it has no flush_rx(). The line, the text and the throw-away blocks share one helper,
     * uart_receive(): it reads a line a byte at a time against a StopWatch, so what arrived behind the line
     * stays in the port, and a line that has not finished when the wait ends is kept (in the helper's own
     * `pending`, per port object) for the next call - empty text now, the whole line later, never a part.
     * Every read has a count, read(any()) or read(1), never a bare read(): on machine.UART (and the 0.2.60
     * evn.UART) a bare read() is the stream's readall, which keeps reading while a peer keeps sending. The
     * wait is a bound even on a peer that never stops (a binary stream, the wrong baud): the bytes already
     * waiting when the call starts are read to their line end, and past `line_wait` the call gives up
     * after its next byte; a line of 1024 bytes without an end comes as that piece, so `pending` stays
     * bounded (review 2026-09-29: the old loop looked at the clock only when the port was empty).
     * The line grows in one bytearray (`+=` extends it in place, and MicroPython's gc_realloc frees what it
     * outgrows), turned into bytes once when it is given or kept: `bytes += byte` made a new object of the
     * whole line for every byte, about 0.5 MB of garbage for a 1024-byte line and collections on Core 0
     * in the middle of a stream (fix pass 2026-09-29). MicroPython's bytearray has no decode(), so the
     * text helper is handed bytes. */
    function uartReceive() {
        use('StopWatch');
        const text = bytesToText();
        return generator.provideFunction_('uart_receive', `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(uart, line_wait=None, pending={}):
  # pending: per port, the part of a line that had arrived when a wait ended
  data = bytearray(pending.pop(id(uart), b''))
  if line_wait is None:
    waiting = uart.any()
    if waiting:
      data += uart.read(waiting) or b''
    return ${text}(bytes(data))
  watch = StopWatch()
  ready = uart.any()  # what has already arrived is read to its line end, however short the wait
  while True:
    if uart.any():
      byte = uart.read(1) or b''
      if byte == b'\\n':
        return ${text}(bytes(data)).rstrip('\\r')
      data += byte  # grows in place: no new copy of the line for every byte
      if len(data) >= 1024:
        return ${text}(bytes(data))
      ready -= 1
      if ready > 0:
        continue
    else:
      ready = 0
    if watch.time() >= line_wait:
      pending[id(uart)] = bytes(data)
      return ''
`);
    }
    generator.forBlock['evn_uart_setup'] = setupGenerator('UART');
    generator.forBlock['evn_uart_send'] = function (block) {
        const newline = block.getFieldValue('NEWLINE') !== 'FALSE';
        const code = value(block, 'TEXT', "''");
        const literal = STRING_LITERAL.test(code);
        let data;
        if (literal && /^[\x20-\x7e]*$/.test(code)) {
            data = 'b' + (newline ? code.slice(0, -1) + '\\n' + code.slice(-1) : code);   // plain ASCII: a bytes literal
        } else {
            // 'grüß\n'.encode(), str(x).encode(), (str(x) + '\n').encode()
            const text = newline ? lineValue(block, 'TEXT', "''") : textValue(block, 'TEXT', "''");
            data = (newline && !literal ? '(' + text + ')' : text) + '.encode()';
        }
        return deviceRef(block, 'UART') + '.write(' + data + ')\n';
    };
    generator.forBlock['evn_uart_line'] = function (block) {
        const uart = deviceRef(block, 'UART');
        return [uartReceive() + '(' + uart + ', ' + value(block, 'TIMEOUT', '1000') + ')', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_uart_read'] = function (block) {
        const uart = deviceRef(block, 'UART');
        return [uartReceive() + '(' + uart + ')', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_uart_any'] = call('UART', 'any');
    generator.forBlock['evn_uart_clear'] = function (block) {
        const uart = deviceRef(block, 'UART');
        return uartReceive() + '(' + uart + ')\n';     // everything read and dropped, a kept part line with it
    };

    /* I2C: readfrom_mem / writeto_mem (machine.I2C's own calls); two bytes and signed values through struct. */
    /** The hex byte of an ADDR / REG field as a Python literal (0x68); a value the field would refuse falls back. */
    function hexField(block, name, fallback) {
        const t = String(block.getFieldValue(name) || '');
        const n = /^[0-9a-f]{1,2}$/i.test(t) ? parseInt(t, 16) : fallback;
        return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
    }
    const I2C_READ_FORMATS = { 'B': 1, 'b': 1, '>H': 2, '>h': 2, '<H': 2, '<h': 2 };
    generator.forBlock['evn_i2c_setup'] = setupGenerator('I2C');
    generator.forBlock['evn_i2c_scan'] = function (block) {
        return ['[hex(address) for address in ' + deviceRef(block, 'I2C') + '.scan()]', Order.ATOMIC];
    };
    generator.forBlock['evn_i2c_probe'] = function (block) {
        return [deviceRef(block, 'I2C') + '.probe(' + hexField(block, 'ADDR', 0x68) + ')', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_i2c_read'] = function (block) {
        const fmt = Object.prototype.hasOwnProperty.call(I2C_READ_FORMATS, block.getFieldValue('FORMAT')) ? block.getFieldValue('FORMAT') : 'B';
        const read = deviceRef(block, 'I2C') + '.readfrom_mem(' + hexField(block, 'ADDR', 0x68) + ', ' + hexField(block, 'REG', 0x75)
            + ', ' + I2C_READ_FORMATS[fmt] + ')';
        if (fmt === 'B') { return [read + '[0]', Order.MEMBER]; }
        return [importModule('struct') + '.unpack(' + generator.quote_(fmt) + ', ' + read + ')[0]', Order.MEMBER];
    };
    generator.forBlock['evn_i2c_read_bytes'] = function (block) {
        return ['list(' + deviceRef(block, 'I2C') + '.readfrom_mem(' + hexField(block, 'ADDR', 0x68) + ', ' + hexField(block, 'REG', 0x75)
            + ', ' + intValue(block, 'COUNT', '1') + '))', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_i2c_write'] = function (block) {
        const fmt = ['>H', '<H'].indexOf(block.getFieldValue('FORMAT')) >= 0 ? block.getFieldValue('FORMAT') : 'B';
        const v = intValue(block, 'VALUE', '0');
        let data;
        if (fmt === 'B') {
            data = 'bytes([' + v + '])';        // ValueError outside 0..255
        } else {
            // struct.pack('>H', 70000) truncates without a word in MicroPython: refused like the byte form instead
            importModule('struct');
            data = generator.provideFunction_('two_bytes', `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(value, order):
  if not 0 <= value <= 65535:
    raise ValueError('a 16-bit register value is 0 to 65535')
  return struct.pack(order, value)
`) + '(' + v + ', ' + generator.quote_(fmt) + ')';
        }
        return deviceRef(block, 'I2C') + '.writeto_mem(' + hexField(block, 'ADDR', 0x68) + ', ' + hexField(block, 'REG', 0x75) + ', ' + data + ')\n';
    };

    /* Files: open() and os as in MicroPython. A missing file reads as empty text and deletes as nothing;
     * every other error - above all OSError 16, a flash write refused while a motor drives - is raised. */
    generator.forBlock['evn_file_write'] = function (block) {
        const mode = block.getFieldValue('MODE') === 'w' ? 'w' : 'a';
        return 'with open(' + textValue(block, 'NAME', "'notes.txt'") + ', ' + generator.quote_(mode) + ') as file:\n'
            + generator.INDENT + 'file.write(' + lineValue(block, 'TEXT', "''") + ')\n';
    };
    generator.forBlock['evn_file_read'] = function (block) {
        const fn = generator.provideFunction_('read_file', `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(name):
  try:
    with open(name) as file:
      return file.read()
  except OSError as error:
    if error.errno != 2:  # 2 = ENOENT, no such file
      raise
    return ''
`);
        return [fn + '(' + textValue(block, 'NAME', "'notes.txt'") + ')', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_file_exists'] = function (block) {
        importModule('os');
        const fn = generator.provideFunction_('file_exists', `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(name):
  try:
    os.stat(name)
    return True
  except OSError:
    return False
`);
        return [fn + '(' + textValue(block, 'NAME', "'notes.txt'") + ')', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_file_delete'] = function (block) {
        importModule('os');
        const fn = generator.provideFunction_('delete_file', `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(name):
  try:
    os.remove(name)
  except OSError as error:
    if error.errno != 2:  # 2 = ENOENT, there was no such file
      raise
`);
        return fn + '(' + textValue(block, 'NAME', "'notes.txt'") + ')\n';
    };
    generator.forBlock['evn_file_list'] = function () {
        return [importModule('os') + '.listdir()', Order.FUNCTION_CALL];
    };

    /* Blank out Python comments and the insides of string literals, keeping the length so nothing
     * shifts. A Python block reading `print("check imu_1")` used to open an IMU on port 1 (an
     * OSError when nothing is there), and `# imu_99` opened one on port 99 (a ValueError). */
    function codeOnly(text) {
        const out = text.split('');
        let i = 0;
        while (i < text.length) {
            const c = text[i];
            if (c === '#') {
                while (i < text.length && text[i] !== '\n') { out[i] = ' '; i++; }
                continue;
            }
            if (c === '"' || c === "'") {
                const triple = text.slice(i, i + 3);
                const close = (triple === c + c + c) ? triple : c;
                let j = i + close.length;
                while (j < text.length) {
                    if (text[j] === '\\') { j += 2; continue; }
                    if (text.slice(j, j + close.length) === close) { j += close.length; break; }
                    if (close.length === 1 && text[j] === '\n') { break; }   // an unterminated string
                    j++;
                }
                for (let k = i; k < Math.min(j, text.length); k++) { if (text[k] !== '\n') { out[k] = ' '; } }
                i = j;
                continue;
            }
            i++;
        }
        return out.join('');
    }

    /** The highest port number a class has: the firmware raises ValueError outside it (serial ports 1..2). */
    function maxPort(cls) {
        if (cls === 'Servo' || cls === 'RGBLED') { return 4; }
        return (cls === 'UART' || cls === 'Bluetooth') ? 2 : 16;
    }
    /* Standard modules a Python block may use without importing them itself: the file blocks' os, the I2C
     * blocks' struct, and json for settings files. */
    const PYTHON_BLOCK_MODULES = ['os', 'struct', 'json'];
    /* The classes whose constructor claims its port: a second object on the port raises OSError ("serial port
     * 1 is already open" / "... is used by a Bluetooth object"). A program of 0.2.58 or older did its UART
     * work in Python blocks, constructing `uart_1 = UART(1, 9600)` itself; defining uart_1 at the top as
     * well, from a mere mention, would make that program fail at start-up. */
    const CLAIMS_PORT = ['UART', 'Bluetooth'];
    /** The object names an enabled Python block of the workspace assigns itself (`uart_1 = UART(1, 9600)`). */
    function pythonAssigned(workspace) {
        const names = new Set();
        for (const b of workspace.getAllBlocks(false)) {
            if ((b.type !== 'evn_python' && b.type !== 'evn_python_value') || !b.isEnabled() || b.getInheritedDisabled()) { continue; }
            for (const m of codeOnly(String(b.getFieldValue('CODE') || '')).matchAll(/(?:^|;)\s*([A-Za-z_]\w*)\s*=(?!=)/gm)) { names.add(m[1]); }
        }
        return names;
    }
    /* A Python block that constructs what the top of the program already constructs: the constructor raises
     * at that line, on the board, before the tester sees why (review 2026-09-29). pythonAssigned() keeps a mere
     * mention from adding a second `uart_1`, but a UART or Bluetooth block on the port - or a pose block, or
     * "robot follows its gyro" (the DriveBase then builds its own Pose) - still does, so the Python block is
     * warned in the editor: serial ports claim their port ("serial port 1 is already open" / "... is used by a
     * Bluetooth object", evn_periph.c uart_make_new, evn_bluetooth.c), and a robot has one Pose ("a Pose object
     * already exists", evn_pose.c). The warning names the fix; nothing in the generated code changes. */
    const SERIAL_BLOCK = /^evn_(uart|bluetooth)_/;
    function runs(b) { return b.isEnabled() && !b.getInheritedDisabled(); }
    /** The serial ports ('1', '2') the top of the program opens, from blocks and from Python-block mentions. */
    function topSerialPorts(workspace) {
        const ports = new Set();
        let assigned = null;
        for (const b of workspace.getAllBlocks(false)) {
            if (!runs(b)) { continue; }
            if (SERIAL_BLOCK.test(b.type) && b.getField('PORT')) { ports.add(String(b.getFieldValue('PORT'))); continue; }
            if (b.type !== 'evn_python' && b.type !== 'evn_python_value') { continue; }
            for (const m of codeOnly(String(b.getFieldValue('CODE') || '')).matchAll(/\b(?:uart|bluetooth)_([12])\b/g)) {
                assigned = assigned || pythonAssigned(workspace);
                if (!assigned.has(m[0])) { ports.add(m[1]); }
            }
        }
        return ports;
    }
    /** The editor's warning for a Python block constructing a serial port or a Pose the top already makes, or null. */
    function pythonClash(block) {
        if (!block.workspace || block.isInFlyout || !runs(block)) { return null; }
        const code = codeOnly(String(block.getFieldValue('CODE') || ''));
        // `UART(1, ...)` / `evn.UART(1)`, not `machine.UART(1)` or `myUART(1)` (no lookbehind: older Safari
        // refuses the whole script at parse time)
        const opens = [...code.matchAll(/(?:^|[^\w.])(?:evn\.)?(?:UART|Bluetooth)\s*\(\s*([12])\s*[,)]/g)];
        if (opens.length) {
            const top = topSerialPorts(block.workspace);
            const hit = opens.find((m) => top.has(m[1]));
            if (hit) {
                return 'This line opens serial port ' + hit[1] + ', which the blocks already open at the start of the program, so the program '
                    + 'would stop here with OSError. Give the port a "set up UART" (or Bluetooth) block for its speed and use uart_' + hit[1]
                    + ' / bluetooth_' + hit[1] + ' without constructing it, or keep this port in Python blocks only.';
            }
        }
        // a Pose of its own, or a DriveBase given an IMU / compass (which builds one), beside the program's: judged by
        // the generator's own rules (usesPose, gyroImuPort - an enabled "robot follows its gyro" anywhere, even inside a
        // switched-off block, gives the drive base its IMU), so the warning and the code cannot disagree (rereview 1
        // of the blocks lane)
        if (/(?:^|[^\w.])(?:evn\.)?Pose\s*\(/.test(code) || /(?:^|[^\w.])(?:evn\.)?DriveBase\s*\([^)]*\b(?:imu|compass)\s*=/.test(code)) {
            if (usesPose(block.workspace) || gyroImuPort(block) !== '') {
                return 'This line makes a Pose, but the program already has one (a pose block, or "robot follows its gyro"): a robot has one '
                    + 'Pose (a DriveBase given imu= or compass= makes one too), so the program would stop here with OSError. Read the '
                    + 'program\'s own: pose (with pose blocks) or drive_base.pose.';
            }
        }
        return null;
    }
    for (const t of ['evn_python', 'evn_python_value']) {
        Blockly.Blocks[t].onchange = function () {
            if (this.isInFlyout || !this.workspace || (this.workspace.isDragging && this.workspace.isDragging())) { return; }
            this.setWarningText(pythonClash(this));
        };
    }
    api.pythonClash = pythonClash;   // for scripts/test_blocks.js

    // Hand-written code always gets the core names plus a bare `import evn` (so `evn.version` and
    // anything the list below misses still resolve), plus any evn name it spells out, and every
    // motor_N / peripheral object it mentions is defined at the top like a block's would be.
    function rawPython(block) {
        const code = block.getFieldValue('CODE').trim();
        const bare = codeOnly(code);
        CORE_NAMES.forEach(use);
        // `import evn` as well as the `from evn import ...` line: the tooltip and docs/BLOCKS.md
        // promise that everything in the module is reachable from a Python block.
        generator.definitions_['import_evn_module'] = 'import evn';
        DEVICE_NAMES.forEach((n) => { if (new RegExp('\\b' + n + '\\b').test(bare)) { use(n); } });
        PYTHON_BLOCK_MODULES.forEach((m) => { if (new RegExp('(^|[^\\w.])' + m + '\\s*\\.').test(bare)) { importModule(m); } });
        for (const m of bare.matchAll(/\bmotor_([1-4])\b/g)) { motorRef(block, m[1]); }
        if (/\bdrive_base\b/.test(bare)) { driveRef(block); }
        if (/\bdata_log\b/.test(bare)) { datalogRef(block); }
        let assigned = null;       // computed once, and only when a port-claiming name is mentioned
        for (const cls of Object.keys(DEVICES)) {
            for (const m of bare.matchAll(new RegExp('\\b' + DEVICES[cls][0] + '_(\\d+)\\b', 'g'))) {
                const port = Number(m[1]);
                if (port < 1 || port > maxPort(cls)) { continue; }
                if (CLAIMS_PORT.indexOf(cls) >= 0) {
                    assigned = assigned || pythonAssigned(block.workspace);
                    if (assigned.has(m[0])) { continue; }   // the program constructs it itself
                }
                deviceRef(block, cls, m[1]);
            }
        }
        return code;
    }
    generator.forBlock['evn_python'] = function (block) {
        const code = rawPython(block);
        return code ? code + '\n' : '';
    };
    generator.forBlock['evn_python_value'] = function (block) {
        const code = rawPython(block);
        return [code || 'None', Order.NONE];
    };

    /* ---- toolbox ------------------------------------------------------------------------- */

    function shadowNum(n) {
        return { shadow: { type: 'math_number', fields: { NUM: n } } };
    }
    function shadowText(t) {
        return { shadow: { type: 'text', fields: { TEXT: t } } };
    }
    function shadowColour(name) {
        return { shadow: { type: 'evn_color', fields: { COLOR: name } } };
    }
    /** One peripheral's sub-category of the Sensors / Outputs toolbox. */
    function group(name, style, contents) {
        return { kind: 'category', name: name, categorystyle: style, contents: contents };
    }

    const TOOLBOX = {
        kind: 'categoryToolbox',
        contents: [
            // filled below from the set-up blocks of the other categories (Pybricks' first palette is "Setup")
            { kind: 'category', name: 'Setup', categorystyle: 'evn_start_category', contents: [] },
            {
                kind: 'category', name: 'Motors', categorystyle: 'evn_motor_category',
                contents: [
                    { kind: 'block', type: 'evn_motor_run_angle', inputs: { ANGLE: shadowNum(360), SPEED: shadowNum(500) } },
                    { kind: 'block', type: 'evn_motor_run_target', inputs: { ANGLE: shadowNum(0), SPEED: shadowNum(500) } },
                    { kind: 'block', type: 'evn_motor_run_time', inputs: { TIME: shadowNum(1000), SPEED: shadowNum(500) } },
                    { kind: 'block', type: 'evn_motor_run', inputs: { SPEED: shadowNum(300) } },
                    { kind: 'block', type: 'evn_motor_stop' },
                    { kind: 'block', type: 'evn_motor_run_until_stalled', inputs: { SPEED: shadowNum(200), DUTY: shadowNum(50) } },
                    { kind: 'block', type: 'evn_motor_wait_done' },
                    { kind: 'block', type: 'evn_motor_reset_angle', inputs: { ANGLE: shadowNum(0) } },
                    { kind: 'block', type: 'evn_stop_all' },
                    { kind: 'block', type: 'evn_motor_setup' },
                ],
            },
            {
                kind: 'category', name: 'Robot', categorystyle: 'evn_motor_category',
                contents: [
                    { kind: 'block', type: 'evn_drivebase_straight', inputs: { DISTANCE: shadowNum(300) } },
                    { kind: 'block', type: 'evn_drivebase_turn', inputs: { ANGLE: shadowNum(90) } },
                    { kind: 'block', type: 'evn_drivebase_arc', inputs: { RADIUS: shadowNum(150), ANGLE: shadowNum(90) } },
                    { kind: 'block', type: 'evn_drivebase_drive', inputs: { SPEED: shadowNum(200), TURN: shadowNum(0) } },
                    { kind: 'block', type: 'evn_drivebase_stop' },
                    { kind: 'block', type: 'evn_drivebase_speeds', inputs: { SPEED: shadowNum(300), TURN: shadowNum(150) } },
                    { kind: 'block', type: 'evn_drivebase_accel', inputs: { ACCEL: shadowNum(750), TURN: shadowNum(750) } },
                    { kind: 'block', type: 'evn_drivebase_reset' },
                    { kind: 'block', type: 'evn_drivebase_setup' },
                    { kind: 'block', type: 'evn_drivebase_gyro' },
                ],
            },
            {
                // evn.Pose: where the robot is (the robot's wheels, the gyro block's IMU, the set-up's compass)
                kind: 'category', name: 'Pose', categorystyle: 'evn_motor_category',
                contents: [
                    { kind: 'block', type: 'evn_pose_value' },
                    { kind: 'block', type: 'evn_pose_uncertainty' },
                    { kind: 'block', type: 'evn_pose_uses' },
                    { kind: 'block', type: 'evn_pose_reset', inputs: { X: shadowNum(0), Y: shadowNum(0), HEADING: shadowNum(0) } },
                    { kind: 'block', type: 'evn_pose_setup' },
                    { kind: 'block', type: 'evn_drivebase_gyro' },
                ],
            },
            {
                kind: 'category', name: 'Sensing', categorystyle: 'evn_sense_category',
                contents: [
                    { kind: 'block', type: 'evn_motor_measure' },
                    { kind: 'block', type: 'evn_motor_is' },
                    { kind: 'block', type: 'evn_drivebase_measure' },
                    { kind: 'block', type: 'evn_drivebase_is' },
                    { kind: 'block', type: 'evn_button_pressed' },
                    { kind: 'block', type: 'evn_battery_voltage' },
                    { kind: 'block', type: 'evn_battery_low', inputs: { THRESHOLD: shadowNum(6600) } },
                    { kind: 'block', type: 'evn_stopwatch_time' },
                ],
            },
            {
                kind: 'category', name: 'Timing', categorystyle: 'evn_time_category',
                contents: [
                    { kind: 'block', type: 'evn_wait', inputs: { TIME: shadowNum(1000) } },
                    { kind: 'block', type: 'evn_forever' },
                    { kind: 'block', type: 'evn_wait_until', inputs: { COND: { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } } } },
                    { kind: 'block', type: 'evn_wait_forever' },
                    { kind: 'block', type: 'evn_stopwatch_reset' },
                    { kind: 'block', type: 'evn_wait_for_button' },
                ],
            },
            {
                kind: 'category', name: 'Board', categorystyle: 'evn_board_category',
                contents: [
                    { kind: 'block', type: 'evn_led' },
                    { kind: 'block', type: 'evn_led_set', inputs: { ON: { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } } } },
                    { kind: 'block', type: 'text_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'hello' } } } } },
                    { kind: 'block', type: 'evn_button_pressed' },
                    { kind: 'block', type: 'evn_battery_voltage' },
                    { kind: 'block', type: 'evn_battery_low', inputs: { THRESHOLD: shadowNum(6600) } },
                ],
            },
            {
                kind: 'category', name: 'Data log', categorystyle: 'evn_board_category',
                contents: [
                    { kind: 'block', type: 'evn_datalog_setup' },
                    { kind: 'block', type: 'evn_datalog_add_motor', inputs: { RATE: shadowNum(0) } },
                    { kind: 'block', type: 'evn_datalog_add', inputs: { RATE: shadowNum(50) } },
                    { kind: 'block', type: 'evn_datalog_run' },
                    { kind: 'block', type: 'evn_datalog_run', fields: { ACTION: 'stop' } },
                    { kind: 'block', type: 'evn_datalog_row', inputs: { A: shadowNum(0) } },
                    { kind: 'block', type: 'evn_datalog_save' },
                ],
            },
            {
                // the board's flash file system: open() and os
                kind: 'category', name: 'Files', categorystyle: 'evn_board_category',
                contents: [
                    { kind: 'block', type: 'evn_file_write', inputs: { NAME: shadowText('notes.txt'), TEXT: shadowText('hello') } },
                    { kind: 'block', type: 'evn_file_read', inputs: { NAME: shadowText('notes.txt') } },
                    { kind: 'block', type: 'evn_file_exists', inputs: { NAME: shadowText('notes.txt') } },
                    { kind: 'block', type: 'evn_file_delete', inputs: { NAME: shadowText('notes.txt') } },
                    { kind: 'block', type: 'evn_file_list' },
                ],
            },
            {
                kind: 'category', name: 'Sensors', categorystyle: 'evn_sense_category',
                contents: [
                    group('Colour sensor', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_colorsensor_setup' },
                        { kind: 'block', type: 'evn_colorsensor_calibrate' },
                        { kind: 'block', type: 'evn_colorsensor_sees' },
                        { kind: 'block', type: 'evn_colorsensor_color' },
                        { kind: 'block', type: 'evn_colorsensor_ambient' },
                        { kind: 'block', type: 'evn_colorsensor_detect' },
                        { kind: 'block', type: 'evn_colorsensor_channel' },
                    ]),
                    group('Distance sensor', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_distance_setup' },
                        { kind: 'block', type: 'evn_distance_mm' },
                        { kind: 'block', type: 'evn_distance_profile' },
                    ]),
                    group('Gesture sensor', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_gesture_setup' },
                        { kind: 'block', type: 'evn_gesture_gesture' },
                        { kind: 'block', type: 'evn_gesture_wait', inputs: { TIMEOUT: shadowNum(5000) } },
                        { kind: 'block', type: 'evn_gesture_proximity' },
                        { kind: 'block', type: 'evn_gesture_color' },
                        { kind: 'block', type: 'evn_gesture_calibrate' },
                    ]),
                    group('Weather sensor', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_env_setup' },
                        { kind: 'block', type: 'evn_env_value' },
                    ]),
                    group('Compass', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_compass_setup' },
                        { kind: 'block', type: 'evn_compass_heading' },
                        { kind: 'block', type: 'evn_compass_north', inputs: { HEADING: shadowNum(0) } },
                        { kind: 'block', type: 'evn_compass_calibrate' },
                        { kind: 'block', type: 'evn_compass_coverage' },
                        { kind: 'block', type: 'evn_compass_calibrate_stop' },
                        { kind: 'block', type: 'evn_compass_calibrate_cancel' },
                    ]),
                    group('Touch pads', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_touch_setup' },
                        { kind: 'block', type: 'evn_touch_any' },
                        { kind: 'block', type: 'evn_touch_pad', inputs: { PAD: shadowNum(0) } },
                    ]),
                    group('IMU', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_imu_setup' },
                        { kind: 'block', type: 'evn_imu_angle' },
                        { kind: 'block', type: 'evn_imu_up' },
                        { kind: 'block', type: 'evn_imu_stationary' },
                        { kind: 'block', type: 'evn_imu_reset_heading', inputs: { ANGLE: shadowNum(0) } },
                        { kind: 'block', type: 'evn_imu_calibrate' },
                    ]),
                    group('ADC', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_adc_setup' },
                        { kind: 'block', type: 'evn_adc_voltage', inputs: { INPUT: shadowNum(0) } },
                    ]),
                ],
            },
            {
                kind: 'category', name: 'Outputs', categorystyle: 'evn_output_category',
                contents: [
                    group('Display', 'evn_output_category', [
                        { kind: 'block', type: 'evn_display_setup' },
                        { kind: 'block', type: 'evn_display_print', inputs: { TEXT: shadowText('hello') } },
                        { kind: 'block', type: 'evn_display_text', inputs: { TEXT: shadowText('hello'), COL: shadowNum(0), ROW: shadowNum(0) } },
                        { kind: 'block', type: 'evn_display_clear' },
                    ]),
                    group('LED matrix', 'evn_output_category', [
                        { kind: 'block', type: 'evn_matrix_setup' },
                        { kind: 'block', type: 'evn_matrix_icon' },
                        { kind: 'block', type: 'evn_matrix_number', inputs: { NUMBER: shadowNum(7) } },
                        { kind: 'block', type: 'evn_matrix_text', inputs: { TEXT: shadowText('hi') } },
                        { kind: 'block', type: 'evn_matrix_char', inputs: { CHAR: shadowText('A') } },
                        { kind: 'block', type: 'evn_matrix_pixel', inputs: { ROW: shadowNum(0), COL: shadowNum(0) } },
                        { kind: 'block', type: 'evn_matrix_brightness', inputs: { LEVEL: shadowNum(8) } },
                        { kind: 'block', type: 'evn_matrix_clear' },
                    ]),
                    group('7-segment', 'evn_output_category', [
                        { kind: 'block', type: 'evn_seven_setup' },
                        { kind: 'block', type: 'evn_seven_number', inputs: { NUMBER: shadowNum(1234) } },
                        { kind: 'block', type: 'evn_seven_text', inputs: { TEXT: shadowText('HELP') } },   // 'EVN' raised: no V glyph on 7 segments
                        { kind: 'block', type: 'evn_seven_colon' },
                        { kind: 'block', type: 'evn_seven_brightness', inputs: { LEVEL: shadowNum(8) } },
                        { kind: 'block', type: 'evn_seven_clear' },
                    ]),
                    group('RGB LEDs', 'evn_output_category', [
                        { kind: 'block', type: 'evn_rgb_setup' },
                        { kind: 'block', type: 'evn_rgb_fill', inputs: { COLOUR: shadowColour('RED') } },
                        { kind: 'block', type: 'evn_rgb_set', inputs: { LED: shadowNum(0), COLOUR: shadowColour('GREEN') } },
                        { kind: 'block', type: 'evn_rgb_brightness', inputs: { LEVEL: shadowNum(64) } },
                        { kind: 'block', type: 'evn_rgb_off' },
                        { kind: 'block', type: 'evn_color' },
                        { kind: 'block', type: 'evn_color_rgb', inputs: { R: shadowNum(255), G: shadowNum(120), B: shadowNum(0) } },
                    ]),
                    group('Servo', 'evn_output_category', [
                        { kind: 'block', type: 'evn_servo_setup' },
                        { kind: 'block', type: 'evn_servo_angle', inputs: { ANGLE: shadowNum(90) } },
                        { kind: 'block', type: 'evn_servo_move', inputs: { ANGLE: shadowNum(180), SPEED: shadowNum(60) } },
                        { kind: 'block', type: 'evn_servo_done' },
                        { kind: 'block', type: 'evn_servo_duty', inputs: { DUTY: shadowNum(50) } },
                        { kind: 'block', type: 'evn_servo_pulse', inputs: { US: shadowNum(1500) } },
                        { kind: 'block', type: 'evn_servo_stop' },
                    ]),
                    group('Bluetooth', 'evn_output_category', [
                        { kind: 'block', type: 'evn_bluetooth_setup', fields: { PORT: '2' } },
                        { kind: 'block', type: 'evn_bluetooth_send', fields: { PORT: '2' }, inputs: { TEXT: shadowText('hello') } },
                        { kind: 'block', type: 'evn_bluetooth_any', fields: { PORT: '2' } },
                        { kind: 'block', type: 'evn_bluetooth_line', fields: { PORT: '2' }, inputs: { TIMEOUT: shadowNum(5000) } },
                    ]),
                ],
            },
            {
                // the raw ports: a serial header as a UART, an I2C port for a chip with no category of its own
                kind: 'category', name: 'Serial and I2C', categorystyle: 'evn_output_category',
                contents: [
                    group('UART', 'evn_output_category', [
                        { kind: 'block', type: 'evn_uart_setup' },
                        { kind: 'block', type: 'evn_uart_send', inputs: { TEXT: shadowText('hello') } },
                        { kind: 'block', type: 'evn_uart_line', inputs: { TIMEOUT: shadowNum(1000) } },
                        { kind: 'block', type: 'evn_uart_read' },
                        { kind: 'block', type: 'evn_uart_any' },
                        { kind: 'block', type: 'evn_uart_clear' },
                    ]),
                    group('I2C', 'evn_output_category', [
                        { kind: 'block', type: 'evn_i2c_setup' },
                        { kind: 'block', type: 'evn_i2c_scan' },
                        { kind: 'block', type: 'evn_i2c_probe' },
                        { kind: 'block', type: 'evn_i2c_read' },
                        { kind: 'block', type: 'evn_i2c_read_bytes', fields: { REG: '3B' }, inputs: { COUNT: shadowNum(6) } },
                        { kind: 'block', type: 'evn_i2c_write', fields: { REG: '6B' }, inputs: { VALUE: shadowNum(1) } },
                    ]),
                ],
            },
            {
                // EVN Extended Peripherals (docs/EXTENDED_PERIPHERALS.md): kit people already own (not stocked by EVN)
                kind: 'category', name: 'Extended', categorystyle: 'evn_sense_category',
                contents: [
                    group('HiTechnic colour', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_htcolor_setup' },
                        { kind: 'block', type: 'evn_htcolor_calibrate' },
                        { kind: 'block', type: 'evn_htcolor_sees' },
                        { kind: 'block', type: 'evn_htcolor_color' },
                        { kind: 'block', type: 'evn_htcolor_value' },
                    ]),
                    group('HiTechnic compass', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_htcompass_setup' },
                        { kind: 'block', type: 'evn_htcompass_heading' },
                        { kind: 'block', type: 'evn_htcompass_north', inputs: { HEADING: shadowNum(0) } },
                        { kind: 'block', type: 'evn_htcompass_calibrate' },
                        { kind: 'block', type: 'evn_htcompass_calibrate_stop' },
                    ]),
                    group('HuskyLens', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_huskylens_setup' },
                        { kind: 'block', type: 'evn_huskylens_algorithm' },
                        { kind: 'block', type: 'evn_huskylens_count' },
                        { kind: 'block', type: 'evn_huskylens_block' },
                        { kind: 'block', type: 'evn_huskylens_arrow' },
                        { kind: 'block', type: 'evn_huskylens_learn', inputs: { ID: shadowNum(1) } },
                        { kind: 'block', type: 'evn_huskylens_learned' },
                        { kind: 'block', type: 'evn_huskylens_forget' },
                    ]),
                    group('VL53L1X distance', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_vl53l1x_setup' },
                        { kind: 'block', type: 'evn_vl53l1x_distance' },
                        { kind: 'block', type: 'evn_vl53l1x_mode' },
                        { kind: 'block', type: 'evn_vl53l1x_budget' },
                        { kind: 'block', type: 'evn_vl53l1x_inter', inputs: { MS: shadowNum(100) } },
                        { kind: 'block', type: 'evn_vl53l1x_roi' },
                        { kind: 'block', type: 'evn_vl53l1x_threshold', inputs: { VALUE: shadowNum(1024) } },
                        { kind: 'block', type: 'evn_vl53l1x_detect', inputs: { MM: shadowNum(200) } },
                        { kind: 'block', type: 'evn_vl53l1x_detect_window', inputs: { LOW: shadowNum(100), HIGH: shadowNum(300) } },
                        { kind: 'block', type: 'evn_vl53l1x_detected' },
                        { kind: 'block', type: 'evn_vl53l1x_detect_off' },
                        { kind: 'block', type: 'evn_vl53l1x_calibrate', inputs: { MM: shadowNum(140) } },
                        { kind: 'block', type: 'evn_vl53l1x_clear_calibration' },
                    ]),
                    group('TCS3430 colour', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_tcs3430_setup' },
                        { kind: 'block', type: 'evn_tcs3430_calibrate' },
                        { kind: 'block', type: 'evn_tcs3430_sees' },
                        { kind: 'block', type: 'evn_tcs3430_color' },
                        { kind: 'block', type: 'evn_tcs3430_value' },
                        { kind: 'block', type: 'evn_tcs3430_gain' },
                        { kind: 'block', type: 'evn_tcs3430_integration', inputs: { MS: shadowNum(100) } },
                        { kind: 'block', type: 'evn_tcs3430_wait', inputs: { MS: shadowNum(0) } },
                        { kind: 'block', type: 'evn_tcs3430_autozero' },
                        { kind: 'block', type: 'evn_tcs3430_window', inputs: { LOW: shadowNum(100), HIGH: shadowNum(900) } },
                        { kind: 'block', type: 'evn_tcs3430_left_window' },
                        { kind: 'block', type: 'evn_tcs3430_clear_window' },
                    ]),
                ],
            },
            { kind: 'sep' },
            {
                kind: 'category', name: 'Logic', categorystyle: 'logic_category',
                contents: [
                    { kind: 'block', type: 'controls_if' },
                    { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
                    { kind: 'block', type: 'logic_compare' },
                    { kind: 'block', type: 'logic_operation' },
                    { kind: 'block', type: 'logic_negate' },
                    { kind: 'block', type: 'logic_boolean' },
                ],
            },
            {
                kind: 'category', name: 'Loops', categorystyle: 'loop_category',
                contents: [
                    { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNum(10) } },
                    { kind: 'block', type: 'controls_whileUntil' },
                    { kind: 'block', type: 'controls_for', inputs: { FROM: shadowNum(1), TO: shadowNum(10), BY: shadowNum(1) } },
                    { kind: 'block', type: 'controls_flow_statements' },
                ],
            },
            {
                kind: 'category', name: 'Math', categorystyle: 'math_category',
                contents: [
                    { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
                    { kind: 'block', type: 'math_arithmetic', inputs: { A: shadowNum(1), B: shadowNum(1) } },
                    { kind: 'block', type: 'math_single', inputs: { NUM: shadowNum(9) } },
                    { kind: 'block', type: 'math_round', inputs: { NUM: shadowNum(3.1) } },
                    { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: shadowNum(64), DIVISOR: shadowNum(10) } },
                    { kind: 'block', type: 'math_constrain', inputs: { VALUE: shadowNum(50), LOW: shadowNum(1), HIGH: shadowNum(100) } },
                    { kind: 'block', type: 'math_random_int', inputs: { FROM: shadowNum(1), TO: shadowNum(100) } },
                ],
            },
            {
                kind: 'category', name: 'Text', categorystyle: 'text_category',
                contents: [
                    { kind: 'block', type: 'text' },
                    { kind: 'block', type: 'text_join' },
                    { kind: 'block', type: 'text_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'hello' } } } } },
                ],
            },
            { kind: 'category', name: 'Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
            { kind: 'category', name: 'Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' },
            { kind: 'sep' },
            {
                kind: 'category', name: 'Advanced', categorystyle: 'evn_advanced_category',
                contents: [
                    { kind: 'block', type: COMMENT },
                    { kind: 'block', type: 'evn_motor_calibrate' },
                    { kind: 'block', type: 'evn_motor_calibrated' },
                    // one limit at a time (Pybricks' "configure [maximum speed]"); the three-input evn_motor_limits still loads
                    // and generates, but set all three at once with made-up defaults, so it left the toolbox
                    { kind: 'block', type: 'evn_motor_limit', inputs: { VALUE: shadowNum(500) } },
                    { kind: 'block', type: 'evn_motor_dc', inputs: { DUTY: shadowNum(50) } },
                    { kind: 'block', type: 'evn_motor_track_target', inputs: { ANGLE: shadowNum(0) } },
                    { kind: 'block', type: 'evn_motor_law' },
                    { kind: 'block', type: 'evn_python' },
                    { kind: 'block', type: 'evn_python_value' },
                ],
            },
        ],
    };

    (function fillSetupCategory() {
        const setups = [];
        const walk = (items) => {
            for (const it of items) {
                if (it.kind === 'category' && it.contents) { walk(it.contents); }
                else if (it.kind === 'block' && SETUP_TYPES.indexOf(it.type) >= 0) { setups.push(it); }
            }
        };
        walk(TOOLBOX.contents.slice(1));
        TOOLBOX.contents[0].contents = [
            { kind: 'label', text: 'Put these under "set up": one for each motor, sensor or output the program uses' },
        ].concat(setups, [{ kind: 'block', type: COMMENT }]);
    }());

    /** Generate the MicroPython program for a workspace. */
    function workspaceToPython(workspace) {
        // the sections decide what runs; in the editor they are already applied (a no-op here), and mid-drag they
        // wait for the drop (a block just taken from the toolbox would show greyed while it is carried)
        if (!(workspace.isDragging && workspace.isDragging())) {
            Blockly.Events.disable();
            try { applySections(workspace); } finally { Blockly.Events.enable(); }
        }
        return generator.workspaceToCode(workspace);
    }

    // CORE_NAMES / DEVICE_NAMES are exported for scripts/test_blocks.js, which compares them with the module's table.
    Object.assign(api, { TOOLBOX, PALETTE, BLOCK_STYLES, CATEGORY_STYLES, workspaceToPython, CORE_NAMES, DEVICE_NAMES, SETUP_TYPES,
        CONNECTION_CHECKER, SETUP_HAT, PROGRAM_HAT, COMMENT, applySections, repairSections, upgradeWorkspace, loadWorkspace, setBoardConnected,
        SERIAL_TYPES, serialClash });
    if (typeof self !== 'undefined') { self.evnBlocks = api; }
    return api;
}));
