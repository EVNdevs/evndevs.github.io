"""A tour of the EVN Standard Peripherals.

Each device is plug-and-play: name the port, read. The firmware identifies the
chip, configures it, keeps the latest reading fresh in the background and
re-attaches it after an unplug. Every constructor raises OSError when nothing
answers on its port, so each block below is guarded: plug in what you have and
the rest is skipped. Ports are the numbers printed on the board.

All fifteen peripherals are bench-validated on EVN modules (the dates are in
docs/STANDARD_PERIPHERALS.md).

Needs: any of the standard peripherals, on the ports named below; the rest is skipped.
"""
from evn import (ADC, EnvSensor, Compass, TouchArray, GestureSensor, DistanceSensor, IMU,
                 MatrixLED, SevenSegmentLED, Display, RGBLED, Bluetooth, Servo, Color, Side, Icon, wait)


def try_open(cls, *args, **kwargs):
    try:
        dev = cls(*args, **kwargs)
        print("found", dev)
        return dev
    except OSError as e:
        print(cls.__name__, "not on", args[0], "-", e)
        return None


# --- sensors on I2C ports (SDA/SCL only) --------------------------------------
adc = try_open(ADC, 3)
if adc:
    adc.inputs((0, 1))                       # scan AIN0 and AIN1 in turn
    print("range", adc.range(), "V full scale")   # default +-4.096 V, never put more than 3.6 V on a pin
    print("AIN0 %.3f V  AIN1 %.3f V" % (adc.read(0), adc.read(1)))

env = try_open(EnvSensor, 4)
if env:
    t, p, h = env.read()                     # waits for the next measurement
    print("%.2f degC  %.0f Pa  %.1f %%RH" % (t, p, h))

compass = try_open(Compass, 2)
if compass:
    # One-off calibration: start, tumble the sensor through every orientation
    # (a floor robot: calibrate(planar=True) and spin on the spot), stop.
    # calibrate_stop() raises ValueError while the sensor has not seen enough
    # directions, and keeps collecting - turn more and stop again, or give up
    # with calibrate_cancel().
    compass.calibrate()
    wait(8000)
    try:
        print("calibration", compass.calibrate_stop())   # (residual, coverage, samples)
        cal = compass.calibration()          # save this and restore it with compass.calibration(*cal)
    except ValueError as e:
        print("not calibrated:", e)
        compass.calibrate_cancel()
    compass.north()                          # where it points now = 0 degrees
    for _ in range(5):
        print("heading %.1f" % compass.heading())
        wait(200)

touch = try_open(TouchArray, 6)
if touch:
    print("thresholds", touch.thresholds())  # (touch, release) of channel 0; thresholds(3) reads channel 3
    for _ in range(20):
        pressed, released = touch.events()   # edge masks since the last call
        if pressed:
            print("pressed", [n for n in range(12) if pressed & (1 << n)])
        wait(50)

gesture = try_open(GestureSensor, 7)
if gesture:
    print("wave a hand over the sensor ...")
    print("gesture:", gesture.read_gesture(timeout=5000), "proximity", gesture.proximity(), "colour", gesture.color())

dist = try_open(DistanceSensor, 8)
if dist:
    for _ in range(5):
        print("distance", dist.read(), "mm", dist.status())

imu = try_open(IMU, 1)
if imu:
    imu.reset_heading()                      # the current pose = heading 0
    for _ in range(5):
        # heading() keeps growing past 360, as Pybricks; tilt() is (pitch, roll),
        # both in (-180, 180], so an upside-down module is not mistaken for a level one
        print("heading %.1f  tilt %s  up %s  stationary %s" % (imu.heading(), imu.tilt(), imu.up() == Side.TOP, imu.stationary()))
        wait(100)
    print("tap the sensor ...")
    wait(2000)
    print("tap:", imu.tap())

# --- displays on I2C ports ------------------------------------------------------
matrix = try_open(MatrixLED, 9)
if matrix:
    matrix.bitmap(b'\x18\x3c\x7e\xff\xff\x7e\x3c\x18')   # a diamond
    matrix.brightness(4)
    wait(500)
    matrix.icon(Icon.HEART)                  # the Pybricks icon set at 8x8
    wait(500)
    matrix.pixel(0, 7)                       # (row, column) as Pybricks hub.display
    matrix.number(42)                        # -99..99
    wait(500)
    matrix.text("EVN", on=400, off=50)       # one character at a time, blocks until done
    matrix.animate([Icon.HAPPY, Icon.SAD], 400)   # runs in the background from here on

seg = try_open(SevenSegmentLED, 10)
if seg:
    seg.number(12.34)
    wait(1000)
    seg.text("HELP")                         # only letters with a seven-segment glyph
    seg.colon(True)

oled = try_open(Display, 11)
if oled:
    oled.splash()
    wait(1000)
    oled.clear()
    oled.label(0, "Dist:")
    oled.data(0, dist.distance() if dist else "--")
    oled.rect(0, 20, 127, 40)
    oled.text(2, 4, "hello", invert=True)
    oled.draw_circle(100, 30, 8, fill=True)  # EV3 screen names: draw_*, print(), width / height
    oled.draw_box(4, 44, 60, 62, r=4)
    oled.draw_text(8, 48, "box")
    oled.print("w", oled.width, "h", oled.height)   # at the cursor; wraps and scrolls
    # oled.mirror(True)   # the REPL and every print() would scroll on the panel too, USB or not

# --- servo ports and serial ports ------------------------------------------------
leds = try_open(RGBLED, 1)                  # EVN RGB LED module on servo port 1 (8 LEDs)
if leds:
    leds.brightness(40)
    for i in range(8):
        r, g, b = leds.hsv(i * 45, 100, 100)
        leds.set(i, r, g, b)
    wait(1000)
    leds.on(Color.BLUE)                      # Pybricks hub.light names
    wait(500)
    leds.blink(Color.GREEN, [200, 200])      # in the background (each step at least 2 ms)
    wait(1200)
    leds.animate([Color.RED, Color.YELLOW, Color.BLUE], 150)
    wait(1200)
    leds.off()
    leds.close()                             # gives servo port 1 back

servo = try_open(Servo, 2)                   # Geekservo 270 degrees (the default profile): 600..2400 us, starts at 135
if servo:
    servo.move(270, speed=200)               # sweep to 270 at 200 deg/s, waits until there
    servo.move(0, speed=400)
    servo.angle(135)                         # jump

wheel = try_open(Servo, 3, profile="geekservo_cr")   # Geekservo continuous rotation
if wheel:
    wheel.duty(50)                           # half speed forward
    wait(1000)
    wheel.stop()
    wheel.close()                            # gives servo port 3 back (the pin goes low)

bt = try_open(Bluetooth, 1, name="EVN Bot")   # Serial 1, 230400 baud; hold the module's button at power-on to program it
if bt:
    print("configured this boot:", bt.configured(), "state", bt.state())
    bt.write(b"hello from EVN\n")
    line = bt.readline(timeout=2000)         # a whole line without its newline, or None on timeout
    if line is not None:
        print("received", line)
    print("dropped by a slow reader:", bt.overflow(), "bytes")
