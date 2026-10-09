"""Controllers: complete

Every part of PID and ADRC, the controllers your program builds for its own loops (computed on the board in C;
nothing moves until the program sends the output somewhere). Build as many as you need, one variable each.

1. A line follower: a PID turns the robot from the colour sensor's brightness for 5 s; its terms printed.
2. A heading hold: an ADRC keeps the robot's heading where it started, on the IMU, for 5 s - push the robot
   by hand and watch `disturbance` (your push, in deg/s) while it turns back.
3. The settings read back and changed, a slow loop given its own dt_max, and what a bad value raises.

Needs: a robot: left wheel motor on port 4 (mounted mirrored), right on port 3, 62.4 mm wheels 170 mm apart;
an EVN colour sensor on I2C port 2 facing the floor a few mm up, over the edge of a dark line on a light floor;
an EVN IMU on I2C port 1
"""
from evn import Motor, Direction, DriveBase, ColorSensor, IMU, PID, ADRC, wait, stop_all

sensor = ColorSensor(2)
imu = IMU(1)
base = DriveBase(Motor(4, Direction.COUNTERCLOCKWISE), Motor(3), wheel_diameter=62.4, axle_track=170)

try:
    # 1. PID: kp, ki (per second), kd (seconds); the derivative filtered over 20 ms; the output (a turn rate,
    # deg/s) clamped to +-120 and the integral to +-40 of it
    pid = PID(1.5, 0.2, 0.08, filter=20, limits=120, integral_limit=40)
    edge = 34                                   # half way between the line's and the floor's brightness
    for _ in range(500):
        turn = pid.update(edge, sensor.hsv().v)  # dt measured by the board between calls
        base.drive(120, turn)
        wait(10)
    base.stop()
    print('P', pid.p, 'I', pid.i, 'D', pid.d, '=', pid.output, 'error', pid.error, 'saturated', pid.saturated)

    # the settings: read them, change some (the state is kept), remove the limits, read them again
    print(pid.settings())                       # (kp, ki, kd, filter, limits, integral_limit, dt_max)
    pid.settings(kp=2.0, kd=0.1)
    pid.settings(limits=False, integral_limit=False)
    print(pid.settings())
    pid.reset()                                 # the next update only seeds (no derivative kick)

    # a loop slower than dt_max (200 ms by default) states it: dt_max=, or dt= given in ms
    slow = PID(0.5, 0.05, dt_max=1000)
    for _ in range(3):
        print(slow.update(20, imu.heading()), slow.restarted)
        wait(500)
    print(slow.update(20, imu.heading(), dt=500))

    # 2. ADRC order 1: heading' = 1 * turn_rate + disturbance, so b0 = 1; it settles in about 4 / wc s;
    # wo (the observer) defaults to 4 wc; the limit is drive()'s turn rate
    hold = ADRC(1, 6, order=1, limits=180, dt_max=200)
    while not imu.ready():                      # the gyro settles first (the heading would drift meanwhile)
        wait(10)
    target = imu.heading()
    for _ in range(500):
        base.drive(0, hold.update(target, imu.heading()))
        wait(10)
    base.stop()
    print('estimate', hold.estimate, 'rate', hold.rate, 'disturbance', hold.disturbance,
          'output', hold.output, 'error', hold.error, 'saturated', hold.saturated, 'restarted', hold.restarted)
    print(hold.settings())                      # (b0, wc, wo, order, limits, dt_max)
    hold.settings(wc=8)                         # wo follows: 32
    hold.settings(wo=40, limits=(-90, 90))      # wo set: it stays when wc changes
    hold.reset()
    print(hold.settings())

    # order 2: a position through an acceleration (here only built, to read its settings)
    position = ADRC(b0=2.0, wc=8, order=2, wo=32)
    print(position.settings(), position.rate)

    # 3. a bad value raises ValueError and changes nothing
    for bad in (lambda: PID(float('nan')), lambda: ADRC(0, 5), lambda: ADRC(1, 5, order=3),
                lambda: pid.update(10, float('inf')), lambda: pid.settings(limits=(1, 1)), lambda: PID(1, limits=0),
                lambda: hold.update(0, 0, dt=0)):
        try:
            bad()
        except ValueError as e:
            print('ValueError:', e)
finally:
    stop_all()
