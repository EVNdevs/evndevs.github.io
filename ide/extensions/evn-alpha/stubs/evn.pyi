"""EVN ALPHA MicroPython API (autocomplete stub).

Everything a program needs is in this module:

    from evn import Motor, Port, Stop, Direction, SpeedUnit, wait, StopWatch

Ports are the EVN numbers 1..4 (`Port.A..D` are the same integers); I2C ports are 1..16,
servo ports 1..4, serial ports 1..2.

Units: angle deg, speed deg/s, acceleration deg/s^2, time ms, duty %, torque mNm, voltage mV.

Signatures follow the firmware bindings (`micropython/modules/evn_*.c`). A parameter written
before ``/`` is positional-only: the binding takes no keywords for it. A parameter written
after ``*`` is keyword-only.
"""
from typing import List, Optional, Sequence, Tuple, Type, Union, overload

version: str
"""Firmware API version string, e.g. "0.1.0"."""


class Port:
    """Port names as integers: A..D are the EVN port numbers 1..4 (M1..M4)."""
    A: int  # = 1  motor port 1 (M1)
    B: int  # = 2  motor port 2 (M2)
    C: int  # = 3  motor port 3 (M3)
    D: int  # = 4  motor port 4 (M4)


class Direction:
    """The positive direction of a ``Motor`` (``Motor(port, positive_direction=...)``)."""
    CLOCKWISE: int  # = 0, the firmware's positive direction (physically clockwise looking at the shaft)
    COUNTERCLOCKWISE: int  # = 1, flips angle, speed, load, duty and targets


class Stop:
    """What a motor does at the end of a maneuver (the ``then=`` argument of ``run_angle()``, ``straight()`` ...)."""
    COAST: int  # = 0  release the motor
    BRAKE: int  # = 1  passive brake (both bridge inputs high)
    HOLD: int  # = 2   keep regulating at the target (default for profiled moves)
    NONE: int  # = 3   no deceleration: reach the target at speed and keep running
    COAST_SMART: int  # = 4  coast, and start the next relative move from the remembered target - only while the
                      #       shaft still stands within twice the position tolerance of it (Pybricks), else from where it is


class SpeedUnit:
    """Unit of every speed value a Motor takes or reports (``Motor(..., speed_unit=)`` / ``motor.speed_unit()``)."""
    DEG_S: int  # = 0  degrees per second (default)
    PERCENT: int  # = 1  percent of ``full_speed()``, the no-load speed at the present battery voltage


_Then = int
_Gears = Union[Sequence[int], Sequence[Sequence[int]], None]


class Control:
    """Per-motor controller settings (``motor.control``).

    Every method raises ``RuntimeError`` after the motor's ``close()`` ("motor closed; create a
    new Motor") and ``RuntimeError`` when the motion engine is not running. Out-of-range values
    raise ``ValueError``. Setters block until Core 1 has applied the value (at most 5 ms), so a
    getter called straight after a setter reads the new value.
    """

    scale: float
    """Motor degrees per output degree (from ``gears``). Read-only."""

    @overload
    def limits(self) -> Tuple[int, Union[int, Tuple[int, int]], int]: ...
    @overload
    def limits(self, speed: Optional[float] = None, acceleration: Union[float, Tuple[float, float], None] = None,
               torque: Optional[float] = None) -> None:
        """Set the speed (deg/s), acceleration (deg/s^2, or an ``(accel, decel)`` tuple) and torque (mNm) limits.

        Acceleration and deceleration are honoured independently by the profiler. The getter
        returns ``(speed, acceleration, torque)``; ``acceleration`` is a tuple when the two differ.
        Defaults (EV3 Large / Medium): speed 1000 / 1400 (or the calibrated no-load speed when higher),
        acceleration 2400 / 3000, torque 449 / 206; the NXT runs the Large's speed and acceleration, the
        JGA25-370 460 and 2400, the Pololu 25D 3000 and 20000, the CHR-GM16 900 and 5000. A non-positive limit raises ``ValueError``;
        an acceleration sequence that is not two values raises ``ValueError``.
        """

    @overload
    def pid(self) -> Tuple[int, int, int, float, int]: ...
    @overload
    def pid(self, kp: Optional[float] = None, ki: Optional[float] = None, kd: Optional[float] = None,
            integral_deadzone: Optional[float] = None, integral_limit: Optional[float] = None) -> None:
        """Position controller gains in uNm/deg, uNm/(deg*s), uNm/(deg/s) (the Pybricks convention).

        ``integral_deadzone`` (deg, 0..5) is the endpoint deadzone - read back as a float in degrees (default
        0.75, i.e. 1.5 encoder edges), the one value in the tuple that is not an int; ``integral_limit`` (% duty,
        0..100, default 20) is the largest contribution the integrator may make (anti-windup).
        There is no ``integral_rate`` (a growth-rate cap has no counterpart in this loop); passing it
        raises ``TypeError``. A negative gain raises ``ValueError``.
        Changes affect this motor object only, and only the ``"pid"`` control law.
        """

    @overload
    def law(self) -> str: ...
    @overload
    def law(self, law: str, /) -> None:
        """Control law: "adrc" (default: active disturbance rejection, self-calibrated) or "pid" (the tuned
        cascade; ``pid()`` / ``evn()`` parameters apply to it only). Anything else raises ``ValueError``."""

    @overload
    def evn(self) -> Tuple[int, int, int, int]: ...
    @overload
    def evn(self, endpoint_kd: Optional[float] = None, start_duty: Optional[float] = None,
            hold_duty: Optional[float] = None, friction_ff: Optional[float] = None) -> None:
        """EVN ALPHA's own tuned parameters of the ``"pid"`` law (the getter returns the per-model optimum).

        Like ``pid()``, they act only when ``law("pid")`` is selected; the default ``"adrc"`` law
        is self-calibrated and ignores them.
        ``endpoint_kd``: velocity gain inside the endpoint window (same units as ``kd``).
        ``start_duty`` / ``hold_duty`` (% duty, 0..100): stiction floors, breakaway push and least duty
        held near the target. ``friction_ff`` (%, 0..200): Coulomb friction feed-forward.
        """

    @overload
    def target_tolerances(self) -> Tuple[float, float]: ...
    @overload
    def target_tolerances(self, speed: Optional[float] = None, position: Optional[float] = None) -> None:
        """The ``done()`` criterion: speed (deg/s, default 50) and position (deg, default two encoder edges and at
        least 1, or half the detent pitch on a motor whose rotor cogs - a library motor with detents, or a custom
        motor whose calibrate() measured them: 1 on a LEGO motor, 3.3 on the Pololu 25D,
        which rests in its nearest detent) tolerance. Both read back as the floats they were set to
        (``position=0.25`` reads 0.25; a LEGO encoder edge is 0.5 deg). A position below the controller's own
        endpoint band can leave a move that stops inside it never reporting done."""

    @overload
    def stall_tolerances(self) -> Tuple[float, int]: ...
    @overload
    def stall_tolerances(self, speed: Optional[float] = None, time: Optional[int] = None) -> None:
        """Stall detection: below ``speed`` deg/s for ``time`` ms, 0..10000 (defaults 50, 50). The speed reads
        back as the float it was set to, the time as int ms."""

    def done(self) -> bool:
        """Same as ``Motor.done()``: the last profiled move is complete and the shaft is within ``target_tolerances()``."""
    def stalled(self) -> bool:
        """Same as ``Motor.stalled()``: at the allowed limit and not turning, for ``stall_tolerances()``."""
    def load(self) -> int:
        """Same as ``Motor.load()``: the load torque estimate in mNm (positive = opposing the motor)."""
    def state(self) -> Tuple[float, float, float, float, int, bool, bool]:
        """``(reference_deg, x1_deg, x2_degs, x3_degs2, applied_mv, hold, assist)``: the controller's position
        reference, the ADRC extended-state observer's position / speed / total-disturbance estimates (output
        units; ``x3`` is the unmodelled acceleration the observer is cancelling - ``load()`` is it through the
        motor's torque constant), the voltage applied last tick (mV, signed in the user's direction), and whether
        the observer is at its hold bandwidth / the breakaway assist is armed. A 1 kHz diagnostic for tuning and
        benches; live while the axis is engaged, the shaft angle otherwise. (``model.state()`` is the legacy
        Luenberger observer, not this estimator.)"""


class Model:
    """Observer (motor model) estimates (``motor.model``). ``RuntimeError`` after ``close()``."""

    def state(self) -> Tuple[float, float, float, bool]:
        """``(angle deg, speed deg/s, current mA, stalled)`` as estimated by the observer."""

    @overload
    def settings(self) -> Tuple[int, int, int, int, int, int, int, int]: ...
    @overload
    def settings(self, values: Sequence[int], /) -> None:
        """Observer settings in firmware units; only the first four can be written (the four gain
        constants must be passed back unchanged or ``ValueError`` is raised). Debug use."""


class Motor:
    """An EV3/NXT motor on EVN port ``port`` (1..4). ``Port.A..D`` are the same numbers.

    The motor model (EV3 Large / EV3 Medium / NXT / JGA25-370 6V 77RPM / Pololu 25D 9.7:1 HP 12V / CHR-GM16-030PA 9V 1:63, or a custom motor) is the one the port was configured for
    (``evn.configure_motor()`` / the extension's Board view, stored on the board), else the one its stored
    calibration was made for, else the firmware's fallback table; ``model=`` names a standard one for this
    session (below). A custom motor's no-load speed is its speed limit and 100 %, its rated voltage its cap.
    A port already held by an open Motor raises ``OSError(EBUSY)`` until it is ``close()``d;
    a port outside 1..4 raises ``ValueError``. Every call after ``close()`` raises
    ``RuntimeError("motor closed; create a new Motor")``.
    """

    control: Control
    """The controller settings of this motor: ``motor.control.limits()``, ``target_tolerances()``, ``stall_tolerances()``, ``law()`` ... (see ``Control``)."""
    model: Model
    """The observer (motor model) estimates of this motor (see ``Model``)."""

    def __init__(self, port: int, positive_direction: int = Direction.CLOCKWISE, gears: _Gears = None,
                 reset_angle: bool = True, profile: Optional[float] = None, speed_unit: int = SpeedUnit.DEG_S,
                 *, model: Optional[str] = None) -> None:
        """``gears``: ``[12, 36]`` or ``[[12, 36], [20, 16, 40]]``; values are then in output degrees.
        ``reset_angle=True`` zeroes ``angle()`` at construction. ``profile``: position tolerance (deg)
        for ``done()``, must be positive; by default two encoder edges and at least 1 deg, or half the detent
        pitch on a motor whose rotor cogs (1 deg on a LEGO motor, 3.3 deg on the Pololu 25D, which rests in its
        nearest detent). ``speed_unit=SpeedUnit.PERCENT`` makes every speed a
        percentage of ``full_speed()``.

        ``model``: the motor on the port, ``"EV3 Large"``, ``"EV3 Medium"``, ``"NXT"``,
        ``"JGA25-370 6V 77RPM"``, ``"Pololu 25D 9.7:1 HP 12V"`` or ``"CHR-GM16-030PA 9V 1:63"`` (``"large"``,
        ``"medium"``, ``"nxt"``, ``"jga25"``, ``"pololu25d_9_7"``, ``"chr16_63"`` also work; the JGA25 is a 6 V
        gearmotor, 3432 counts per revolution, the port capped at 6 V; the Pololu 25D is a 12 V high-power
        gearmotor, 9.7:1, 464.64 counts per revolution, EV3 Medium control class; the CHR-GM16 is a 16 mm 9 V
        gearmotor, 1:63, 1764 counts per revolution, the port capped at 9 V (above the 2S pack: it never binds),
        EV3 Large control class). Every gain and limit starts from the model's compiled
        defaults; ``calibrate()`` refines them for this motor and stores the result with the model.
        ``None`` keeps the motor the port runs: the one it was configured for (``evn.configure_motor()`` or
        the Board view's gear, stored on the board), else the one its stored calibration was made for, else
        the firmware's fallback table (EV3 Large on ports 1-2, EV3 Medium on 3-4). Naming another model
        switches the port to that model's defaults until the next reboot and prints a WARNING that its stored calibration
        (made for the other model) is not applied until ``calibrate()`` runs again. ``ValueError`` for
        an unknown name; ``RuntimeError`` if the port is moving.
        """

    # measuring
    def angle(self) -> int:
        """Angle in degrees (64-bit, never wraps)."""
    def reset_angle(self, angle: Optional[float] = None, /) -> None:
        """Make the current position read ``angle``; with no argument (or ``None``) it becomes the 0 reference."""
    def speed(self) -> int:
        """Speed in deg/s (the controller's own estimate). Pybricks' ``window`` argument is not
        offered: ``speed(100)`` raises ``TypeError``."""
    def load(self) -> int:
        """Load torque in mNm (positive = opposing the motor): the controller's disturbance estimate."""
    def stalled(self) -> bool:
        """True when the motor is pushing as hard as it is allowed to and the shaft still does not turn, for
        ``control.stall_tolerances()`` (Pybricks meaning): the applied voltage at the cap in force
        (``settings(max_voltage)``, or the ``duty_limit`` of ``run_until_stalled``), the speed below the stall
        speed and the load estimate absorbing the push. Works on any calibrated motor, also during ``dc()``
        (at full duty). A hold pushed to its limit by a load reads stalled too."""
    def done(self) -> bool:
        """True when the last profiled move is complete and the shaft is within the target tolerances."""

    # stopping
    def stop(self) -> None:
        """Coast (release the motor)."""
    def brake(self) -> None:
        """Passive brake."""
    def hold(self) -> None:
        """Actively hold the current angle."""

    # running
    def run(self, speed: float, /) -> None:
        """Run at ``speed`` deg/s until the next command (ramped at the acceleration limit)."""
    def dc(self, duty: float, /) -> None:
        """Open-loop duty cycle, clamped to -100..100 %."""
    def run_time(self, speed: float, time: float, then: _Then = Stop.HOLD, wait: bool = True) -> None:
        """Run at ``speed`` for ``time`` ms, then ``then``: the maneuver takes ``time`` (Pybricks). The distance is
        what a trapezoid of ``speed`` covers in ``time`` at the speed and acceleration the controller will actually
        allow at the present pack voltage, so a limit shortens the distance, never the duration; ``speed`` 0 is a
        timed hold of the measured angle (``done()`` stays False until ``time`` has passed). ``time`` is 0 to
        2147483647 ms (24.8 days); a negative or longer ``time`` raises ``ValueError``. The exact bound holds for an
        int; a float ``time`` is exact only below about 2147483520 (this port's floats are 32-bit, so 2147483647.0
        rounds to 2147483648 and is refused - the message says so)."""
    def run_angle(self, speed: float, rotation_angle: float, then: _Then = Stop.HOLD, wait: bool = True) -> None:
        """Turn by ``rotation_angle`` degrees at ``speed``. Counts from the aim the motor is holding after a
        completed position command (Pybricks: the reference while actively controlled), so chained relative
        moves are exact - ten ``run_angle(200, 90)`` are 900 degrees - and from the measured angle after a
        coast, a brake, a stall or a shaft forced more than 45 degrees off its hold. A ``Stop.COAST_SMART``
        aim counts the same way for a coasting shaft. A negative speed reverses."""
    def run_target(self, speed: float, target_angle: float, then: _Then = Stop.HOLD, wait: bool = True) -> None:
        """Turn to the absolute ``target_angle`` at ``speed`` (the sign of ``speed`` is ignored)."""
    def run_until_stalled(self, speed: float, then: _Then = Stop.COAST, duty_limit: Optional[float] = None) -> int:
        """Run until the motor stalls (``stalled()`` after the first 150 ms); returns the angle reached.

        **``duty_limit`` IS the stall force** (% of ``settings()`` max_voltage): the motor pushes up to that
        cap against the obstruction before the stall is reported, and without one it pushes with the whole
        pack (an EV3 Large gripper closes hard: pass ``duty_limit=30`` or so for a gentle grip). An unloaded
        shaft creeps instead of stalling, so this does not return without a real obstruction (Ctrl-C aborts);
        a ``duty_limit`` below the motor's breakaway returns at once, where it stands. ``then`` outside
        ``Stop`` raises ``ValueError``.
        """
    def track_target(self, target_angle: float, /) -> None:
        """Unprofiled position servo: jump the reference straight to ``target_angle``."""

    # speed unit
    @overload
    def speed_unit(self) -> int: ...
    @overload
    def speed_unit(self, unit: int, /) -> None:
        """``SpeedUnit.DEG_S`` or ``SpeedUnit.PERCENT`` for every speed argument and result of this motor
        (run*, speed(), control.limits speed, target/stall speed tolerances). Accelerations stay deg/s^2,
        dc() stays % duty. Any other value raises ``ValueError``."""
    @overload
    def full_speed(self) -> int: ...
    @overload
    def full_speed(self, deg_s: float, /) -> None:
        """What 100 % means, in deg/s, at the present battery voltage: the no-load speed measured by
        ``calibrate()`` (stored in flash per port), or until then the motor model's rated no-load speed
        (EV3 Large 1050, EV3 Medium 1560, NXT 1020 deg/s at 9 V; JGA25 462 deg/s at its 6 V cap; Pololu 6000 deg/s at 12 V; CHR-GM16 1290 deg/s at its 9 V cap) scaled
        by the voltage the motor sees (the pack, or its cap).
        Setting it stores deg/s per volt, so it keeps tracking the battery; a non-positive value raises
        ``ValueError``."""
    @overload
    def calibrate(self) -> Tuple[int, int, int, int]: ...
    @overload
    def calibrate(self, wait: bool = True) -> Optional[Tuple[int, int, int, int]]:
        """Self-calibration of this port (about 11 s; the shaft must be free to turn, it moves up to about a
        turn and a half each way and ends near where it started). Returns (b0 in deg/s^2 per volt, time constant in ms,
        breakaway voltage in mV, kinetic friction voltage in mV); the result is stored in flash, loaded at
        every boot, and sets this port's ``full_speed()``. Re-run after swapping the motor.
        ``wait=False`` starts it and returns None; a later ``calibrate()`` on the same port joins it and
        returns the result, so several ports can calibrate together. ``RuntimeError`` when the shaft does
        not break away or the fit fails. The calibration also measures the port's encoder phase tables
        (the four quadrature phase widths, one table per direction of turning: a Hall sensor's edges sit
        at slightly different angles each way) and installs and stores them with the record, which is
        what keeps ``speed()``, ``Pose.velocity()`` and the position between two encoder steps exact; see
        ``evn._encoder_table()``. It ends with a detent survey (20 short kicks, the shaft resting after each):
        a motor whose rotor cogs (magnetic detents, like the Pololu 25D's every 8 encoder edges) always comes
        to rest in a detent, so the rests line up with the detent period, and the calibration measures that
        period. A custom motor that cogs then gets what a library motor with detents has: the cogging
        feed-forward (amplitude = breakaway minus running friction) and the detent rest at the end of a move
        (half a detent pitch of tolerance); a library motor keeps its library figure and the measurement only
        checks it. ``evn.calibration(port)["cogging_edges"]`` says what the port runs on."""

    # settings
    @overload
    def settings(self) -> Tuple[int, int]: ...
    @overload
    def settings(self, max_voltage: Optional[float] = None, *, stall_timeout: Optional[float] = None) -> None:
        """``(max_voltage mV, stall_timeout ms)``. ``max_voltage``: the voltage cap, 0..12000 (default 9000, above any
        2S pack, so no effect until lowered). ``stall_timeout`` (default 1000): a ``wait=True`` move returns once
        the motor has been stalled this long - the hold keeps pushing, ``stalled()`` is True and the program goes
        on instead of hanging on a gripper closed on a brick (an industrial drive's following-error fault; ROS
        actions time out); 0 waits forever as Pybricks does. A ``DriveBase`` wait uses the shorter of its two
        wheels' timeouts."""
    def close(self) -> None:
        """Coast, free the port. Every later call raises ``RuntimeError``."""
    def __enter__(self) -> "Motor": ...
    def __exit__(self, *args: object) -> None: ...



class DriveBase:
    """Two ``Motor`` objects driven as a differential drive, the Pybricks ``robotics.DriveBase`` API
    (docs/MICROPYTHON_API.md; phase 8, 2026-09-19).

    ``DriveBase(left_motor, right_motor, wheel_diameter, axle_track, *, imu=None, compass=None, declination=None,
    pose=None)``: the wheel diameter and the axle track in mm. A motor's forward direction is its ``positive_direction`` (a mirrored left motor:
    ``Motor(4, Direction.COUNTERCLOCKWISE)``); its ``gears=`` make the values wheel degrees. Units: mm, mm/s,
    mm/s^2 for distances, degrees, deg/s, deg/s^2 for the heading; a positive angle is a clockwise turn seen
    from above (the ``Pose`` / compass convention). The axle track that matters is the effective one between
    the two contact patches (measure it with one ``turn(360)`` against a floor mark).

    Each maneuver is two profiled moves on one time base: the wheel with the longer travel gets the
    maneuver's speed and acceleration, the other the same numbers scaled by the ratio of the travels, both
    started on the same 1 kHz tick, so the wheels stay proportional and a straight is straight. A direct
    ``Motor`` command on one wheel while a maneuver is in force coasts the other wheel (Pybricks).
    A motor that already belongs to a DriveBase is taken over (that base is closed), so re-running the
    ``DriveBase(...)`` line with the same ``Motor`` objects works; re-running a whole cell raises
    ``OSError(EBUSY)`` at its first ``Motor(port)`` whose port is still held. ``ValueError`` for a
    motor used twice or a geometry outside 1..1000 / 1..2000 mm; ``RuntimeError`` after ``close()``.

    **The base's pose.** ``imu=`` / ``compass=`` (the I2C ports 1..16 of existing ``IMU`` / ``Compass`` objects)
    make the base build and own an ``evn.Pose`` from its own geometry: the two motor ports, ``wheel_diameter``,
    ``axle_track``, each motor's ``positive_direction`` (no ``reverse_left`` to type) and the motors' gears as the
    gear ratio, so the geometry is typed once. ``declination=`` (degrees, east positive) goes with ``compass=``.
    ``pose=`` adopts a ``Pose`` the program built instead, after checking it was built on the same physics (the
    same two ports as left and right, ``reverse_left`` / ``reverse_right`` matching the motors' directions, the
    gear ratio equal to the motors' gears, the wheel diameter and axle track equal to the base's). ``robot.pose``
    is that ``Pose`` (or ``None``); the base holds it, so it is never collected under the loop. ``close()``
    closes a Pose the base built, never one the program built and gave it; a Pose an old base built and handed
    over (``pose=old.pose``) comes with its ownership, so the new base's ``close()`` closes it. The geometry has
    one home, the base: a measured axle track goes into ``DriveBase(..., axle_track=t_eff, imu=3)`` (rebuild the
    base; it builds its Pose from it), never into ``robot.pose.settings()``. Errors: ``OSError`` when no ``IMU`` / ``Compass``
    object is on that port or another ``Pose`` is already running (pass it as ``pose=``, or ``close()`` it);
    ``ValueError`` for a port outside 1..16, ``declination=`` without ``compass=`` or outside -180..180, two wheels with different
    gears, ``pose=`` together with ``imu=`` / ``compass=`` / ``declination=``, a closed ``pose=`` or one whose
    geometry differs (the message names what); ``TypeError`` when ``pose=`` is not an ``evn.Pose``. Everything
    is checked before an old base on the same wheels is closed.

    **Closing the loop over the pose** (``use_gyro(True)``, Pybricks' name): with a ``Pose`` on the base (built
    from ``imu=`` / ``compass=``, given as ``pose=``, or adopted by ``use_gyro``), every maneuver is trimmed at the pose rate (100 Hz with the IMU, every second
    DMP packet; 200 Hz on the wheels alone) so the ROBOT - not just the wheels -
    follows the path the program asked for: the base keeps the pose an ideal robot would have (integrated from
    the wheel references, anchored at ``reset()`` and at the first maneuver after a stop, continuous across
    chained maneuvers) and corrects the body-frame error with the RAMSETE law, so scrub on a turn, a dragged
    cable and the gyro's drift are taken out as they happen instead of adding up over minutes. ``done()`` then
    also waits for the pose to settle inside ``follower()`` tolerances. What it cannot fix is what the pose
    cannot see: a translation the encoders do not turn for (a robot pushed sideways while turning in place)
    goes uncorrected until an outside reference (a wall, a line) resets the pose."""
    pose: Optional["Pose"]
    """The base's ``Pose`` (read-only): the one it built from ``imu=`` / ``compass=``, was given as ``pose=`` or
    adopted at ``use_gyro(True)``, or ``None`` when the base has no pose (wheel-space maneuvers only)."""
    def __init__(self, left_motor: Motor, right_motor: Motor, wheel_diameter: float, axle_track: float, *,
                 imu: Optional[int] = None, compass: Optional[int] = None, declination: Optional[float] = None,
                 pose: Optional["Pose"] = None) -> None: ...
    def straight(self, distance: float, then: int = Stop.HOLD, wait: bool = True) -> None:
        """Drive straight ``distance`` mm (negative = backwards), then hold / coast / brake. ``then=Stop.NONE``
        raises ``ValueError`` (use ``drive()``); ``Stop.COAST_SMART`` counts the next relative move from this
        move's aim. ``wait=False`` returns at once; poll ``done()``."""
    def turn(self, angle: float, then: int = Stop.HOLD, wait: bool = True) -> None:
        """Turn in place by ``angle`` degrees, clockwise positive."""
    def curve(self, radius: float, angle: float, then: int = Stop.HOLD, wait: bool = True) -> None:
        """Drive an arc of ``|radius|`` mm through ``|angle|`` degrees, the Pybricks ``curve()`` convention: the
        angle's sign picks the side of the circle (positive = clockwise, to the right), the radius's sign the
        direction of travel (negative = backwards), so ``curve(-r, a)`` retraces ``curve(r, a)``.
        ``radius = axle_track / 2`` pivots on one wheel. See ``arc()`` for the other convention."""
    def arc(self, radius: float, distance: Optional[float] = None, angle: Optional[float] = None,
            then: int = Stop.HOLD, wait: bool = True) -> None:
        """Drive along a circle of ``|radius|`` mm to the right (positive radius) or left (negative) for
        ``distance`` mm of path or ``angle`` degrees of heading (exactly one of the two); a negative value drives
        backwards. Pybricks ``arc()``."""
    def drive(self, speed: float, turn_rate: float) -> None:
        """Drive at ``speed`` mm/s along the path and ``turn_rate`` deg/s (clockwise positive) until the next
        command; both wheels ramp to their new speeds together, and if one would exceed the weaker wheel's
        limit both are scaled so the radius is kept."""
    def stop(self) -> None:
        """Coast both wheels."""
    def brake(self) -> None:
        """Passive brake on both wheels."""
    def distance(self) -> int:
        """mm driven since ``reset()`` (the mean of the two wheels, from the encoders)."""
    def angle(self) -> int:
        """Degrees turned since ``reset()``, clockwise positive (from the encoders)."""
    def state(self) -> Tuple[float, float, float, float]:
        """(distance mm, drive speed mm/s, angle deg, turn rate deg/s)."""
    def reset(self, distance: float = 0, angle: float = 0, /) -> None:
        """Start ``distance()`` and ``angle()`` again from these values."""
    def done(self) -> bool:
        """True when both wheels have completed their maneuver - ``Motor.done()``'s meaning: profile complete AND
        inside ``control.target_tolerances()`` - or are passive; like ``Motor``, the only other way a ``wait=True``
        maneuver returns is the stall timeout (``Motor.settings(stall_timeout=)``). With ``use_gyro(True)`` the
        wheels are judged against their target plus the trim and ``done()`` also waits for the pose error to
        settle inside ``follower()`` tolerances - or the trim at its bound, or 2 s after the profiles ended (a pose
        that never settles must not hang the program); that 2 s escape exists only under ``use_gyro``."""
    def stalled(self) -> bool:
        """True when either wheel is stalled (``Motor.stalled()``: at its allowed limit and not turning)."""
    @overload
    def use_gyro(self) -> bool: ...
    @overload
    def use_gyro(self, enable: bool, /) -> None:
        """Close the chassis loop over the base's ``Pose`` (see the class docstring). With a pose on the base
        (``imu=`` / ``compass=`` / ``pose=``) it re-checks that the geometry still agrees (a ``Pose.settings()``
        since the bind raises ``ValueError`` "use_gyro: the Pose's wheel_diameter and axle_track must equal the
        base's (rebuild the DriveBase with the measured values; it builds its Pose from them)"; one made while
        ``use_gyro`` is on makes the next maneuver raise ``OSError`` "use_gyro: the Pose's geometry no longer
        matches the base's ..." and turns ``use_gyro`` off). With no pose on the base but a ``Pose`` the program built running,
        it adopts that one after the full check (ports, directions, gears, wheel diameter and axle track: a
        ``ValueError`` names what differs) and holds it from then on, so ``robot.pose`` returns it. With no pose
        anywhere: ``ValueError`` ("DriveBase(..., imu=port) builds one, pose= takes yours"). With an IMU on the Pose it
        first waits (up to 30 s) for ``IMU.ready()`` - the DMP calibrates its gyro 8..25 s into stillness, and a
        loop armed before that would correct toward a drifting heading (Pybricks calibrates the hub IMU before any
        program runs, so its users never see this); ``OSError`` if it never comes (the robot was moving), when the
        pose has no estimate yet, and from the next maneuver if the base's ``Pose`` was closed or replaced meanwhile
        (``use_gyro`` is then off; the loop never trims on a stranger's estimate). ``use_gyro(False)`` drops the trims (the wheels move back to their untrimmed references,
        up to the trim limit at the trim slew) and returns to wheel-only maneuvers. With it on, each maneuver
        counts from the aim the wheel holds INCLUDING its trim, so a correction is kept, not undone; a maneuver
        ended with ``Stop.COAST`` / ``BRAKE`` keeps the reference path too (the next one corrects any roll)."""
    @overload
    def follower(self) -> Tuple[float, float, float, int, int, int, int, float, float, int]: ...
    @overload
    def follower(self, *, b: Optional[float] = None, zeta: Optional[float] = None, k_min: Optional[float] = None,
                 correction_speed: Optional[float] = None, correction_rate: Optional[float] = None,
                 trim_limit: Optional[float] = None, trim_slew: Optional[float] = None,
                 position_tolerance: Optional[float] = None, heading_tolerance: Optional[float] = None,
                 settle_time: Optional[float] = None) -> None:
        """The pose loop's knobs: ``b`` (1/m^2, convergence; 400 - the RAMSETE gain scales with 1/length^2, so
        WPILib's 2.0 for a field-sized robot is far too soft here), ``zeta`` (damping, 0.7), ``k_min`` (1/s, the
        pull-in gain once the profile has stopped, 4), ``correction_speed`` (mm/s the loop may add along the path,
        150), ``correction_rate`` (deg/s it may add to the heading, 90), ``trim_limit`` (wheel degrees of
        correction per wheel, 180), ``trim_slew`` (the most a wheel's reference moves toward its trim, wheel deg/s,
        600), ``position_tolerance`` (mm, 1) and ``heading_tolerance`` (deg, 0.3) that ``done()`` waits for, held
        for ``settle_time`` (ms, 100). Every value > 0, ``zeta`` in (0, 1). Gains only: a change mid-maneuver keeps
        the correction in force; the robot's geometry comes from the base that has ``use_gyro`` on."""
    def pose_error(self) -> Tuple[float, float, float, bool, float, float]:
        """``(forward mm, left mm, heading deg, settled, trim_left deg, trim_right deg)``: where the ideal robot
        is, seen from the estimate, and the wheel trims asked of the engine (it slews toward them).
        ``ValueError`` without ``use_gyro(True)``."""
    @overload
    def settings(self) -> Tuple[int, Union[int, Tuple[int, int]], int, Union[int, Tuple[int, int]]]: ...
    @overload
    def settings(self, straight_speed: Optional[float] = None, straight_acceleration: Union[None, float, Tuple[float, float]] = None,
                 turn_rate: Optional[float] = None, turn_acceleration: Union[None, float, Tuple[float, float]] = None) -> None:
        """``settings()`` -> (straight_speed mm/s, straight_acceleration mm/s^2, turn_rate deg/s, turn_acceleration
        deg/s^2); an acceleration may be ``(accel, decel)``. Defaults: the weaker wheel's ``control.limits()``,
        the straight acceleration at 75 % of it (about 770 mm/s, 1230 mm/s^2, 520 deg/s, 1100 deg/s^2 on two
        Mediums with 62.4 mm wheels 170 mm apart: at the full 1630 mm/s^2 the tyres slip about 1.5 mm per 30 cm
        out-and-back, invisible to the encoders); lower them for a heavier robot or a slick floor. A value above what the
        weaker wheel can do is clamped to it and the getter reports the clamped value."""
    def close(self) -> None:
        """Coast both wheels and release them (the ``Motor`` objects stay open; a new DriveBase can use them).
        Closes a ``Pose`` the base built (``imu=`` / ``compass=``), and one an old base built and handed over
        (``pose=old.pose``: the ownership comes with it); a Pose the program built and gave it (``pose=``) or
        left for ``use_gyro`` to adopt stays the program's."""
    def __enter__(self) -> DriveBase: ...
    def __exit__(self, *args: object) -> None: ...
    def _wheels(self) -> Tuple[float, float, float, float]:
        """Bench diagnostic: (left deg, right deg, left deg/s, right deg/s) since ``reset()``, wheel degrees."""

class battery:
    """Battery readings (a module-like object: ``evn.battery.voltage()``)."""
    @staticmethod
    def voltage() -> int:
        """Pack voltage in mV (0 when no pack is present)."""
    @staticmethod
    def cells() -> Optional[Tuple[int, int]]:
        """Cell voltages in mV, or ``None`` when no pack is present."""
    @staticmethod
    def age() -> Optional[int]:
        """Age of the reading in ms, or ``None`` when no pack is present."""
    @staticmethod
    def present() -> bool:
        """True when a battery pack is connected and read (``voltage()`` is 0 and ``cells()`` / ``age()`` are ``None`` otherwise)."""


class button:
    """The board's user button (a module-like object: ``evn.button.pressed()``)."""
    @staticmethod
    def pressed() -> bool:
        """User button state (the button is also the emergency stop: coast all)."""


class led:
    """The board LED (a module-like object: ``evn.led.on()``). Until a program uses it, it blinks as the board's heartbeat (faster while a computer has the USB port open)."""
    @staticmethod
    def on() -> None:
        """Light the board LED. The first call takes the LED over from the heartbeat blink."""
    @staticmethod
    def off() -> None:
        """Turn the board LED off (the heartbeat blink stops once the program uses the LED)."""
    @staticmethod
    def toggle() -> None:
        """Switch the board LED to the other state."""
    @staticmethod
    def set(value: object, /) -> None:
        """Light the board LED when ``value`` is true, turn it off when it is false."""


class Servo:
    """Hobby servo on servo port 1..4 (PIO, 50 Hz).

    ``profile``: ``"geekservo_270"`` (the kit's Geekservo 270-degree servo and **the default**:
    600..2400 us, starts at 135 degrees, sweeps up to 500 deg/s), ``"generic"`` (180 degrees,
    500..2500 us), ``"geekservo_360"`` (the grey Geekservo 2KG: 360 degrees over 500..2500 us,
    starts at 180, sweeps up to 400 deg/s) or ``"geekservo_cr"`` (the Geekservo continuous-rotation
    servo: ``duty()`` -100..100 %). ``reverse=True`` mirrors the direction; the keyword arguments override any
    profile field, and ``range=R`` without ``start=`` starts at R/2.

    The object owns the channel while it lives: ``RGBLED(n)`` on the same port raises ``OSError``,
    and a servo port pulses nothing until the first ``Servo`` object is built. While an
    ``RGBLED`` holds the port every call raises ``OSError("servo port %d is used by an RGBLED strip")``.
    ``close()`` and a soft reset (Ctrl-D) drop the claim. A new object drives its port even after
    ``disable()`` on an earlier one, and the constructor waits up to 10 ms for a just-closed strip
    to hand the channel back (its dark frame goes out first); a strip that is still open raises at once.

    Raises: ``ValueError`` for a port outside 1..4, an unknown profile name, a pulse range outside
    ``200 <= min_us < max_us <= 2800``, a range outside 0..3600, a start outside the range, a
    ``max_dps`` below 1, a non-finite number; ``ValueError("Servo is closed")`` from every call
    after ``close()``; ``TypeError`` for ``duty()`` on a fixed-range profile or ``angle()`` /
    ``move()`` on a continuous one; ``OSError`` when the port is not available.

    Bench-validated against an encoder: 270-degree 277..281 degrees of travel; continuous-rotation
    no creep at duty 0, duty 50 / 75 / 100 about 185 / 315 / 450 deg/s, starts in ~100 ms, stops in
    ~150 ms (under a heavy load the servo is torque-limited below duty ~50).
    """
    def __init__(self, port: int, profile: Optional[str] = None, reverse: bool = False, *,
                 range: Optional[int] = None, min_us: Optional[int] = None, max_us: Optional[int] = None,
                 start: Optional[float] = None, max_dps: Optional[float] = None) -> None: ...
    @overload
    def pulse(self) -> int: ...
    @overload
    def pulse(self, us: int, /) -> None:
        """Pulse width in microseconds, 200..2800."""
    @overload
    def angle(self) -> float:
        """The tracked position in degrees (fixed-range profiles)."""
    @overload
    def angle(self, degrees: float, reverse: bool = False, /) -> None:
        """Jump to ``degrees`` (0..range). ``reverse=True`` mirrors this one pulse, but the servo still
        records ``degrees`` as its position, so a following ``move()`` starts from the wrong place."""
    def move(self, angle: float, speed: Optional[float] = None, wait: bool = True) -> None:
        """Sweep to ``angle`` at ``speed`` deg/s (default the profile's maximum); blocks until there when
        ``wait``. ``speed=0`` raises ``ValueError`` (use ``angle()`` to jump)."""
    def done(self) -> bool:
        """True when no sweep is in progress."""
    @overload
    def duty(self) -> float: ...
    @overload
    def duty(self, percent: float, /) -> None:
        """Continuous-rotation profile: -100..100 %, 0 stops."""
    def stop(self) -> None:
        """Continuous: stop pulse; fixed-range: cancel the sweep."""
    def profile(self) -> Tuple[str, int, int, int, float, float, bool]:
        """``(name, range, min_us, max_us, start, max_dps, reverse)``."""
    def set_range(self, min_us: int, max_us: int, /) -> None:
        """New pulse range, ``200 <= min_us < max_us <= 2800``."""
    def enable(self) -> None:
        """Start the pulses again after ``disable()``."""
    def disable(self) -> None:
        """Stop the pulses and drive the pin low (sticky until ``enable()`` or a new ``Servo`` object)."""
    def close(self) -> None:
        """Give the channel back (the pulse stops, the pin goes low) so an ``RGBLED`` strip or a new
        ``Servo`` object can take the port without a soft reset. Idempotent; every other method then
        raises ``ValueError("Servo is closed")``, ``done()`` and ``profile()`` included."""


class I2C:
    """Raw I2C on port 1..16, through the board's two TCA9548A multiplexers.

    Bench-validated as the transport under every standard peripheral (2026-09-18). The layer
    recovers by itself: a transaction that times out aborts, resets the controller, clocks a held
    SDA free and re-initialises the bus, and the multiplexer channel cache is dropped after any
    failed transaction. The transaction deadline grows with the length (1 ms + 40 us per byte at 400 kHz, more at a slower clock, at
    least 5 ms), so a long transfer never times out by being long.

    Addresses the board itself uses are refused with ``ValueError``: **0x70** (the multiplexers,
    which answer on every port) everywhere, and **0x6A on port 16** (the battery charger).
    ``scan()`` never lists 0x70.

    Errors: ``OSError(ENODEV)`` nothing answered at that address; ``OSError(EIO)`` the device
    answered but refused a byte; ``OSError(ETIMEDOUT)`` the bus was held and has been reset
    (``stats()`` counts it). ``stats()``'s ``errors`` are failed transactions since boot; the expected NACK of
    a probe, of a constructor's ID-register identify on an empty port or of a driver's re-probe of an unplugged
    device is not one, so a climbing count means a real fault. ``ValueError`` for a port outside 1..16, an address outside
    0x01..0x77 (0x01..0x07 reach NXT-era sensors: 0x01 is the NXT's 8-bit address 0x02; 0x00, the
    general call, stays refused), a register outside 0..255 or a length outside the limits below.

    Every port has its own clock: 400 kHz unless ``I2C(port, freq=...)`` or an extended peripheral
    (``HiTechnicColorSensor``, ``HiTechnicCompass``: 100 kHz) slowed it; the other ports keep theirs.
    The soft reset at the end of a program puts every port back at 400 kHz.

    A scan of a port that carries an ``IMU`` pops one byte of the chip's FIFO (the driver heals it
    with a FIFO reset).
    """
    def __init__(self, port: int, /, *, freq: Optional[int] = None) -> None:
        """``freq`` sets this port's I2C clock, 10000..400000 Hz (``ValueError`` outside); ``None`` keeps
        the rate the port runs at. The transaction deadline's per-byte allowance scales with the rate."""
    def freq(self) -> int:
        """The clock this port runs at, in Hz (400000 unless slowed by ``I2C(port, freq=...)`` or by an
        extended peripheral on the port)."""
    def scan(self) -> List[int]:
        """Every address 0x01..0x77 that ACKs on this port, except 0x70 (the multiplexer). A probe
        that times out resets the bus and drops the multiplexer channel, so the scan of that port is
        abandoned there rather than carried on against the bare bus."""
    def probe(self, addr: int, /) -> bool:
        """True when a device ACKs ``addr`` on this port (a 1-byte read, 1 ms deadline)."""
    def readfrom(self, addr: int, nbytes: int, /) -> bytes:
        """``nbytes`` 1..256."""
    def writeto(self, addr: int, buf: bytes, /) -> None:
        """``buf`` 1..4096 bytes."""
    def readfrom_mem(self, addr: int, memaddr: int, nbytes: int, /) -> bytes:
        """``memaddr`` 0..255, ``nbytes`` 1..256 (a write of the register then a repeated-start read)."""
    def writeto_mem(self, addr: int, memaddr: int, buf: bytes, /) -> None:
        """``memaddr`` 0..255, ``buf`` at most 255 bytes."""
    def stats(self) -> Tuple[Tuple[int, int, bool], Tuple[int, int, bool]]:
        """``((errors, recoveries, stuck), (...))`` for bus 0 (ports 1-8) and bus 1 (ports 9-16):
        failed transactions since boot, timeouts that reset the controller, and whether SDA/SCL were
        still held low after the last reset."""
    def _deadline(self, us: int, /) -> None:
        """Private bench hook (``tools/bench/mpy_i2c_layer.py``): force every transaction deadline to
        exactly ``us`` microseconds, 0..1000000 (0 = the normal length-scaled one), so a transfer can
        be made to time out on purpose and the recovery exercised. Not part of the user API."""


class Side:
    """A side of a device (the Pybricks ``Side`` values): ``IMU.up()``, ``MatrixLED.orientation()``."""
    TOP: int
    BOTTOM: int
    FRONT: int
    BACK: int
    LEFT: int
    RIGHT: int


class Icon:
    """The Pybricks icon set redrawn at 8x8 for ``MatrixLED.icon()`` / ``animate()``.

    Each member is an 8-byte bitmap (one byte per row, top row first, bit 7 = leftmost pixel).
    """
    UP: bytes
    DOWN: bytes
    LEFT: bytes
    RIGHT: bytes
    ARROW_RIGHT_UP: bytes
    ARROW_RIGHT_DOWN: bytes
    ARROW_LEFT_UP: bytes
    ARROW_LEFT_DOWN: bytes
    ARROW_UP: bytes
    ARROW_DOWN: bytes
    ARROW_LEFT: bytes
    ARROW_RIGHT: bytes
    HAPPY: bytes
    SAD: bytes
    EYE_LEFT: bytes
    EYE_RIGHT: bytes
    EYE_LEFT_BLINK: bytes
    EYE_RIGHT_BLINK: bytes
    EYE_LEFT_BROW: bytes
    EYE_RIGHT_BROW: bytes
    EYE_LEFT_BROW_UP: bytes
    EYE_RIGHT_BROW_UP: bytes
    HEART: bytes
    PAUSE: bytes
    EMPTY: bytes
    FULL: bytes
    SQUARE: bytes
    TRIANGLE_RIGHT: bytes
    TRIANGLE_LEFT: bytes
    TRIANGLE_UP: bytes
    TRIANGLE_DOWN: bytes
    CIRCLE: bytes
    CLOCKWISE: bytes
    COUNTERCLOCKWISE: bytes
    TRUE: bytes
    FALSE: bytes


class Color:
    """A colour as hue (0..359), saturation (0..100) and value (-100..100), as in Pybricks.

    ``Color(h, s=100, v=100)``. Named constants ``Color.RED`` ... ``Color.NONE``. Colours compare
    by value, ``c >> 30`` / ``c << 30`` shift the hue, ``c * 0.5`` / ``c / 2`` scale the value.
    A value that is one of the named constants is that object, so it prints as ``Color.RED``.
    """
    h: int
    """Hue, 0..359 degrees."""
    s: int
    """Saturation, 0..100 %."""
    v: int
    """Value (brightness), -100..100 %."""
    NONE: "Color"     # (0, 0, 0)
    BLACK: "Color"    # (0, 0, 10)
    GRAY: "Color"     # (0, 0, 50)
    WHITE: "Color"    # (0, 0, 100)
    RED: "Color"      # (0, 100, 100)
    BROWN: "Color"    # (30, 100, 50)
    ORANGE: "Color"   # (30, 100, 100)
    YELLOW: "Color"   # (60, 100, 100)
    GREEN: "Color"    # (120, 100, 100)
    CYAN: "Color"     # (180, 100, 100)
    BLUE: "Color"     # (240, 100, 100)
    VIOLET: "Color"   # (270, 100, 100)
    MAGENTA: "Color"  # (300, 100, 100)
    def __init__(self, h: int, s: int = 100, v: int = 100) -> None: ...
    def __rshift__(self, degrees: int) -> "Color": ...
    def __lshift__(self, degrees: int) -> "Color": ...
    def __mul__(self, factor: float) -> "Color": ...
    def __rmul__(self, factor: float) -> "Color": ...
    def __truediv__(self, divisor: float) -> "Color": ...


class ColorSensor:
    """TCS34725 RGBC colour sensor (an EVN Standard Peripheral) on I2C port 1..16.

    Bench-validated 2026-09-17 on three sensors at once. The constructor checks that a TCS34725
    answers at 0x29 and returns after the first reading (about 12 ms). Readings are served from a
    cache the firmware refreshes once per sensor cycle (4.8 ms at the defaults: 2.4 ms integration,
    gain 16x, as the EVN Arduino library), so reading costs nothing on the I2C bus; ``read()`` waits
    for the next new one. ``gain()``, ``integration_time()``, ``wait_time()`` and ``thresholds()``
    return only once a sample measured **under the new setting** exists.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no TCS34725 on port %d (I2C 0x29)")``
    when nothing answers; ``OSError("no free ColorSensor slot for port %d (%d in use)")`` when all
    8 slots are taken; ``OSError("colour sensor on port %d gave no first sample")`` /
    ``"... gave no sample under the new setting"`` on a timeout; ``OSError("colour sensor on port %d
    not responding")`` while the sensor is unplugged; ``ValueError("colour sensor is closed")`` from
    every call after ``close()``.

    Known limit: at the chip's step tolerance about one ``read()`` in twenty repeats or skips an
    integration. In bright light the defaults saturate (clear = full scale, ``color()`` WHITE):
    lower the gain before judging colours.
    """
    def __init__(self, port: int, /) -> None: ...
    def raw(self) -> Tuple[int, int, int, int]:
        """``(clear, red, green, blue)`` raw counts of the latest reading (full scale 1024 x integration steps, max 65535)."""
    def read(self) -> Tuple[int, int, int, int]:
        """Wait for the next new reading (at most one sensor cycle) and return its ``(clear, red, green, blue)``."""
    def percent(self) -> Tuple[float, float, float, float]:
        """``(clear, red, green, blue)`` as percentages of full scale at the current integration time."""
    def rgb(self) -> Tuple[int, int, int]:
        """``(r, g, b)`` 0..255, each channel relative to the clear channel."""
    def color(self) -> Optional[Color]:
        """The detectable colour nearest the reading (Pybricks' matcher): one of ``detectable_colors()``,
        or ``None`` when that set is empty.

        Hue matches work at any distance or light level. For ``Color.WHITE`` vs ``Color.NONE`` the
        reading's value must be meaningful: calibrate with ``ranges()`` on white and black first."""
    def color_match(self) -> Tuple[Optional[Color], float]:
        """``(color(), confidence)`` from one reading. The confidence is the margin to the runner-up in
        ``detectable_colors()``: ``1 - d_best / d_second`` in the matcher's own distance, so 1.0 means the
        reading sits on the chosen colour and 0.0 that it is halfway between two (a coin flip); with a single
        detectable colour it is the distance to that one against a fixed scale. Threshold it:
        ``c, p = cs.color_match(); if c == Color.RED and p > 0.6:``. ``(None, 0.0)`` with no detectable colours.
        (Owner's rule, 2026-09-20: a classification comes with its confidence.)"""
    @overload
    def detectable_colors(self) -> Sequence[Color]: ...
    @overload
    def detectable_colors(self, colors: Sequence[Color], /) -> None:
        """The colours ``color()`` chooses from. Default ``(Color.RED, Color.YELLOW, Color.GREEN,
        Color.BLUE, Color.WHITE, Color.NONE)``; any ``Color``, e.g. ``Color(h=348, s=96, v=40)``.
        Anything that is not a ``Color`` raises ``TypeError``."""
    def hsv(self, normalized: bool = False) -> Color:
        """The reading as a ``Color`` (``.h`` 0..359, ``.s`` 0..100, ``.v`` 0..100); value is the strongest
        channel's % of full scale, or of its calibration range with ``normalized=True``."""
    @overload
    def ranges(self) -> Tuple[Optional[Tuple[int, int]], Optional[Tuple[int, int]], Optional[Tuple[int, int]], Optional[Tuple[int, int]]]: ...
    @overload
    def ranges(self, *, clear: Optional[Tuple[int, int]] = None, red: Optional[Tuple[int, int]] = None,
               green: Optional[Tuple[int, int]] = None, blue: Optional[Tuple[int, int]] = None) -> None:
        """Calibration ``(low, high)`` per channel for ``normalized()``, in C, R, G, B order. A keyword
        left out keeps that channel's range; an explicit ``None`` clears it. ``0 <= low < high <= 65535``,
        else ``ValueError``."""
    def normalized(self) -> Tuple[float, float, float, float]:
        """``(clear, red, green, blue)`` mapped 0..100 between each channel's calibration low and high
        (channels without a range: % of full scale)."""
    def ambient(self) -> int:
        """Clear channel as a percentage of full scale at the current integration time."""
    def lux(self) -> float:
        """Illuminance estimate (Adafruit linear fit; uncalibrated, depends on gain and integration time)."""
    def color_temperature(self) -> int:
        """Correlated colour temperature estimate in kelvin (McCamy; uncalibrated)."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    @overload
    def gain(self) -> int: ...
    @overload
    def gain(self, x: int, /) -> None:
        """Analogue gain 1, 4, 16 (default) or 60; anything else raises ``ValueError``."""
    @overload
    def integration_time(self) -> float: ...
    @overload
    def integration_time(self, ms: float, /) -> float:
        """Integration time 2.4..614.4 ms in 2.4 ms steps (default 2.4); longer = more counts, slower.
        Returns the value actually set."""
    @overload
    def wait_time(self) -> float: ...
    @overload
    def wait_time(self, ms: float, /) -> float:
        """Pause between integrations, 0 (off, default)..7372.8 ms; returns the value actually set
        (the int ``0`` when off)."""
    @overload
    def thresholds(self) -> Tuple[int, int, int]: ...
    @overload
    def thresholds(self, low: int, high: int, persistence: int = 1, /) -> None:
        """Clear-channel window: below ``low`` or above ``high`` for ``persistence`` cycles
        (0 = every cycle, 1, 2, 3, 5, 10 .. 60) latches ``interrupt()`` until ``clear_interrupt()``.
        ``thresholds(low)`` alone raises ``TypeError``; values outside 0..65535 raise ``ValueError``."""
    def interrupt(self) -> bool:
        """The sensor's latched out-of-window flag (``STATUS.AINT``, read from the chip).

        At the default persistence of 0 ("every cycle") the chip re-asserts the flag on every
        integration whatever the thresholds are, so this reads ``True`` as soon as ``thresholds()``
        has been called: pass a persistence of 1 or more for a flag that means "the clear count left
        the window"."""
    def clear_interrupt(self) -> None:
        """Clear the latched ``interrupt()`` flag on the chip. ``OSError`` while the sensor is unplugged."""
    def id(self) -> int:
        """0x44 (TCS34725 / 34721) or 0x4D (TCS34727 / 34723)."""
    def close(self) -> None:
        """Put the sensor to sleep and release the port."""


class ADC:
    """ADS1115 16-bit ADC (an EVN Standard Peripheral) on I2C port 1..16.

    Inputs: 0..3 = AIN0..AIN3 to ground, 4 = AIN0-AIN1, 5 = AIN0-AIN3, 6 = AIN1-AIN3,
    7 = AIN2-AIN3. Defaults: input 0, **+/-4.096 V** (owner decision 2026-09-18: the 3.3 V module's
    inputs never exceed 3.6 V, so 4.096 V covers them at 1.5x the resolution of 6.144 V),
    860 samples per second. The firmware scans the enabled inputs in the background; readings come
    from its cache. A setter returns once every scanned input has a conversion under the new setting,
    so the first sample after a setter costs one extra conversion (the one in flight is discarded).

    Bench-validated 2026-09-18 (0 V, 3.3 V and +/-3.3 V differential at every range, a servo-pulse
    average as a mid-scale signal, hot-plug): a conversion costs about 3 ms at 860 samples per second
    and 151 ms at 8 (the chip converts ~20 % slower than its nominal rate; the driver learns the
    margin per data rate). Never exceed VDD + 0.3 V (3.6 V) on a pin.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no ADS1115 on port %d (I2C 0x48)")``;
    ``OSError(EIO)`` when all 4 slots are taken, ``OSError(ETIMEDOUT)`` when the first conversion
    does not arrive; ``ValueError("input must be 0..7")``; ``ValueError("input %d is not enabled: see
    inputs()")`` for an input that is not scanned; ``OSError("ADC on port %d not responding")`` while
    unplugged; ``ValueError("ADC is closed")`` after ``close()``.
    """
    def __init__(self, port: int, /) -> None: ...
    def raw(self, input: Optional[int] = None, /) -> int:
        """Latest 16-bit code of ``input`` (``None`` = the first enabled one, or the continuous one)."""
    def voltage(self, input: Optional[int] = None, /) -> float:
        """Latest conversion of ``input`` in volts (cached)."""
    def read(self, input: Optional[int] = None, /) -> float:
        """Wait for the next conversion of ``input`` and return it in volts."""
    @overload
    def inputs(self) -> Tuple[int, ...]: ...
    @overload
    def inputs(self, seq: Union[int, Sequence[int]], /) -> None:
        """The inputs scanned in turn (a single int or a sequence; each takes about 1.2/data_rate
        + 0.7 ms, ~3 ms at 860 samples per second).
        An empty set raises ``ValueError("at least one input")``."""
    @overload
    def range(self) -> float: ...
    @overload
    def range(self, volts: float, /) -> None:
        """Full scale: 6.144, 4.096 (default), 2.048, 1.024, 0.512 or 0.256 V. Never exceed VDD + 0.3 V on a pin."""
    @overload
    def data_rate(self) -> int: ...
    @overload
    def data_rate(self, sps: int, /) -> None:
        """8, 16, 32, 64, 128, 250, 475 or 860 (default) samples per second."""
    @overload
    def continuous(self) -> Optional[int]: ...
    @overload
    def continuous(self, input: Optional[int], /) -> None:
        """Convert one input back to back at the data rate (``None`` returns to scanning). The chip has
        no data-ready flag in this mode, so a read can repeat or skip a conversion."""
    def age(self, input: Optional[int] = None, /) -> int:
        """ms since the cached conversion of ``input``."""
    def close(self) -> None:
        """Put the ADS1115 in power-down and release the port. Idempotent; every other call then raises ``ValueError("ADC is closed")``."""


class EnvSensor:
    """BME280 temperature / pressure / humidity sensor (an EVN Standard Peripheral) on I2C port 1..16.

    Bench-validated 2026-09-17. Defaults are the datasheet's indoor-navigation setting (pressure x16,
    temperature x2, humidity x1, IIR filter 16, 0.5 ms standby). In normal mode a new measurement
    arrives every measurement time plus the standby (40.5 ms at the defaults, about 24.7 readings a
    second); ``measurement_time()`` reports the datasheet's **worst case** for one measurement, which
    is longer. A setting change returns once the first measurement wholly under the new setting exists
    (about two measurement times, 80 ms at the defaults). Skipping the temperature channel makes all
    three values ``None`` (pressure and humidity compensation need it).

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no BME280 on port %d (I2C 0x76)")``;
    ``OSError(EIO)`` when all 4 slots are taken; ``OSError(ETIMEDOUT)`` when no measurement arrives
    within the budget; ``OSError("environment sensor on port %d not responding")`` while unplugged;
    ``ValueError("environment sensor is closed")`` after ``close()``.

    Known limit: a fingertip (or a mounting) covering the vent hole in the metal can reads about
    100 Pa high until it is lifted.
    """
    def __init__(self, port: int, /) -> None: ...
    def temperature(self) -> Optional[float]:
        """Degrees Celsius (``None`` while the channel is skipped)."""
    def pressure(self) -> Optional[float]:
        """Pascals."""
    def humidity(self) -> Optional[float]:
        """Percent relative humidity."""
    def all(self) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """``(temperature, pressure, humidity)`` from the same measurement."""
    def read(self) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """Wait for the next measurement and return ``(temperature, pressure, humidity)``."""
    def raw(self) -> Tuple[int, int, int]:
        """``(adc_t, adc_p, adc_h)`` uncompensated codes."""
    @overload
    def oversampling(self) -> Tuple[int, int, int]: ...
    @overload
    def oversampling(self, *, temperature: Optional[int] = None, pressure: Optional[int] = None,
                     humidity: Optional[int] = None) -> None:
        """0 (skip), 1, 2, 4, 8 or 16 per channel. ``None`` keeps the current value; anything else
        raises ``ValueError``."""
    @overload
    def filter(self) -> int: ...
    @overload
    def filter(self, coefficient: int, /) -> None:
        """IIR filter 0 (off), 2, 4, 8 or 16."""
    @overload
    def standby(self) -> float: ...
    @overload
    def standby(self, ms: float, /) -> None:
        """Normal-mode pause between measurements: 0.5, 10, 20, 62.5, 125, 250, 500 or 1000 ms."""
    @overload
    def forced(self) -> int: ...
    @overload
    def forced(self, interval_ms: int, /) -> None:
        """One host-triggered measurement every ``interval_ms``, 0..2000000 (0 = back to normal mode);
        above that raises ``ValueError("interval must be 0..2000000 ms")``."""
    def measurement_time(self) -> float:
        """Worst-case ms for one measurement at the current oversampling (the datasheet's bound, not
        the typical time the schedule uses)."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Put the BME280 in sleep mode and release the port. Idempotent; every other call then raises ``ValueError("environment sensor is closed")``."""


class Compass:
    """QMC5883L or HMC5883L 3-axis magnetometer (an EVN Standard Peripheral) on I2C port 1..16.

    Body frame: X forward, Y left, Z up (``axes()`` says which sensor axes those are).
    ``heading()`` is 0..360 degrees clockwise from ``north()``. Calibrate once with
    ``calibrate()`` ... ``calibrate_stop()`` while tumbling the sensor (or ``planar=True``
    while spinning a floor robot); ``calibrate_stop()`` stores the result on the board for the port and
    every later ``Compass(port)`` installs it (``evn.compass_calibration(port)`` reads it).
    ``calibrate_stop()`` raises ``ValueError`` when the sensor did not move through enough
    directions (coverage 0 for a still sensor) **and keeps collecting**, so turn some more and stop
    again, or give up with ``calibrate_cancel()``. A flat ring of samples is refused by the 3-D fit;
    a floor robot uses ``calibrate(planar=True)``.
    A calibration corrects the sensor, not the room: keep the compass at one place on the robot,
    away from motors (their magnets change the field as the robot moves).

    A second ``Compass(port)`` on an open port keeps the calibration, the ``axes()`` it was made in
    and the ``north()`` reference; ``close()`` drops them. ``axes()`` set to what it already is is a no-op; a real change clears the
    fit. HMC5883L: 75 Hz, a setter returns after two periods (~30 ms) with the first reading under
    the new setting. Bench-validated on the EVN HMC5883L module (2026-09-17); the QMC5883L variant
    has not been on hardware yet.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no QMC5883L/HMC5883L on port %d ...")``;
    ``OSError(EIO)`` when all 4 slots are taken, ``OSError(ETIMEDOUT)`` for no first sample;
    ``OSError("compass on port %d not responding")`` while unplugged;
    ``ValueError("Compass is closed")`` from every call after ``close()``; ``ValueError`` for a
    setting the chip on the port does not have (``temperature()`` on an HMC, ``bias()`` /
    ``self_test()`` on a QMC) or a value it does not accept.
    """
    def __init__(self, port: int, /) -> None: ...
    def raw(self) -> Tuple[int, int, int]:
        """Sensor-frame counts."""
    def field(self) -> Tuple[float, float, float]:
        """Calibrated field in gauss, body frame. A planar calibration (``calibrate(planar=True)``) corrects x and y
        only: z is then the sensor's own reading, the robot's iron included."""
    def heading(self) -> float:
        """Degrees 0..360 clockwise from north - the direction of the horizontal field, whatever its size.
        ``heading_confidence()`` says how far that field can be trusted as the Earth's; read it beside a heading
        the program acts on."""
    def heading_confidence(self) -> float:
        """0..1, measured from this sample's field strength: 1 when |field| equals the calibration's fitted
        radius, falling to 0 at 25 % off it (a motor's magnets 10 cm away cancelled three quarters of the Earth's
        field on the bench and read 0). After a planar calibration (``calibrate(planar=True)``) the fit is the
        horizontal circle, so the horizontal part of the field is measured against it: the Earth's vertical
        field, which the planar fit does not see, does not count. Without a fitted radius (no ``calibrate()``, or one installed with
        ``calibration(offset, matrix)``, which carries no radius) only a coarse test is possible: 0.5 when |field| is inside the
        Earth's 0.25..0.65 G, else 0. ``Pose`` drops compass samples whose confidence is 0."""
    def field_strength(self) -> float:
        """|field| in gauss (calibrated when a calibration is set). The Earth's field is 0.25..0.65 G. After a planar
        calibration it is the horizontal field only (x and y, what the planar fit calibrates; compare it with
        ``stored_calibration()["field"]``), which is smaller: from about 0.1 G at high latitudes to 0.4 G near the equator."""
    def read(self) -> float:
        """Heading after the next new sample."""
    def north(self, heading: float = 0, /) -> None:
        """The current direction reads as ``heading`` from now on."""
    def temperature(self) -> float:
        """QMC5883L only: relative temperature in degrees Celsius (no factory offset).
        ``ValueError`` on an HMC5883L."""
    def overflow(self) -> bool:
        """The last measurement was out of range for the current ``range()``."""
    def overrun(self) -> bool:
        """A measurement was lost before the last read (the QMC5883L's DOR flag; always ``False`` on
        an HMC5883L, which has no such flag)."""
    def chip(self) -> str:
        """``'QMC5883L'`` or ``'HMC5883L'``."""
    @overload
    def axes(self) -> Tuple[str, str]: ...
    @overload
    def axes(self, *, top: Optional[str] = None, front: Optional[str] = None) -> None:
        """Sensor axes pointing up and forward (``'x'``, ``'y'``, ``'z'``, or ``'-x'`` ...). ``None``
        keeps the current value; two equal axes raise ``ValueError``. Setting the axes to what they
        already are changes nothing; a real change clears the installed calibration."""
    @overload
    def data_rate(self) -> float: ...
    @overload
    def data_rate(self, hz: float, /) -> None:
        """QMC 10/50/100/200 Hz; HMC 0.75/1.5/3/7.5/15/30/75 Hz. The getter is a float on both chips."""
    @overload
    def range(self) -> float: ...
    @overload
    def range(self, gauss: float, /) -> None:
        """QMC 2 or 8 G; HMC 0.88, 1.3 (default), 1.9, 2.5, 4.0, 4.7, 5.6 or 8.1 G. The getter is a
        float on both chips. Lowering an HMC below 4.0 G while a ``bias()`` is set raises ``ValueError``."""
    @overload
    def oversampling(self) -> int: ...
    @overload
    def oversampling(self, n: int, /) -> None:
        """QMC OSR 64/128/256/512; HMC averages 1/2/4/8."""
    @overload
    def bias(self) -> int: ...
    @overload
    def bias(self, mode: int, /) -> None:
        """HMC5883L self-test strap: 0 normal, 1 positive, 2 negative. The strap adds about 1.16 Ga and
        saturates every range under 4.0 G, so a non-zero bias needs ``range(4.0)`` or higher first (else
        ``ValueError``, whose message names 4.7) - or use ``self_test()``, which sets the datasheet's gain itself."""
    def self_test(self, *, negative: bool = False, raw: bool = False) -> Tuple[object, object, object]:
        """HMC5883L only (``ValueError`` on a QMC): the datasheet's self test, run at the gain the
        datasheet prescribes with the settings put back afterwards. Returns ``(ok_x, ok_y, ok_z)``
        booleans, or the raw strap counts with ``raw=True``; ``negative=True`` uses the negative strap."""
    def calibrate(self, planar: bool = False) -> None:
        """Start collecting samples for the hard/soft-iron fit (``planar=True`` fits the horizontal
        ellipse for a robot that only turns on the floor)."""
    def calibrate_progress(self) -> Tuple[int, float]:
        """``(samples, coverage 0..1)``."""
    def calibrate_directions(self) -> Tuple[int, int, bool]:
        """``(mask, current, planar)``: the directions seen so far as a bit mask (bit n = cx + 3*cy + 9*cz,
        each 0/1/2 for below/inside/above the dead band of that axis of the field around its centre,
        body frame; 26 bits, the 8 with cz = 1 in planar mode), the latest reading's direction (-1 =
        none) and the mode - for a live coverage view. ``ValueError`` when no collection runs."""
    def calibrate_stop(self) -> Tuple[float, float, int]:
        """Fit and install the calibration, and store it in flash for this port with the date (every
        later ``Compass(port)`` with the same axes starts with it); ``(residual, coverage, samples)``. ``ValueError`` when
        ``calibrate()`` was not started, and ``ValueError("calibration refused: ...")`` when there are
        not enough samples or directions - collection then continues, so turn more and call again."""
    def calibrate_cancel(self) -> None:
        """End a collection without fitting (the way out of a refused ``calibrate_stop()``)."""
    def stored_calibration(self) -> dict:
        """This port's stored calibration: ``{"port", "calibrated", "busy", "stored", "pending", "stamp",
        "planar", "coverage" (0..1), "residual", "field" (gauss), "samples", "chip", "top", "front",
        "offset" (gauss), "error"}``."""
    def clear_calibration(self) -> bool:
        """Forget this port's stored calibration and the one in force; ``False`` when a running motor
        kept the flash write back."""
    @overload
    def calibration(self) -> Optional[Tuple[Tuple[float, float, float], Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]]]: ...
    @overload
    def calibration(self, offset: Optional[Sequence[float]], matrix: Optional[Sequence[Sequence[float]]] = None, /) -> None:
        """Install a stored ``(offset, matrix)`` or clear it with ``calibration(None)``. An offset alone
        installs the identity matrix (a hard-iron-only calibration)."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Put the magnetometer in standby and release the port (the calibration in use and the ``north()`` reference go with it). Idempotent; every other call then raises ``ValueError("Compass is closed")``."""


class TouchArray:
    """MPR121 12-electrode capacitive touch array (an EVN Standard Peripheral) on I2C port 1..16.

    Touch status every 4 ms, filtered data every 50 ms; auto-configuration sets the charge per
    electrode at every start. Bench-validated 2026-09-18: a bare finger moves a pad by about 500
    counts against the default 12 / 6 thresholds (lower them for a pad under a cover); a hand 1 cm
    above moves it by at most 6; proximity needs ``electrodes(12, proximity=3)``; hot-plug recovers
    by itself. The constructor takes about 55 ms (reset, 76 register writes, auto-configuration, two
    status periods); a setter about 52 ms at the 4 ms status period (26 polls of three writes, then
    the restart and its periods; 171 ms at the 64 ms period), and returns with the first sample
    under the new setting.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no MPR121 on port %d (I2C 0x5A)")``;
    ``OSError(EIO)`` when all 4 slots are taken, ``OSError(ETIMEDOUT)`` for no first sample;
    ``OSError("touch array on port %d not responding")`` while unplugged;
    ``ValueError("touch array is closed")`` after ``close()``;
    ``ValueError("channel must be 0..12 (12 = proximity)")`` for a bad channel.
    """
    def __init__(self, port: int, /) -> None: ...
    def touched(self) -> int:
        """Bitmask, bit n = electrode n touched (bit 12 = proximity)."""
    def read(self, channel: int, /) -> bool:
        """True while electrode ``channel`` (0..11, 12 = the proximity channel) is touched. A channel outside 0..12 raises ``ValueError``."""
    def pressed(self) -> bool:
        """Any electrode touched (the proximity channel excluded)."""
    def proximity(self) -> bool:
        """Needs ``electrodes(..., proximity=1|2|3)``."""
    def events(self) -> Tuple[int, int]:
        """``(pressed_mask, released_mask)`` accumulated since the previous call (read and clear)."""
    def data(self, channel: int, /) -> Tuple[int, int]:
        """``(filtered, baseline)`` 10-bit values, refreshed every 50 ms."""
    @overload
    def thresholds(self) -> Tuple[int, int]:
        """No argument: channel 0's ``(touch, release)`` pair, which an all-channel set applies to
        every channel."""
    @overload
    def thresholds(self, channel: int, /) -> Tuple[int, int]:  # type: ignore[overload-overlap]  # one bare int is the channel (the binding's rule)
        """One bare positional argument is the **channel to read**, not ``touch``: it returns that
        channel's ``(touch, release)``."""
    @overload
    def thresholds(self, *, channel: int) -> Tuple[int, int]:  # type: ignore[overload-overlap]
        """``channel=n`` without ``touch`` / ``release`` is a getter too: that channel's
        ``(touch, release)``."""
    @overload
    def thresholds(self, touch: Optional[int] = None, release: Optional[int] = None, *,
                   channel: Optional[int] = None) -> None:
        """Set the touch / release deltas below the baseline, in counts (0..255). ``channel=None``
        (the default) sets every channel, **including the proximity channel 12**. To set ``touch``
        alone, name it: ``thresholds(touch=3)``. ``thresholds(3, channel=2)`` raises ``TypeError``
        (a bare positional with ``channel=`` is ambiguous)."""
    @overload
    def debounce(self) -> Tuple[int, int]: ...
    @overload
    def debounce(self, touch: int, release: int, /) -> None:
        """0..7 consecutive samples each; one argument alone raises ``TypeError``."""
    @overload
    def electrodes(self) -> Tuple[int, int]: ...
    @overload
    def electrodes(self, count: Optional[int] = None, proximity: Optional[int] = None) -> None:
        """Scan ELE0..count-1 (1..12); proximity 0 off, 1 = ELE0..1, 2 = ELE0..3, 3 = ELE0..11 summed
        as channel 12. ``None`` keeps the current value, so ``electrodes(4)`` keeps the proximity
        setting and ``electrodes(proximity=3)`` keeps the count."""
    @overload
    def sampling(self) -> Tuple[int, int, int]: ...
    @overload
    def sampling(self, first: int, second: int, interval_ms: int, /) -> None:
        """First filter 6/10/18/34 samples, second filter 4/6/10/18, interval 1/2/4/8/16/32/64/128 ms.
        Fewer than three arguments raise ``TypeError``."""
    @overload
    def charge(self) -> Tuple[int, float]: ...
    @overload
    def charge(self, current_uA: int, time_us: float, /) -> None:
        """Global charge current 0..63 uA and time 0, 0.5, 1, 2, 4, 8, 16 or 32 us. This is what the
        electrodes run at while auto-configuration is off; with it on the chip's own search overrides
        it at every start."""
    @overload
    def autoconfig(self) -> Tuple[bool, bool, int, int, int]: ...
    @overload
    def autoconfig(self, enable: bool, reconfig: Optional[bool] = None, vdd: Optional[float] = None) -> None:
        """Auto-configuration of the charge per electrode at every start (``enable``) and
        re-configuration when an electrode drifts out of range (``reconfig``, follows ``enable``
        unless given). ``vdd`` (1.71..3.6 V) recomputes the USL / TL / LSL levels.
        ``autoconfig(False)`` = the ``charge()`` setting applies to every electrode and nothing
        changes it. The getter returns ``(enabled, reconfig, usl, tl, lsl)``."""
    def out_of_range(self) -> int:
        """Bitmask of channels that failed auto-configuration."""
    def overcurrent(self) -> bool:
        """An over-current fault has been seen since the object was opened or ``clear_overcurrent()``
        was called. The driver recovers from the fault by itself (clear, reset, reconfigure), so a
        fault would otherwise be invisible to a program that was not reading at that instant."""
    def clear_overcurrent(self) -> None:
        """Forget a recorded over-current fault, so ``overcurrent()`` reads False until the next one."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Put the MPR121 in stop mode and release the port. Idempotent; every other call then raises ``ValueError("touch array is closed")``."""


class GestureSensor:
    """APDS-9960 gesture / proximity / colour sensor (an EVN Standard Peripheral) on I2C port 1..16.

    Bench-validated 2026-09-17 (12/12 swipes with a hand, every setting, hot-plug). Every setter
    returns with the first sample under the new setting.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no APDS-9960 on port %d (I2C 0x39)")``;
    ``OSError("no free GestureSensor slot for port %d (%d in use)")`` when all 4 slots are taken;
    ``OSError("gesture sensor on port %d gave no first sample")`` / ``"... gave no sample under the
    new setting"`` on a timeout; ``OSError("gesture sensor on port %d not responding")`` while
    unplugged; ``OSError("gesture sensor on port %d is in gesture mode (an object within the gesture
    threshold): colour and proximity are suspended until it moves away, or engines(gesture=False)")``
    from ``proximity()``, the colour getters and ``age()`` when the chip entered gesture mode before
    any reading was taken (a sensor lying face down at power-up, or right after a setter);
    ``ValueError("gesture sensor is closed")`` after ``close()``;
    ``ValueError("colour engine is off: engines(colour=True)")`` /
    ``ValueError("gesture engine is off: engines(gesture=True)")`` with an engine disabled.
    """
    def __init__(self, port: int, /) -> None: ...
    def gesture(self) -> Optional[str]:
        """``'up'``, ``'down'``, ``'left'``, ``'right'`` (each gesture once) or ``None``: the direction the
        hand moved with the module's label upright (``'up'`` = from the bottom edge toward the top edge)."""
    def read_gesture(self, timeout: Optional[int] = 5000) -> Optional[str]:
        """Wait up to ``timeout`` ms for the next gesture (``None`` keeps the 5000 ms default).
        A negative timeout raises ``ValueError("timeout must be >= 0 ms")``."""
    def gesture_detail(self) -> Tuple[Optional[str], Optional[str], Optional[str], int, int, int, bool]:
        """``(gesture, up_down, left_right, ud_delta, lr_delta, datasets, overflow)`` of the last
        gesture; the first three are direction names or ``None``."""
    def proximity(self) -> int:
        """0..255, higher = closer. While an object is held still inside the gesture entry threshold the
        chip stays in gesture mode and this value (and the colour) stops updating until it moves away;
        ``age()`` grows and ``status()[4]`` is ``True``; use ``engines(gesture=False)`` to track a
        stationary object. With no reading taken yet (the object there from power-up) it raises
        ``OSError("... is in gesture mode ...")`` instead of a stale value."""
    def raw(self) -> Tuple[int, int, int, int]:
        """``(clear, red, green, blue)`` counts (needs the colour engine)."""
    def rgb(self) -> Tuple[int, int, int]:
        """``(r, g, b)`` 0..255, each channel relative to the clear channel (needs the colour engine)."""
    def hsv(self) -> Color:
        """The reading as a ``Color`` (``.h`` 0..359, ``.s`` 0..100, ``.v`` 0..100); value is the strongest channel as a % of full scale."""
    def color(self) -> Optional[Color]:
        """Nearest of ``detectable_colors()``, or ``None`` when that set is empty."""
    def color_match(self) -> Tuple[Optional[Color], float]:
        """``(color(), confidence)`` from one reading, as ``ColorSensor.color_match()``: the margin to the
        runner-up (1.0 on the colour, 0.0 halfway between two)."""
    @overload
    def detectable_colors(self) -> Sequence[Color]: ...
    @overload
    def detectable_colors(self, colors: Sequence[Color], /) -> None:
        """The colours ``color()`` chooses from (default: red, yellow, green, blue, white, none); pass a sequence of ``Color`` to change them. Anything that is not a ``Color`` raises ``TypeError``."""
    def ambient(self) -> int:
        """Clear channel as a percentage of full scale."""
    @overload
    def engines(self) -> Tuple[bool, bool, bool]: ...
    @overload
    def engines(self, *, colour: Optional[bool] = None, proximity: Optional[bool] = None,
                gesture: Optional[bool] = None) -> None:
        """``None`` keeps the current state of that engine."""
    @overload
    def gain(self) -> Tuple[int, int, int]: ...
    @overload
    def gain(self, *, colour: Optional[int] = None, proximity: Optional[int] = None,
             gesture: Optional[int] = None) -> None:
        """colour 1/4/16/64, proximity 1/2/4/8, gesture 1/2/4/8; ``None`` keeps the current value."""
    @overload
    def integration_time(self) -> float: ...
    @overload
    def integration_time(self, ms: float, /) -> float:
        """Colour ADC integration 2.78..712 ms in 2.78 ms steps; returns the value actually set."""
    @overload
    def led(self) -> Tuple[float, float, int]: ...
    @overload
    def led(self, *, proximity: Optional[float] = None, gesture: Optional[float] = None,
            boost: Optional[int] = None) -> None:
        """LED current 100/50/25/12.5 mA per engine, boost 100/150/200/300 %; ``None`` keeps the current
        value. The getter returns ``(proximity_mA, gesture_mA, boost_percent)``."""
    @overload
    def pulses(self) -> Tuple[Tuple[int, int], Tuple[int, int]]: ...
    @overload
    def pulses(self, *, proximity: Optional[Tuple[int, int]] = None,
               gesture: Optional[Tuple[int, int]] = None) -> None:
        """``(count, length_us)`` per engine; count 1..64, length 4/8/16/32 us."""
    @overload
    def gesture_config(self) -> Tuple[int, int, int, int, float, int, int]: ...
    @overload
    def gesture_config(self, *, entry: Optional[int] = None, exit: Optional[int] = None,
                       fifo_threshold: Optional[int] = None, dimensions: Optional[int] = None,
                       wait: Optional[float] = None, exit_mask: Optional[int] = None,
                       exit_persistence: Optional[int] = None) -> None:
        """entry / exit 0..255, fifo_threshold 1/4/8/16 datasets, dimensions 0..3,
        wait 0/2.8/5.6/8.4/14/22.4/30.8/39.2 ms, exit_mask 0..15, exit_persistence 1/2/4/7.
        ``None`` keeps the current value. The getter returns
        ``(entry, exit, fifo_threshold, dimensions, wait_ms, exit_mask, exit_persistence)``."""
    @overload
    def thresholds(self) -> Tuple[int, int, int, int, int, int]: ...
    @overload
    def thresholds(self, *, als: Optional[Tuple[int, int, int]] = None,
                   proximity: Optional[Tuple[int, int, int]] = None) -> None:
        """``(low, high, persistence)`` per engine: ALS 0..65535 with persistence 0, 1, 2, 3, 5, 10 .. 60;
        proximity 0..255 with persistence 0..15. The getter returns the six values in one flat tuple."""
    def status(self) -> Tuple[bool, bool, bool, bool, bool]:
        """``(als_int, prox_int, als_saturated, prox_saturated, in_gesture)``; ``in_gesture`` is the
        chip's ``GCONF4.GMODE`` bit - ``True`` while the chip is decoding a gesture and its proximity
        and colour engines are suspended."""
    def clear_interrupts(self) -> None:
        """Clear the latched ALS and proximity interrupts on the chip (``status()``). ``OSError`` while the sensor is unplugged."""
    @overload
    def offsets(self) -> Tuple[int, int, int, int, int, int]: ...
    @overload
    def offsets(self, prox_ur: int, prox_dl: int, g_up: int, g_down: int, g_left: int, g_right: int, /) -> None:
        """Six sign/magnitude bytes 0..255; any other number of arguments raises ``TypeError``."""
    @overload
    def photodiodes(self) -> Tuple[int, bool]: ...
    @overload
    def photodiodes(self, mask: Optional[int] = None, compensate: Optional[bool] = None) -> None:
        """Proximity diode masking: ``mask`` 0..15 (U D L R bits disable a diode), ``compensate``
        enables the chip's gain compensation. With neither given this is the getter, which returns
        ``(mask, compensate)``."""
    @overload
    def wait_time(self) -> float: ...
    @overload
    def wait_time(self, ms: float, /) -> float:
        """Pause between ALS / proximity cycles, 0..8540 ms (0 = off); returns the value actually set
        (the int ``0`` when off)."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def id(self) -> int:
        """0xAB, or 0xA8 on the alternate part the EVN module carries."""
    def close(self) -> None:
        """Put the APDS-9960 to sleep and release the port. Idempotent; every other call then raises ``ValueError("gesture sensor is closed")``."""


class DistanceSensor:
    """VL53L0X time-of-flight distance sensor (an EVN Standard Peripheral) on I2C port 1..16.

    Bench-validated 2026-09-17 on three sensors at once. The constructor runs the ST soft reset and
    initialisation (about 100 ms) and starts continuous ranging; every setter re-runs part of the
    init and returns with the first measurement under the new setting.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no VL53L0X on port %d (I2C 0x29)")``;
    ``OSError("no free DistanceSensor slot for port %d (%d in use)")`` when all 4 slots are taken;
    ``OSError("distance sensor on port %d gave no first measurement")`` / ``"... gave no measurement
    under the new setting"`` on a timeout; ``OSError("distance sensor on port %d not responding")``
    while unplugged; ``ValueError("distance sensor is closed")`` after ``close()``.
    """
    def __init__(self, port: int, /) -> None: ...
    def distance(self) -> Optional[int]:
        """Millimetres, or ``None`` when there is no valid target."""
    def read(self) -> Optional[int]:
        """Distance after the next measurement."""
    def raw(self) -> Tuple[int, str, int, float, float, float]:
        """``(range_mm, status_name, device_status, signal_rate_mcps, ambient_rate_mcps, spad_count)``."""
    def status(self) -> str:
        """``'valid'``, ``'sigma fail'``, ``'signal fail'``, ``'phase fail'``, ``'hardware fail'``,
        ``'min range fail'`` or ``'no update'``."""
    @overload
    def timing_budget(self) -> float: ...
    @overload
    def timing_budget(self, ms: float, /) -> None:
        """20..1000 ms per measurement (longer = more accurate). The getter is a float."""
    @overload
    def signal_rate_limit(self) -> float: ...
    @overload
    def signal_rate_limit(self, mcps: float, /) -> None:
        """0..511.99 MCPS (lower = longer range, more false readings)."""
    @overload
    def vcsel_periods(self) -> Tuple[int, int]: ...
    @overload
    def vcsel_periods(self, pre: int, final: int, /) -> None:
        """``pre`` 12/14/16/18, ``final`` 8/10/12/14 PCLKs; one argument alone raises ``TypeError``."""
    @overload
    def inter_measurement(self) -> int: ...
    @overload
    def inter_measurement(self, ms: int, /) -> None:
        """Pause between ranges, 0..60000 ms (0 = back to back)."""
    def profile(self, name: str, /) -> None:
        """``'default'``, ``'high_speed'``, ``'high_accuracy'`` or ``'long_range'`` (setter only)."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Stop ranging (software standby) and release the port. Idempotent; every other call then raises ``ValueError("distance sensor is closed")``."""


class IMU:
    """MPU-6500 6-axis IMU with its DMP (an EVN Standard Peripheral) on I2C port 1..16.

    Body frame X forward, Y left, Z up. The DMP fuses gyro and accelerometer at 200 Hz; yaw is
    relative to start-up (or ``reset_heading()``). Bench-validated 2026-09-18: the constructor takes
    450..600 ms (DMP load), turning clockwise seen from above raises ``heading()`` (unwrapped past
    360), nose up gives a positive pitch, left side up a positive roll, ``up()`` names the side
    facing up, taps and the Android orientation are reported once each, and a hot-plug into the same
    socket keeps the settings and the heading. The orientation starts at identity and settles within
    ~10 s; the DMP calibrates its gyro 8..25 s into stillness (``ready()``), after which the heading
    drifts about 0.2 degrees per 5 s. Keep the robot still for the first ~15 s (moved early, the DMP
    may not calibrate for a long time - ``dmp(True, gyro_cal=False)`` then lets the driver average
    the bias itself after 1 s still). A module mounted upside down needs ``axes(top='-z')``.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no MPU-6500 on port %d (I2C 0x68)")``;
    ``OSError(EIO)`` when both slots are taken, ``OSError(ETIMEDOUT)`` for no first sample;
    ``OSError("IMU on port %d not responding")`` from **every** getter while the module is unplugged
    (``heading()``, ``stationary()`` and ``ready()`` included); ``ValueError("IMU is closed")`` after
    ``close()``; ``ValueError("orientation needs the DMP: imu.dmp(True)")`` from the quaternion-based
    getters in raw mode.

    Known limits: the gyro filter values 250 Hz and 3600 Hz are refused - they select the chip's
    8 kHz internal rate, where the sample-rate divider is ignored and the DMP's time base breaks.
    ``evn.I2C(port).scan()`` of this port pops one byte of the FIFO (the driver heals it with a FIFO
    reset). One call can hold the I2C bus for up to ~3.7 ms while it drains the FIFO.
    """
    def __init__(self, port: int, /, *, calibrate: bool = False) -> None:
        """Start the IMU on I2C port 1..16. The port's stored calibration (``calibrate()``) is applied
        by default: its gyro and accelerometer offsets and its axes. ``calibrate=True`` runs a new one
        first (~2 s, the robot still on a level surface); a failed one raises ``RuntimeError``."""
    def calibrate(self, wait: bool = True, *, pose: int = 0) -> Optional[dict]:
        """About 2 s with the robot still on a level surface: measures the gyro bias, the
        accelerometer offsets and which sensor axis points up, stores them in flash for this port with
        the date and applies them (every later ``IMU(port)`` starts with them). ``axes()`` follows: top
        from gravity, front kept where it still fits - check it. Returns ``calibration()``; raises
        ``RuntimeError("IMU calibration failed: ...")`` only when it moved. Off level it calibrates
        what it can - over 8 degrees the gyro and the up axis, over 30 the gyro alone - and says what
        it left out in ``warning``. ``wait=False``
        returns ``None`` at once; ``calibration()`` reports ``busy`` and finishes it. ``pose=1``, then
        turn the robot about half a turn on the same spot on its wheels, then ``pose=2``: the two-pose
        calibration, which leaves a sloped surface out (up to 20 degrees, reported as ``slope``) and
        stores only the sensor's and the mount's error."""
    def calibration(self) -> dict:
        """This port's stored calibration: ``{"port", "calibrated", "busy", "stored", "stamp" (seconds
        since 1970 UTC, 0 = the clock was not set), "gyro" (deg/s bias, sensor axes), "accel" (g error,
        sensor axes), "top", "front", "temperature", "error" (why the last calibration failed, else
        None), "pending" (a change on any port is not in flash yet), "accel_calibrated", "tilt" (degrees
        off level the accelerometer was calibrated at, None when it was not), "warning" (what the last
        calibration left out, or a caution; else None), "two_pose", "slope" (degrees a two-pose
        calibration left out this session, else None), "waiting" (between pose=1 and pose=2)}``."""
    def cancel_calibration(self) -> None:
        """Drop a calibration in progress (a ``wait=False`` run, or a first pose waiting for its turn);
        nothing is stored."""
    def clear_calibration(self) -> bool:
        """Forget this port's calibration: back to the factory trim; ``axes()`` stays. ``False`` when a
        running motor kept the flash write back (retried by the next ``calibration()``)."""
    def quaternion(self) -> Tuple[float, float, float, float]:
        """``(w, x, y, z)``, unit (DMP mode only)."""
    def heading(self) -> float:
        """Heading in degrees, clockwise positive; keeps growing past +/-180 (as Pybricks)."""
    def reset_heading(self, angle: float = 0, /) -> None:
        """The current pose reads as ``angle``."""
    def up(self) -> int:
        """The ``Side`` that faces up (``Side.TOP`` when level)."""
    def stationary(self) -> bool:
        """True while angular velocity and acceleration vary less than the ``settings()`` thresholds
        over 250 ms."""
    def ready(self) -> bool:
        """True once the gyro bias has settled: stationary with the calibrated gyro under the threshold
        on every axis (the DMP calibrates 8..25 s into stillness; raw mode averages 1 s by itself
        after 1 s still)."""
    @overload
    def settings(self) -> Tuple[float, float, float]: ...
    @overload
    def settings(self, *, angular_velocity_threshold: Optional[float] = None,
                 acceleration_threshold: Optional[float] = None,
                 heading_correction: Optional[float] = None) -> None:
        """``angular_velocity_threshold`` deg/s (2), ``acceleration_threshold`` mm/s^2 (2500) for
        ``stationary()``; ``heading_correction`` = degrees reported per true full turn (360), clamped
        to 1..3600. A non-positive value raises ``ValueError("settings must be positive")``."""
    def tilt(self) -> Tuple[float, float]:
        """``(pitch, roll)`` degrees, both in the range (-180, 180] (roll is ``atan2`` of two gravity
        components, so an upside-down module is distinguishable from a level one). DMP mode only."""
    def euler(self) -> Tuple[float, float, float]:
        """``(yaw, pitch, roll)`` degrees; yaw is the heading wrapped into -180..180. DMP mode only."""
    def acceleration(self) -> Tuple[float, float, float]:
        """mm/s^2 in the body frame."""
    def linear_acceleration(self) -> Tuple[float, float, float]:
        """mm/s^2 with gravity removed (DMP mode only)."""
    def gravity(self) -> Tuple[float, float, float]:
        """Unit vector in the body frame (DMP mode only)."""
    def angular_velocity(self) -> Tuple[float, float, float]:
        """deg/s in the body frame."""
    def raw(self) -> Tuple[Tuple[int, int, int], Tuple[int, int, int]]:
        """``((ax, ay, az), (gx, gy, gz))`` counts."""
    def read(self) -> Union[Tuple[float, float, float], Tuple[Tuple[float, float, float], Tuple[float, float, float]]]:
        """Wait for the next sample: ``(yaw, pitch, roll)`` in DMP mode, ``((ax, ay, az) g,
        (gx, gy, gz) deg/s)`` in raw mode. The rate is the DMP rate (``sample_rate()``)."""
    def temperature(self) -> float:
        """Die temperature in degrees Celsius."""
    def tap(self) -> Optional[Tuple[str, int]]:
        """``(direction, count)`` of a tap not yet returned, e.g. ``('z up', 1)``; a firm tap is
        needed (250 mg/ms), and the DMP counts a double tap (``count`` 2) only when it reads both
        impulses in the same direction within 500 ms. Taps are in the body frame."""
    def screen_orientation(self) -> Optional[str]:
        """``'portrait'``, ``'landscape'``, ``'reverse portrait'`` or ``'reverse landscape'`` of an
        orientation change not yet returned, else ``None`` - each event is reported once, as ``tap()``
        does. **Chip frame**: the DMP's own x/y, which ``axes()`` does not remap (taps are remapped)."""
    def calibrate_gyro(self, samples: int = 500, /) -> Optional[Tuple[int, int, int]]:
        """Average ``samples`` (1..65535) still readings and subtract the bias; returns the bias in
        counts, or ``None`` while the DMP's own gyro calibration owns the bias (``dmp(True)`` with its
        default ``gyro_cal=True``); with ``dmp(True, gyro_cal=False)`` it measures and returns it."""
    @overload
    def ranges(self) -> Tuple[int, int]: ...
    @overload
    def ranges(self, *, gyro: Optional[int] = None, accel: Optional[int] = None) -> None:
        """gyro 250/500/1000/2000 dps, accel 2/4/8/16 g (raw mode). In DMP mode anything but
        2000 dps / 2 g raises ``ValueError``; ``None`` keeps the current value."""
    @overload
    def filter(self) -> Tuple[int, int]: ...
    @overload
    def filter(self, *, gyro: Optional[int] = None, accel: Optional[int] = None) -> None:
        """Digital low-pass: gyro 184/92/41/20/10/5 Hz, accel 460/184/92/41/20/10/5 Hz. The gyro's
        250 Hz and 3600 Hz settings are **not** offered (they switch the chip to its 8 kHz internal
        rate and break the DMP's time base). ``None`` keeps the current value."""
    @overload
    def sample_rate(self) -> int: ...
    @overload
    def sample_rate(self, hz: int, /) -> None:
        """DMP mode 12..200 Hz, raw mode 4..1000 Hz."""
    @overload
    def dmp(self) -> bool: ...
    @overload
    def dmp(self, enable: bool, *, rate: Optional[int] = None, tap: bool = True,
            orientation: bool = True, gyro_cal: bool = True) -> None:
        """Switch the DMP on or off. ``rate=None`` **keeps the rate in force** (12..200 Hz otherwise);
        ``tap`` / ``orientation`` / ``gyro_cal`` select the DMP features. ``dmp()`` with no argument
        is the getter."""
    @overload
    def axes(self) -> Tuple[str, str]: ...
    @overload
    def axes(self, *, top: Optional[str] = None, front: Optional[str] = None) -> None:
        """Which chip axes point up and forward (``'x'``, ``'y'``, ``'z'``, ``'-x'`` ...); ``None``
        keeps the current value, two equal axes raise ``ValueError``."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Put the MPU-6500 to sleep and release the port. Idempotent; every other call then raises ``ValueError("IMU is closed")``."""


class MatrixLED:
    """EVN 8x8 LED matrix (HT16K33, an EVN Standard Peripheral) on I2C port 1..16.

    Drawing changes a frame in the firmware that reaches the board within 10 ms (1.2-3.8 ms
    measured). The EVN matrix answers at I2C address 0x71 (``addr=`` for another HT16K33 board,
    0x71..0x77; **0x70 is the board's I2C multiplexer and is refused**). The chip's state is re-sent
    with every frame and its RAM is read every 100 ms while idle, so a forced reset heals within
    ~107 ms and an unplugged display is noticed. Bench-validated 2026-09-18: every drawing call
    verified on the chip, the pictures read by eye, a replug restores the picture, brightness and
    orientation. ``orientation()`` applies to the drawing calls that follow it.

    Raises: ``ValueError("port must be 1..16")``;
    ``ValueError("addr must be 0x71..0x77 (0x70 is the board's I2C multiplexer)")``;
    ``OSError("no HT16K33 on port %d (I2C 0x%02x)")``;
    ``OSError("port %d: no free LED display slot (at most 4)")``; ``OSError(ETIMEDOUT)`` when the
    chip does not come up; ``OSError("LED display on port %d not responding")`` while unplugged;
    ``ValueError("MatrixLED is closed")`` from every call after ``close()``.
    """
    def __init__(self, port: int, addr: Optional[int] = None) -> None:
        """``addr=None`` uses the EVN matrix's 0x71."""
    @overload
    def brightness(self) -> int: ...
    @overload
    def brightness(self, level: int, /) -> None:
        """1..16."""
    @overload
    def blink(self) -> float: ...
    @overload
    def blink(self, hz: float, /) -> None:
        """0 (off), 2, 1 or 0.5 Hz."""
    def on(self, enable: bool = True, /) -> None:
        """Display enable (the chip's, not the frame)."""
    def off(self) -> None:
        """Display off (the chip's enable; the frame is kept and ``on()`` shows it again)."""
    def clear(self) -> None:
        """Every pixel off."""
    def fill(self) -> None:
        """Every pixel on."""
    def show(self) -> None:
        """Push the frame to the chip now."""
    @overload
    def raw(self) -> bytes:
        """The 16 display-RAM bytes."""
    @overload
    def raw(self, frame: bytes, /) -> None:
        """Write all 16 display-RAM bytes."""
    @overload
    def raw(self, led: int, on: bool, /) -> None:
        """Set one of the 128 LEDs (0..127) directly."""
    @overload
    def keys(self) -> bytes:
        """The six key-scan bytes; ``ValueError("key scan is off: keys(True)")`` until ``keys(True)``,
        and after it until the first scan has completed."""
    @overload
    def keys(self, enable: bool, /) -> None:
        """Turn the chip's key scan on or off."""
    def pixel(self, row: int, column: int, brightness: Union[int, float, bool] = 100) -> None:
        """Pybricks order: row 0..7 from the top, column 0..7 from the left; 0 / 0.0 / False turns the
        pixel off (the chip has one global brightness, so any non-zero value lights it)."""
    def get(self, row: int, column: int, /) -> bool:
        """True when the frame's pixel at ``row``, ``column`` (0..7) is on."""
    def hline(self, row: int, col0: int, col1: int, on: bool = True, /) -> None:
        """Horizontal line on ``row`` from ``col0`` to ``col1`` (0..7); ``on=False`` erases."""
    def vline(self, column: int, row0: int, row1: int, on: bool = True, /) -> None:
        """Vertical line in ``column`` from ``row0`` to ``row1`` (0..7); ``on=False`` erases."""
    def rect(self, row0: int, col0: int, row1: int, col1: int, on: bool = True, /) -> None:
        """Filled rectangle."""
    def bitmap(self, rows: Union[bytes, Sequence[int], Sequence[Sequence[int]]], /) -> None:
        """8 bytes, one per row, bit 7 = leftmost pixel (or 8 rows of 8 values, non-zero = on)."""
    def image(self, matrix: Union[bytes, Sequence[int], Sequence[Sequence[int]]], /) -> None:
        """Same as ``bitmap()`` (the Pybricks name)."""
    def icon(self, icon: bytes, /) -> None:
        """Show an ``Icon`` member (or any 8-row bitmap)."""
    def char(self, char: str, /) -> None:
        """One 8x8 glyph; a string that is not one character raises ``ValueError``."""
    def number(self, number: int, /) -> None:
        """-99..99 in 3x5 digits (a dash / a corner pixel marks negative); outside that raises
        ``ValueError("number must be -99..99")``."""
    def text(self, text: str, on: int = 500, off: int = 50, *, wait: bool = True) -> None:
        """One character at a time, ``on`` ms lit then ``off`` ms blank, blank at the end;
        ``wait=False`` returns at once (``animating()`` tells when it is over). ``on`` below 1 ms
        raises ``ValueError("on must be >= 1 ms")``, a negative ``off`` raises ``ValueError``, and the
        text is limited to 63 characters."""
    def animate(self, matrices: Sequence[Union[bytes, Sequence[int], Sequence[Sequence[int]]]], interval: int, /) -> None:
        """Cycle 1..32 images forever, ``interval`` ms (>= 1) each, in the background; any drawing call
        ends it."""
    def animating(self) -> bool:
        """True while an ``animate()`` or ``text(wait=False)`` sequence is running."""
    def stop(self) -> None:
        """End an animation or text sequence, leaving the frame as it is."""
    @overload
    def orientation(self) -> Union[int, Tuple[bool, bool, bool]]:
        """The ``Side`` that is up, or ``(invert_x, invert_y, swap_xy)`` when the transform is not a
        rotation."""
    @overload
    def orientation(self, up: int, /) -> None:
        """``Side.TOP`` (as wired), ``RIGHT``, ``BOTTOM`` or ``LEFT``: which edge of the matrix is up.
        Any other ``Side`` raises ``ValueError``."""
    @overload
    def orientation(self, *, invert_x: bool = False, invert_y: bool = False, swap_xy: bool = False) -> None:
        """Mirrored mountings."""
    def close(self) -> None:
        """Display and oscillator off (standby) and release the port. Idempotent; every other call then raises ``ValueError("MatrixLED is closed")``."""


class SevenSegmentLED:
    """EVN 4-digit seven-segment display (HT16K33, an EVN Standard Peripheral) on I2C port 1..16.

    The EVN seven-segment board answers at I2C address 0x74 (``addr=`` for another HT16K33 board,
    0x71..0x77; **0x70 is the board's I2C multiplexer and is refused**). Bench-validated on the EVN
    board (2026-09-17): every call checked on the chip and read by eye, hot-plug recovery. The
    chip's state is re-sent with every frame and its RAM read every 100 ms while idle.

    Raises: as ``MatrixLED``, with ``ValueError("SevenSegmentLED is closed")`` after ``close()``.
    """
    def __init__(self, port: int, addr: Optional[int] = None) -> None:
        """``addr=None`` uses the EVN seven-segment board's 0x74."""
    @overload
    def brightness(self) -> int: ...
    @overload
    def brightness(self, level: int, /) -> None:
        """1..16."""
    @overload
    def blink(self) -> float: ...
    @overload
    def blink(self, hz: float, /) -> None:
        """0 (off), 2, 1 or 0.5 Hz."""
    def on(self, enable: bool = True, /) -> None:
        """Display enable (the chip's, not the frame); ``on(False)`` is ``off()``."""
    def off(self) -> None:
        """Display off (the frame is kept and ``on()`` shows it again)."""
    def clear(self) -> None:
        """Every segment off."""
    def fill(self) -> None:
        """Every segment on."""
    def show(self) -> None:
        """Push the frame to the chip now."""
    @overload
    def raw(self) -> bytes: ...
    @overload
    def raw(self, frame: bytes, /) -> None: ...
    @overload
    def raw(self, led: int, on: bool, /) -> None:
        """Direct display RAM: no argument returns the 16 bytes, ``raw(frame)`` writes all 16, ``raw(led, on)`` sets one of the 128 LEDs (0..127)."""
    @overload
    def keys(self) -> bytes:
        """As ``MatrixLED.keys()``: ``ValueError("key scan is off: keys(True)")`` until ``keys(True)``
        and its first completed scan."""
    @overload
    def keys(self, enable: bool, /) -> None: ...
    def digit(self, position: int, value: int, /) -> None:
        """``position`` 0..3, ``value`` 0..9."""
    def char(self, position: int, letter: str, /) -> None:
        """A character with a seven-segment glyph: a digit 0-9 or A B C D E F G H J L N O P R T U Y
        (upper or lower case, shown the same) - _ space; anything else raises ``ValueError``. Only the
        first character of ``letter`` is used."""
    def text(self, text: str, /) -> None:
        """Up to 4 characters, left aligned; a ``'.'`` after a character lights its point."""
    def number(self, value: Union[int, float], /) -> None:
        """A float with the point after the integer part (the EVN Arduino layout); an int goes to the
        integer layout. Outside -999..9999 an int raises ``ValueError("number must be -999..9999")``
        and NaN / infinity raise ``ValueError("number must be a finite value")``; a float outside the
        range still falls back to the documented layout (99999.0 shows 9999)."""
    def integer(self, value: int, /) -> None:
        """-999..9999, right aligned."""
    def point(self, position: int, on: bool = True, /) -> None:
        """Light (or with ``on=False`` clear) the decimal point of digit ``position`` 0..3."""
    def colon(self, on: bool = True, /) -> None:
        """Light (or with ``on=False`` clear) the colon."""
    def segments(self, position: int, mask: int, /) -> None:
        """Raw segments: a..g = bits 0..6, point = bit 7 (0..255)."""
    def clear_position(self, position: int, clear_point: bool = True, /) -> None:
        """Blank digit ``position`` 0..3, and its decimal point unless ``clear_point=False``."""
    def close(self) -> None:
        """Display and oscillator off (standby) and release the port. Idempotent; every other call then raises ``ValueError("SevenSegmentLED is closed")``."""


class Display:
    """EVN 128x64 OLED (SSD1306 / SSD1315, an EVN Standard Peripheral) on I2C port 1..16.

    Text is a 16-column x 8-row grid of 8x8 characters. Changes are streamed to the panel in the
    background (a full repaint takes about 30 ms with ``show()``, about 57 ms streamed); a display
    that is unplugged raises ``OSError`` from ``show()``, ``all_on()``, ``scroll()``,
    ``scroll_stop()``, ``fade()``, ``zoom()`` and ``command()``, while ``contrast()``, ``flip()``,
    ``invert()``, ``on()`` and ``off()`` only store the setting; it comes back by itself with its
    picture and those settings when replugged. The constructor's budget covers the settle and
    the confirming re-send and can take up to about 740 ms on a panel that has just been plugged in;
    the confirming setup is re-sent on every attach. Bench-validated on the EVN OLED (an SSD1315)
    2026-09-17.

    **Scrolling**: the panel's RAM may not be written while a hardware scroll runs, so drawing is
    held back until it stops. The first drawing call after ``scroll()`` stops the scroll and repaints
    the frame, and a new ``scroll()`` sends the stop command first. ``flip()`` repaints the frame
    (the segment re-map only affects data written after it, SSD1306 10.1.8).

    Raises: ``ValueError("port must be 1..16")``; ``ValueError("addr must be 0x3C or 0x3D")``;
    ``OSError("no SSD1306 on port %d (I2C 0x%02x)")``;
    ``OSError("port %d: no free display slot (at most 2)")``; ``OSError(ETIMEDOUT)`` when the panel
    does not come up; ``OSError("display on port %d not responding")`` while unplugged;
    ``ValueError("Display is closed")`` from every call after ``close()``.
    """
    def __init__(self, port: int, addr: int = 0x3C, *, flip: bool = False) -> None: ...
    def write(self, row: int, text: object, /) -> None:
        """A whole row 0..7 (padded to 16 characters); resets the row's label."""
    def label(self, row: int, text: object, /) -> None:
        """The row's prefix; ``data()`` writes after it."""
    def data(self, row: int, value: object, /) -> None:
        """Text after the label; the rest of the row is cleared."""
    def text(self, col: int, row: int, text: object, invert: bool = False) -> int:
        """Characters at a grid position (col 0..15, row 0..7), no padding; returns how many
        characters were written. ``invert`` may be given positionally or as a keyword."""
    def clear(self) -> None:
        """Clear the frame and home the ``print()`` cursor."""
    def clear_row(self, row: int, /) -> None:
        """Clear text row 0..7 and its label."""
    @overload
    def pixel(self, x: int, y: int, /) -> bool: ...
    @overload
    def pixel(self, x: int, y: int, on: bool, /) -> None:
        """``pixel(x, y)`` reads the frame's pixel (x 0..127, y 0..63); ``pixel(x, y, on)`` sets it."""
    def line(self, x0: int, y0: int, x1: int, y1: int, on: bool = True, /) -> None:
        """Every coordinate must be on the screen (x 0..127, y 0..63)."""
    def rect(self, x0: int, y0: int, x1: int, y1: int, on: bool = True, *, fill: bool = False) -> None:
        """Rectangle from ``(x0, y0)`` to ``(x1, y1)`` (on the screen: x 0..127, y 0..63); ``fill=True`` (keyword) fills it, ``on=False`` erases."""
    width: int
    """128 (pixels)."""
    height: int
    """64 (pixels)."""
    def draw_pixel(self, x: int, y: int, color: Union[Color, bool] = True) -> None:
        """EV3 screen names: ``Color.BLACK`` (the default ink) lights a pixel; ``Color.NONE`` (value 0)
        and any grey with value >= 50 (``Color.WHITE``, ``Color.GRAY``) erase, as does ``False``.
        Coordinates off the screen are clipped, not refused."""
    def draw_line(self, x1: int, y1: int, x2: int, y2: int, width: int = 1, color: Union[Color, bool] = True) -> None:
        """``width`` 1..64."""
    def draw_box(self, x1: int, y1: int, x2: int, y2: int, r: int = 0, fill: bool = False,
                 color: Union[Color, bool] = True) -> None:
        """Rectangle with corner radius ``r`` (>= 0)."""
    def draw_circle(self, x: int, y: int, r: int, fill: bool = False, color: Union[Color, bool] = True) -> None:
        """``r`` 0..255."""
    def draw_text(self, x: int, y: int, text: object, text_color: Union[Color, bool] = True,
                  background_color: Union[Color, bool, None] = None) -> None:
        """8x8 glyphs at a pixel position; ``background_color=None`` is transparent."""
    def print(self, *args: object, sep: str = " ", end: str = "\n") -> None:
        """Like the builtin ``print()`` on the 16x8 text grid: wraps, scrolls up at the bottom;
        ``clear()`` homes the cursor."""
    @overload
    def mirror(self) -> bool: ...
    @overload
    def mirror(self, enable: bool, /) -> None:
        """Copy the board's stdout - the REPL, every print(), tracebacks - to this display's console,
        with or without a USB host. One display at a time; ``mirror(False)``, ``close()`` or a soft
        reset (Ctrl-D) ends it. Each mirrored line costs a scroll of the frame, so a program that
        prints steadily keeps the panel busy."""
    @overload
    def frame(self) -> bytes: ...
    @overload
    def frame(self, data: bytes, /) -> None:
        """The page-major frame buffer; exactly 1024 bytes."""
    def splash(self) -> None:
        """The EVN logo."""
    def show(self) -> None:
        """Push every pending change now and wait for it."""
    @overload
    def contrast(self) -> int: ...
    @overload
    def contrast(self, value: int, /) -> None:
        """1..255."""
    @overload
    def flip(self) -> bool: ...
    @overload
    def flip(self, enable: bool, /) -> None:
        """Rotate the panel 180 degrees. The frame is repainted (the segment re-map only affects
        data written after it, SSD1306 10.1.8): about 30 ms with ``show()``."""
    @overload
    def invert(self) -> bool: ...
    @overload
    def invert(self, enable: bool, /) -> None:
        """Inverted panel (``True``: unlit pixels light and lit ones go dark) or normal (``False``, default); the frame is untouched."""
    def on(self, enable: bool = True, /) -> None:
        """Panel on (``on(False)`` is ``off()``); the frame is kept."""
    def off(self) -> None:
        """Panel off (sleep); the frame is kept and ``on()`` shows it again."""
    def scroll(self, left: bool = False, rows: Optional[Tuple[int, int]] = None, speed: int = 0,
               vertical: int = 0) -> None:
        """Hardware scroll: ``rows`` ``(first, last)`` of 0..7 ascending (``None`` = the whole screen),
        ``speed`` 0..7 (a frame-interval code), ``vertical`` -63..63. While it runs the frame is not
        written to the panel; the next drawing call stops it and repaints."""
    def scroll_stop(self) -> None:
        """Stop a hardware ``scroll()``; the next drawing call repaints the frame."""
    def fade(self, mode: str, interval: int = 0, /) -> None:
        """``'off'``, ``'fade'`` or ``'blink'`` with the frame-interval code 0..15."""
    def zoom(self, enable: bool = True, /) -> None:
        """The panel's zoom-in mode (SSD1306 command 0xD6): each row shown twice as tall; ``zoom(False)`` ends it."""
    def all_on(self, enable: bool = True, /) -> None:
        """Light every pixel (the panel's entire-display-on command; the frame is untouched)."""
    def command(self, data: bytes, /) -> None:
        """Raw command bytes (1..32) for anything not wrapped."""
    def close(self) -> None:
        """Panel off and release the port (a ``mirror()`` on this display ends). Idempotent; every other call then raises ``ValueError("Display is closed")``."""


class RGBLED:
    """WS2812B strip / EVN RGB LED module on servo port 1..4 (an EVN Standard Peripheral).

    The servo channel is borrowed while the object is open: ``Servo(n)`` on that port raises
    ``OSError`` until ``close()``, and ``RGBLED(n)`` raises ``OSError("servo port %d is used by a
    Servo object")`` while a ``Servo`` object holds it. ``close()`` pushes a black frame and hands
    the channel back over the next polls, so the strip is dark about a millisecond later and the
    port stays low unless a ``Servo`` object takes it.

    Bench-validated on the EVN RGB LED module 2026-09-18: LED 0 is the LED at the module's connector
    end (``invert=True`` for a module mounted the other way round); a frame reaches the strip within
    a millisecond (30 us per LED + 340 us latch, 0.6 ms for the module), patterns keep time to 1 ms.

    Raises: ``ValueError("servo port must be 1..4")``, ``ValueError("count must be 1..64")``;
    ``OSError("servo port %d is not available for an LED strip")``;
    ``ValueError("RGBLED is closed")`` after ``close()``; ``ValueError`` for an LED index out of
    range, a colour component outside 0..255, a pattern step below 2 ms or a pattern longer than 16
    entries; ``OSError(ETIMEDOUT)`` when ``show()`` waits more than 20 ms for the previous frame.
    """
    def __init__(self, port: int, count: int = 8, *, invert: bool = False) -> None:
        """``invert`` is keyword-only."""
    @overload
    def set(self, led: int, r: int, g: int, b: int, /) -> None: ...
    @overload
    def set(self, led: int, color: Union[Color, Tuple[int, int, int]], /) -> None:
        """Colour of LED ``led`` (0..count-1): ``r, g, b`` 0..255, an ``(r, g, b)`` tuple or a ``Color``. The strip is updated at the next poll (about a millisecond), or at once by ``show()``."""
    @overload
    def fill(self, r: int, g: int, b: int, /) -> None: ...
    @overload
    def fill(self, color: Union[Color, Tuple[int, int, int]], /) -> None:
        """Every LED the same colour: ``r, g, b`` 0..255, an ``(r, g, b)`` tuple or a ``Color``."""
    @overload
    def range(self, first: int, last: int, r: int, g: int, b: int, /) -> None: ...
    @overload
    def range(self, first: int, last: int, color: Union[Color, Tuple[int, int, int]], /) -> None:
        """LEDs ``first`` to ``last`` (inclusive) the same colour: ``r, g, b``, an ``(r, g, b)`` tuple or a ``Color``."""
    def clear(self) -> None:
        """Every LED off."""
    def get(self, led: int, /) -> Tuple[int, int, int]:
        """The stored ``(r, g, b)`` of LED ``led`` (before ``brightness()`` scaling)."""
    @overload
    def brightness(self) -> int: ...
    @overload
    def brightness(self, value: int, /) -> None:
        """Global scale 0..255 (the stored colours keep their full values)."""
    @overload
    def count(self) -> int: ...
    @overload
    def count(self, n: int, /) -> None:
        """1..64. Growing the count turns the newly exposed LEDs off until they are set; LEDs beyond a
        smaller count are no longer sent, so they keep showing their last colour (turn them off first).
        ``close()`` blacks out only ``count()`` LEDs."""
    @overload
    def invert(self) -> bool: ...
    @overload
    def invert(self, enable: bool, /) -> None:
        """``True`` numbers the LEDs from the far end (a module mounted the other way round)."""
    def show(self) -> None:
        """Start the transfer now instead of at the next poll. It waits only for a frame still going out
        (at most 20 ms, else ``OSError(ETIMEDOUT)``) and returns once the transfer has started; the strip
        has the frame 30 us per LED + 340 us later."""
    def hsv(self, h: int, s: int, v: int, /) -> Tuple[int, int, int]:
        """h (wrapped into 0..359), s and v 0..100 -> ``(r, g, b)``."""
    def on(self, color: Union[Color, Tuple[int, int, int], Sequence[Union[Color, Tuple[int, int, int], None]], None], /) -> None:
        """Every LED the colour (Pybricks ``hub.light.on``), or a list with one colour per LED
        (``ColorLightMatrix``); ``None`` turns the strip off."""
    def off(self) -> None:
        """Every LED off (ends a pattern)."""
    def blink(self, color: Union[Color, Tuple[int, int, int]], durations: Sequence[int], /) -> None:
        """On / off for ``[on1, off1, on2, off2, ...]`` ms, forever, in the background. 2..16 entries,
        an even number of them, each at least 2 ms (the pattern is stepped by the 1 kHz poll)."""
    def animate(self, colors: Sequence[Union[Color, Tuple[int, int, int], None]], interval: int, /) -> None:
        """The colours one after another for ``interval`` ms each (at least 2 ms), forever, in the
        background. 1..16 colours."""
    def pattern(self) -> Optional[str]:
        """``'blink'``, ``'animate'`` or ``None``."""
    def stop(self) -> None:
        """End the pattern, keeping the current colours."""
    def close(self) -> None:
        """Push a black frame and hand the servo channel back (the strip is dark about a millisecond later). Idempotent; every other call then raises ``ValueError("RGBLED is closed")``, even after a new ``RGBLED(n)`` has opened the same port, and a second ``close()`` never touches the new object's strip."""


class Bluetooth:
    """EVN Bluetooth module (HC-05, an EVN Standard Peripheral) on Serial 1 or 2.

    Hold the module's button while powering the board to program it: the constructor then applies
    ``baud``, ``name`` and ``mode`` (``'remote'`` or ``'host'`` bound to ``addr``), reboots the
    module and switches to ``baud``. Otherwise it just opens the port at ``baud``; ``configured()``
    tells which happened. Default 230400 = the highest baud the module sustains (bench 2026-09-17).
    Third case - the module already carries the REPL (``repl(True)``, typically from ``boot.py``): a plain
    ``Bluetooth(n)`` adopts it as it stands, at the port's own baud (``print(bt)`` shows it), sends the module
    nothing and ``configured()`` is False; any configuration argument (``baud`` other than that baud, ``name``,
    ``mode``, ``addr``, ``stay_in_command``) raises ``ValueError("the module carries the REPL; call repl(False)
    before changing its configuration")`` - the carrier cannot be re-programmed under the REPL.

    One LIVE object per serial header: ``Bluetooth(n)`` raises ``OSError("serial port %d is used by a
    UART object")`` while an ``evn.UART`` object holds the port, ``OSError("serial port %d is already
    open")`` while another live ``Bluetooth(n)`` does, and ``UART(n)`` raises the mirror error while this
    object does. A module the REPL is on whose object was dropped without ``close()`` (``boot.py``'s
    ``evn.Bluetooth(2).repl(True)``) is ADOPTED by the next ``Bluetooth(n)`` - the REPL keeps running,
    the new object is the handle - so ``bt = Bluetooth(2); bt.repl(False)`` always has something to act
    on. Dropping an object that does not carry the REPL closes its port (as a dropped ``Motor`` does). A port that is already open keeps its transmit queue; only the
    divisor changes, once the transmitter is idle.

    Raises: ``ValueError("serial port must be 1 or 2")``, ``ValueError("baud must be
    4800..1382400")``, ``ValueError("name must be 1..32 characters")``, ``ValueError("mode must be
    'remote' or 'host'")``, ``ValueError("addr must be 'NAP,UAP,LAP' (up to 20 characters)")``;
    ``OSError(EIO)`` when the port cannot be opened or the module leaves data mode mid-write;
    ``OSError(ETIMEDOUT)`` when ``wait=True`` and the module is not ready within 3 s;
    ``ValueError("Bluetooth is closed")`` from every call after ``close()``;
    ``OSError("module is not in command mode")`` from the command-mode calls in data mode.
    """
    def __init__(self, port: int, baud: Optional[int] = None, name: Optional[str] = None, mode: Optional[str] = None,
                 addr: Optional[str] = None, *, stay_in_command: bool = False, wait: bool = True) -> None:
        """``name=None`` keeps "EVN Bluetooth", ``mode=None`` keeps ``'remote'``; ``baud`` left out means 230400, or
        the port's own baud when the module already carries the REPL."""
    def write(self, data: bytes, /) -> int:
        """Queues every byte (never lossy): returns ``len(data)``; waits only while the port's 1 KiB transmit
        queue is full. Keep the module at 230400 or below so a large single write is not lost inside the
        module. ``OSError(EIO)`` if the module leaves data mode meanwhile."""
    def read(self, n: int = -1, timeout: Optional[int] = 0) -> bytes:
        """Up to ``n`` bytes (all buffered when -1). ``timeout=0`` returns at once, ``None`` waits for ``n``
        bytes, a value in ms waits at most that long and returns what arrived. A negative timeout raises
        ``ValueError("timeout must be >= 0 ms or None")``."""
    def readline(self, timeout: int = 5000) -> Optional[bytes]:
        """The next line, without its trailing ``b"\\n"`` and without a ``b"\\r"`` in front of it, or
        ``None`` on timeout (or if the module leaves data mode). Only the line leaves the receive
        buffer, so whatever arrived behind it is still there for ``read()``. ``timeout=0`` returns a
        line only if one is already complete and never waits; a negative timeout raises
        ``ValueError("timeout must be >= 0 ms")``. A line longer than 255 bytes never completes: this
        times out and ``overflow()`` counts what was dropped."""
    def read_all(self) -> bytes:
        """Everything buffered, at once."""
    def any(self) -> int:
        """Bytes buffered."""
    def waiting(self) -> int:
        """Bytes buffered (the Pybricks ``UARTDevice`` name of ``any()``)."""
    def overflow(self) -> int:
        """Bytes the port's 256-byte receive ring had to drop since the last call because the program
        read too slowly. Read and clear: zero means nothing was lost."""
    def clear(self) -> None:
        """Drop buffered input."""
    def wait_until(self, pattern: bytes, timeout: Optional[int] = None) -> bool:
        """Wait for the byte sequence (1..32 bytes), discarding everything up to and including it;
        ``False`` on timeout, ``OSError(EIO)`` if the module leaves data mode."""
    def set_baudrate(self, baud: int, /) -> None:
        """The board port's speed in data mode, 1200..1382400 (the module's own baud is set by the
        constructor). Queued bytes leave at the old speed first; data mode only."""
    def state(self) -> str:
        """``'probing'``, ``'configuring'``, ``'resetting'``, ``'command'``, ``'data'`` or ``'closed'``."""
    def ready(self) -> bool:
        """The port is open and the module is in data mode, or in command mode with no command in
        flight. The module has no STATE line on the header, so this does **not** mean a peer is
        connected."""
    @overload
    def repl(self) -> bool: ...
    @overload
    def repl(self, enable: bool, /) -> None:
        """``repl(True)``: the board's REPL (prompt, print(), tracebacks, Ctrl-C) on this module as well as USB, so a
        PC paired with the module reaches the board through its "Standard Serial over Bluetooth" COM port (mpremote,
        the VS Code extension). ``repl()`` tells whether it is on. Bytes the REPL consumes never reach ``read()``.
        Data mode only (``ValueError("repl needs data mode")`` otherwise).
        Survives a soft reboot; put it in boot.py to have it after a hard reset."""
    def config_errors(self) -> Tuple[str, ...]:
        """The configuration commands the module did not answer OK (``"AT+ROLE"``, ...) followed by its last
        reply (``"ERROR:(n)"``, ``"FAIL"`` or ``""`` for a timeout); empty when everything was accepted."""
    def configured(self) -> bool:
        """True when the module was in command mode and every setting was accepted."""
    def in_command_mode(self) -> bool:
        """True while the module is in AT command mode (it was powered with its button held)."""
    def command(self, cmd: str, /) -> Tuple[bool, str]:
        """Run one AT command (command mode only): ``(ok, payload)``."""
    def address(self) -> Optional[str]:
        """``AT+ADDR?`` (command mode only); ``None`` when the module did not answer."""
    def version(self) -> Optional[str]:
        """``AT+VERSION?`` (command mode only)."""
    def exit_command_mode(self) -> bool:
        """``AT+RESET``, after which the port runs at the data baud."""
    def factory_reset(self) -> bool:
        """``AT+ORGL`` (name "HC-05", 9600 baud, slave)."""
    def startup_time(self) -> int:
        """ms the module took to reach data mode."""
    def close(self) -> None:
        """Release the serial port (the REPL is taken off it if it was on); the port keeps running for an ``evn.UART`` object. Every other call then raises ``ValueError("Bluetooth is closed")``, even after a new ``Bluetooth(n)`` has opened the same port, and a second ``close()`` is a no-op that never touches the new object's module."""


class UART:
    """Raw serial port: 1 = Serial1 (uart0, GP0/GP1), 2 = Serial2 (uart1, GP8/GP9).

    One object per header: ``UART(n)`` raises ``OSError("serial port %d is used by a Bluetooth
    object")`` while an ``evn.Bluetooth`` object holds the port, and ``OSError("serial port %d is
    already open")`` while another ``UART`` object holds it (``close()`` hands it back).
    Re-opening a port that is already open never resets it and never drops queued bytes: only the
    divisor changes, and only once the transmitter is idle.

    Receive is an interrupt-drained 256-byte ring; transmit a 1 KiB ring drained under interrupt.

    Raises: ``ValueError("uart must be 1 (Serial1) or 2 (Serial2)")``, ``ValueError("baudrate out of
    range")`` outside 300..3000000; ``OSError(EIO)`` when the port cannot be opened within a second;
    ``ValueError("UART is closed")`` from every call after ``close()``.
    """
    def __init__(self, id: int, baudrate: int = 115200, /) -> None: ...
    def write(self, buf: bytes, /) -> int:
        """Queues every byte (never lossy): returns ``len(buf)``; waits only while the transmit ring is full."""
    def read(self, nbytes: Optional[int] = None, /) -> Optional[bytes]:
        """Up to ``nbytes`` buffered bytes (``None`` = everything buffered), or ``None`` when nothing is
        waiting. A negative count raises ``ValueError``."""
    def readline(self, timeout: int = 5000) -> Optional[bytes]:
        """The next line, without its trailing ``b"\\n"`` and without a ``b"\\r"`` in front of it, or
        ``None`` on timeout. Only the line leaves the receive ring; bytes that arrived behind it stay
        buffered for the next ``read()``. ``timeout=0`` returns a line only if one is already complete
        and never waits; a negative timeout raises ``ValueError("timeout must be >= 0 ms")``. A line
        longer than 255 bytes never completes: this times out and ``overflow()`` counts the drop."""
    def any(self) -> int:
        """Bytes buffered."""
    def overflow(self) -> int:
        """Bytes the 256-byte receive ring had to drop since the last call. Read and clear."""
    def flush_rx(self) -> None:
        """Drop buffered input."""
    @overload
    def repl(self) -> bool: ...
    @overload
    def repl(self, enable: bool, /) -> None:
        """The MicroPython REPL on this serial port as well as USB (a USB-serial adapter on the header);
        ``evn.Bluetooth.repl()`` is the same switch for the module. Survives a soft reboot."""
    def close(self) -> None:
        """Release the port so a ``Bluetooth`` object (or another ``UART`` object at a different baud)
        can take it; the port itself keeps running and keeps its queued bytes, and the REPL is taken
        off it. Idempotent; every other method then raises ``ValueError("UART is closed")``."""


class Flash:
    """LittleFS block device backing the filesystem mounted at ``/``.

    Every write to it - ``open(...).write()``, ``flush()``, ``close()``, ``os.remove()``, ``mkfs`` - is
    **refused while any motor is driving** (``run()``/``dc()``, an unfinished ``run_angle``/``run_target``/
    ``run_time`` or DriveBase maneuver, a moving ``track_target``) with ``OSError(EBUSY)`` (errno 16): a
    flash write would stall the 1 kHz motion engine for 45..400 ms, so the firmware refuses instead of
    pausing. A holding, braked or coasting motor does not block a write; reads and ``import`` are never
    refused. Write logs after the move (``stop()``/``hold()``/``wait=True``, then write) or catch the error
    and write later."""
    def __init__(self) -> None: ...


# ---- EVN Extended Peripherals (docs/EXTENDED_PERIPHERALS.md) ------------------------------------
# Devices the firmware drives natively that EVN does not stock (treated like EVN Standard Peripherals): each is
# identified by an ID string, an ID register or a handshake (never by its address), read from a cache the firmware
# refreshes in the background, and re-found after an unplug.


class HiTechnicColorSensor:
    """HiTechnic NXT Color Sensor V1 or V2 (an EVN Extended Peripheral) on I2C port 1..16.

    Address 0x01 (the NXT's 0x02), run at **100 kHz** on its port (the other ports stay at
    400 kHz). Identified by its "HiTechnc" manufacturer string; V1 and V2 are told apart by the
    type string ("Color" / "ColorPD"): ``version()`` returns 1 or 2. Readings come from a cache
    refreshed every 10 ms. Bench-validated 2026-09-26 on a V2 (firmware V1.5); V1 support is from
    the register map alone.

    The V2 has three modes and switches on demand: ``color_number()``, ``rgb()``, ``hsv()``,
    ``reflection()``, ``color()``, ``color_match()``, ``calibrate_black()`` and ``calibrate_white()``
    read the active mode (LED on, ambient
    cancelled), ``ambient()`` the passive mode (LED off), ``raw()`` the raw mode. A call that needs
    another mode than the last one waits about **125 ms** for the first reading under it, so group
    calls by mode (``rgb()`` and ``ambient()`` alternately in a loop run at ~4 Hz).

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no HiTechnic sensor on port %d (I2C
    0x01)")``; ``OSError("port %d has a HiTechnic Compass, not a HiTechnicColorSensor")``;
    ``OSError("no free HiTechnic slot (4 at once)")``; ``OSError("HiTechnicColorSensor on port %d
    not responding")`` while unplugged; ``NotImplementedError`` from ``ambient()``, ``raw()`` and
    ``mains()`` on a V1; ``ValueError("HiTechnicColorSensor is closed")`` after ``close()``.
    """
    def __init__(self, port: int, /) -> None: ...
    def version(self) -> int:
        """1 (V1, type "Color") or 2 (V2, type "ColorPD")."""
    def firmware(self) -> str:
        """The sensor's firmware text, e.g. ``'V1.5'``."""
    def calibrate_black(self) -> None:
        """Take the current active-mode ``(R, G, B)`` as the black reference: nothing in front of the
        sensor (or a black target) where the colours will be read. A V2 is switched to active mode
        first. Kept in RAM by this object (not stored on the board); V1 and V2. Call it, then
        ``calibrate_white()``, at the start of a program."""
    def calibrate_white(self) -> None:
        """Take the current active-mode ``(R, G, B)`` of a white target as the reference white. From
        then on each channel is (reading - black) / (white - black), clamped 0..100 %, before ``hsv()``,
        ``color()`` and ``color_match()``. A V2 is switched to active mode first. ``ValueError("the white
        target is not brighter than the black reference: hold a white sheet in front")`` when a channel is
        not at least 10 % above the black."""
    @overload
    def black_reference(self) -> Optional[Tuple[float, float, float]]: ...
    @overload
    def black_reference(self, value: None, /) -> None:
        """The black reference as ``(R, G, B)`` in counts, or ``None`` when none is taken;
        ``black_reference(None)`` clears it. Any other argument raises ``ValueError`` (use
        ``calibrate_black()``)."""
    @overload
    def white_reference(self) -> Optional[Tuple[float, float, float]]: ...
    @overload
    def white_reference(self, value: None, /) -> None:
        """The reference white as ``(R, G, B)`` in counts, or ``None`` when none is taken;
        ``white_reference(None)`` clears it. Any other argument raises ``ValueError`` (use
        ``calibrate_white()``)."""
    def color(self) -> Optional[Color]:
        """The ``detectable_colors()`` entry nearest the reading's HSV (Pybricks' matcher; calibrated
        after ``calibrate_black()`` / ``calibrate_white()``), or ``None`` when that set is empty."""
    def color_match(self) -> Tuple[Optional[Color], float]:
        """``(color(), confidence)`` from one reading: the confidence is ``1 - d_best / d_second``
        (1.0 on the chosen colour, 0.0 halfway between two). ``(None, 0.0)`` with no detectable colours."""
    @overload
    def detectable_colors(self) -> Sequence[Color]: ...
    @overload
    def detectable_colors(self, colors: Sequence[Color], /) -> None:
        """The colours ``color()`` chooses from. Default ``(Color.RED, Color.YELLOW, Color.GREEN,
        Color.BLUE, Color.WHITE, Color.NONE)``; anything that is not a ``Color`` raises ``TypeError``."""
    def color_number(self) -> int:
        """The sensor's own colour number 0..17 (HiTechnic chart: 0 black ... 17 white)."""
    def rgb(self) -> Tuple[int, int, int]:
        """``(r, g, b)`` 0..255, LED on, ambient light cancelled (V2)."""
    def hsv(self) -> Color:
        """The active reading as a ``Color`` (``.h`` 0..359, ``.s`` 0..100, ``.v`` 0..100), through the
        black / white references when they are taken (``rgb()`` stays the sensor's own 0..255)."""
    def reflection(self) -> float:
        """Reflected light 0..100 %: V2 the white channel / 255, V1 the mean of R, G, B / 255."""
    def ambient(self) -> int:
        """V2 only: the white channel with the LED off (passive mode), 16-bit counts."""
    def raw(self) -> Tuple[int, int, int, int]:
        """V2 only: ``(r, g, b, white)`` 16-bit counts, LED on, no ambient cancellation."""
    def mains(self, hz: int, /) -> None:
        """V2 only: 50 or 60, the mains frequency whose flicker the sensor cancels. Stored by the
        sensor itself and **not readable back**; anything else raises ``ValueError``."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Leave the V2 in passive mode (LED off), set the port back to 400 kHz and release it."""


class HiTechnicCompass:
    """HiTechnic NXT Compass Sensor (NMC1034, an EVN Extended Peripheral) on I2C port 1..16.

    Address 0x01 (the NXT's 0x02), run at **100 kHz** on its port; identified by the "HiTechnc"
    manufacturer string and the "Compass" type string. The heading is read every 10 ms into a
    cache. A heading only, in whole degrees (the sensor's resolution): no field vector and no
    ``heading_confidence()`` (the standard ``Compass`` has both). Keep it away from the motors.
    Bench-validated 2026-09-26 (firmware V1.23).

    Calibration is the sensor's own: ``calibrate()``, then turn the robot level through a little
    more than one full turn taking at least 20 s, then ``calibrate_stop()``. The sensor stores the
    result itself; nothing is stored on the board.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no HiTechnic sensor on port %d (I2C
    0x01)")``; ``OSError("port %d has a HiTechnic Color V2, not a HiTechnicCompass")``;
    ``OSError("HiTechnicCompass on port %d not responding")`` while unplugged;
    ``ValueError("HiTechnicCompass is closed")`` after ``close()``.
    """
    def __init__(self, port: int, /) -> None: ...
    def heading(self) -> float:
        """0..359 degrees clockwise, relative to the direction set by ``north()``."""
    def north(self, heading: float = 0, /) -> None:
        """From now the direction the sensor points at reads ``heading`` (kept while the object is open)."""
    def calibrate(self) -> None:
        """Start the sensor's hard-iron calibration: turn the robot level through a little more than one
        full turn, taking at least 20 s, then call ``calibrate_stop()``."""
    def calibrate_stop(self) -> bool:
        """End the calibration: ``True`` when the sensor accepted it, ``False`` when it rejected it.
        ``ValueError("not calibrating: call calibrate() first")`` outside a calibration."""
    def calibrating(self) -> bool:
        """``True`` between ``calibrate()`` and ``calibrate_stop()``."""
    def firmware(self) -> str:
        """The sensor's firmware text, e.g. ``'V1.23'``."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Set the port back to 400 kHz and release it (a compass closed mid-calibration is put back in
        measure mode)."""


class HuskyLens:
    """DFRobot HuskyLens AI camera (an EVN Extended Peripheral) on I2C port 1..16.

    Set the camera's **Protocol Type to I2C** in its General Settings. Address 0x32 at 400 kHz;
    identified by a KNOCK the camera answers with a checksummed OK. The firmware asks for a new
    result every 10 ms and publishes each frame whole, so ``blocks()``, ``arrows()``, ``count()``,
    ``learned()`` and ``frame()`` are memory copies. The screen is 320 x 240; at most 16 objects are
    kept per frame. One HuskyLens at a time. Bench-validated 2026-09-26 on the standard model.

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no HuskyLens on port %d (I2C 0x32)")``;
    ``OSError("a HuskyLens is already open on another port (1 at once)")``; ``OSError("HuskyLens on
    port %d not responding")`` while unplugged; ``OSError("HuskyLens is busy: try again")`` /
    ``OSError("this needs a HuskyLens Pro")`` from a command the camera refused;
    ``ValueError("HuskyLens is closed")`` after ``close()``.
    """
    FACE_RECOGNITION: int = 0
    OBJECT_TRACKING: int = 1
    OBJECT_RECOGNITION: int = 2
    LINE_TRACKING: int = 3
    COLOR_RECOGNITION: int = 4
    TAG_RECOGNITION: int = 5
    OBJECT_CLASSIFICATION: int = 6
    def __init__(self, port: int, /) -> None: ...
    @overload
    def algorithm(self) -> Optional[int]: ...
    @overload
    def algorithm(self, n: int, /) -> None:
        """Switch the camera to algorithm ``n`` (0..6, the class constants) and wait for its OK. The getter
        returns the algorithm last set through this driver, or ``None`` until one is: **the camera cannot
        report it**."""
    def blocks(self, id: Optional[int] = None, /) -> List[Tuple[int, int, int, int, int]]:
        """The blocks of the latest frame, all or only ``id``: ``[(x, y, width, height, id), ...]`` with
        ``x``, ``y`` the block's centre on the 320 x 240 screen; id 0 = seen but not learned."""
    def arrows(self, id: Optional[int] = None, /) -> List[Tuple[int, int, int, int, int]]:
        """The arrows of the latest frame (line tracking), all or only ``id``:
        ``[(x_origin, y_origin, x_target, y_target, id), ...]``."""
    def count(self) -> int:
        """How many objects the camera saw in the latest frame (``blocks()`` / ``arrows()`` hold at most 16)."""
    def learned(self) -> int:
        """How many IDs the current algorithm has learned."""
    def frame(self) -> int:
        """The camera's frame number of the latest result (wraps at 65536)."""
    def learn(self, id: int = 1, /) -> None:
        """Learn what the camera frames now as ``id`` (1..65535)."""
    def forget(self) -> None:
        """Forget everything learned in the current algorithm."""
    def age(self) -> int:
        """Milliseconds since the latest result was received."""
    def close(self) -> None:
        """Release the port (nothing is written to the camera: its algorithm and learned objects stay)."""


class VL53L1X:
    """ST VL53L1X time-of-flight distance sensor, up to 4 m (an EVN Extended Peripheral) on I2C port 1..16.

    Address 0x29 at 400 kHz, shared with the VL53L0X and the TCS34725: identified by its model ID 0xEACC
    at the 16-bit index 0x010F, read only after the one-byte ID registers of those two chips ruled them
    out (a 16-bit index would write a register on them). The sensor ranges continuously and the firmware
    keeps the latest result in a cache, so every getter is a memory copy. Defaults: **long** mode and a
    **33 ms** timing budget (about 31 readings a second). Two at once. Bench-validated 2026-09-26 (rig
    port 1).

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no VL53L1X on port %d (I2C 0x29, model ID
    0xEACC)")``; ``OSError("VL53L1X on port %d: no free slot (2 at once)")``; ``OSError("VL53L1X on port
    %d not responding")`` while unplugged; ``ValueError("VL53L1X is closed")`` after ``close()``.
    """
    def __init__(self, port: int, /) -> None: ...
    def distance(self) -> Optional[int]:
        """The distance in mm, or ``None`` when the measurement is not valid (``status()`` says why)."""
    def status(self) -> str:
        """ST's range status of the latest measurement: ``'valid'``, ``'sigma fail'``, ``'signal fail'``,
        ``'min range fail'``, ``'out of bounds'``, ``'hardware fail'``, ``'valid, no wrap check'``,
        ``'wrap around'``, ``'crosstalk fail'``, ``'synchronisation'``, ``'merged pulse'``, ``'too close'``
        or ``'unknown'``. Only ``'valid'`` gives a ``distance()``."""
    def raw(self) -> Tuple[int, int, int, int]:
        """``(distance mm, status number, signal kcps, ambient kcps)`` of the latest measurement, whatever
        the status (status 0 = valid)."""
    @overload
    def distance_mode(self) -> str: ...
    @overload
    def distance_mode(self, mode: str, /) -> None:
        """``'short'`` (up to ~1.3 m, copes better with sunlight) or ``'long'`` (up to ~4 m in the dark,
        the default); waits for the first reading under the new mode. Switching to ``'long'`` with a
        15 ms budget raises ``ValueError`` (15 ms is short mode only: set ``timing_budget(20)`` first);
        anything else than the two names raises ``ValueError``."""
    @overload
    def timing_budget(self) -> int: ...
    @overload
    def timing_budget(self, ms: int, /) -> None:
        """The time per measurement in ms: 15 (short mode only), 20, 33 (the default), 50, 100, 200 or
        500. Longer = more precise and longer range, fewer readings. Waits for the first reading under the
        new budget; a value that does not exist in the current mode raises ``ValueError``."""
    def age(self) -> int:
        """Milliseconds since the cached measurement was taken."""
    def close(self) -> None:
        """Stop ranging and release the port."""


class TCS3430:
    """ams-OSRAM TCS3430 XYZ tristimulus colour / ambient light sensor with an IR channel (an EVN
    Extended Peripheral) on I2C port 1..16.

    Address 0x39 at 400 kHz, shared with the APDS-9960: identified by its ID register (0x92 bits 7:2 =
    110111, 0xDC). Readings come from a cache the firmware refreshes each integration cycle. Defaults:
    **one cycle, 2.78 ms at 64x** - the fastest cadence, a new reading about every 3 ms, for the EVN
    module that lights its target with its own LED and is used close to it. On a bright close target
    ``saturated()`` reports a clip (lower ``gain()``); for far-field or ambient light use
    ``integration_time(100)`` or more (the full 16-bit scale needs 178 ms). Counts are raw: no lux or
    colour-temperature conversion, and ``xy()`` is uncalibrated. Two at once. Bench-validated
    2026-09-26 (rig port 16).

    Raises: ``ValueError("port must be 1..16")``; ``OSError("no TCS3430 on port %d (I2C 0x39, ID
    0xDC)")``; ``OSError("TCS3430 on port %d: no free slot (2 at once)")``; ``OSError("TCS3430 on port %d
    not responding")`` while unplugged; ``ValueError("TCS3430 is closed")`` after ``close()``.
    """
    def __init__(self, port: int, /) -> None: ...
    def calibrate_black(self) -> None:
        """Take the current reading as the black reference: nothing in front of the sensor (or a black
        target) where the colours will be read. It is subtracted per channel from every reading and from
        the white. Kept in RAM by this object (not stored on the board), valid across ``gain()`` and
        ``integration_time()`` changes. Call it, then ``calibrate_white()``, at the start of a program:
        uncalibrated, nothing in front reads ``Color.BLUE``. ``ValueError`` when the reading is saturated
        (lower ``gain()``)."""
    def calibrate_white(self) -> None:
        """Take the current reading of a white target, under the module's own LED, as the reference
        white: each channel is divided by the white's and scaled to D65, so the white target reads
        ``s`` 0, ``v`` 100. Uncalibrated, the warm LED makes a white sheet read ``Color.YELLOW``. Kept in
        RAM by this object, valid across ``gain()`` / ``integration_time()`` changes. ``ValueError`` when
        the reading is saturated (lower ``gain()``) or a channel is not at least 10 % above the black (not brighter than the black reference)."""
    @overload
    def black_reference(self) -> Optional[Tuple[float, float, float]]: ...
    @overload
    def black_reference(self, value: None, /) -> None:
        """The black reference as ``(X, Y, Z)`` per 1x-gain cycle, or ``None`` when none is taken;
        ``black_reference(None)`` clears it. Any other argument raises ``ValueError`` (use
        ``calibrate_black()``)."""
    @overload
    def white_reference(self) -> Optional[Tuple[float, float, float]]: ...
    @overload
    def white_reference(self, value: None, /) -> None:
        """The reference white as ``(X, Y, Z)`` per 1x-gain cycle, or ``None`` when none is taken;
        ``white_reference(None)`` clears it. Any other argument raises ``ValueError`` (use
        ``calibrate_white()``)."""
    def color(self) -> Optional[Color]:
        """The ``detectable_colors()`` entry the reading's ``hsv()`` matches - the same matcher as
        ``ColorSensor`` (Pybricks' rule) - or ``None`` when that set is empty. Call ``calibrate_black()``
        and ``calibrate_white()`` first."""
    def color_match(self) -> Tuple[Optional[Color], float]:
        """``(color(), confidence)`` from one reading: the confidence is 1.0 on the chosen colour and
        0.0 halfway between two (the shared ``ColorSensor`` definition). ``(None, 0.0)`` with no
        detectable colours."""
    @overload
    def detectable_colors(self) -> Sequence[Color]: ...
    @overload
    def detectable_colors(self, colors: Sequence[Color], /) -> None:
        """The colours ``color()`` chooses from. Default ``(Color.RED, Color.YELLOW, Color.GREEN,
        Color.BLUE, Color.WHITE, Color.NONE)``; anything that is not a ``Color`` raises ``TypeError``.
        A ``Color`` read from ``hsv()`` over a real target can be taught the same way."""
    def hsv(self) -> Color:
        """The reading as a ``Color`` (``.h`` 0..359, ``.s`` 0..100, ``.v`` 0..100): X, Y, Z net of the
        black reference, relative to the reference white (without one, to the full scale against D65),
        mapped to RGB with the sRGB standard's matrix and clamped to 0..100 %."""
    def xyz(self) -> Tuple[int, int, int]:
        """``(X, Y, Z)`` raw counts."""
    def raw(self) -> Tuple[int, int, int, int]:
        """``(X, Y, Z, IR1)`` raw counts."""
    def ir(self) -> int:
        """The IR1 channel, raw counts."""
    def xy(self) -> Optional[Tuple[float, float]]:
        """``(x, y)`` = X / (X + Y + Z), Y / (X + Y + Z) of the raw counts - **uncalibrated** chromaticity
        (no per-unit matrix) - or ``None`` in the dark."""
    def saturated(self) -> bool:
        """``True`` when the latest reading clipped (analog saturation or a channel at the digital full
        scale): lower ``gain()`` or shorten ``integration_time()``."""
    @overload
    def gain(self) -> int: ...
    @overload
    def gain(self, n: int, /) -> None:
        """The analog gain: 1, 4, 16, 64 (the default) or 128 (typical ratios 1 : 4 : 16 : 66 : 137);
        anything else raises ``ValueError``. Waits for the first reading at the new gain."""
    @overload
    def integration_time(self) -> float: ...
    @overload
    def integration_time(self, ms: float, /) -> float:
        """The integration time in ms, 2.78..711.7 in 2.78 ms steps (``ValueError`` outside): the nearest
        step is set and returned. Full scale is (steps x 1024 - 1) counts, 65535 from 178 ms up. Waits for
        the first reading under the new time."""
    def age(self) -> int:
        """Milliseconds since the cached reading was taken."""
    def close(self) -> None:
        """Power the chip down and release the port."""


def core1_status() -> Optional[Tuple[int, int, int, int, int, int]]:
    """``(ticks, period_min_us, period_max_us, exec_max_us, missed, late)`` of the 1 kHz motion engine,
    or ``None`` when it is not running. ``missed`` = deadlines the alarm ISR itself skipped (a flash
    lockout gap); ``late`` = loop-body overruns, ticks whose body ran past its 1 ms so that two deadlines
    were pending when it came back - the count ``exec_max_us`` alone cannot give. Both must stay 0."""

def stop_all() -> None:
    """Coast every motor."""

def configure_motor(port: int, model: Optional[str], *, counts_per_rev: Optional[float] = None,
                    rated_voltage: int = 0, no_load_speed: Optional[float] = None) -> None:
    """Say what is on motor port 1..4 and store it on the board, so a plain ``Motor(port)`` runs that motor
    from any host and after every reboot. ``model``: ``"EV3 Large"``, ``"EV3 Medium"``, ``"NXT"``,
    ``"JGA25-370 6V 77RPM"`` (``"jga25"``: a 6 V, 77 rpm, 1:78 gearmotor with an 11 cpr hall encoder, 3432
    counts per revolution, the port capped at 6 V, EV3 Large control class, limits 460 deg/s and 2400
    deg/s^2), ``"Pololu 25D 9.7:1 HP 12V"`` (``"pololu25d_9_7"``:
    Pololu #4842, a 12 V high-power 9.68:1 gearmotor with a 48 CPR encoder, 464.64 counts per revolution,
    1000 rpm no-load at 12 V - about 3500 deg/s on the pack -, EV3 Medium control class, limits 3000 deg/s
    and 20000 deg/s^2; its stall current is
    above the port's 3 A rating, so never hold it stalled) or ``"CHR-GM16-030PA 9V 1:63"`` (``"chr16_63"``:
    a 16 mm 9 V gearmotor, 1:63, with a 7 ppr hall encoder on the motor shaft, 1764 counts per revolution,
    215 rpm = 1290 deg/s no-load at 9 V, the port capped at 9 V (above the 2S pack: it never binds), EV3 Large
    control class, limits 900 deg/s and 5000 deg/s^2; another ratio of the family (1:10 to 1:360) is a
    custom motor with 7 x 4 x the ratio counts) for a library motor; ``"custom"`` for any other DC motor with a quadrature encoder, described by
    ``counts_per_rev`` (encoder edges per OUTPUT revolution = one channel's pulses x 4 x the gear ratio;
    a LEGO motor is 720), ``rated_voltage`` (mV, the port's voltage cap; 0 = none) and ``no_load_speed``
    (deg/s at the rated voltage, 0 = not known: it sets the speed limit, 100 % and the control's first
    guess until ``calibrate()`` measures the motor); ``None`` removes the stored configuration and puts
    the port back to the firmware's fallback (EV3 Large on 1-2, EV3 Medium on 3-4).
    A change to a different motor clears the port's calibration (the old motor's numbers must not run
    the new one): ``calibrate()`` afterwards - it also finds which way the motor's encoder counts, so a
    custom, JGA25, Pololu 25D or CHR-GM16 motor is only fully trusted once calibrated. Nothing moves. The port must be free (``OSError(EBUSY)``
    while a Motor holds it: ``close()`` it first) and every motor stopped (the flash write);
    ``RuntimeError`` says why a refused change did nothing, ``ValueError`` what was wrong with the
    numbers."""

def motor_config(port: int, /) -> dict:
    """What motor port 1..4 runs now: ``{"port", "model" ('EV3 Large' / 'EV3 Medium' / 'NXT' /
    'JGA25-370 6V 77RPM' / 'Pololu 25D 9.7:1 HP 12V' / 'CHR-GM16-030PA 9V 1:63' / 'custom'), "custom"
    (bool), "control_class" (the standard model the control starts from: a custom motor's, or a library
    motor's own - the JGA25 and the CHR-GM16 run the EV3 Large class, the Pololu 25D the EV3 Medium class),
    "counts_per_rev", "rated_voltage" (mV, the port's voltage cap: a custom motor's rated voltage, the
    JGA25's 6000, the CHR-GM16's 9000, the Pololu 25D's 12000 - above the pack, so it never binds -, 0 for
    a LEGO motor), "no_load_speed" (deg/s at that voltage, at 9 V when uncapped; 0 =
    a custom motor gave none),
    "stored" (True when it is in flash and the port runs it), "session" (True while a program's
    ``Motor(port, model=)`` runs a standard model in its place until the next reboot)}``."""

def compass_calibration(port: int, /) -> dict:
    """The stored compass calibration of I2C port 1..16 (``Compass.calibrate_stop()``), without opening
    a Compass: the same dict as ``Compass.stored_calibration()``."""

def imu_calibration(port: int, /) -> dict:
    """The stored IMU calibration of I2C port 1..16 (``IMU.calibrate()``), without building an IMU: the
    same dict as ``IMU.calibration()``."""

def calibration(port: int, /) -> dict:
    """The calibration motor port 1..4 runs: ``{"port", "calibrated" (a calibrate() result drives the port),
    "busy" (a calibrate(wait=False) is running on it), "stored" (it is in flash), "stamp" (seconds since 1970 UTC when it was made; 0 = the board's clock
    was not set then - the extension sets it, a bare program does not), "b0" (deg/s^2 per V),
    "tau_ms", "v_break_mv", "v_f_mv", "no_load_speed" (deg/s at 9 V, or at the motor's rated
    voltage), "vbus_mv" (the pack during it), "encoder_reversed" (True when the calibration found the
    encoder counting against the drive and flipped the port's decoder - a non-LEGO motor wired the other
    way round; stored with the record, back at boot, gone with the record), "cogging_edges" (the rotor's
    detent period the port runs on, in encoder edges, 0 = none: the library motor's figure, or the period
    calibrate() measured on a custom motor; non-zero widens the endpoint band and done() to half a detent pitch and,
    when the breakaway is above the running friction, turns on the cogging feed-forward and the detent hold),
    "cogging_measured" (the period calibrate()'s detent survey measured, 0 = the rotor did not rest in
    detents, None = a record older than the survey, or the survey was abandoned), "cogging_confidence" (how sure the survey was, 0..1,
    None after a reboot), "cogging_note" (None, or why the measurement and the motor library disagree - the
    library figure is kept - or why the survey was abandoned), "warning" (what is wrong with the record found in flash:
    made for another motor, refused; implausible for the model, applied anyway; else None),
    "error" (why the last calibrate() on this port failed or was refused, else None)}``."""

def clock(seconds: Optional[int] = None, /) -> int:
    """The board's wall clock as seconds since 1970-01-01 UTC; 0 until a host sets it (no battery-backed
    clock, no epoch time in the build). With an argument it is set first (a date in 2025..2105, else
    ``ValueError``). The extension's console sets it at every connect; ``calibration(port)["stamp"]``
    is this clock at the time of the calibration."""

def clear_calibration(port: int, /) -> None:
    """Forget motor port 1..4's calibration, record and running numbers: the port goes back to its motor's
    compiled defaults as if ``calibrate()`` had never run. Nothing moves. Port free (``OSError(EBUSY)``
    while a Motor holds it) and every motor stopped; ``RuntimeError`` says why a refusal changed nothing."""

def reset_cause() -> str:
    """``"watchdog"`` after a watchdog reboot, else ``"normal"``."""

def bootloader() -> None:
    """Coast the motors and reboot into BOOTSEL (the RPI-RP2 drive) for flashing."""

def _calibration(port: int, /) -> Optional[Tuple[bool, bool, int, int, int, int, int, int, int, int, Optional[str], Optional[str], int]]:
    """Debug, nothing moves: the ADRC calibration port 1..4 is running as
    (valid, stored, b0, tau_ms, v_break_mv, v_f_mv, k_vss, dt_mean_us, vbus_mv, vbus_pulse_mv,
    warning, error, fit_max_us). ``warning`` says what is wrong with the record found in flash (made for another
    motor model: refused; gains implausible for this port's model: applied anyway); ``error`` why the
    last calibrate() on this port failed or was refused. None entries when there is nothing to say."""

def _encoder_table(port: int, /) -> Tuple[Tuple[int, int, int, int], Tuple[int, int, int, int], int, Tuple[int, int, int, int], Tuple[int, int, int, int], Optional[str], int, int]:
    """Debug, nothing moves: ``(table_fwd, table_rev, rev_shift, widths_fwd, widths_rev, note, pin_state,
    step_mod_4)`` for motor port 1..4 — the substep phase tables the port runs, one per direction of turning
    (``(0, 64, 128, 192)`` is the balanced default) and the reverse table's gauge in substeps (0 unless the
    calibration found the hysteresis on the pinned channel), the phase widths the last ``Motor.calibrate()``
    measured in each direction (all zero when none this boot), ``None`` or which direction could not be
    timed / why the default was kept, and the boot-consistency values ``tools/bench/mpy_encoder_seed.py``
    checks."""
def reset(*, start: bool = False) -> None:
    """Coast the motors and reboot the board. After the reboot ``main.py`` waits for a press of the
    user button as after a power-on; ``start=True`` makes that one boot run it at once (what the
    extension's *Upload and run now* does)."""

def autostart(on: Optional[bool] = None, /) -> bool:
    """Whether ``main.py`` starts at boot without the user-button press (default ``False``: the board
    waits, LED blinking fast, and runs ``main.py`` again at the next press once it has ended). Not
    stored: put ``evn.autostart(True)`` in ``boot.py`` for a board that must run unattended."""

def _chip_reset() -> dict:
    """Debug: the RP2040's last chip-level reset as ``{"had_por", "had_run", "had_psm_restart"}``
    (power-on or brown-out, the RESET key, a debugger). A software reboot leaves them as they were."""


def wait(time: float) -> None:
    """Pause the program for ``time`` milliseconds (motors keep doing what they were told)."""


class StopWatch:
    """Millisecond stopwatch, running from construction."""
    def __init__(self) -> None: ...
    def time(self) -> int:
        """Elapsed ms."""
    def pause(self) -> None:
        """Stop counting; ``time()`` holds its value until ``resume()``."""
    def resume(self) -> None:
        """Continue counting after ``pause()`` (no effect while running)."""
    def reset(self) -> None:
        """Back to 0; a running stopwatch keeps running, a paused one stays paused."""


class Pose:
    """The robot's planar pose from any subset of the two drive encoders, an ``IMU`` and a ``Compass``
    (docs/POSE_ESTIMATION_DESIGN.md; encoders-only trajectories benched on the board 2026-09-18).

    ``Pose(1, 2, 56, 112, imu=3, compass=14)``: left/right motor ports 1..4 with the wheel diameter and axle
    track in mm (both or neither), ``imu=`` / ``compass=`` the I2C ports of existing ``IMU`` / ``Compass``
    objects (``OSError`` if no object is on that port; the compass counts once a calibration is installed).
    ``reverse_left`` / ``reverse_right``: that motor's positive direction is backwards (a mirrored mount).
    ``imu_offset=(x_mm, y_mm)``: where the IMU sits, forward and left of the axle mid-point (e.g. ``(-50, 60)``
    for 50 mm behind, 60 mm left); a tape-measure value is enough, and it removes the acceleration a turning
    body adds at a lever arm. Needs ``imu=`` and no motor ports (``ValueError`` with wheels: the accelerometer
    is not used then).

    One ``Pose`` per robot: a second constructor raises ``OSError`` while one is live. ``with Pose(...) as pose:``
    is the idiom - ``__exit__`` is ``close()``. A ``Pose`` dropped inside a function, or closed, is released at
    once; a bare temporary in the same statement scope (``Pose(...).heading()`` then ``Pose(...)``) can survive
    one collection and still block the next constructor - use a function, ``with``, or ``close()``.
    One object per robot (``OSError`` for a second one until ``close()``). Frames: x East / y North in mm
    (without a compass, x is +90 degrees from the heading at ``reset()``), heading clockwise from north in
    degrees, speed mm/s, yaw rate deg/s clockwise. A source whose driver is lost leaves the set by itself and
    rejoins when running; ``bounded()`` is False while the live set cannot bound the position (IMU alone).
    Every method raises ``ValueError("Pose is closed")`` after ``close()``."""
    def __init__(self, left: Optional[int] = None, right: Optional[int] = None, wheel_diameter: Optional[float] = None,
                 axle_track: Optional[float] = None, *, gear_ratio: float = 1.0, imu: Optional[int] = None,
                 compass: Optional[int] = None, reverse_left: bool = False, reverse_right: bool = False,
                 declination: float = 0.0, imu_offset: Optional[Tuple[float, float]] = None) -> None: ...
    def position(self) -> Tuple[float, float]:
        """(x, y) in mm, East / North."""
    def heading(self) -> float:
        """Degrees clockwise from north, 0..360."""
    def velocity(self) -> Tuple[float, float]:
        """(forward speed mm/s, yaw rate deg/s clockwise)."""
    def state(self) -> Tuple[float, float, float, float, float]:
        """(x, y, heading, speed, yaw rate)."""
    def covariance(self) -> Tuple[float, float, float]:
        """(sigma x mm, sigma y mm, sigma heading deg): the filter's own uncertainty."""
    def parameters(self) -> Tuple[float, float, float]:
        """(r_left, r_right, track) in mm as the filter estimates them (they only move with turns)."""
    @overload
    def settings(self) -> Tuple[float, float]: ...
    @overload
    def settings(self, *, wheel_diameter: Optional[float] = None, axle_track: Optional[float] = None) -> None:
        """``settings()`` -> (wheel_diameter mm, axle_track mm); ``settings(wheel_diameter=, axle_track=)`` applies a
        calibrated geometry (1..1000 / 1..2000 mm). The axle track that matters is the effective one, between the two
        contact patches as the robot really turns; measure it with one commanded 360 degree turn against a floor
        mark: ``t_eff = t * turned_by_the_encoders / 360``. That is the recipe for a Pose WITHOUT a base: with a
        ``DriveBase``, rebuild the base with ``axle_track=t_eff`` (it builds its Pose from it) - ``settings()`` on
        the base's Pose is refused at the next ``use_gyro(True)``, and with ``use_gyro`` on the next maneuver
        raises ``OSError`` and turns it off. The pose, the heading and the gyro bias are kept; only
        the wheel parameters and their covariance restart. NOT stored: a power cycle brings back the constructor's
        numbers, so a program that needs the calibrated track sets it at start-up. The setter raises ``ValueError``
        without motor ports."""
    def bounded(self) -> bool:
        """False while the live sources cannot bound the position (IMU alone, IMU + compass, none)."""
    def sources(self) -> Tuple[str, ...]:
        """The sources contributing right now: a subset of ('wheels', 'imu', 'compass'). 'compass' is absent
        while the compass's field is being rejected (``Compass.heading_confidence()`` 0: a motor's magnets, a
        steel table) - the heading then has NO absolute reference and drifts with the gyro/wheels until the
        field is the Earth's again; ``_stats()[8]`` counts the dropped samples."""
    def configured(self) -> Tuple[str, ...]:
        """The sources the object was built with."""
    def __enter__(self) -> "Pose": ...
    def __exit__(self, *args: object) -> None:
        """``close()``: ``with Pose(...) as pose:`` releases the estimator on exit, whatever happened inside."""
    def __del__(self) -> None:
        """A ``Pose`` dropped without ``close()`` (a function-local, a re-run cell) stops its service at the next
        garbage collection - and the next ``Pose(...)`` runs one collection before it decides, so a Pose dropped
        inside a function is released at once with no ``gc.collect()`` of your own. A bare temporary in the same
        statement scope (``Pose(...).heading()`` followed by ``Pose(...)``) can survive that one collection and
        still raise "already exists": use a function, ``with``, or ``close()`` (which stops the service
        immediately). A ``DriveBase`` holds the Pose it built, was given (``pose=``) or adopted
        (``use_gyro(True)``), so that Pose is never collected while the base uses it."""
    def reset(self, x: float = 0, y: float = 0, heading: float = 0) -> None:
        """Set the pose (mm, mm, degrees clockwise from north); biases and wheel parameters are kept. A reset is a
        re-framing, never a command: a ``DriveBase`` with ``use_gyro(True)`` re-anchors its ideal robot on the new
        pose and nothing moves - to close an offset an outside reference revealed, follow the reset with an
        explicit ``straight()``/``turn()``."""
    def close(self) -> None:
        """Stop the pose service and release it, so a new ``Pose`` can be made. Idempotent; every other call then raises ``ValueError("Pose is closed")``."""
    def _stats(self) -> Tuple[int, int, int, int, int, int, int, int, int]:
        """Bench diagnostic: (steps, rejected wheel updates, rejected lateral updates, rejected magnetometer updates,
        the yaw-rate row's reject run, wheel-gate escapes taken, steps with a stale IMU, steps that integrated a
        time gap - a Core 0 stall longer than 100 ms, whose exact encoder travel is integrated as one arc, compass
        samples dropped before the filter because their field was not the Earth's)."""
    def _bias(self) -> Tuple[float, float]:
        """Bench diagnostic: (the filter's gyro bias deg/s, its sigma deg/s) - in the filter's frame,
        counter-clockwise positive, unlike ``heading()``."""
    def _step(self, dt: float, gyro_z: float, accel_x: float, accel_y: float, wl: float, wr: float, mag: float, /) -> Tuple[float, ...]:
        """Bench hook: one filter step on SI values (nan = absent source); returns the SI state."""


class DataLog:
    """The data logger, recorded on the board by the firmware: motors, sensors, the battery, the user button
    and the program's own rows, each at the rate its source makes new readings, kept in RAM and written to a
    CSV file when the motors are still.

    ``DataLog(*headers, name='log', timestamp=True, extension='csv', append=False, size=32768, autosave=True,
    on_full='halve')``. The first five are Pybricks' (``pybricks.tools.DataLog``): ``headers`` are the columns
    of ``log()`` (at most 8 strings; none = no ``log()``), and the file is ``/data/<name>.<extension>``, with
    ``_<date>_<time>`` after the name when ``timestamp`` is True and the board's clock is set (the EVN console
    sets it when it connects); without the clock (or ``timestamp=False``) the name gets ``_1``, ``_2`` ... rather
    than overwrite a file, and ``save(path)`` does not create the folder. ``append=True`` adds the rows to an
    existing file without a new header (a header first when the file does not exist yet).
    EVN's own: ``size`` = bytes of RAM for the samples (1024..1000000; the default 32 kB holds about 4 s of
    one 1 kHz channel before its first halving); ``autosave`` = a DataLog not yet saved (still recording, or
    stopped) is stopped and saved by itself when ``main.py`` ends, the editor's Run finishes, the board
    soft-reboots or its ``with`` block ends, once the motors coast (a motor still driving is reported, not
    saved); a stopped one still owed its autosave is saved first when another DataLog ``start()``s;
    ``on_full`` = what a channel whose share of the RAM is full does: ``'halve'`` keeps every second sample
    and halves its rate (the recording never stops by itself: a long run comes back evenly thinned), or
    ``'drop'`` drops the newest samples and counts them.

    Differences from Pybricks: rows and samples wait in RAM and reach the file at ``save()`` or at autosave
    (a Pybricks hub writes each row at once; this board must not write flash while a motor drives: a
    sector erase stalls the 1 kHz motor loop). Values are recorded in their physical unit (deg, deg/s, mNm,
    mV ...), never ``SpeedUnit.PERCENT``, and a motor's angle, speed and load unrounded (the methods round
    to an int).

    Best effort at the lowest priority: the sampler reads what the drivers already hold (no extra bus
    traffic), runs after every other Core 0 service and records only NEW readings, each stamped with its
    source's own time. Measured on the board (2026-09-26): about 11-14 us per poll with one motor
    channel, about 100 us with seven channels at max including an IMU; Core 1 misses no tick while it
    records. The poll (and so a motor channel at max) runs at about 820 Hz with nothing on I2C and about
    460 Hz with an IMU attached; an IMU's acceleration at max about 180 samples a second beside five other
    channels through the console (about 60 Hz for the heading with a compass also on the bus in the program
    bench), never twice within 2 ms.

    A run of identical samples is two rows: a sample bit-identical to the channel's previous row adds no
    row, the run's first row stays and its end row's time stamp moves forward to the newest sample, so the
    file shows the value flat from the first stamp to the last (every sample in it was taken and compared;
    a change of one bit is recorded). ``log()`` rows are never folded.

    One recording at a time: ``start()`` of another DataLog raises ``RuntimeError`` while one records; the
    same object's second ``start()`` returns ``None``. Every other call after ``close()`` raises
    ``ValueError('DataLog is closed')``; ``running()`` answers False and ``close()`` is idempotent."""
    def __init__(self, *headers: str, name: str = 'log', timestamp: bool = True, extension: str = 'csv',
                 append: bool = False, size: int = 32768, autosave: bool = True, on_full: str = 'halve') -> None: ...
    def add(self, source: Union[Motor, Type[battery], Type[button], ColorSensor, DistanceSensor, GestureSensor,
                                EnvSensor, Compass, IMU, TouchArray, ADC],
            quantity: str, rate: float = 0, *, input: Optional[int] = None) -> int:
        """Add a channel and return its index (before ``start()``; ``RuntimeError`` while recording, at most 16).
        ``source``: a ``Motor``, ``evn.battery``, ``evn.button`` or a standard-peripheral object; ``quantity``:
        the method name (``'angle'``, ``'speed'``, ``'heading'``, ``'acceleration'`` ...; ``quantities(source)``
        lists them, ``ValueError`` for another); ``rate``: samples a second, 0 = every new reading. A rate
        above the source's own gives the source's: a motor or the button every new reading (up to 1000 a
        second, the motor engine's tick; about 460 with an IMU on the bus), an IMU 200, a compass 75, the battery 25, another sensor its own conversion rate. ``input=``
        (0..7, 4..7 the differential pairs as in ``ADC.voltage()``) picks an ``ADC`` input (default: the one ``voltage()`` reads). Units: a motor's angle deg,
        speed deg/s, load mNm, stalled 0/1; battery voltage / cells mV; the sensors the units of their methods
        (IMU acceleration mm/s^2, angular_velocity deg/s, compass field G, temperature degC, pressure Pa ...);
        a multi-part reading (``hsv``, ``acceleration``, ``cells`` ...) is one channel of several values."""
    @staticmethod
    def quantities(source: Union[Motor, Type[battery], Type[button], ColorSensor, DistanceSensor,
                                 GestureSensor, EnvSensor, Compass, IMU, TouchArray, ADC], /) -> Tuple[str, ...]:
        """The quantity names ``add()`` takes for this source, e.g. ``('angle', 'speed', 'load', 'stalled')``
        for a ``Motor`` (a staticmethod: ``DataLog.quantities(motor)``)."""
    def start(self) -> Optional[float]:
        """Start recording (a new recording: the samples of an earlier one are gone). Returns the seconds the
        fastest-filling channel records before its first halving (``None`` if it was already recording).
        The RAM (``size``) is taken from the heap at the first start (``MemoryError`` if the heap cannot give
        it). ``ValueError`` with no channel and no headers, or when ``size`` cannot give every channel room
        for 8 samples; ``RuntimeError`` while another DataLog records."""
    def stop(self) -> None:
        """Stop recording; the samples stay in RAM for ``save()``. With ``autosave`` a stopped log not yet
        saved is saved by itself when ``main.py`` ends, the editor's Run finishes, the board soft-reboots or
        a ``with`` block ends, once the motors coast."""
    def running(self) -> bool:
        """True while recording."""
    def log(self, *values: Union[float, bool, None]) -> None:
        """Pybricks: one row of the program's own numbers, one value per header (``ValueError`` for another
        count, ``TypeError`` for a value that is not a number, ``None`` or a bool; ``None`` is an empty cell).
        Stamped with the board's time; starts the log if it was never started; after ``stop()`` it raises
        ``RuntimeError`` (``start()`` again for a new recording). In the file the rows are under
        device ``log`` with the header names as quantities."""
    def info(self) -> dict:
        """What is recorded: ``running``, ``size`` (bytes), ``saved`` (since the last start) and ``channels``
        (one dict per channel: ``device``, ``port`` (None for the battery / button), ``quantity``, ``unit``,
        ``rate`` (samples a second now), ``halvings``, ``samples`` (the rows held), ``taken`` (the samples
        taken since the start), ``same`` (the samples folded into a run's end row: a run of identical samples
        is two rows) and ``dropped``); once started also ``seconds`` (recorded so far), ``polls``, ``cost_us`` (the longest
        poll's cost) and ``cost_mean_us``."""
    def save(self, path: Optional[str] = None, /) -> str:
        """Write the recording to a file and return its path: ``/data/<name>[_<date>_<time>].<extension>`` or
        ``path``. The file is the EVN extension's CSV (``# key: value`` header lines, then
        ``time_s,device,port,quantity,value,unit,note``, one line per value; a multi-part quantity as
        ``quantity.part``, e.g. ``acceleration.x``); it opens in the extension's data viewer. A coast the program
        just issued is given up to 5 ms to land, so ``motor.stop(); log.stop(); log.save()`` works; while a
        motor still drives it is refused with ``OSError(EBUSY)`` (errno 16) and nothing written: stop or
        coast the motors first (a flash write while a motor drives would stall its control loop). ``RuntimeError`` while
        recording (``stop()`` first), ``ValueError`` before anything was recorded. A save of a few kB
        takes Core 1 about 45 missed ticks per flash sector erased."""
    def close(self) -> None:
        """Stop and free the RAM, WITHOUT saving (``save()`` first to keep the samples). Idempotent."""
    def __enter__(self) -> "DataLog": ...
    def __exit__(self, *args: object) -> None:
        """``with DataLog(...) as log:``: on exit the log is stopped, saved if it saves by itself (``autosave``
        and not saved yet, the motors coasting), then closed."""
