"""evn - the EVN ALPHA module, as the simulator runs it (docs/SIMULATOR.md).

The same names, signatures, units and errors as the firmware's bindings (stubs/evn.pyi) for what the simulated robot
has: Motor, DriveBase, ColorSensor, DistanceSensor, IMU, Servo, TouchArray, ADC, PID, wait, StopWatch, stop_all, battery,
button, led, UART, and the constants. The motors and the sensors are the simulator's (src/sim/engine, through the _evnsim module); everything
else of the firmware's API is present by name and says plainly that the simulated robot does not have it.
"""
import _evnsim as _s
import math as _math
from array import array as _array

# every runtime function bound once, at import: a call is then one global lookup, not a global and an attribute lookup
# on _evnsim (ledger HT-56). _evnsim is built once per interpreter (vm.ts CONTROL_PY) and evn is imported anew at every
# soft reset (boot.py reset()), so a binding is always the running interpreter's runtime.
_s_button, _s_interrupted, _s_led, _s_now_ms, _s_now_us = _s.button, _s.interrupted, _s.led, _s.now_ms, _s.now_us
_s_pack_mv, _s_stop_all, _s_version, _s_wait = _s.pack_mv, _s.stop_all, _s.version, _s.wait
_s_m_cal, _s_m_claim, _s_m_dc, _s_m_done, _s_m_full = _s.m_cal, _s.m_claim, _s.m_dc, _s.m_done, _s.m_full
_s_m_gen, _s_m_lib, _s_m_limits, _s_m_model, _s_m_run = _s.m_gen, _s.m_lib, _s.m_limits, _s.m_model, _s.m_run
_s_m_run_angle, _s_m_run_target, _s_m_run_time = _s.m_run_angle, _s.m_run_target, _s.m_run_time
_s_m_stall_tol, _s_m_stalled, _s_m_state, _s_m_stop = _s.m_stall_tol, _s.m_stalled, _s.m_state, _s.m_stop
_s_m_tol, _s_m_track, _s_m_vcap, _s_m_volts, _s_m_wait = _s.m_tol, _s.m_track, _s.m_vcap, _s.m_volts, _s.m_wait
_s_db_close, _s_db_closed, _s_db_curve, _s_db_done = _s.db_close, _s.db_closed, _s.db_curve, _s.db_done
_s_db_drive, _s_db_new, _s_db_reset, _s_db_settings = _s.db_drive, _s.db_new, _s.db_reset, _s.db_settings
_s_db_stalled, _s_db_state, _s_db_stop, _s_db_straight = _s.db_stalled, _s.db_state, _s.db_stop, _s.db_straight
_s_db_turn, _s_db_wait, _s_db_wheels = _s.db_turn, _s.db_wait, _s.db_wheels
_s_cs_age, _s_cs_calibrate, _s_cs_expose, _s_cs_open = _s.cs_age, _s.cs_calibrate, _s.cs_expose, _s.cs_open
_s_cs_ranges, _s_cs_wait, _s_cs_bind = _s.cs_ranges, _s.cs_wait, _s.cs_bind
_s_cs_raw, _s_cs_norm, _s_cs_pct, _s_cs_rgb, _s_cs_hsv = _s.cs_raw, _s.cs_norm, _s.cs_pct, _s.cs_rgb, _s.cs_hsv
_s_ds_get, _s_ds_open, _s_ds_raw, _s_ds_set = _s.ds_get, _s.ds_open, _s.ds_raw, _s.ds_set
_s_imu_open, _s_imu_rate, _s_imu_state = _s.imu_open, _s.imu_rate, _s.imu_state

version = _s_version()

_ERR = "\x00"
_EXC = {"OSError": OSError, "ValueError": ValueError, "TypeError": TypeError, "RuntimeError": RuntimeError}


def _chk(r):
    """A result of the module, or the exception it stands for."""
    if type(r) is str and r and r[0] == _ERR:
        kind, _, msg = r[1:].partition(": ")
        raise _EXC.get(kind, RuntimeError)(msg)
    return r


def _num(v, what):
    if type(v) is bool or not isinstance(v, (int, float)):
        raise TypeError("%s must be a number" % what)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError("%s must be a finite number" % what)
    return v


def _int(v):
    """MicroPython's mp_obj_get_int: an int (or a bool), else TypeError."""
    if not isinstance(v, int):
        raise TypeError("can't convert %s to int" % type(v).__name__)
    return int(v)


def _await_sample(age, limit_ms, values=None):
    """Wait for a sensor's next sample, as the board's read() does: `age()` is the ms since the latest one, `values()`
    (when given) the sample's readings. Looked at every 1 ms (the world's tick), so read() returns at the sample, not
    on a polling grid.

    The sample's time is estimated as now - age: the age is whole ms and never negative (the world can be up to half
    a tick ahead of the program's clock), so the estimate is within -0.5 .. +1 ms of the sample, and an estimate
    1.5 ms later than the first one is a later sample. A sensor that samples faster than that (the IMU's raw rates,
    up to 1000 Hz) passes `values`: its readings carry the sensor's noise, so a new sample reads differently."""
    stamp = _s_now_ms() - age()
    v0 = values() if values else None
    waited = 0.0
    while waited < limit_ms:
        # to the world's next tick (whole ms), where a sample can come: not 1 ms plus the calls' own cost
        step = 1.0 - _s_now_ms() % 1.0
        _s_wait(step)
        waited += step
        if _s_now_ms() - age() > stamp + 1.5 or (values and values() != v0):
            return


class Port:
    A = 1
    B = 2
    C = 3
    D = 4


class Direction:
    CLOCKWISE = 0
    COUNTERCLOCKWISE = 1


class Stop:
    COAST = 0
    BRAKE = 1
    HOLD = 2
    NONE = 3
    COAST_SMART = 4


class SpeedUnit:
    DEG_S = 0
    PERCENT = 1


class Side:
    TOP = 0
    BOTTOM = 1
    LEFT = 2
    RIGHT = 3
    FRONT = 4
    BACK = 5


def wait(time):
    """Pause the program for `time` ms (a fraction included)."""
    _num(time, "time")
    _s_wait(time)


class StopWatch:
    def __init__(self):
        self._t0 = _s_now_ms()
        self._held = None

    def time(self):
        now = self._held if self._held is not None else _s_now_ms()
        return int(now - self._t0)

    def pause(self):
        if self._held is None:
            self._held = _s_now_ms()

    def resume(self):
        if self._held is not None:
            self._t0 += _s_now_ms() - self._held
            self._held = None

    def reset(self):
        now = _s_now_ms()
        self._t0 = now
        if self._held is not None:
            self._held = now


def stop_all():
    """Coast every motor."""
    _s_stop_all()


def _program_end():
    pass


# ---------------------------------------------------------------- colours

class Color:
    def __init__(self, h, s=100, v=100):
        self.h = int(h) % 360
        self.s = max(0, min(100, int(s)))
        self.v = max(0, min(100, int(v)))
        self._name = None

    def __repr__(self):
        if self._name:
            return "Color." + self._name
        return "Color(h=%d, s=%d, v=%d)" % (self.h, self.s, self.v)

    def __eq__(self, other):
        return isinstance(other, Color) and self.h == other.h and self.s == other.s and self.v == other.v

    def __hash__(self):
        return hash((self.h, self.s, self.v))

    def __rshift__(self, d):
        return Color(self.h + d, self.s, self.v)

    def __lshift__(self, d):
        return Color(self.h - d, self.s, self.v)

    def __mul__(self, f):
        return Color(self.h, self.s, self.v * f)

    __rmul__ = __mul__

    def __truediv__(self, f):
        return Color(self.h, self.s, self.v / f)


for _n, _h, _sat, _v in (("NONE", 0, 0, 0), ("BLACK", 0, 0, 10), ("GRAY", 0, 0, 50), ("WHITE", 0, 0, 100),
                         ("RED", 0, 100, 100), ("BROWN", 30, 100, 50), ("ORANGE", 30, 100, 100),
                         ("YELLOW", 60, 100, 100), ("GREEN", 120, 100, 100), ("CYAN", 180, 100, 100),
                         ("BLUE", 240, 100, 100), ("VIOLET", 270, 100, 100), ("MAGENTA", 300, 100, 100)):
    _c = Color(_h, _sat, _v)
    _c._name = _n
    setattr(Color, _n, _c)


# ---------------------------------------------------------------- motors

_motors = [None, None, None, None, None]


def _ratio(gears):
    if gears is None:
        return 1.0
    trains = gears if gears and isinstance(gears[0], (list, tuple)) else [gears]
    r = 1.0
    for t in trains:
        if len(t) < 2:
            raise ValueError("gears must be a list of at least two tooth counts, or a list of such lists")
        for a in t:
            if not isinstance(a, int) or a <= 0:
                raise ValueError("gears must be positive integers")
        r *= t[-1] / t[0]
    return r


# the firmware's per-model figures the simulator needs for the Python side of a Motor (motion/motor_models.c):
# d_torque_d_voltage and d_voltage_d_torque (the observer's scales) and the rated voltage that caps max_voltage
# (mV, 0 = none)
_MODEL_FIG = {
    "EV3 Large": (3587, 0, 107106), "EV3 Medium": (7806, 0, 49219), "NXT": (2896, 0, 132663),
    "JGA25-370 6V 77RPM": (1766, 6000, 217567), "Pololu 25D 9.7:1 HP 12V": (5615, 12000, 68428),
    "CHR-GM16-030PA 9V 1:63": (9124, 9000, 42110), "CM22-2230 12V 1:49": (1698, 12000, 226340),
}
_OBS_DEF = (50000, 50, 500, 50, 45, 200, 5000, 20000)    # motion/motion_engine.c: the observer's settings


def _v_to_torque(name, mv):
    """evn_observer_voltage_to_torque (motion/observer.c), mNm"""
    k = _MODEL_FIG.get(name, _MODEL_FIG["EV3 Large"])[0]
    return (178956 * min(int(mv), 12000) // k) / 1000.0


def _torque_to_v(name, mnm):
    """evn_observer_torque_to_voltage, mV"""
    k = _MODEL_FIG.get(name, _MODEL_FIG["EV3 Large"])[2]
    return 2147 * min(int(mnm * 1000.0), 1000000) // k


class Control:
    def __init__(self, m):
        self._m = m
        # the tolerances in output deg/s, as the firmware keeps them (a SpeedUnit changes how they read, not them)
        self._tol = [50.0, 1.0]
        self._stall = [50.0, 50]

    @property
    def scale(self):
        return self._m._ratio

    def limits(self, speed=None, acceleration=None, torque=None):
        m = self._m
        m._live()
        k = m._ratio
        if speed is None and acceleration is None and torque is None:
            sp, ac, dc = _s_m_limits(m.port, -1, -1, -1)
            acc = int(round(ac / k)) if ac == dc else (int(round(ac / k)), int(round(dc / k)))
            return (int(round(m._out_speed(sp / k))), acc, int(round(m._torque_now())))
        sp = ac = dc = -1
        if speed is not None:
            if not _num(speed, "speed limit") > 0:
                raise ValueError("speed limit must be positive")
            sp = m._in_speed(speed) * k
        if acceleration is not None:
            if isinstance(acceleration, (tuple, list)):
                if len(acceleration) != 2:
                    raise ValueError("acceleration must be a number or (accel, decel)")
                up, down = _num(acceleration[0], "acceleration"), _num(acceleration[1], "deceleration")
            else:
                up = down = _num(acceleration, "acceleration")
            if not (up > 0 and down > 0):
                raise ValueError("acceleration must be positive")
            ac, dc = up * k, down * k
        if torque is not None:
            if not _num(torque, "torque limit") > 0:
                raise ValueError("torque limit must be positive")
        _s_m_limits(m.port, sp, ac, dc)
        if torque is not None:
            m._torque = float(torque)
            m._apply_cap()

    def _apply(self):
        m = self._m
        k = m._ratio
        # the binding's done() is speed <= tolerance, the engine's speed < tolerance: a tolerance of 0 (allowed) is sent
        # as the simulator's speed resolution, 1 deg/s, or a move would never be done
        _s_m_tol(m.port, max(self._tol[0], 1.0) * k, self._tol[1] * k)
        _s_m_stall_tol(m.port, self._stall[0] * k, self._stall[1])

    def target_tolerances(self, speed=None, position=None):
        m = self._m
        if speed is None and position is None:
            return (float(m._out_speed(self._tol[0])), float(self._tol[1]))
        if speed is not None and _num(speed, "speed tolerance") < 0:
            raise ValueError("speed tolerance must not be negative")
        if position is not None and not _num(position, "position tolerance") > 0:
            raise ValueError("position tolerance must be positive")
        if speed is not None:
            self._tol[0] = float(m._in_speed(speed))
        if position is not None:
            self._tol[1] = float(position)
        self._apply()

    def stall_tolerances(self, speed=None, time=None):
        m = self._m
        if speed is None and time is None:
            return (float(m._out_speed(self._stall[0])), int(self._stall[1]))
        if speed is not None and _num(speed, "stall speed") < 0:
            raise ValueError("stall speed must not be negative")
        if time is not None:
            t = _int(time)
            if not 0 <= t <= 10000:
                raise ValueError("stall time must be 0..10000 ms")
        if speed is not None:
            self._stall[0] = float(m._in_speed(speed))
        if time is not None:
            self._stall[1] = t
        self._apply()

    def state(self):
        """(reference_deg, x1_deg, x2_degs, x3_degs2, applied_mv, hold, assist). The simulator has no ESO: the
        estimates are the measured angle and speed, x3 is 0, hold is done(), assist False."""
        m = self._m
        th, w = _s_m_state(m.port)
        ang = th * m._sign / m._ratio - m._off
        return (float(ang), float(ang), float(w * m._sign / m._ratio), 0.0,
                int(round(_s_m_volts(m.port) * 1000 * m._sign)), bool(_s_m_done(m.port)), False)

    def done(self):
        return self._m.done()

    def stalled(self):
        return self._m.stalled()

    def load(self, *, output=False):
        return self._m.load(output=output)


class Model:
    """motor.model: the observer's state and settings. The simulated motor is the simulator's own plant: state()
    reads the measured angle and speed (current 0: not simulated); settings() are stored and read back."""

    def __init__(self, m=None):
        if not isinstance(m, Motor):
            raise TypeError("cannot create 'Model' instances")
        self._m = m
        self._set = list(_OBS_DEF)

    def state(self):
        m = self._m
        m._live()
        th, w = _s_m_state(m.port)
        return (float(th * m._sign / m._ratio - m._off), float(w * m._sign / m._ratio), 0.0,
                bool(_s_m_stalled(m.port)))

    def settings(self, values=None, /):
        self._m._live()
        if values is None:
            return tuple(self._set)
        v = [_int(x) for x in values]
        if len(v) < 4:
            raise ValueError("settings needs at least 4 values")
        if len(v) > 4 and (len(v) != 8 or v[4:] != self._set[4:]):
            raise ValueError("observer gains are fixed model constants")
        self._set[:4] = v[:4]


class Motor:
    def __init__(self, port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None,
                 speed_unit=SpeedUnit.DEG_S, *, model=None):
        speed_unit = _int(speed_unit)
        if speed_unit not in (SpeedUnit.DEG_S, SpeedUnit.PERCENT):
            raise ValueError("speed_unit must be a SpeedUnit value")
        port = _int(port)
        if not 1 <= port <= 4:
            raise ValueError("port must be 1..4 (Port.A..Port.D)")
        positive_direction = _int(positive_direction)
        if positive_direction not in (Direction.CLOCKWISE, Direction.COUNTERCLOCKWISE):
            raise ValueError("positive_direction must be a Direction value")
        if profile is not None and _num(profile, "profile") <= 0:
            raise ValueError("profile must be positive")
        self._ratio = _ratio(gears)
        if model is not None:
            name = _s_m_lib(str(model))
            if name is None:
                raise ValueError("unknown motor model: %s" % model)
            have = _s_m_model(port)
            if name != have:
                print("WARNING: Motor(%d): the simulated robot has a %s on port %d (the hardware configurator); "
                      "model=%r is not applied" % (port, have, port, model))
        self.port = port
        self._sign = -1 if positive_direction == Direction.COUNTERCLOCKWISE else 1
        self._unit = speed_unit
        self._closed = False
        self._base = None
        self._full_set = None
        self._torque = 0.0
        self._off = 0.0
        old = _motors[port]
        if old is not None and old is not self:
            if old._base is not None:
                old._base._why = "drive base closed: Motor(%d) was replaced by a newer Motor(%d); create a new DriveBase" % (port, port)
        self._gen = _s_m_claim(port)
        _motors[port] = self
        name = _s_m_model(port)
        rated = _MODEL_FIG.get(name, (0, 0, 0))[1]
        # max_voltage: 9000 mV, or the motor's rated voltage when that is lower (evn_motor.c)
        self._vmax = rated if 0 < rated < 9000 else 9000
        self.control = Control(self)
        self.model = Model(self)
        if profile is not None:
            self.control._tol[1] = float(profile)
        if profile is not None or self._ratio != 1.0:
            self.control._apply()
        self._stall_timeout = 1000
        if reset_angle:
            self.reset_angle(0)

    # the program's units <-> the shaft's
    def _live(self):
        if self._closed:
            raise RuntimeError("motor closed; create a new Motor")
        if _s_m_gen(self.port) != self._gen:
            raise RuntimeError("Motor(%d) was replaced by a newer Motor(%d)" % (self.port, self.port))

    def _full_shaft(self):
        """100 %, shaft deg/s: full_speed(deg_s) when the program set it, else the model's at the pack"""
        return self._full_set * self._ratio if self._full_set is not None else _s_m_full(self.port)

    def _in_speed(self, v):
        _num(v, "speed")
        if self._unit == SpeedUnit.PERCENT:
            return v * self._full_shaft() / self._ratio / 100.0
        return v

    def _out_speed(self, v):
        if self._unit == SpeedUnit.PERCENT:
            return v * 100.0 * self._ratio / self._full_shaft()
        return v

    def _mag(self, speed):
        """motor_speed_mag (evn_motor.c): a move's speed, output deg/s, at least 1"""
        v = abs(self._in_speed(speed))
        return v if v >= 1.0 else 1.0

    def _torque_now(self):
        """torque_limit_effective_mnm: the torque limit, else the torque of max_voltage"""
        return self._torque if self._torque > 0 else _v_to_torque(_s_m_model(self.port), self._vmax)

    def _apply_cap(self):
        """apply_voltage_cap: min(max_voltage, the torque limit's voltage), at least 1 mV"""
        cap = self._vmax
        if self._torque > 0:
            cap = min(cap, _torque_to_v(_s_m_model(self.port), self._torque))
        cap = max(1, cap)
        _s_m_vcap(self.port, cap / 1000.0 if cap < 9000 else 0)

    def _then(self, then):
        if then not in (Stop.COAST, Stop.BRAKE, Stop.HOLD, Stop.NONE, Stop.COAST_SMART):
            raise ValueError("then must be a Stop value")
        return then

    def _wait(self):
        _s_m_wait(self.port, self._stall_timeout)

    # measuring
    def angle(self):
        self._live()
        th = _s_m_state(self.port)[0]
        return int(round(th * self._sign / self._ratio - self._off))

    def reset_angle(self, angle=None, /):
        self._live()
        th = _s_m_state(self.port)[0]
        self._off = th * self._sign / self._ratio - (0 if angle is None else _num(angle, "angle"))

    def speed(self):
        self._live()
        w = _s_m_state(self.port)[1]
        return int(round(self._out_speed(w * self._sign / self._ratio)))

    def load(self, *, output=False):
        self._live()
        return 0

    def stalled(self):
        self._live()
        return _s_m_stalled(self.port)

    def done(self):
        self._live()
        return _s_m_done(self.port)

    # stopping
    def stop(self):
        self._live()
        _s_m_stop(self.port, Stop.COAST)

    def brake(self):
        self._live()
        _s_m_stop(self.port, Stop.BRAKE)

    def hold(self):
        self._live()
        _s_m_stop(self.port, Stop.HOLD)

    # running
    def run(self, speed, /):
        self._live()
        _chk(_s_m_run(self.port, self._in_speed(speed) * self._sign * self._ratio))

    def dc(self, duty, /):
        self._live()
        _chk(_s_m_dc(self.port, _num(duty, "duty") * self._sign))

    def run_time(self, speed, time, then=Stop.HOLD, wait=True):
        self._live()
        _num(time, "time")
        if not 0 <= time <= 2147483647:
            raise ValueError("time must be 0 to 2147483647 ms")
        _chk(_s_m_run_time(self.port, self._in_speed(speed) * self._sign * self._ratio, time, self._then(then)))
        if wait:
            self._wait()

    def run_angle(self, speed, rotation_angle, then=Stop.HOLD, wait=True):
        self._live()
        _num(rotation_angle, "rotation_angle")
        v = self._mag(speed) * (-1 if speed < 0 else 1)
        _chk(_s_m_run_angle(self.port, v * self._ratio, rotation_angle * self._ratio * self._sign, self._then(then)))
        if wait:
            self._wait()

    def run_target(self, speed, target_angle, then=Stop.HOLD, wait=True):
        self._live()
        _num(target_angle, "target_angle")
        shaft = (target_angle + self._off) * self._ratio * self._sign
        v = self._mag(speed)
        _chk(_s_m_run_target(self.port, v * self._ratio, shaft, self._then(then)))
        if wait:
            self._wait()

    def run_until_stalled(self, speed, then=Stop.COAST, duty_limit=None):
        self._live()
        if then == Stop.NONE:
            raise ValueError("then=Stop.NONE: the motor cannot keep running after the stall")
        self._then(then)
        if duty_limit is not None:
            d = _num(duty_limit, "duty_limit")
            if not 0 < d <= 100:
                raise ValueError("duty_limit must be 0..100 %")
            # the stall force: this share of settings()' max_voltage (the pack, when that is above it)
            _s_m_vcap(self.port, min(self._vmax, 8400) / 1000.0 * d / 100.0)
        self.run(speed)
        sw = StopWatch()
        while not (sw.time() > 150 and _s_m_stalled(self.port)):
            _s_wait(5)
            if _s_interrupted():
                break
        a = self.angle()
        _s_m_stop(self.port, then if then != Stop.COAST_SMART else Stop.COAST)
        self._apply_cap()
        return a

    def track_target(self, target_angle, /):
        self._live()
        _chk(_s_m_track(self.port, (_num(target_angle, "target_angle") + self._off) * self._ratio * self._sign))

    def speed_unit(self, unit=None, /):
        if unit is None:
            return self._unit
        if unit not in (SpeedUnit.DEG_S, SpeedUnit.PERCENT):
            raise ValueError("unit must be SpeedUnit.DEG_S or SpeedUnit.PERCENT")
        self._unit = unit

    def full_speed(self, deg_s=None, /):
        self._live()
        if deg_s is None:
            return int(round(self._full_shaft() / self._ratio))
        v = _num(deg_s, "full speed")
        if not v > 0:
            raise ValueError("full speed must be positive")
        self._full_set = float(v)

    def calibrate(self, wait=True):
        self._live()
        r = _s_m_cal(self.port)
        return (r[0], r[1], r[2], r[3]) if wait else None

    def settings(self, max_voltage=None, *, stall_timeout=None):
        if max_voltage is None and stall_timeout is None:
            return (self._vmax, self._stall_timeout)
        if stall_timeout is not None:
            ms = _num(stall_timeout, "stall_timeout")
            if ms < 0 or ms > 60000 or 0 < ms < 1:
                raise ValueError("stall_timeout must be 0 (wait forever) or 1..60000 ms")
            self._stall_timeout = int(ms + 0.5)
        if max_voltage is not None:
            v = int(_num(max_voltage, "max_voltage"))
            if not 0 <= v <= 12000:
                raise ValueError("max_voltage must be 0..12000 mV")
            self._vmax = v
            self._apply_cap()

    def close(self):
        if self._closed or _motors[self.port] is not self:
            self._closed = True
            return
        _s_m_stop(self.port, Stop.COAST)
        self._closed = True
        _motors[self.port] = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


# ---------------------------------------------------------------- the drive base

class DriveBase:
    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track, *, imu=None, compass=None,
                 declination=None, pose=None, speed_unit=SpeedUnit.DEG_S):
        if not isinstance(left_motor, Motor) or not isinstance(right_motor, Motor):
            raise TypeError("left_motor and right_motor must be Motor objects")
        if left_motor is right_motor or left_motor.port == right_motor.port:
            raise ValueError("a motor cannot be both wheels")
        left_motor._live()
        right_motor._live()
        if not 1 <= _num(wheel_diameter, "wheel_diameter") <= 1000:
            raise ValueError("wheel_diameter must be 1..1000 mm")
        if not 1 <= _num(axle_track, "axle_track") <= 2000:
            raise ValueError("axle_track must be 1..2000 mm")
        if imu is not None or compass is not None or pose is not None:
            raise OSError("the simulated DriveBase drives on its encoders: imu=, compass= and pose= (a Pose's fused "
                          "heading) are not simulated yet - read an IMU() yourself for the heading")
        if declination is not None:
            raise ValueError("declination= needs compass=")
        if speed_unit not in (SpeedUnit.DEG_S, SpeedUnit.PERCENT):
            raise ValueError("speed_unit must be SpeedUnit.DEG_S or SpeedUnit.PERCENT")
        # wheels with different gears are allowed: the binding refuses them only when it builds a Pose (imu= /
        # compass=, refused above)
        for m in (left_motor, right_motor):
            if m._base is not None:
                m._base._why = "drive base closed: a newer DriveBase took Motor(%d)" % m.port
        self.left = left_motor
        self.right = right_motor
        self._d = wheel_diameter
        self._t = axle_track
        self._unit = speed_unit
        self._why = None
        self.pose = None
        self._id = _s_db_new(left_motor.port, right_motor.port, left_motor._sign * left_motor._ratio,
                             right_motor._sign * right_motor._ratio, wheel_diameter, axle_track)
        left_motor._base = self
        right_motor._base = self

    def _live(self):
        if self._why:
            raise RuntimeError(self._why)
        why = _s_db_closed(self._id)
        if why:
            raise RuntimeError(why)

    def _full(self):
        full = min(self.left._full_shaft() / self.left._ratio, self.right._full_shaft() / self.right._ratio)
        return full * 3.14159265 * self._d / 360.0, full * self._d / self._t

    def _go(self):
        """a command: the base is live (the runtime puts its wheels under it, out of a dc())"""
        self._live()

    def _then(self, then, straight=True):
        if then == Stop.NONE:
            raise ValueError("then=Stop.NONE: use drive()")
        if then not in (Stop.COAST, Stop.BRAKE, Stop.HOLD, Stop.COAST_SMART):
            raise ValueError("then must be a Stop value")
        return then

    def _wait(self):
        _s_db_wait(self._id, min(self.left._stall_timeout, self.right._stall_timeout))

    def straight(self, distance, then=Stop.HOLD, wait=True):
        self._go()
        _chk(_s_db_straight(self._id, _num(distance, "distance"), self._then(then)))
        if wait:
            self._wait()

    def turn(self, angle, then=Stop.HOLD, wait=True):
        self._go()
        _chk(_s_db_turn(self._id, _num(angle, "angle"), self._then(then)))
        if wait:
            self._wait()

    def curve(self, radius, angle, then=Stop.HOLD, wait=True):
        self._go()
        _num(radius, "radius")
        _num(angle, "angle")
        path = abs(radius) * abs(angle) * 3.14159265 / 180.0
        sgn = -1 if radius < 0 else 1
        # forwards along a positive radius; a positive angle turns clockwise (to the right)
        turn = abs(angle) * (1 if angle >= 0 else -1) * sgn
        _chk(_s_db_curve(self._id, sgn * path, turn, self._then(then)))
        if wait:
            self._wait()

    def arc(self, radius, distance=None, angle=None, then=Stop.HOLD, wait=True):
        self._go()
        if not abs(_num(radius, "radius")) > 0:
            raise ValueError("radius must not be zero (use turn())")
        if (distance is None) == (angle is None):
            raise ValueError("give exactly one of distance= and angle=")
        if distance is not None:
            path = _num(distance, "distance")
        else:
            path = _num(angle, "angle") * 3.14159265 / 180.0 * abs(radius)
        # to the right for a positive radius: the heading turns clockwise as the path goes forward
        turn = path / abs(radius) * 180.0 / 3.14159265 * (1 if radius > 0 else -1)
        _chk(_s_db_curve(self._id, path, turn, self._then(then)))
        if wait:
            self._wait()

    def drive(self, *args, **kw):
        """drive(speed, turn_rate) in SpeedUnit.DEG_S, drive(speed, steering) / drive(speed, steering=) in
        SpeedUnit.PERCENT: the binding's argument rules (evn_drivebase.c drivebase_drive)."""
        # the common form - drive(speed, turn_rate) in SpeedUnit.DEG_S, two finite numbers - goes straight to db_drive,
        # which refuses a closed base itself before the call is charged, as db_closed did (ledger HT-67); every other
        # call takes the checks below in their order, a closed base first
        if len(args) == 2 and not kw and not self._why and self._unit != SpeedUnit.PERCENT:
            speed, turn = args
            ts, tt = type(speed), type(turn)
            if (ts is float or ts is int) and (tt is float or tt is int) and speed - speed == 0 and turn - turn == 0:
                _chk(_s_db_drive(self._id, speed, turn))
                return
        names = ("speed", "turn_rate", "steering")
        if len(args) > 2:
            raise TypeError("function takes at most 3 positional arguments")
        a = dict(zip(names, args))
        for k, v in kw.items():
            if k not in names:
                raise TypeError("unexpected keyword argument '%s'" % k)
            if k in a:
                raise TypeError("argument '%s' given twice" % k)
            a[k] = v
        if "speed" not in a:
            raise TypeError("'speed' argument required")
        self._go()
        pct = self._unit == SpeedUnit.PERCENT
        second = a.get("turn_rate")
        if "steering" in a:
            if second is not None or not pct:
                raise TypeError("drive(): steering in SpeedUnit.PERCENT, turn_rate in SpeedUnit.DEG_S")
            second = a["steering"]
        elif "turn_rate" in kw and pct:
            raise TypeError("drive(): steering in SpeedUnit.PERCENT, turn_rate in SpeedUnit.DEG_S")
        if second is None:
            raise TypeError("drive() missing steering" if pct else "drive() missing turn_rate")
        speed = _num(a["speed"], "speed")
        if pct:
            st = _num(second, "steering")
            sp = max(-100.0, min(100.0, speed))
            st = max(-100.0, min(100.0, st))
            full_mm, _ = self._full()
            k = 360.0 / (3.14159265 * self._d)
            outer = sp / 100.0 * full_mm
            inner = outer * (1 - 2 * abs(st) / 100.0)
            # positive steering: the right wheel is the inner one
            vl, vr = (outer, inner) if st >= 0 else (inner, outer)
            v = (vl + vr) / 2
            w = (vl - vr) / 2 * k / (self._t / self._d)
            _chk(_s_db_drive(self._id, v, w))
            return
        _chk(_s_db_drive(self._id, speed, _num(second, "turn_rate")))

    def stop(self):
        self._go()
        _chk(_s_db_stop(self._id, Stop.COAST))

    def brake(self):
        self._go()
        _chk(_s_db_stop(self._id, Stop.BRAKE))

    def hold(self):
        self._go()
        _chk(_s_db_stop(self._id, Stop.HOLD))

    def distance(self):
        self._live()
        return int(round(_s_db_state(self._id)[0]))

    def angle(self):
        self._live()
        return int(round(_s_db_state(self._id)[2]))

    def state(self):
        self._live()
        s = _s_db_state(self._id)
        if self._unit == SpeedUnit.PERCENT:
            fm, ft = self._full()
            return (float(s[0]), float(s[1] * 100.0 / fm), float(s[2]), float(s[3] * 100.0 / ft))
        return (float(s[0]), float(s[1]), float(s[2]), float(s[3]))

    def reset(self, distance=0, angle=0):
        self._live()
        _chk(_s_db_reset(self._id, _num(distance, "distance"), _num(angle, "angle")))

    def done(self):
        self._live()
        return _s_db_done(self._id)

    def stalled(self):
        self._live()
        return _s_db_stalled(self._id)

    def use_gyro(self, enable=None, /):
        if enable is None:
            return False
        if enable:
            raise ValueError("use_gyro needs a Pose: the simulator has no Pose yet")

    def settings(self, straight_speed=None, straight_acceleration=None, turn_rate=None, turn_acceleration=None):
        self._live()
        pct = self._unit == SpeedUnit.PERCENT

        def pair(a):
            if a is None:
                return -1, -1
            if isinstance(a, (tuple, list)):
                if len(a) != 2:
                    raise ValueError("an acceleration is a number or an (accel, decel) pair")
                return _num(a[0], "acceleration"), _num(a[1], "deceleration")
            return _num(a, "acceleration"), a

        fm, ft = self._full()
        if straight_speed is None and straight_acceleration is None and turn_rate is None and turn_acceleration is None:
            r = _s_db_settings(self._id, -1, -1, -1, -1, -1, -1)
            sa = int(round(r[1])) if abs(r[1] - r[2]) < 0.5 else (int(round(r[1])), int(round(r[2])))
            ta = int(round(r[4])) if abs(r[4] - r[5]) < 0.5 else (int(round(r[4])), int(round(r[5])))
            ss = r[0] * 100.0 / fm if pct else r[0]
            tr = r[3] * 100.0 / ft if pct else r[3]
            return (int(round(ss)), sa, int(round(tr)), ta)
        for v in (straight_speed, turn_rate):
            if v is not None and _num(v, "speed") <= 0:
                raise ValueError("speeds must be positive")
        sa, sd = pair(straight_acceleration)
        ta, td = pair(turn_acceleration)
        for v in (sa, sd, ta, td):
            if v != -1 and v <= 0:
                raise ValueError("accelerations must be positive")
        ss = -1 if straight_speed is None else (straight_speed * fm / 100.0 if pct else straight_speed)
        tr = -1 if turn_rate is None else (turn_rate * ft / 100.0 if pct else turn_rate)
        _s_db_settings(self._id, ss, sa, sd, tr, ta, td)

    def speed_unit(self, unit=None, /):
        if unit is None:
            return self._unit
        if unit not in (SpeedUnit.DEG_S, SpeedUnit.PERCENT):
            raise ValueError("unit must be SpeedUnit.DEG_S or SpeedUnit.PERCENT")
        self._unit = unit

    def close(self):
        _s_db_close(self._id)
        self._why = "drive base closed; create a new DriveBase"
        for m in (self.left, self.right):
            if m._base is self:
                m._base = None

    def _wheels(self):
        w = _s_db_wheels(self._id)
        return (w[0], w[1], w[2], w[3])

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


# ---------------------------------------------------------------- the colour sensor (TCS34725)

_GAINS = (1, 4, 16, 60)


def _cos(deg):
    return _math.cos(deg * 0.017453292519943295)


def _sin(deg):
    return _math.sin(deg * 0.017453292519943295)


# The getters' numbers come back in these two arrays, written by the runtime into the wasm heap (Pyodide's buffer API),
# not as a JS Array through a JsProxy and its indexings (ledger HT-60): percent() / normalized() in floats (always, a
# clamped 0.0 / 100.0 too: the firmware's mp_obj_new_float, micropython/modules/evn_colorsensor.c colorsensor_percent /
# colorsensor_normalized), raw() / rgb() / hsv() in ints. A getter returns the binding's number when it wrote them;
# -1 (charged nothing) when this module's arrays are not the binding in force - an evn imported since, or a soft reset
# - and they are bound again and the call made again; else the error.
_cs_f = _array("d", bytes(32))
_cs_i = _array("i", bytes(16))
_cs_g = _s_cs_bind(_cs_f, _cs_i)


def _cs_again(r, f, b, n, *a):
    """a getter's slow path, its n numbers from array b: the arrays bound again (r == -1), or the error r stands
    for"""
    global _cs_g
    if r == -1:
        _cs_g = _s_cs_bind(_cs_f, _cs_i)
        r = f(_cs_g, *a)
    if r == _cs_g:
        return tuple(b[:n])
    _chk(r)
    raise RuntimeError("colour sensor: the runtime returned %r" % (r,))


class ColorSensor:
    def __init__(self, port, /):
        port = _int(port)
        if not 1 <= port <= 16:
            raise ValueError("port must be 1..16")
        _chk(_s_cs_open(port))
        self.port = port
        self._closed = False
        self._wait_ms = 0.0
        self._gain = 16
        self._steps = 1
        self._detect = (Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)

    def _live(self):
        if self._closed:
            raise ValueError("colour sensor is closed")

    def raw(self):
        if self._closed:
            self._live()
        r = _s_cs_raw(_cs_g, self.port)
        if r != _cs_g:
            return _cs_again(r, _s_cs_raw, _cs_i, 4, self.port)
        a = _cs_i
        return (a[0], a[1], a[2], a[3])

    def read(self):
        self._live()
        port = self.port
        _await_sample(lambda: _chk(_s_cs_age(port)), 1000)
        r = _s_cs_raw(_cs_g, port)
        if r != _cs_g:
            return _cs_again(r, _s_cs_raw, _cs_i, 4, port)
        a = _cs_i
        return (a[0], a[1], a[2], a[3])

    def percent(self):
        if self._closed:
            self._live()
        r = _s_cs_pct(_cs_g, self.port)
        if r != _cs_g:
            return _cs_again(r, _s_cs_pct, _cs_f, 4, self.port)
        a = _cs_f
        return (a[0], a[1], a[2], a[3])

    def normalized(self):
        if self._closed:
            self._live()
        r = _s_cs_norm(_cs_g, self.port)
        if r != _cs_g:
            return _cs_again(r, _s_cs_norm, _cs_f, 4, self.port)
        a = _cs_f
        return (a[0], a[1], a[2], a[3])

    def rgb(self):
        self._live()
        r = _s_cs_rgb(_cs_g, self.port)
        if r != _cs_g:
            return _cs_again(r, _s_cs_rgb, _cs_i, 3, self.port)
        a = _cs_i
        return (a[0], a[1], a[2])

    def hsv(self, normalized=True):
        if self._closed:
            self._live()
        normalized = bool(normalized)
        r = _s_cs_hsv(_cs_g, self.port, normalized)
        a = _cs_i if r == _cs_g else _cs_again(r, _s_cs_hsv, _cs_i, 3, self.port, normalized)
        return Color(a[0], a[1], a[2])

    def _match(self):
        # Pybricks' matcher: the distance between the two colours in the HSV cone (saturation shrinks to nothing
        # at black, so a dark reading's noisy hue picks no colour)
        c = self.hsv()
        a = c.s * c.v / 10000.0
        x, y, z = a * _cos(c.h), a * _sin(c.h), c.v / 100.0
        best = None
        bd = 1e9
        second = 1e9
        for k in self._detect:
            ka = k.s * k.v / 10000.0
            d = (x - ka * _cos(k.h)) ** 2 + (y - ka * _sin(k.h)) ** 2 + (z - k.v / 100.0) ** 2
            if d < bd:
                second = bd
                best, bd = k, d
            elif d < second:
                second = d
        return best, bd, second

    def color(self):
        return self._match()[0]

    def color_match(self):
        best, bd, second = self._match()
        if best is None:
            return (None, 0.0)
        if len(self._detect) == 1:
            return (best, max(0.0, 1.0 - bd / 0.5))
        return (best, 1.0 - bd / second if second > 0 else 1.0)

    def detectable_colors(self, colors=None, /):
        if colors is None:
            return self._detect
        for c in colors:
            if not isinstance(c, Color):
                raise TypeError("detectable colours must be Color objects")
        self._detect = tuple(colors)

    def ranges(self, *, clear=(), red=(), green=(), blue=()):
        self._live()
        given = (clear, red, green, blue)
        if all(g == () for g in given):
            r = _chk(_s_cs_ranges(self.port, -1, 0, 0))
            return tuple(None if r[2 * c] is None else (int(r[2 * c]), int(r[2 * c + 1])) for c in range(4))
        for g in given:
            if g not in ((), None) and not (len(g) == 2 and 0 <= g[0] < g[1] <= 65535):
                raise ValueError("a range is (low, high) with 0 <= low < high <= 65535")
        for c, g in enumerate(given):
            if g == ():
                continue
            if g is None:
                _s_cs_ranges(self.port, c, -1, -1)
            else:
                _s_cs_ranges(self.port, c, g[0], g[1])

    def calibrate_black(self):
        self._live()
        _chk(_s_cs_calibrate(self.port, False))
        self._no_black = False

    def calibrate_white(self, auto=None, *, target=None, min_rate=100, flicker=0):
        self._live()
        _chk(_s_cs_calibrate(self.port, True))
        self._no_white = False

    def black_reference(self, *value):
        """The black in force (counts), or None; black_reference(None) clears it (the lows: 0)."""
        self._live()
        r = _chk(_s_cs_ranges(self.port, -1, 0, 0))
        if value:
            if len(value) != 1 or value[0] is not None:
                raise ValueError("black_reference() takes only None (to clear it)")
            for c in range(4):
                if r[2 * c + 1] is not None:
                    _s_cs_ranges(self.port, c, 0, r[2 * c + 1])
            self._no_black = True
            return
        if r[0] is None or getattr(self, "_no_black", False):
            return None
        return tuple(float(r[2 * c]) for c in range(4))

    def white_reference(self, *value):
        """The white in force (counts), or None; white_reference(None) clears it (the highs: full scale)."""
        self._live()
        r = _chk(_s_cs_ranges(self.port, -1, 0, 0))
        if value:
            if len(value) != 1 or value[0] is not None:
                raise ValueError("white_reference() takes only None (to clear it)")
            for c in range(4):
                if r[2 * c] is not None:
                    _s_cs_ranges(self.port, c, r[2 * c], min(65535, 1024 * self._steps))
            self._no_white = True
            return
        if r[1] is None or getattr(self, "_no_white", False):
            return None
        return tuple(float(r[2 * c + 1]) for c in range(4))

    def stored_calibration(self):
        return {"port": self.port, "calibrated": True, "chip": "TCS34725", "stored": True,
                "note": "simulated: calibrated on the course's own black and white"}

    def clear_calibration(self):
        self._live()
        _s_cs_ranges(self.port, -2, 0, 0)
        return True

    def ambient(self):
        return int(self.percent()[0] * 0.05)

    def lux(self):
        r = self.raw()
        return max(0.0, (-0.32466 * r[1] + 1.57837 * r[2] - 0.73191 * r[3]) / (self._steps * 2.4 * self._gain / 48.0))

    def color_temperature(self):
        r = self.raw()
        x = -0.14282 * r[1] + 1.54924 * r[2] - 0.95641 * r[3]
        y = -0.32466 * r[1] + 1.57837 * r[2] - 0.73191 * r[3]
        z = -0.68202 * r[1] + 0.77073 * r[2] + 0.56332 * r[3]
        s = x + y + z
        if s <= 0:
            return 0
        n = (x / s - 0.3320) / (0.1858 - y / s)
        return int(449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33)

    def age(self):
        self._live()
        return _chk(_s_cs_age(self.port))

    def gain(self, x=None, /):
        self._live()
        if x is None:
            return self._gain
        if x not in _GAINS:
            raise ValueError("gain must be 1, 4, 16 or 60")
        _chk(_s_cs_expose(self.port, x, -1))
        self._gain = x

    def integration_time(self, ms=None, /):
        self._live()
        if ms is None:
            return self._steps * 2.4
        steps = int(round(_num(ms, "ms") / 2.4))
        if not 1 <= steps <= 256:
            raise ValueError("integration_time must be 2.4 .. 614.4 ms")
        _chk(_s_cs_expose(self.port, -1, steps))
        self._steps = steps
        return steps * 2.4

    def wait_time(self, ms=None, /):
        self._live()
        # the firmware's 0 is an int, any other time a float (evn_colorsensor.c colorsensor_wait_time)
        if ms is None:
            return self._wait_ms or 0
        steps = int(round(_num(ms, "ms") / 2.4))
        if not 0 <= steps <= 256:
            raise ValueError("wait_time must be 0 .. 614.4 ms")
        self._wait_ms = steps * 2.4
        _chk(_s_cs_wait(self.port, self._wait_ms))
        return self._wait_ms or 0

    def id(self):
        return 0x44

    def close(self):
        self._closed = True


# ---------------------------------------------------------------- the distance sensor (VL53L0X)

class DistanceSensor:
    """A VL53L0X looking where the configurator points it: a range a timing budget, None when nothing is in range."""

    def __init__(self, port, /):
        port = _int(port)
        if not 1 <= port <= 16:
            raise ValueError("port must be 1..16")
        _chk(_s_ds_open(port))
        self.port = port
        self._closed = False
        self._budget = 33.0
        self._inter = 0
        self._signal = 0.25
        self._vcsel = (14, 10)

    def _live(self):
        if self._closed:
            raise ValueError("distance sensor is closed")

    def distance(self):
        self._live()
        r = _chk(_s_ds_get(self.port))
        return None if r[0] is None else int(r[0])

    def read(self):
        self._live()
        port = self.port
        _await_sample(lambda: _chk(_s_ds_get(port))[2], 2000)
        r = _chk(_s_ds_get(port))[0]
        return None if r is None else int(r)

    def raw(self):
        self._live()
        r = _chk(_s_ds_raw(self.port))
        return (int(r[0]), r[1], int(r[2]), float(r[3]), float(r[4]), float(r[5]))

    def status(self):
        self._live()
        return _chk(_s_ds_get(self.port))[1]

    def _set(self, what, a, b=0):
        r = _chk(_s_ds_set(self.port, what, a, b))
        self._budget, self._inter, self._signal = float(r[0]), int(r[1]), float(r[2])
        self._vcsel = (int(r[3]), int(r[4]))

    def timing_budget(self, ms=None, /):
        self._live()
        if ms is None:
            return self._budget
        if not 20 <= _num(ms, "ms") <= 1000:
            raise ValueError("timing_budget must be 20..1000 ms")
        self._set("budget", ms)

    def signal_rate_limit(self, mcps=None, /):
        self._live()
        if mcps is None:
            return self._signal
        if not 0 <= _num(mcps, "mcps") <= 511.99:
            raise ValueError("signal_rate_limit must be 0..511.99 MCPS")
        self._set("signal", mcps)

    def vcsel_periods(self, *a):
        self._live()
        if not a:
            return self._vcsel
        if len(a) != 2:
            raise TypeError("vcsel_periods(pre, final)")
        if a[0] not in (12, 14, 16, 18) or a[1] not in (8, 10, 12, 14):
            raise ValueError("pre must be 12, 14, 16 or 18; final 8, 10, 12 or 14")
        self._set("vcsel", a[0], a[1])

    def inter_measurement(self, ms=None, /):
        self._live()
        if ms is None:
            return self._inter
        if type(ms) is not int:
            raise TypeError("can't convert %s to int" % type(ms).__name__)
        if not 0 <= ms <= 60000:
            raise ValueError("inter_measurement must be 0..60000 ms")
        self._set("inter", ms)

    def profile(self, name, /):
        self._live()
        if name not in ("default", "high_speed", "high_accuracy", "long_range"):
            raise ValueError("profile must be 'default', 'high_speed', 'high_accuracy' or 'long_range'")
        self._set("profile", name)

    def age(self):
        self._live()
        return _chk(_s_ds_get(self.port))[2]

    def close(self):
        self._closed = True

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


# ---------------------------------------------------------------- the IMU (MPU-6500 with its DMP)

_AXES = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1), "-x": (-1, 0, 0), "-y": (0, -1, 0), "-z": (0, 0, -1)}
_imu_gen = {}
_imu_live = {}      # port -> the IMU object running it (a newer IMU(port) takes it over)
_IMU_STATE = ("_dmp", "_gyro_cal", "_rate", "_ranges", "_filter", "_top", "_front", "_settings", "_ready", "_yaw0")


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _imu_cal(port, top, front):
    """The simulated IMU's calibration: perfect, stored (IMU.calibration(), evn.imu_calibration())."""
    return {"port": port, "calibrated": True, "busy": False, "stored": True, "stamp": 0,
            "gyro": (0.0, 0.0, 0.0), "accel": (0.0, 0.0, 0.0), "top": top, "front": front,
            "temperature": 30.0, "error": None, "pending": False, "accel_calibrated": True, "tilt": 0.0,
            "warning": None, "two_pose": False, "slope": None, "waiting": False}


class IMU:
    """The simulated robot's MPU-6500, lying flat on it (x forward, y left, z up): the chassis' own motion. Its
    calibration is perfect (calibrate() returns at once); ready() after a second of stillness. A second IMU(port) takes
    the running IMU over (its heading, settings and ready() go on; the older object is replaced), as on the board;
    calibrate=True starts it again."""

    def __init__(self, port, *, calibrate=False):
        port = _int(port)
        if not 1 <= port <= 16:
            raise ValueError("port must be 1..16")
        old = _imu_live.get(port)
        self.port = port
        if old is not None and not calibrate:
            _chk(_s_imu_state(port))
            _imu_gen[port] = _imu_gen.get(port, 0) + 1
            self._gen = _imu_gen[port]
            self._closed = False
            for k in _IMU_STATE:
                setattr(self, k, getattr(old, k))
            _imu_live[port] = self
            return
        _chk(_s_imu_open(port))
        _imu_gen[port] = _imu_gen.get(port, 0) + 1
        self._gen = _imu_gen[port]
        _imu_live[port] = self
        self._closed = False
        self._dmp = True
        self._gyro_cal = True
        self._rate = 200
        self._ranges = (2000, 2)
        self._filter = (41, 41)
        self._top, self._front = "z", "x"
        self._settings = [2.0, 2500.0, 360.0]
        self._ready = False
        r = self._row()
        self._yaw0 = r[0]

    def _live(self):
        if self._closed:
            raise ValueError("IMU is closed")
        if _imu_gen.get(self.port) != self._gen:
            raise ValueError("IMU(%d) was replaced by a newer IMU(%d)" % (self.port, self.port))

    def _row(self):
        return _chk(_s_imu_state(self.port))

    def _need_dmp(self):
        if not self._dmp:
            raise ValueError("orientation needs the DMP: imu.dmp(True)")

    def _body(self, v):
        """a vector of the chip's frame (the robot's) in the body frame axes() names"""
        t, f = _AXES[self._top], _AXES[self._front]
        return (_dot(v, f), _dot(v, _cross(t, f)), _dot(v, t))

    def _gravity(self, r):
        p, q = r[1] * 0.017453292519943295, r[2] * 0.017453292519943295
        return self._body((_math.sin(p), _math.cos(p) * _math.sin(q), _math.cos(p) * _math.cos(q)))

    def _turn(self, r):
        # the turn about the body's up axis since the zero (a module whose top is not up sees a part of it)
        return (r[0] - self._yaw0) * _AXES[self._top][2] * 360.0 / self._settings[2]

    def heading(self):
        self._live()
        return -self._turn(self._row())

    def reset_heading(self, angle=0, /):
        self._live()
        r = self._row()
        self._yaw0 = r[0] + _num(angle, "angle") * self._settings[2] / 360.0 * _AXES[self._top][2]

    def quaternion(self):
        self._live()
        self._need_dmp()
        r = self._row()
        y, p, q = self._turn(r) * 0.008726646259971648, -r[1] * 0.008726646259971648, r[2] * 0.008726646259971648
        cy, sy, cp, sp, cr, sr = _math.cos(y), _math.sin(y), _math.cos(p), _math.sin(p), _math.cos(q), _math.sin(q)
        return (cy * cp * cr + sy * sp * sr, cy * cp * sr - sy * sp * cr, cy * sp * cr + sy * cp * sr, sy * cp * cr - cy * sp * sr)

    def tilt(self):
        self._live()
        self._need_dmp()
        g = self._gravity(self._row())
        pitch = _math.degrees(_math.atan2(g[0], _math.sqrt(g[1] * g[1] + g[2] * g[2])))
        roll = _math.degrees(_math.atan2(g[1], g[2]))
        if g[2] < 0:
            pitch = 180.0 - pitch if pitch > 0 else -180.0 - pitch
        return (pitch, roll)

    def euler(self):
        self._live()
        p, r = self.tilt()
        y = -self._turn(self._row())
        y = (y + 180.0) % 360.0 - 180.0
        return (y, p, r)

    def _acc(self, r):
        # the accelerometer saturates at its range (+-2 g under the DMP): every reading made from its counts - acceleration(),
        # linear_acceleration(), read(), raw() - reads at most the range, as on the board (evn_imu.c: all from s.accel)
        lim = 9810.0 * self._ranges[1]
        return tuple(max(-lim, min(lim, v)) for v in self._body((r[6], r[7], r[8])))

    def _gyr(self, r):
        # the gyro saturates at its range (deg/s; +-2000 under the DMP)
        lim = float(self._ranges[0])
        return tuple(max(-lim, min(lim, v)) for v in self._body((r[3], r[4], r[5])))

    def acceleration(self):
        self._live()
        return self._acc(self._row())

    def linear_acceleration(self):
        self._live()
        self._need_dmp()
        r = self._row()
        a, g = self._acc(r), self._gravity(r)
        return tuple(a[i] - 9810.0 * g[i] for i in range(3))

    def gravity(self):
        self._live()
        self._need_dmp()
        return self._gravity(self._row())

    def angular_velocity(self):
        self._live()
        return self._gyr(self._row())

    def raw(self):
        self._live()
        r = self._row()
        a, g = self._acc(r), self._gyr(r)
        ka, kg = 32768.0 / self._ranges[1] / 9810.0, 32768.0 / self._ranges[0]
        clip = lambda v: max(-32768, min(32767, int(v)))
        return (tuple(clip(v * ka) for v in a), tuple(clip(v * kg) for v in g))

    def read(self):
        self._live()
        port = self.port
        _await_sample(lambda: _chk(_s_imu_state(port))[9], 1000, lambda: tuple(_chk(_s_imu_state(port))[3:9]))
        r = self._row()
        if self._dmp:
            return self.euler()
        return (tuple(v / 9810.0 for v in self._acc(r)), self._gyr(r))

    def up(self):
        """The Side that faces up (Side.TOP when level)."""
        self._live()
        self._need_dmp()
        g = self._gravity(self._row())
        a = max(range(3), key=lambda i: abs(g[i]))
        return ((Side.FRONT, Side.LEFT, Side.TOP) if g[a] >= 0 else (Side.BACK, Side.RIGHT, Side.BOTTOM))[a]

    def stationary(self):
        self._live()
        return self._row()[10] >= 250

    def ready(self):
        self._live()
        if not self._ready:
            r = self._row()
            self._ready = r[10] >= 1000
        return self._ready

    def heading_confidence(self):
        self._live()
        return 1.0 if self.ready() else 0.0

    def settings(self, *, angular_velocity_threshold=None, acceleration_threshold=None, heading_correction=None):
        self._live()
        given = (angular_velocity_threshold, acceleration_threshold, heading_correction)
        if all(v is None for v in given):
            return tuple(self._settings)
        for i, v in enumerate(given):
            if v is None:
                continue
            if _num(v, "setting") <= 0:
                raise ValueError("settings must be positive")
            self._settings[i] = float(min(3600, max(1, v))) if i == 2 else float(v)

    def temperature(self):
        self._live()
        return 30.0

    def tap(self):
        self._live()
        return None

    def screen_orientation(self):
        self._live()
        return None

    def calibrate_gyro(self, samples=500):
        self._live()
        if not 1 <= samples <= 65535:
            raise ValueError("samples must be 1..65535")
        return None if (self._dmp and self._gyro_cal) else (0, 0, 0)

    def calibrate(self, wait=True, *, pose=0):
        self._live()
        if pose not in (0, 1, 2):
            raise ValueError("pose must be 1 or 2 (two-pose), or 0 (one pose)")
        return self.calibration() if wait else None

    def calibration(self):
        self._live()
        return _imu_cal(self.port, self._top, self._front)

    def clear_calibration(self):
        self._live()
        return True

    def cancel_calibration(self):
        self._live()

    def find_front(self):
        # the board's refusal type (RuntimeError "IMU find_front: ..."): the simulated robot stays level on its
        # mat, so the nose-down tip the board waits for never comes; the axes stay as they are
        self._live()
        raise RuntimeError("IMU find_front: the simulated robot cannot be tipped - run it on the board")

    def ranges(self, *, gyro=None, accel=None):
        self._live()
        if gyro is None and accel is None:
            return self._ranges
        if gyro is not None and gyro not in (250, 500, 1000, 2000):
            raise ValueError("gyro range must be 250, 500, 1000 or 2000")
        if accel is not None and accel not in (2, 4, 8, 16):
            raise ValueError("accel range must be 2, 4, 8 or 16")
        g, a = gyro or self._ranges[0], accel or self._ranges[1]
        if self._dmp and (g != 2000 or a != 2):
            raise ValueError("the DMP runs at 2000 dps / 2 g; use dmp(False) for other ranges")
        self._ranges = (g, a)

    def filter(self, *, gyro=None, accel=None):
        self._live()
        if gyro is None and accel is None:
            return self._filter
        if gyro is not None and gyro not in (184, 92, 41, 20, 10, 5):
            raise ValueError("gyro filter must be 184, 92, 41, 20, 10 or 5 Hz")
        if accel is not None and accel not in (460, 184, 92, 41, 20, 10, 5):
            raise ValueError("accel filter must be 460, 184, 92, 41, 20, 10 or 5 Hz")
        self._filter = (gyro or self._filter[0], accel or self._filter[1])

    def sample_rate(self, hz=None, /):
        self._live()
        if hz is None:
            return self._rate
        if self._dmp and not 12 <= hz <= 200:
            raise ValueError("DMP rate must be 12..200 Hz")
        if not self._dmp and not 4 <= hz <= 1000:
            raise ValueError("sample_rate must be 4..1000 Hz")
        self._rate = int(hz)
        # the DMP runs at 200 Hz over a whole number, a raw rate at 1000 Hz over one (hal_mpu6500.c dmp_divider,
        # raw_divider): a raw 400 Hz runs at 500 Hz
        _s_imu_rate(self.port, 200.0 / max(1, int(200 // hz)) if self._dmp else 1000.0 / max(1, int(1000 // hz)))

    def dmp(self, *a, rate=None, tap=True, orientation=True, gyro_cal=True):
        self._live()
        if not a:
            return self._dmp
        was = self._dmp
        self._dmp = bool(a[0])
        self._gyro_cal = bool(gyro_cal)
        # the DMP pins 2000 dps / 2 g (hal_mpu6500.c clamp_cfg); LEAVING a DMP that was on puts raw mode back at the
        # maxima, 2000 dps / 16 g (hal_mpu6500_set_dmp: `if (!enable && in->cfg.dmp)`); dmp(False) with the DMP already
        # off keeps the ranges() given
        if not self._dmp and was:
            self._ranges = (2000, 16)
        if self._dmp:
            self._ranges = (2000, 2)
            if rate is not None:
                if not 12 <= rate <= 200:
                    raise ValueError("rate must be 12..200 Hz")
                self._rate = int(rate)
            self._rate = min(200, max(12, self._rate))
            _s_imu_rate(self.port, 200.0 / max(1, int(200 // self._rate)))

    def axes(self, *, top=None, front=None):
        self._live()
        if top is None and front is None:
            return (self._top, self._front)
        for v in (top, front):
            if v is not None and v not in _AXES:
                raise ValueError("axis must be 'x', 'y', 'z' or '-x', '-y', '-z'")
        t, f = top or self._top, front or self._front
        if t.strip("-") == f.strip("-"):
            raise ValueError("top and front must be different axes")
        self._top, self._front = t, f

    def age(self):
        self._live()
        return self._row()[9]

    def close(self):
        # an object a newer IMU(port) replaced closes nothing: the IMU is the newer object's
        if not self._closed and _imu_gen.get(self.port) == self._gen:
            _imu_gen[self.port] = self._gen + 1
            _imu_live.pop(self.port, None)
            self._closed = True

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


# ---------------------------------------------------------------- PID (motion/user_ctrl.c's maths)

class PID:
    """motion/user_ctrl.c's maths, as stubs/evn.pyi describes them."""

    def __init__(self, kp, ki=0, kd=0, *, filter=20, limits=None, integral_limit=None, dt_max=200):
        self.kp = self.ki = self.kd = 0.0
        self.filter = 20.0
        self.limits = None
        self.integral_limit = None
        self.dt_max = 200.0
        self._set(kp, ki, kd, filter, limits, integral_limit, dt_max)
        self.reset()

    @staticmethod
    def _fin(v, what):
        if type(v) is bool or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
            raise ValueError("%s must be a number" % what)
        return float(v)

    def _set(self, kp, ki, kd, filter, limits, integral_limit, dt_max):
        # in this order, stopping at the first invalid one
        if kp is not None:
            self.kp = self._fin(kp, "kp")
        if ki is not None:
            self.ki = self._fin(ki, "ki")
        if kd is not None:
            self.kd = self._fin(kd, "kd")
        if filter is not None:
            if self._fin(filter, "filter") < 0:
                raise ValueError("filter must be positive or 0")
            self.filter = float(filter)
        if limits is False:
            self.limits = None
        elif limits is not None:
            if isinstance(limits, (tuple, list)):
                if len(limits) != 2:
                    raise ValueError("limits must be a number or (low, high)")
                lo, hi = self._fin(limits[0], "limits"), self._fin(limits[1], "limits")
                if lo >= hi:
                    raise ValueError("limits must have low < high")
                self.limits = (lo, hi)
            else:
                x = self._fin(limits, "limits")
                if x <= 0:
                    raise ValueError("limits must be positive")
                self.limits = (-x, x)
        if integral_limit is False:
            self.integral_limit = None
        elif integral_limit is not None:
            if self._fin(integral_limit, "integral_limit") <= 0:
                raise ValueError("integral_limit must be positive")
            self.integral_limit = float(integral_limit)
        if dt_max is not None:
            if self._fin(dt_max, "dt_max") <= 0:
                raise ValueError("dt_max must be positive")
            self.dt_max = float(dt_max)

    def settings(self, kp=None, ki=None, kd=None, *, filter=None, limits=None, integral_limit=None, dt_max=None):
        if kp is None and ki is None and kd is None and filter is None and limits is None and integral_limit is None \
                and dt_max is None:
            return (self.kp, self.ki, self.kd, self.filter, self.limits, self.integral_limit, self.dt_max)
        self._set(kp, ki, kd, filter, limits, integral_limit, dt_max)

    def reset(self):
        self.p = self.i = self.d = 0.0
        self.output = 0.0
        self.error = 0.0
        self.saturated = False
        self.restarted = False
        self._last = None
        self._t = None
        self._df = 0.0
        self._slow = False

    def update(self, setpoint, measurement, dt=None):
        # a float or an int that is finite (x - x == 0: not inf, not nan; a bool is neither type) passes as _fin passes
        # it; anything else takes _fin's checks, in the same order. The state is read into locals once; the sums are
        # the same sums in the same order (ledger HT-67)
        t = type(setpoint)
        if (t is float or t is int) and setpoint - setpoint == 0:
            sp = float(setpoint)
        else:
            sp = self._fin(setpoint, "setpoint")
        t = type(measurement)
        if (t is float or t is int) and measurement - measurement == 0:
            me = float(measurement)
        else:
            me = self._fin(measurement, "measurement")
        dt_max = self.dt_max
        if dt is not None:
            if type(dt) is bool or not isinstance(dt, (int, float)) or dt != dt or dt <= 0:
                raise ValueError("dt must be a positive number of ms")
            if dt > dt_max:
                raise ValueError("dt exceeds dt_max")
        now = _s_now_us()
        if dt is None:
            t0 = self._t
            dtm = None if t0 is None else (now - t0) / 1000.0
        else:
            dtm = float(dt)
        e = sp - me
        restart = dt is None and dtm is not None and dtm > dt_max
        if restart and self._slow:
            # two measured pauses past dt_max in a row: the loop itself is slower (it re-seeds and starts the next one)
            self._t = now
            self._last = me
            self._df = 0.0
            raise ValueError("updates further apart than dt_max: raise dt_max")
        self._slow = restart
        self._t = now
        self.error = e
        self.p = p = self.kp * e
        self.restarted = restart
        last = self._last
        if last is None or dtm is None or restart:
            # the first update seeds; a pause longer than dt_max restarts (the integral kept, the derivative re-seeded)
            self.d = d = 0.0
            self._df = 0.0
        else:
            raw = -(me - last) / (dtm / 1000.0)
            f = self.filter
            a = dtm / (f + dtm) if f > 0 else 1.0
            df = self._df
            df += a * (raw - df)
            self._df = df
            self.d = d = self.kd * df
            step = self.ki * e * dtm / 1000.0
            out = p + self.i + step + d
            lim = self.limits
            # clamping anti-windup: no integration while the output sits on a limit it pushes into
            if not (lim and ((out > lim[1] and step > 0) or (out < lim[0] and step < 0))):
                self.i += step
                il = self.integral_limit
                if il is not None:
                    self.i = max(-il, min(il, self.i))
        self._last = me
        out = p + self.i + d
        lim = self.limits
        sat = False
        if lim:
            if out >= lim[1] or out <= lim[0]:
                sat = True
            out = max(lim[0], min(lim[1], out))
        self.saturated = sat
        self.output = out
        return out


# ---------------------------------------------------------------- the board

class battery:
    @staticmethod
    def voltage():
        return _s_pack_mv()

    @staticmethod
    def cells():
        v = _s_pack_mv()
        return (v // 2 + 6, v - v // 2 - 6)

    @staticmethod
    def age():
        return 0

    @staticmethod
    def present():
        return True

    @staticmethod
    def low(threshold=6600):
        return _s_pack_mv() < threshold


class button:
    @staticmethod
    def pressed():
        return _s_button()


class led:
    _on = False

    @staticmethod
    def on():
        led._on = True
        _s_led(True)

    @staticmethod
    def off():
        led._on = False
        _s_led(False)

    @staticmethod
    def toggle():
        led._on = not led._on
        _s_led(led._on)

    @staticmethod
    def set(value, /):
        led._on = bool(value)
        _s_led(led._on)


def motor_config(port):
    if type(port) is not int or not 1 <= port <= 4:
        raise ValueError("port must be 1..4")
    return {"port": port, "model": _s_m_model(port), "custom": False, "stored": True, "session": False}


def configure_motor(port, model, **kw):
    raise OSError("the simulated robot's motors are set in the hardware configurator (EVN: Configure the simulated robot)")


def calibration(port):
    r = _s_m_cal(port)
    return {"port": port, "calibrated": True, "stored": True, "busy": False, "b0": r[0], "tau_ms": r[1],
            "v_break_mv": r[2], "v_f_mv": r[3], "warning": None, "error": None}


def clear_calibration(port):
    pass


def color_calibration(port):
    return {"port": port, "calibrated": True, "chip": "TCS34725", "stored": True}


def imu_calibration(port):
    if type(port) is not int or not 1 <= port <= 16:
        raise ValueError("port must be 1..16")
    imu = _imu_live.get(port)
    return _imu_cal(port, *((imu._top, imu._front) if imu is not None else ("z", "x")))


def compass_calibration(port):
    raise OSError("the simulated robot has no compass")


def vl53l1x_calibration(port):
    raise OSError("the simulated robot has no VL53L1X distance sensor")


def core1_status():
    return None


def reset_cause():
    return "simulator"


def clock(seconds=None):
    return 0


def autostart(on=None):
    return False


def set_stop_button(b):
    pass


def reset(*, start=False):
    raise OSError("the simulator resets from the Simulator panel")


def bootloader():
    raise OSError("the simulator has no bootloader")


# ---------------------------------------------------------------- what the simulated robot does not have (yet)

def _absent(name, what):
    def __init__(self, port=None, *a, **k):
        if port is None:
            raise OSError("the simulated robot has no %s" % what)
        raise OSError("no %s on port %s: the simulated robot has a drive base, colour and distance sensors, an IMU, "
                      "servos, touch arrays and ADCs (the hardware configurator)" % (what, port))
    return type(name, (), {"__init__": __init__})


Compass = _absent("Compass", "compass")
GestureSensor = _absent("GestureSensor", "APDS-9960 gesture sensor")
EnvSensor = _absent("EnvSensor", "BME280 environment sensor")
MatrixLED = _absent("MatrixLED", "matrix LED")
SevenSegmentLED = _absent("SevenSegmentLED", "seven-segment display")
Display = _absent("Display", "OLED display")
RGBLED = _absent("RGBLED", "RGB LED strip")
Bluetooth = _absent("Bluetooth", "Bluetooth module")
I2C = _absent("I2C", "I2C device")
HiTechnicColorSensor = _absent("HiTechnicColorSensor", "HiTechnic colour sensor")
HiTechnicCompass = _absent("HiTechnicCompass", "HiTechnic compass")
HuskyLens = _absent("HuskyLens", "HuskyLens")
VL53L1X = _absent("VL53L1X", "VL53L1X distance sensor")
TCS3430 = _absent("TCS3430", "TCS3430 colour sensor")
Pose = _absent("Pose", "Pose estimator (not simulated yet)")
DataLog = _absent("DataLog", "data logger")
ADRC = _absent("ADRC", "ADRC controller")
Flash = _absent("Flash", "flash block device (its files are the Simulator panel's)")
Icon = _absent("Icon", "matrix LED icon set (no matrix LED)")


# ---------------------------------------------------------------- servos, touch arrays and ADCs (peripherals.ts)
# The bindings' checks and messages (micropython/modules/evn_periph.c Servo, evn_toucharray.c, evn_adc.c); the driver's
# state is the simulator's (src/sim/engine/peripherals.ts). A limit switch or bumper is an ADC input or a touch-array
# electrode, as on the board (it has no switch class): docs/SIMULATOR.md "Servos, touch arrays, ADCs and switches".

_s_sv_open, _s_sv_owned, _s_sv_get, _s_sv_do, _s_sv_wait = _s.sv_open, _s.sv_owned, _s.sv_get, _s.sv_do, _s.sv_wait
_s_ta_open, _s_ta_get, _s_ta_events, _s_ta_data = _s.ta_open, _s.ta_get, _s.ta_events, _s.ta_data
_s_ta_cfg, _s_ta_set, _s_ta_close = _s.ta_cfg, _s.ta_set, _s.ta_close
_s_ad_open, _s_ad_cfg, _s_ad_get, _s_ad_read, _s_ad_set, _s_ad_close = _s.ad_open, _s.ad_cfg, _s.ad_get, _s.ad_read, _s.ad_set, _s.ad_close

_UNSET = object()
# hal/hal_servo.c's profiles: range (0: continuous), min_us, max_us, start, max_dps
_SERVO_PROFILES = {
    "generic": (180, 500, 2500, 90.0, 500.0),
    "geekservo_270": (270, 600, 2400, 135.0, 500.0),
    "geekservo_cr": (0, 600, 2400, 0.0, 0.0),
    "geekservo_360": (360, 500, 2500, 180.0, 400.0),
}


def _flt(v):
    """MicroPython's mp_obj_get_float: an int, a float or a bool, else TypeError."""
    if not isinstance(v, (int, float)):
        raise TypeError("can't convert %s to float" % type(v).__name__)
    return float(v)


def _finite(v, what):
    v = _flt(v)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError("%s must be a finite number" % what)
    return v


class Servo:
    """A hobby servo on servo port 1..4: the pulse the program sets, the tracked position the board reports (it has no
    encoder: angle() is where the pulse sends the horn, not where a load holds it)."""

    def __init__(self, port, profile=None, reverse=False, *, range=None, min_us=None, max_us=None, start=None, max_dps=None):
        n = _int(port)
        if not 1 <= n <= 4:
            raise ValueError("servo must be 1..4")
        if profile is None:
            name = "geekservo_270"
        elif not isinstance(profile, str):
            raise TypeError("can't convert '%s' object to str implicitly" % type(profile).__name__)
        elif profile in _SERVO_PROFILES:
            name = profile
        else:
            raise ValueError("profile must be 'generic', 'geekservo_270', 'geekservo_360' or 'geekservo_cr'")
        rng, lo, hi, st, dps = _SERVO_PROFILES[name]
        if range is not None:
            r = _int(range)
            if r < 0 or r > 3600:
                raise ValueError("range must be 0 (continuous) .. 3600 degrees")
            rng = r
            if start is None:
                st = r * 0.5
        if min_us is not None:
            lo = _int(min_us)
            if not 200 <= lo <= 2800:
                raise ValueError("min_us must be 200..2800")
        if max_us is not None:
            hi = _int(max_us)
            if not 200 <= hi <= 2800:
                raise ValueError("max_us must be 200..2800")
        if lo < 200 or hi > 2800 or lo >= hi:
            raise ValueError("pulse range must satisfy 200 <= min_us < max_us <= 2800")
        if start is not None:
            st = _finite(start, "start")
        if max_dps is not None:
            dps = _finite(max_dps, "max_dps")
        if rng and (st < 0 or st > rng):
            raise ValueError("start must be within the range")
        if rng and dps < 1:
            raise ValueError("max_dps must be >= 1")
        self._port = n
        self._closed = False
        self._token = _s_sv_open(n, name, rng, lo, hi, st, dps, bool(reverse))

    def _check(self):
        if self._closed:
            raise ValueError("Servo is closed")
        if not _s_sv_owned(self._port, self._token):
            raise ValueError("Servo(%d) was replaced by a newer Servo(%d)" % (self._port, self._port))

    def _fixed(self):
        st = _s_sv_get(self._port)
        if st[5] == 0:
            raise TypeError("continuous-rotation servo: use duty()")
        return st

    def __repr__(self):
        p = self._port
        if self._closed or not _s_sv_owned(p, self._token):
            return "Servo(%d, %s)" % (p, "closed" if self._closed else "replaced")
        st = _s_sv_get(p)
        if st[5] == 0:
            return "Servo(%d, profile='%s', continuous, %d..%d us, duty=%d%%)" % (p, st[4], st[6], st[7], int(st[3]))
        return "Servo(%d, profile='%s', range=%d, %d..%d us, position=%d, %s)" % (
            p, st[4], st[5], st[6], st[7], int(st[1]), "reverse" if st[10] else "direct")

    def pulse(self, us=_UNSET, /):
        self._check()
        if us is _UNSET:
            return int(_s_sv_get(self._port)[0])
        us = _int(us)
        if not 200 <= us <= 2800:
            raise ValueError("pulse must be 200..2800 us")
        _s_sv_do(self._port, "us", us, 0)

    def angle(self, degrees=_UNSET, reverse=False, /):
        self._check()
        st = self._fixed()
        if degrees is _UNSET:
            return float(st[1])
        d = _finite(degrees, "angle")
        if d < 0 or d > st[5]:
            raise ValueError("angle must be 0..%d" % st[5])
        _s_sv_do(self._port, "angle", d, bool(reverse))

    def move(self, angle, speed=None, wait=True):
        self._check()
        st = self._fixed()
        d = _finite(angle, "angle")
        if d < 0 or d > st[5]:
            raise ValueError("angle must be 0..%d" % st[5])
        dps = abs(st[9] if speed is None else _finite(speed, "speed"))
        if dps == 0:
            raise ValueError("speed must be non-zero (use angle() to jump)")
        _s_sv_do(self._port, "move", d, dps)
        if wait:
            _s_sv_wait(self._port)

    def done(self):
        self._check()
        return not _s_sv_get(self._port)[2]

    def duty(self, percent=_UNSET, /):
        self._check()
        st = _s_sv_get(self._port)
        if st[5] != 0:
            raise TypeError("fixed-range servo: use angle() / move()")
        if percent is _UNSET:
            return float(st[3])
        d = _finite(percent, "duty")
        if d < -100 or d > 100:
            raise ValueError("duty must be -100..100")
        _s_sv_do(self._port, "duty", d, 0)

    def stop(self):
        self._check()
        _s_sv_do(self._port, "stop", 0, 0)

    def profile(self):
        self._check()
        st = _s_sv_get(self._port)
        return (st[4], int(st[5]), int(st[6]), int(st[7]), float(st[8]), float(st[9]), bool(st[10]))

    def set_range(self, min_us, max_us, /):
        self._check()
        lo, hi = _int(min_us), _int(max_us)
        if lo < 200 or hi > 2800 or lo >= hi:
            raise ValueError("range must satisfy 200 <= min < max <= 2800 us")
        _s_sv_do(self._port, "range", lo, hi)

    def enable(self):
        self._check()
        _s_sv_do(self._port, "enable", 0, 0)

    def disable(self):
        self._check()
        _s_sv_do(self._port, "disable", 0, 0)

    def close(self):
        if not self._closed and _s_sv_owned(self._port, self._token):
            _s_sv_do(self._port, "close", 0, 0)
            self._closed = True


_TA_CDT = (0.0, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0)


def _ta_channel(c):
    c = _int(c)
    if not 0 <= c <= 12:
        raise ValueError("channel must be 0..12 (12 = proximity)")
    return c


class TouchArray:
    """An MPR121 touch array on I2C port 1..16: its electrodes read the configurator's switches (or a mechanism's
    contacts); a closed contact is a touch of ~500 counts against the 12 / 6 thresholds."""

    def __init__(self, port, /):
        port = _int(port)
        if not 1 <= port <= 16:
            raise ValueError("port must be 1..16")
        _chk(_s_ta_open(port))
        self._port = port

    def _cfg(self):
        return _chk(_s_ta_cfg(self._port))

    def _get(self):
        return _chk(_s_ta_get(self._port))

    def __repr__(self):
        r = _s_ta_cfg(self._port)
        if type(r) is str:
            return "TouchArray(%d, closed)" % self._port
        return "TouchArray(%d, electrodes=%d, proximity=%d, thresholds=(%d, %d), update=%d ms)" % (
            self._port, r[0], r[1], r[14], r[27], r[6] * r[5])

    def touched(self):
        return int(self._get()[0])

    def read(self, channel, /):
        c = _ta_channel(channel)
        return bool(int(self._get()[0]) & (1 << c))

    def pressed(self):
        return bool(int(self._get()[0]) & 0x0FFF)

    def proximity(self):
        return bool(int(self._get()[0]) & 0x1000)

    def events(self):
        r = _chk(_s_ta_events(self._port))
        return (int(r[0]), int(r[1]))

    def data(self, channel, /):
        c = _ta_channel(channel)
        r = _chk(_s_ta_data(self._port, c))
        return (int(r[0]), int(r[1]))

    def thresholds(self, *args, **kw):
        cfg = self._cfg()
        for k in kw:
            if k not in ("touch", "release", "channel"):
                raise TypeError("unexpected keyword argument '%s'" % k)
        if len(args) > 2:
            raise TypeError("function takes 3 positional arguments but %d were given" % (len(args) + 1))
        read_one = len(args) == 1 and "release" not in kw
        if read_one and "channel" in kw:
            raise TypeError("thresholds(channel) or thresholds(touch, release, channel=)")
        v = {"touch": None, "release": None}
        for name, a in zip(("touch", "release"), args):
            if name in kw:
                raise TypeError("argument '%s' given twice" % name)
            v[name] = a
        for name in ("touch", "release"):
            if name in kw:
                v[name] = kw[name]
        if read_one:
            c = _ta_channel(v["touch"])
            return (int(cfg[14 + c]), int(cfg[27 + c]))
        ch = -1 if kw.get("channel") is None else _ta_channel(kw["channel"])
        i = 0 if ch < 0 else ch
        if v["touch"] is None and v["release"] is None:
            return (int(cfg[14 + i]), int(cfg[27 + i]))
        t = int(cfg[14 + i]) if v["touch"] is None else _int(v["touch"])
        r = int(cfg[27 + i]) if v["release"] is None else _int(v["release"])
        if not (0 <= t <= 255 and 0 <= r <= 255):
            raise ValueError("thresholds must be 0..255")
        _chk(_s_ta_set(self._port, "thr", ch, t, r, 0, 0))

    def debounce(self, *a):
        cfg = self._cfg()
        if not a:
            return (int(cfg[2]), int(cfg[3]))
        if len(a) != 2:
            raise TypeError("debounce(touch, release)")
        t, r = _int(a[0]), _int(a[1])
        if not (0 <= t <= 7 and 0 <= r <= 7):
            raise ValueError("debounce must be 0..7")
        _chk(_s_ta_set(self._port, "deb", t, r, 0, 0, 0))

    def electrodes(self, count=None, proximity=None):
        cfg = self._cfg()
        if count is None and proximity is None:
            return (int(cfg[0]), int(cfg[1]))
        n = int(cfg[0]) if count is None else _int(count)
        p = int(cfg[1]) if proximity is None else _int(proximity)
        if not 1 <= n <= 12:
            raise ValueError("count must be 1..12")
        if not 0 <= p <= 3:
            raise ValueError("proximity must be 0..3")
        _chk(_s_ta_set(self._port, "ele", n, p, 0, 0, 0))

    def sampling(self, *a):
        cfg = self._cfg()
        if not a:
            return (int(cfg[4]), int(cfg[5]), int(cfg[6]))
        if len(a) != 3:
            raise TypeError("sampling(first, second, interval_ms)")
        f, s2, ms = _int(a[0]), _int(a[1]), _int(a[2])
        ffi = (6, 10, 18, 34).index(f) if f in (6, 10, 18, 34) else -1
        sfi = (4, 6, 10, 18).index(s2) if s2 in (4, 6, 10, 18) else -1
        esi = (1, 2, 4, 8, 16, 32, 64, 128).index(ms) if ms in (1, 2, 4, 8, 16, 32, 64, 128) else -1
        if ffi < 0:
            raise ValueError("first must be 6, 10, 18 or 34")
        if sfi < 0:
            raise ValueError("second must be 4, 6, 10 or 18")
        if esi < 0:
            raise ValueError("interval must be 1, 2, 4, 8, 16, 32, 64 or 128 ms")
        _chk(_s_ta_set(self._port, "smp", ffi, sfi, esi, 0, 0))

    def charge(self, *a):
        cfg = self._cfg()
        if not a:
            return (int(cfg[7]), float(cfg[8]))
        if len(a) != 2:
            raise TypeError("charge(current_uA, time_us)")
        cdc, us = _int(a[0]), _flt(a[1])
        cdt = _TA_CDT.index(us) if us in _TA_CDT else -1
        if not 0 <= cdc <= 63:
            raise ValueError("current must be 0..63 uA")
        if cdt < 0:
            raise ValueError("time must be 0, 0.5, 1, 2, 4, 8, 16 or 32 us")
        _chk(_s_ta_set(self._port, "chg", cdc, cdt, 0, 0, 0))

    def autoconfig(self, enable=None, reconfig=None, vdd=None):
        cfg = self._cfg()
        if enable is None:
            return (bool(cfg[9]), bool(cfg[10]), int(cfg[11]), int(cfg[12]), int(cfg[13]))
        usl, tl, lsl = int(cfg[11]), int(cfg[12]), int(cfg[13])
        if vdd is not None:
            v = _flt(vdd)
            if v < 1.71 or v > 3.6:
                raise ValueError("vdd must be 1.71..3.6 V")
            u = min(255.0, (v - 0.7) / v * 256.0)
            usl, tl, lsl = int(u + 0.5), int(u * 0.9 + 0.5), int(u * 0.65 + 0.5)
        en = bool(enable)
        re = en if reconfig is None else bool(reconfig)
        _chk(_s_ta_set(self._port, "auto", int(en), int(re), usl, tl, lsl))

    def out_of_range(self):
        self._get()
        return 0

    def overcurrent(self):
        self._get()
        return False

    def clear_overcurrent(self):
        self._cfg()
        _chk(_s_ta_set(self._port, "clroc", 0, 0, 0, 0, 0))

    def age(self):
        return int(self._get()[1])

    def close(self):
        _s_ta_close(self._port)


_ADC_FSR_MV = (6144, 4096, 2048, 1024, 512, 256)
_ADC_SPS = (8, 16, 32, 64, 128, 250, 475, 860)


class ADC:
    """An ADS1115 on I2C port 1..16: AIN0..3 read the configurator's volts and switches (or a mechanism's sources)."""

    def __init__(self, port, /):
        port = _int(port)
        if not 1 <= port <= 16:
            raise ValueError("port must be 1..16")
        _chk(_s_ad_open(port))
        self._port = port

    def _cfg(self):
        return _chk(_s_ad_cfg(self._port))

    def _input(self, a):
        cfg = self._cfg()
        if a is not _UNSET:
            i = _int(a)
            if not 0 <= i <= 7:
                raise ValueError("input must be 0..7")
            return i
        if cfg[3] >= 0:
            return int(cfg[3])
        for i in range(8):
            if cfg[2] & (1 << i):
                return i
        return 0

    def _get(self, a):
        return _chk(_s_ad_get(self._port, self._input(a)))

    def __repr__(self):
        r = _s_ad_cfg(self._port)
        if type(r) is str:
            return "ADC(%d, closed)" % self._port
        s = "ADC(%d, inputs=0x%02x, range=%d mV, data_rate=%d" % (self._port, r[2], _ADC_FSR_MV[r[0]], _ADC_SPS[r[1]])
        if r[3] >= 0:
            s += ", continuous=%d" % r[3]
        return s + ")"

    def raw(self, input=_UNSET, /):
        return int(self._get(input)[0])

    def voltage(self, input=_UNSET, /):
        return float(self._get(input)[1])

    def read(self, input=_UNSET, /):
        i = self._input(input)
        r = _chk(_s_ad_get(self._port, i))
        return float(_chk(_s_ad_read(self._port, i, r[3])))

    def inputs(self, seq=_UNSET, /):
        cfg = self._cfg()
        if seq is _UNSET:
            return tuple(i for i in range(8) if cfg[2] & (1 << i))
        mask = 0
        # a bool is not an int to the binding (mp_obj_is_int), and mp_obj_get_array refuses it: TypeError (review r1 N5)
        if isinstance(seq, int) and not isinstance(seq, bool):
            v = _int(seq)
            if not 0 <= v <= 7:
                raise ValueError("input must be 0..7")
            mask = 1 << v
        else:
            if not isinstance(seq, (list, tuple)):
                raise TypeError("object '%s' isn't a tuple or list" % type(seq).__name__)
            for x in seq:
                v = _int(x)
                if not 0 <= v <= 7:
                    raise ValueError("input must be 0..7")
                mask |= 1 << v
        if mask == 0:
            raise ValueError("at least one input")
        _chk(_s_ad_set(self._port, "inputs", mask))

    def range(self, volts=_UNSET, /):
        cfg = self._cfg()
        if volts is _UNSET:
            return _ADC_FSR_MV[cfg[0]] / 1000.0
        v = _flt(volts)
        mv = int(v * 1000.0 + 0.5) if v >= 0 else -1
        if mv not in _ADC_FSR_MV:
            raise ValueError("range must be 6.144, 4.096, 2.048, 1.024, 0.512 or 0.256")
        _chk(_s_ad_set(self._port, "fsr", _ADC_FSR_MV.index(mv)))

    def data_rate(self, sps=_UNSET, /):
        cfg = self._cfg()
        if sps is _UNSET:
            return _ADC_SPS[cfg[1]]
        s = _int(sps)
        if s not in _ADC_SPS:
            raise ValueError("data_rate must be 8, 16, 32, 64, 128, 250, 475 or 860")
        _chk(_s_ad_set(self._port, "dr", _ADC_SPS.index(s)))

    def continuous(self, input=_UNSET, /):
        cfg = self._cfg()
        if input is _UNSET:
            return int(cfg[3]) if cfg[3] >= 0 else None
        i = -1
        if input is not None:
            i = _int(input)
            if not 0 <= i <= 7:
                raise ValueError("input must be 0..7")
        _chk(_s_ad_set(self._port, "cont", i))

    def age(self, input=_UNSET, /):
        return int(self._get(input)[2])

    def close(self):
        _s_ad_close(self._port)


# ---------------------------------------------------------------- UART (uart.ts)
# micropython/modules/evn_periph.c l.1091-1558 (the owner, 2026-09-28: "Follow machine uart"): the constructor, init()
# and every method with the binding's arguments, ranges, errors and messages; py/stream.c's read / readinto / readall /
# write / iteration over the binding's read, as the board runs them. The port - rings, FIFOs, the wire's timing in
# simulated time, what carries across Stop / Run - is the simulator's (src/sim/engine/uart.ts, SIMULATOR_SBC_DESIGN.md
# §4.1, §5.6). No link to a process yet (S2): what a program writes goes nowhere and nothing arrives.

_s_ua_open, _s_ua_init, _s_ua_close, _s_ua_fmt, _s_ua_write = _s.ua_open, _s.ua_init, _s.ua_close, _s.ua_fmt, _s.ua_write
_s_ua_read, _s_ua_readline, _s_ua_any, _s_ua_txdone, _s_ua_flush = _s.ua_read, _s.ua_readline, _s.ua_any, _s.ua_txdone, _s.ua_flush
_s_ua_break, _s_ua_flush_rx, _s_ua_overflow, _s_ua_repl = _s.ua_break, _s.ua_flush_rx, _s.ua_overflow, _s.ua_repl

_UART_PINS = ((0, 1), (8, 9))   # Serial1 = uart0 GP0 / GP1, Serial2 = uart1 GP8 / GP9 (hal_uart.c l.12-15)
_UART_BUF = 256                 # py/stream.c DEFAULT_BUFFER_SIZE: read()'s chunk


class _MpErrno(OSError):
    """MicroPython's OSError(n): str `[Errno 110] ETIMEDOUT`, args (n,), named OSError."""

    def __init__(self, n, name):
        super().__init__(n, name)
        self.args = (n,)
        self._name = name

    def __str__(self):
        return "[Errno %d] %s" % (self.errno, self._name)

    def __repr__(self):
        return "OSError(%d,)" % self.errno


_MpErrno.__name__ = _MpErrno.__qualname__ = "OSError"


def _uchk(r):
    if type(r) is str and r == _ERR + "OSError: ETIMEDOUT":
        raise _MpErrno(110, "ETIMEDOUT")   # mp_raise_OSError(MP_ETIMEDOUT): the queued bytes did not leave in time
    return _chk(r)


def _uart_ms(v, err):
    v = _int(v)
    if v < 0:
        raise ValueError(err)
    return v


def _rbuf(buf):
    """mp_get_buffer_raise(.., MP_BUFFER_READ): a str's UTF-8 bytes, any buffer's bytes, else TypeError."""
    if isinstance(buf, str):
        return buf.encode()
    try:
        return bytes(memoryview(buf).cast("B"))
    except TypeError:
        raise TypeError("object with buffer protocol required")


def _uart_parse(f, t, baudrate, bits, parity, stop, timeout, timeout_char, invert, txbuf, rxbuf):
    """uart_parse: into f = [baud, bits, parity (0 none, 1 even, 2 odd), stop, invert] and t = [timeout, timeout_char],
    which hold the current settings; every refusal raises before anything is applied."""
    if baudrate is not _UNSET:
        b = _int(baudrate)
        if b < 300 or b > 3000000:
            raise ValueError("baudrate out of range")
        f[0] = b
    if bits is not _UNSET:
        b = _int(bits)
        if b < 5 or b > 8:
            raise ValueError("bits must be 5, 6, 7 or 8")
        f[1] = b
    if parity is not _UNSET:
        if parity is None:
            f[2] = 0
        else:
            p = _int(parity)
            if p != 0 and p != 1:
                raise ValueError("parity must be None, 0 (even) or 1 (odd)")
            f[2] = 2 if p else 1
    if stop is not _UNSET:
        s = _int(stop)
        if s != 1 and s != 2:
            raise ValueError("stop must be 1 or 2")
        f[3] = s
    if timeout is not _UNSET:
        t[0] = _uart_ms(timeout, "timeout must be >= 0 ms")
    if timeout_char is not _UNSET:
        t[1] = _uart_ms(timeout_char, "timeout_char must be >= 0 ms")
    if invert is not _UNSET:
        i = _int(invert)
        if i & ~3:
            raise ValueError("bad inversion mask")
        f[4] = i
    if txbuf is not _UNSET and _int(txbuf) > 1023:
        raise ValueError("txbuf too large: the transmit ring holds 1023 bytes")
    if rxbuf is not _UNSET and _int(rxbuf) > 255:
        raise ValueError("rxbuf too large: the receive ring holds 255 bytes")
    floor = 13000 // f[0] + 1   # hal_uart_char_ms: one 13-bit character + 1 ms at the (new) baud
    if t[1] < floor:
        t[1] = floor


class UART:
    """A serial header as machine.UART: id 1 = Serial1 (GP0 / GP1), 2 = Serial2 (GP8 / GP9)."""

    INV_TX = 1
    INV_RX = 2

    def __init__(self, id, baudrate=_UNSET, bits=_UNSET, parity=_UNSET, stop=_UNSET, *, timeout=_UNSET,
                 timeout_char=_UNSET, invert=_UNSET, txbuf=_UNSET, rxbuf=_UNSET):
        self._closed = True
        self._id = 0
        n = _int(id)
        if n < 1 or n > 2:
            raise ValueError("uart must be 1 (Serial1) or 2 (Serial2)")
        f = [115200, 8, 0, 1, 0]
        t = [0, 0]
        _uart_parse(f, t, baudrate, bits, parity, stop, timeout, timeout_char, invert, txbuf, rxbuf)
        self._id = n
        self._timeout, self._tchar = t
        _uchk(_s_ua_open(n, f[0], f[1], f[2], f[3], f[4]))
        self._closed = False

    def _live(self):
        if self._closed:
            raise ValueError("UART is closed")

    def _fmt(self):
        return [int(x) for x in _s_ua_fmt(self._id).split(",")]

    def __repr__(self):
        n = self._id
        if self._closed:
            return "UART(%d, closed)" % n
        b, bits, par, st, inv = self._fmt()
        return ("UART(%d, baudrate=%d, bits=%d, parity=%s, stop=%d, tx=%d, rx=%d, txbuf=1023, rxbuf=255, timeout=%d, "
                "timeout_char=%d, invert=%s)" % (n, b, bits, ("None", "0", "1")[par if par <= 2 else 0], st,
                                                 _UART_PINS[n - 1][0], _UART_PINS[n - 1][1], self._timeout, self._tchar,
                                                 ("None", "INV_TX", "INV_RX", "INV_TX|INV_RX")[inv & 3]))

    def init(self, baudrate=_UNSET, bits=_UNSET, parity=_UNSET, stop=_UNSET, *, timeout=_UNSET, timeout_char=_UNSET,
             invert=_UNSET, txbuf=_UNSET, rxbuf=_UNSET):
        self._live()
        f = self._fmt()
        t = [self._timeout, self._tchar]
        _uart_parse(f, t, baudrate, bits, parity, stop, timeout, timeout_char, invert, txbuf, rxbuf)
        _uchk(_s_ua_init(self._id, f[0], f[1], f[2], f[3], f[4]))
        self._timeout, self._tchar = t

    def deinit(self):
        if not self._closed:
            _s_ua_close(self._id)
            self._closed = True

    close = deinit

    def _rw(self, size):
        """mp_stream_rw over the binding's read: a short read calls again (one more `timeout`); None: nothing came."""
        out = b""
        while size > 0:
            r = _s_ua_read(self._id, size, self._timeout, self._tchar)
            if r is None:
                return out if out else None
            r = r.encode("latin-1")
            out += r
            size -= len(r)
        return out

    def _readall(self):
        """py/stream.c stream_readall: 256-byte chunks until a read finds nothing."""
        out = b""
        cur = _UART_BUF
        while True:
            r = _s_ua_read(self._id, cur, self._timeout, self._tchar)
            if r is None:
                return out if out else None
            r = r.encode("latin-1")
            out += r
            cur = cur - len(r) if len(r) < cur else _UART_BUF

    def read(self, nbytes=None, /):
        n = -1
        if nbytes is not None:
            n = _int(nbytes)
            if n < -1:
                raise ValueError("nbytes must not be negative")
        if n == 0:
            return b""      # py/stream.c never calls the stream's read for 0 bytes: no closed check (as the board)
        self._live()
        return self._readall() if n == -1 else self._rw(n)

    def readinto(self, buf, nbytes=_UNSET, /):
        try:
            mv = memoryview(buf)
        except TypeError:
            raise TypeError("object with buffer protocol required")
        if mv.readonly:
            raise TypeError("object with buffer protocol required")
        mv = mv.cast("B")
        ln = mv.nbytes
        if nbytes is not _UNSET:
            k = _int(nbytes)
            ln = ln if k < 0 or k > ln else k   # an mp_uint_t: a negative count is more than the buffer
        if ln == 0:
            return 0        # mp_stream_rw with size 0 never reaches uart_live (as the board)
        self._live()
        r = self._rw(ln)
        if r is None:
            return None
        mv[:len(r)] = r
        return len(r)

    def readline(self, size=None, *, timeout=None):
        self._live()
        mx = -1
        if size is not None:
            mx = _int(size)
            if mx < -1:
                raise ValueError("size must not be negative")
        to = self._timeout if timeout is None else _uart_ms(timeout, "timeout must be >= 0 ms")
        if mx == 0:
            return b""
        r = _s_ua_readline(self._id, mx, to)
        return None if r is None else r.encode("latin-1")

    def write(self, buf, *a):
        if len(a) > 2:
            raise TypeError("function takes at most 4 positional arguments")
        data = _rbuf(buf)
        off, mx = 0, len(data)
        if len(a) == 1:
            mx = _int(a[0])
        elif len(a) == 2:
            off, mx = _int(a[0]), _int(a[1])
        if off < 0 or off > len(data):
            off = len(data)
        data = data[off:] if mx < 0 else data[off:off + mx]
        if not data:
            return 0
        self._live()
        _s_ua_write(self._id, data.decode("latin-1"))
        return len(data)

    def any(self):
        self._live()
        return int(_s_ua_any(self._id))

    def txdone(self):
        self._live()
        return bool(_s_ua_txdone(self._id))

    def flush(self):
        self._live()
        if not _s_ua_flush(self._id):
            raise _MpErrno(110, "ETIMEDOUT")

    def sendbreak(self):
        self._live()
        _uchk(_s_ua_break(self._id))

    def flush_rx(self):
        self._live()
        _s_ua_flush_rx(self._id)

    def overflow(self):
        self._live()
        return int(_s_ua_overflow(self._id))

    def repl(self, enable=_UNSET, /):
        self._live()
        if enable is _UNSET:
            return bool(_s_ua_repl(self._id))
        _s_ua_repl(self._id, 1 if enable else 0)

    def __iter__(self):
        return self

    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line
