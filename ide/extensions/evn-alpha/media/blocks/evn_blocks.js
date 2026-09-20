/* EVN ALPHA blocks: block definitions and the MicroPython generators for the `evn` module.
 *
 * Loaded by the block editor webview (script tag: globals `Blockly` and `python`) and by
 * scripts/test_blocks.js under Node (require). Every block generates code against the API in
 * stubs/evn.pyi; a motor is `motor_<port>`, created once at the top of the program from the
 * "set up motor" block for that port (or `Motor(port)` when there is none).
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
        evn_output: '#8d5b8f',      // plum: displays, LEDs, servos, Bluetooth
        evn_time: '#c25e4f',        // terracotta
        evn_board: '#5f9e88',       // jade
        evn_advanced: '#5f6368',    // graphite
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
            tooltip: 'Options for one motor port. Put one anywhere in the workspace; without it a port uses clockwise and deg/s. Ports are the numbers on the board, 1 to 4.',
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
        {
            type: 'evn_stopwatch_time',
            message0: 'stopwatch time (ms)',
            output: 'Number', style: 'evn_time_blocks',
            tooltip: 'Milliseconds since the program started or the stopwatch was reset.',
        },
        {
            type: 'evn_stopwatch_reset',
            message0: 'reset stopwatch',
            previousStatement: null, nextStatement: null, style: 'evn_time_blocks',
            tooltip: 'Set the stopwatch back to 0.',
        },
        {
            type: 'evn_led',
            message0: 'turn LED %1',
            args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['on', 'on'], ['off', 'off'], ['toggle', 'toggle']] }],
            previousStatement: null, nextStatement: null, style: 'evn_board_blocks',
            tooltip: 'The user LED on the board.',
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
            type: 'evn_motor_calibrate',
            message0: 'calibrate motor %1',
            args0: [{ type: 'field_dropdown', name: 'PORT', options: PORTS }],
            previousStatement: null, nextStatement: null, style: 'evn_advanced_blocks',
            tooltip: 'Self-calibration (about 4.5 s; the shaft must be free to turn). Measures the motor and its full speed; stored on the board for this port. Run it once after plugging in a motor.',
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
            tooltip: 'One line of MicroPython, inserted as written. motor_1 .. motor_4 are the motors, drive_base the robot and color_sensor_3, imu_1 ... the peripherals (each defined when mentioned); the evn module is imported, so Pose, UART, I2C, Flash, core1_status() and evn.version are all reachable.',
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
            tooltip: 'The EVN colour sensor (TCS34725) on an I2C port, 1 to 16. Put one anywhere in the workspace; the colour-sensor blocks make the object by themselves, this block just says which ports the program uses.',
        },
        {
            type: 'evn_colorsensor_color',
            message0: 'colour sensor %1 colour',
            args0: [portField(I2C_PORTS)],
            output: null, style: 'evn_sense_blocks',
            tooltip: 'The colour the sensor sees: red, yellow, green, blue, white or nothing.',
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
            message0: 'colour sensor %1 reflection (%%)',
            args0: [portField(I2C_PORTS)],
            output: 'Number', style: 'evn_sense_blocks',
            tooltip: 'How much light comes back, 0 (black) to 100 (white).',
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
            message0: 'call this way north on compass %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The direction the robot points right now becomes heading 0.',
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
            tooltip: 'Work out and use the calibration. It raises an error when the sensor did not turn through enough directions, so keep spinning until this block runs.',
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
            message0: 'set up IMU on port %1',
            args0: [portField(I2C_PORTS)],
            style: 'evn_sense_blocks',
            tooltip: 'The EVN IMU (MPU-6500 gyro and accelerometer) on an I2C port, 1 to 16. Keep the robot still for the first 15 seconds so it can settle.',
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
            message0: 'IMU %1 is still',
            args0: [portField(I2C_PORTS)],
            output: 'Boolean', style: 'evn_sense_blocks',
            tooltip: 'True while the robot is not moving or turning.',
        },
        {
            type: 'evn_imu_reset_heading',
            message0: 'set IMU %1 heading to 0',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_sense_blocks',
            tooltip: 'The way the robot points right now becomes heading 0.',
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
            tooltip: 'Up to four characters. A full stop after a character lights that digit’s dot.',
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
                        ['Geekservo 270 degrees', 'geekservo_270'], ['generic 180 degrees', 'generic'], ['Geekservo continuous', 'geekservo_cr'],
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
            tooltip: 'Go straight to an angle, 0 to the servo’s range (270 degrees for the kit’s servo).',
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
            message0: 'Bluetooth %1 received line',
            args0: [portField(SERIAL_PORTS)],
            output: 'String', style: 'evn_output_blocks',
            tooltip: 'Wait up to 5 seconds for a line of text from the other side, and give it without its newline (empty text when nothing arrives).',
        },
    ]);

    /* ---- drive base (evn.DriveBase: two motors as a robot; mm, deg clockwise) -------------- */

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
            message0: 'robot follows its gyro: IMU on port %1',
            args0: [portField(I2C_PORTS)],
            previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'The robot itself, not just its wheels, follows every straight, turn and arc: the wheel encoders and an EVN IMU on this port track where the robot really is (evn.Pose) and each move is corrected as it goes, so scrub on a turn, a dragged cable and the gyro\'s drift no longer add up over minutes. Put it before the first move and keep the robot still: it waits (up to 30 s) for the IMU to settle. Uses the "set up robot" geometry; one per program (a second block only repeats the switch-on).',
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
            message0: 'drive an arc of radius %1 mm through %2 degrees',
            args0: [
                { type: 'input_value', name: 'RADIUS', check: 'Number' },
                { type: 'input_value', name: 'ANGLE', check: 'Number' },
            ],
            message1: 'then %1 wait %2',
            args1: [
                { type: 'field_dropdown', name: 'THEN', options: DB_THEN },
                { type: 'field_checkbox', name: 'WAIT', checked: true },
            ],
            inputsInline: true, previousStatement: null, nextStatement: null, style: 'evn_motor_blocks',
            tooltip: 'Drive along a circle: a positive radius curves to the right, a negative one to the left; a negative angle drives the arc backwards.',
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

    /* ---- generator helpers --------------------------------------------------------------- */

    /* The names of the `evn` module a program can use. CORE_NAMES are what a hand-written Python
     * block always gets; a peripheral class is imported only when a block (or a Python block that
     * spells it out) needs it, so the import line stays short. */
    const CORE_NAMES = ['Motor', 'Port', 'Stop', 'Direction', 'SpeedUnit', 'wait', 'StopWatch', 'battery', 'button', 'led', 'stop_all'];
    /* Everything else the module offers. A name is imported when a block needs it or when a Python
     * block spells it out - which is why the list has to hold the classes that have no block of
     * their own as well (Pose is the drive base, and a blocks user has no other way to reach it). */
    const DEVICE_NAMES = ['Color', 'Icon', 'Side', 'ColorSensor', 'DistanceSensor', 'GestureSensor', 'EnvSensor',
        'Compass', 'TouchArray', 'IMU', 'ADC', 'Display', 'MatrixLED', 'SevenSegmentLED', 'RGBLED', 'Servo', 'Bluetooth',
        'DriveBase', 'Pose', 'UART', 'I2C', 'Flash', 'reset', 'reset_cause', 'bootloader', 'core1_status', 'version'];
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
    generator.addReservedWords('evn,motor_1,motor_2,motor_3,motor_4,stopwatch,drive_base,pose,' +
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
        // the drive base is built from two motor objects: its line goes after the (regrouped) motors
        if (this.definitions_.drive_base) {
            const d = this.definitions_.drive_base;
            delete this.definitions_.drive_base;
            this.definitions_.drive_base = d;
        }
        // the pose names the IMU's port: its line goes after the (regrouped) devices
        if (this.definitions_.pose) {
            const p = this.definitions_.pose;
            delete this.definitions_.pose;
            this.definitions_.pose = p;
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
            generator.definitions_[name] = name + ' = DriveBase(' + l + ', ' + r + ', wheel_diameter=' + g.wheel + ', axle_track=' + g.track + ')';
        }
        return name;
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

    /** Whether the port's "set up motor" block makes counterclockwise its positive direction (a mirrored
     * mount). The Pose reads the encoders directly, so it needs the same fact as `reverse_left=` / `reverse_right=`. */
    function motorReversed(block, port) {
        const setup = block.workspace.getBlocksByType('evn_motor_setup', false)
            .find((b) => b.isEnabled() && b.getFieldValue('PORT') === port);
        return !!setup && setup.getFieldValue('DIRECTION') === 'CCW';
    }

    /** Name of the robot's Pose object (the drive base's wheels plus the IMU on `imuPort`), defining it once.
     * The IMU object has to exist before the Pose names its port (Pose raises OSError otherwise): finish()
     * puts the `pose = ...` line after the devices. */
    function poseRef(block, imuPort) {
        const name = 'pose';
        if (!generator.definitions_[name]) {
            const g = driveGeometry(block);
            deviceRef(block, 'IMU', imuPort);
            use('Pose');
            generator.definitions_[name] = name + ' = Pose(' + g.left + ', ' + g.right + ', wheel_diameter=' + g.wheel + ', axle_track=' + g.track
                + (motorReversed(block, g.left) ? ', reverse_left=True' : '')
                + (motorReversed(block, g.right) ? ', reverse_right=True' : '')
                + ', imu=' + imuPort + ')';
        }
        return name;
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
        const db = driveRef(block);
        poseRef(block, block.getFieldValue('PORT'));
        return db + '.use_gyro(True)\n';
    };
    generator.forBlock['evn_drivebase_straight'] = function (block) {
        return driveRef(block) + '.straight(' + value(block, 'DISTANCE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_drivebase_turn'] = function (block) {
        return driveRef(block) + '.turn(' + value(block, 'ANGLE', '0') + moveTail(block, 'HOLD') + ')\n';
    };
    generator.forBlock['evn_drivebase_arc'] = function (block) {
        return driveRef(block) + '.arc(' + value(block, 'RADIUS', '100') + ', angle=' + value(block, 'ANGLE', '0') + moveTail(block, 'HOLD') + ')\n';
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
    generator.forBlock['evn_forever'] = function (block) {
        const body = generator.statementToCode(block, 'DO') || generator.PASS;
        return 'while True:\n' + body;
    };
    generator.forBlock['evn_stopwatch_time'] = function () {
        use('StopWatch');
        generator.definitions_['stopwatch'] = 'stopwatch = StopWatch()';
        return ['stopwatch.time()', Order.FUNCTION_CALL];
    };
    generator.forBlock['evn_stopwatch_reset'] = function () {
        use('StopWatch');
        generator.definitions_['stopwatch'] = 'stopwatch = StopWatch()';
        return 'stopwatch.reset()\n';
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
    generator.forBlock['evn_motor_calibrate'] = function (block) {
        return motorRef(block) + '.calibrate()\n';
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

    generator.forBlock['evn_colorsensor_setup'] = setupGenerator('ColorSensor');
    generator.forBlock['evn_colorsensor_color'] = call('ColorSensor', 'color');
    generator.forBlock['evn_colorsensor_ambient'] = call('ColorSensor', 'ambient');
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
    generator.forBlock['evn_gesture_wait'] = function (block) {
        return [deviceRef(block, 'GestureSensor') + '.read_gesture(' + value(block, 'TIMEOUT', '5000') + ')', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_env_setup'] = setupGenerator('EnvSensor');
    generator.forBlock['evn_env_value'] = function (block) {
        return [deviceRef(block, 'EnvSensor') + '.' + block.getFieldValue('WHAT') + '()', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_compass_setup'] = setupGenerator('Compass');
    generator.forBlock['evn_compass_heading'] = call('Compass', 'heading');
    generator.forBlock['evn_compass_north'] = doCall('Compass', 'north');
    generator.forBlock['evn_compass_calibrate'] = function (block) {
        const planar = block.getFieldValue('PLANAR') === 'TRUE';
        return deviceRef(block, 'Compass') + '.calibrate(' + (planar ? 'True' : '') + ')\n';
    };
    generator.forBlock['evn_compass_calibrate_stop'] = doCall('Compass', 'calibrate_stop');

    generator.forBlock['evn_touch_setup'] = setupGenerator('TouchArray');
    generator.forBlock['evn_touch_any'] = call('TouchArray', 'pressed');
    generator.forBlock['evn_touch_pad'] = function (block) {
        return [deviceRef(block, 'TouchArray') + '.read(' + value(block, 'PAD', '0') + ')', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_imu_setup'] = setupGenerator('IMU');
    generator.forBlock['evn_imu_angle'] = pick('IMU', 'WHAT');
    generator.forBlock['evn_imu_stationary'] = call('IMU', 'stationary');
    generator.forBlock['evn_imu_reset_heading'] = doCall('IMU', 'reset_heading');
    generator.forBlock['evn_imu_up'] = function (block) {
        use('Side');
        return [deviceRef(block, 'IMU') + '.up() == Side.' + block.getFieldValue('SIDE'), Order.RELATIONAL];
    };

    generator.forBlock['evn_adc_setup'] = setupGenerator('ADC');
    generator.forBlock['evn_adc_voltage'] = function (block) {
        return [deviceRef(block, 'ADC') + '.voltage(' + value(block, 'INPUT', '0') + ')', Order.FUNCTION_CALL];
    };

    generator.forBlock['evn_display_setup'] = setupGenerator('Display');
    generator.forBlock['evn_display_clear'] = doCall('Display', 'clear');
    generator.forBlock['evn_display_text'] = function (block) {
        return deviceRef(block, 'Display') + '.text(' + value(block, 'COL', '0') + ', ' + value(block, 'ROW', '0') +
            ', ' + value(block, 'TEXT', "''") + ')\n';
    };
    generator.forBlock['evn_display_print'] = function (block) {
        return deviceRef(block, 'Display') + '.print(' + value(block, 'TEXT', "''") + ')\n';
    };

    generator.forBlock['evn_matrix_setup'] = setupGenerator('MatrixLED');
    generator.forBlock['evn_matrix_clear'] = doCall('MatrixLED', 'clear');
    generator.forBlock['evn_matrix_number'] = doNumber('MatrixLED', 'number', 'NUMBER', '0');
    generator.forBlock['evn_matrix_brightness'] = doNumber('MatrixLED', 'brightness', 'LEVEL', '8');
    generator.forBlock['evn_matrix_text'] = function (block) {
        return deviceRef(block, 'MatrixLED') + '.text(' + value(block, 'TEXT', "''") + ')\n';
    };
    generator.forBlock['evn_matrix_icon'] = function (block) {
        use('Icon');
        return deviceRef(block, 'MatrixLED') + '.icon(Icon.' + block.getFieldValue('ICON') + ')\n';
    };
    generator.forBlock['evn_matrix_pixel'] = function (block) {
        return deviceRef(block, 'MatrixLED') + '.pixel(' + value(block, 'ROW', '0') + ', ' + value(block, 'COL', '0') +
            ', ' + (block.getFieldValue('ON') === 'TRUE' ? 'True' : 'False') + ')\n';
    };

    generator.forBlock['evn_seven_setup'] = setupGenerator('SevenSegmentLED');
    generator.forBlock['evn_seven_clear'] = doCall('SevenSegmentLED', 'clear');
    generator.forBlock['evn_seven_number'] = doNumber('SevenSegmentLED', 'number', 'NUMBER', '0');
    generator.forBlock['evn_seven_brightness'] = doNumber('SevenSegmentLED', 'brightness', 'LEVEL', '8');
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
    generator.forBlock['evn_rgb_brightness'] = doNumber('RGBLED', 'brightness', 'LEVEL', '64');
    generator.forBlock['evn_rgb_fill'] = function (block) {
        return deviceRef(block, 'RGBLED') + '.fill(' + value(block, 'COLOUR', '(0, 0, 0)') + ')\n';
    };
    generator.forBlock['evn_rgb_set'] = function (block) {
        return deviceRef(block, 'RGBLED') + '.set(' + value(block, 'LED', '0') + ', ' + value(block, 'COLOUR', '(0, 0, 0)') + ')\n';
    };

    generator.forBlock['evn_servo_setup'] = setupGenerator('Servo');
    generator.forBlock['evn_servo_stop'] = doCall('Servo', 'stop');
    generator.forBlock['evn_servo_angle'] = doNumber('Servo', 'angle', 'ANGLE', '90');
    generator.forBlock['evn_servo_pulse'] = doNumber('Servo', 'pulse', 'US', '1500');

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
     * where a "read everything" Python block can still find it. None on timeout becomes ''. */
    generator.forBlock['evn_bluetooth_line'] = function (block) {
        return ['(' + deviceRef(block, 'Bluetooth') + ".readline(5000) or b'').decode()", Order.FUNCTION_CALL];
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

    /** The highest port number a class has: the firmware raises ValueError outside it. */
    function maxPort(cls) { return (cls === 'Servo' || cls === 'RGBLED') ? 4 : 16; }

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
        for (const m of bare.matchAll(/\bmotor_([1-4])\b/g)) { motorRef(block, m[1]); }
        if (/\bdrive_base\b/.test(bare)) { driveRef(block); }
        for (const cls of Object.keys(DEVICES)) {
            for (const m of bare.matchAll(new RegExp('\\b' + DEVICES[cls][0] + '_(\\d+)\\b', 'g'))) {
                const port = Number(m[1]);
                if (port >= 1 && port <= maxPort(cls)) { deviceRef(block, cls, m[1]); }
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
                    { kind: 'block', type: 'evn_drivebase_reset' },
                    { kind: 'block', type: 'evn_drivebase_setup' },
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
                    { kind: 'block', type: 'evn_stopwatch_time' },
                ],
            },
            {
                kind: 'category', name: 'Timing', categorystyle: 'evn_time_category',
                contents: [
                    { kind: 'block', type: 'evn_wait', inputs: { TIME: shadowNum(1000) } },
                    { kind: 'block', type: 'evn_forever' },
                    { kind: 'block', type: 'evn_stopwatch_reset' },
                    { kind: 'block', type: 'evn_wait_for_button' },
                ],
            },
            {
                kind: 'category', name: 'Board', categorystyle: 'evn_board_category',
                contents: [
                    { kind: 'block', type: 'evn_led' },
                    { kind: 'block', type: 'text_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'hello' } } } } },
                    { kind: 'block', type: 'evn_button_pressed' },
                    { kind: 'block', type: 'evn_battery_voltage' },
                ],
            },
            {
                kind: 'category', name: 'Sensors', categorystyle: 'evn_sense_category',
                contents: [
                    group('Colour sensor', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_colorsensor_setup' },
                        { kind: 'block', type: 'evn_colorsensor_sees' },
                        { kind: 'block', type: 'evn_colorsensor_color' },
                        { kind: 'block', type: 'evn_colorsensor_ambient' },
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
                    ]),
                    group('Weather sensor', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_env_setup' },
                        { kind: 'block', type: 'evn_env_value' },
                    ]),
                    group('Compass', 'evn_sense_category', [
                        { kind: 'block', type: 'evn_compass_setup' },
                        { kind: 'block', type: 'evn_compass_heading' },
                        { kind: 'block', type: 'evn_compass_north' },
                        { kind: 'block', type: 'evn_compass_calibrate' },
                        { kind: 'block', type: 'evn_compass_calibrate_stop' },
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
                        { kind: 'block', type: 'evn_imu_reset_heading' },
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
                        { kind: 'block', type: 'evn_matrix_pixel', inputs: { ROW: shadowNum(0), COL: shadowNum(0) } },
                        { kind: 'block', type: 'evn_matrix_brightness', inputs: { LEVEL: shadowNum(8) } },
                        { kind: 'block', type: 'evn_matrix_clear' },
                    ]),
                    group('7-segment', 'evn_output_category', [
                        { kind: 'block', type: 'evn_seven_setup' },
                        { kind: 'block', type: 'evn_seven_number', inputs: { NUMBER: shadowNum(1234) } },
                        { kind: 'block', type: 'evn_seven_text', inputs: { TEXT: shadowText('EVN') } },
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
                        { kind: 'block', type: 'evn_servo_pulse', inputs: { US: shadowNum(1500) } },
                        { kind: 'block', type: 'evn_servo_stop' },
                    ]),
                    group('Bluetooth', 'evn_output_category', [
                        { kind: 'block', type: 'evn_bluetooth_setup', fields: { PORT: '2' } },
                        { kind: 'block', type: 'evn_bluetooth_send', fields: { PORT: '2' }, inputs: { TEXT: shadowText('hello') } },
                        { kind: 'block', type: 'evn_bluetooth_any', fields: { PORT: '2' } },
                        { kind: 'block', type: 'evn_bluetooth_line', fields: { PORT: '2' } },
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
                    { kind: 'block', type: 'evn_motor_calibrate' },
                    { kind: 'block', type: 'evn_motor_limits', inputs: { SPEED: shadowNum(1000), ACCEL: shadowNum(2400), TORQUE: shadowNum(400) } },
                    { kind: 'block', type: 'evn_motor_dc', inputs: { DUTY: shadowNum(50) } },
                    { kind: 'block', type: 'evn_motor_track_target', inputs: { ANGLE: shadowNum(0) } },
                    { kind: 'block', type: 'evn_motor_law' },
                    { kind: 'block', type: 'evn_python' },
                    { kind: 'block', type: 'evn_python_value' },
                ],
            },
        ],
    };

    /** Generate the MicroPython program for a workspace. */
    function workspaceToPython(workspace) {
        return generator.workspaceToCode(workspace);
    }

    const api = { TOOLBOX, PALETTE, BLOCK_STYLES, CATEGORY_STYLES, workspaceToPython };
    if (typeof self !== 'undefined') { self.evnBlocks = api; }
    return api;
}));
