"""_evnboot - how the simulated board runs a program (docs/SIMULATOR.md). Not for programs.

The simulator's interpreter is CPython (Pyodide) rather than MicroPython: MicroPython's WebAssembly port cannot collect
garbage while a program runs, so a robot loop would run out of memory within minutes. What a program for the board
sees is made to look like the board's MicroPython (micropython/port/mpconfigport.h, MicroPython v1.26.1):
  - `time` / `utime`: the board's names only (sleep, sleep_ms, sleep_us, ticks_ms / us / cpu, ticks_add, ticks_diff;
    the board is built without time() / time_ns() / localtime() / gmtime() / mktime()), on the simulated clock;
  - `errno` / `uerrno`: MicroPython's names and numbers, and a file error carries them (ENOENT 2, not WebAssembly's 44);
  - open() and the os module's writes refuse with OSError EBUSY (16) while a motor drives, as the board's flash does;
  - `sys.print_exception`, and help() with the board's text (micropython/port/help.c);
  - `micropython` (const, native, viper, opt_level, mem_info), `gc.mem_free()` / `gc.mem_alloc()`,
    and the u-names (ujson, ustruct, ...);
  - a program is a paste at the raw REPL: compiled as "<stdin>", run in a fresh __main__ after a soft reset, and its
    traceback printed the way MicroPython prints one: the program's frames only (the extension makes
    `File "<stdin>", line N` clickable).
The program's view (time, errno, the file errors) is given to the program's own code - <stdin> and the board's files -
only: the standard library's modules keep CPython's, which they are written against.
"""
import sys
import types
import builtins
import os as _os
import errno as _cerrno

import _evnsim
import gc as _gc
import weakref as _weakref

_real_time = sys.modules.get("time") or __import__("time")


def _is_program(g):
    """the importing / calling code is the program's: <stdin> (its __main__) or a file on the board"""
    if not g:
        return False
    return g.get("__name__") == "__main__" or str(g.get("__file__") or "").startswith("/flash/")


def _caller_is_program(depth=2):
    try:
        fn = sys._getframe(depth).f_code.co_filename
    except ValueError:
        return False
    return fn == "<stdin>" or fn.startswith("/flash/")


# ---------------------------------------------------------------- time, on the simulated clock

def _sim_time(t):
    t.sleep = _evnsim.sleep
    t.sleep_ms = _evnsim.sleep_ms
    t.sleep_us = _evnsim.sleep_us
    t.ticks_ms = _evnsim.ticks_ms
    t.ticks_us = _evnsim.ticks_us
    t.ticks_cpu = _evnsim.ticks_cpu
    t.ticks_add = _evnsim.ticks_add
    t.ticks_diff = _evnsim.ticks_diff


# the program's: the board's time module (extmod/modtime.c with TIME_TIME_TIME_NS 0, GMTIME_LOCALTIME_MKTIME 0)
_t = types.ModuleType("time")
_sim_time(_t)

# the standard library's: CPython's, its sleep and clocks on the simulated clock too
_lib_t = types.ModuleType("time")
for _k in dir(_real_time):
    if not _k.startswith("__"):
        setattr(_lib_t, _k, getattr(_real_time, _k))
_sim_time(_lib_t)
_lib_t.time = _evnsim.time
_lib_t.time_ns = _evnsim.time_ns
# the runtime's functions bound once (ledger HT-56): _evnsim is built once per interpreter, before this module
_ticks_us = _evnsim.ticks_us
_lib_t.monotonic = lambda: _ticks_us() / 1e6
_lib_t.monotonic_ns = lambda: _ticks_us() * 1000
_lib_t.perf_counter = _lib_t.monotonic
_lib_t.perf_counter_ns = _lib_t.monotonic_ns
sys.modules["time"] = _lib_t
sys.modules["utime"] = _t

# ---------------------------------------------------------------- errno, MicroPython's numbers

# py/mperrno.h: the numbers a MicroPython OSError carries; py/moderrno.c: the names its errno module has
_MP_ERRNO = {
    "EPERM": 1, "ENOENT": 2, "ESRCH": 3, "EINTR": 4, "EIO": 5, "ENXIO": 6, "E2BIG": 7, "ENOEXEC": 8, "EBADF": 9,
    "ECHILD": 10, "EAGAIN": 11, "ENOMEM": 12, "EACCES": 13, "EFAULT": 14, "ENOTBLK": 15, "EBUSY": 16, "EEXIST": 17,
    "EXDEV": 18, "ENODEV": 19, "ENOTDIR": 20, "EISDIR": 21, "EINVAL": 22, "ENFILE": 23, "EMFILE": 24, "ENOTTY": 25,
    "ETXTBSY": 26, "EFBIG": 27, "ENOSPC": 28, "ESPIPE": 29, "EROFS": 30, "EMLINK": 31, "EPIPE": 32, "EDOM": 33,
    "ERANGE": 34, "ENOTEMPTY": 39, "EOPNOTSUPP": 95, "EAFNOSUPPORT": 97, "EADDRINUSE": 98, "ECONNABORTED": 103,
    "ECONNRESET": 104, "ENOBUFS": 105, "EISCONN": 106, "ENOTCONN": 107, "ETIMEDOUT": 110, "ECONNREFUSED": 111,
    "EHOSTUNREACH": 113, "EALREADY": 114, "EINPROGRESS": 115, "ECANCELED": 125,
}
_MP_NAME = {v: k for k, v in _MP_ERRNO.items()}
_TO_MP = {getattr(_cerrno, k): v for k, v in _MP_ERRNO.items() if hasattr(_cerrno, k)}

_err = types.ModuleType("errno")
for _k in ("EPERM", "ENOENT", "EIO", "EBADF", "EAGAIN", "ENOMEM", "EACCES", "EEXIST", "ENODEV", "EISDIR", "EINVAL",
           "EOPNOTSUPP", "EADDRINUSE", "ECONNABORTED", "ECONNRESET", "ENOBUFS", "ENOTCONN", "ETIMEDOUT",
           "ECONNREFUSED", "EHOSTUNREACH", "EALREADY", "EINPROGRESS"):
    setattr(_err, _k, _MP_ERRNO[_k])
_err.errorcode = {_MP_ERRNO[k]: k for k in dir(_err) if k.startswith("E")}


class _MpOSError(OSError):
    """OSError as MicroPython raises it (py/objexcept.c): args (n,), str `[Errno 2] ENOENT` for a name of its errno
    module, else the bare number (`OSError: 16`), repr `OSError(2,)`, and its type is named OSError (MicroPython has
    no FileNotFoundError, PermissionError, ...). Not CPython's OSError(n, ...), which picks a subclass by WebAssembly's
    numbers (2 is EACCES there: a PermissionError)."""

    def __init__(self, n):
        super().__init__(n, _MP_NAME.get(n, ""))
        self.args = (n,)

    def __str__(self):
        name = _err.errorcode.get(self.errno)
        return "[Errno %d] %s" % (self.errno, name) if name else str(self.errno)

    def __repr__(self):
        return "OSError(%d,)" % self.errno


_MpOSError.__name__ = _MpOSError.__qualname__ = "OSError"


def _mp_oserror(n):
    return _MpOSError(n)


def _translate(e):
    n = _TO_MP.get(e.errno, e.errno) if isinstance(e.errno, int) else e.errno
    return _mp_oserror(n) if isinstance(n, int) else e


# ---------------------------------------------------------------- the board's flash: no write while a motor drives

def _driving():
    """A motor drives: the board's any_axis_driving over its four axes (hal/hal_tuning_log.c:87-113), whoever
    commanded them - a program's Motor or DriveBase, or the Board view's motor buttons with no program - as the
    runtime's axes are now (_evnsim.m_driving). So every coast ends it: a Ctrl-C, stop_all(), the soft reset, the
    extension's coast after a run (the s1023 simapi review r3 S2, simint review r1 N2)."""
    f = _m_driving
    return bool(f) and any(f(p) for p in range(1, 5))


_m_driving = getattr(_evnsim, "m_driving", None)


def _refuse_if_driving():
    if _driving():
        raise _mp_oserror(16)


_real_open = builtins.open


_INLINE_MAX = 512       # LittleFS keeps a file this small inline in its directory; past it a write erases a block
_open_files = _weakref.WeakSet()     # the program's files open for writing (the soft reset closes them)


def _read_bytes(path):
    try:
        with _real_open(path, "rb") as f:
            return f.read()
    except OSError:
        return None


def _put_bytes(path, data):
    try:
        if data is None:
            _os.unlink(path)
        else:
            with _real_open(path, "wb") as f:
                f.write(data)
    except OSError:
        pass


class _BoardFile:
    """A file the program opened for writing, under LittleFS's rules (lfs2.c, extmod/vfs_lfsx_file.c) while a motor
    drives (OSError 16, EBUSY):
      - a create commits the new entry at open() (refused there, _open);
      - a write waits in the cache while the file stays inline (512 bytes); a write() that takes it past that (or
        any write to a file already past it) erases a block, and is refused at write();
      - flush() commits (a sync), and is refused;
      - close() commits and closes: refused, it still closes, and what was not committed is dropped.
    What was committed is the file as it was at open() (its old content for "w" on an existing file) or at the last
    flush() / close() that went through; a refusal puts it back."""

    def __init__(self, f, path, mode, committed):
        self._f = f
        _open_files.add(self)
        self._path = path
        self._committed = committed         # the bytes the flash holds for it (None: it is not on the flash)
        self._size = 0 if "w" in mode or committed is None else len(committed)

    def __getattr__(self, name):
        return getattr(self._f, name)

    def __iter__(self):
        return iter(self._f)

    def __next__(self):
        return next(self._f)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    def write(self, data):
        n = len(data.encode("utf-8")) if isinstance(data, str) else len(data)
        if self._size + n > _INLINE_MAX:
            _refuse_if_driving()
        r = self._f.write(data)
        self._size += n
        return r

    def _commit(self):
        try:
            self._f.flush()
        except OSError as e:
            raise _translate(e) from None
        self._committed = _read_bytes(self._path)

    def flush(self):
        if self._f.closed:
            return self._f.flush()          # ValueError, as CPython says it
        _refuse_if_driving()
        self._commit()

    def close(self):
        if self._f.closed:
            return
        refused = _driving()
        if not refused:
            try:
                self._f.close()
            except OSError as e:
                raise _translate(e) from None
            return
        # closed either way; what was not committed is dropped
        try:
            self._f.close()
        except OSError:
            pass
        _put_bytes(self._path, self._committed)
        raise _mp_oserror(16)


def _open(file, mode="r", *a, **k):
    if not _caller_is_program():
        return _real_open(file, mode, *a, **k)
    writes = any(c in str(mode) for c in "wax+")
    if not writes:
        try:
            return _real_open(file, mode, *a, **k)
        except OSError as e:
            raise _translate(e) from None
    path = _os.path.abspath(file) if isinstance(file, (str, bytes)) else None
    committed = _read_bytes(path) if path is not None and _os.path.isfile(path) else None
    if committed is None:
        _refuse_if_driving()            # a create commits the new file's entry at once
    try:
        f = _real_open(file, mode, *a, **k)
    except OSError as e:
        raise _translate(e) from None
    if path is None:
        return f
    if committed is None:
        committed = b""                 # created: an empty file is on the flash
    return _BoardFile(f, path, str(mode), committed)


builtins.open = _open


def _os_call(name, writes):
    real = getattr(_os, name)

    def call(*a, **k):
        if not _caller_is_program():
            return real(*a, **k)
        if writes:
            _refuse_if_driving()
        try:
            return real(*a, **k)
        except OSError as e:
            raise _translate(e) from None
    call.__name__ = name
    return call


for _n, _w in (("remove", True), ("unlink", True), ("rename", True), ("mkdir", True), ("rmdir", True),
               ("listdir", False), ("stat", False), ("chdir", False), ("statvfs", False), ("getcwd", False)):
    if hasattr(_os, _n):
        setattr(_os, _n, _os_call(_n, _w))

# ---------------------------------------------------------------- the micropython module and the u-names

_mp = types.ModuleType("micropython")
_mp.const = lambda x: x
_mp.native = _mp.viper = lambda f: f
_mp.opt_level = lambda *a: 0
_mp.mem_info = lambda *a: print("stack: 0 out of 7936\nGC: total: 192000, used: 48000, free: 144000")
_mp.qstr_info = lambda *a: None
_mp.alloc_emergency_exception_buf = lambda n: None
_mp.schedule = lambda f, arg: f(arg)
_mp.heap_lock = _mp.heap_unlock = lambda: 0
sys.modules["micropython"] = _mp
builtins.const = _mp.const

_gc.mem_free = lambda: 144000
_gc.mem_alloc = lambda: 48000
_gc.threshold = lambda *a: -1

for _u, _n in (("ujson", "json"), ("ustruct", "struct"), ("ucollections", "collections"), ("urandom", "random"),
               ("ure", "re"), ("uos", "os"), ("usys", "sys"), ("ubinascii", "binascii"),
               ("uio", "io"), ("uselect", "select"), ("uheapq", "heapq"), ("uarray", "array"), ("umath", "math")):
    try:
        sys.modules[_u] = __import__(_n)
    except ImportError:
        pass
sys.modules["uerrno"] = _err

# ---------------------------------------------------------------- sys.print_exception, help()


def _print_exception(exc, file=None, /):
    """sys.print_exception(exc, file=sys.stdout): the traceback as MicroPython prints it"""
    (file or sys.stdout).write(format_exception(exc))


sys.print_exception = _print_exception

# the board's help() text: micropython/port/help.c's evn_help_text (scripts/test_simulator.js checks it is the same)
_HELP = (
    'Welcome to MicroPython on the EVN ALPHA!\n'
    '\n'
    'Core 1 runs the 1 kHz motion engine; this REPL runs on Core 0.\n'
    'The motor API follows Pybricks (docs.pybricks.com, pupdevices/motor):\n'
    '\n'
    '  from evn import Motor, Port, Stop, Direction, wait, StopWatch\n'
    '  m = Motor(1)                      # EVN ports 1..4; Motor(1) again takes the port over (m then raises)\n'
    '  m.run_angle(500, 360)             # deg/s, deg; blocks until done\n'
    '  m.run_target(500, 0, then=Stop.COAST, wait=False)\n'
    '  m.run(300); m.stop()              # forever / coast\n'
    '  m.angle(), m.speed(), m.load(), m.stalled(), m.done()\n'
    '  m.control.limits(), m.control.pid(), m.control.target_tolerances()\n'
    '  m.settings(max_voltage=7000, stall_timeout=1000), m.model.state(), m.close()\n'
    '  wait(500); sw = StopWatch(); sw.time()   # ms\n'
    '  Motor(2, speed_unit=SpeedUnit.PERCENT)   # speeds in % of full_speed()\n'
    '  m.calibrate(); m.full_speed()            # self-calibration (about 12 s, shaft free; stored) / what 100 % is\n'
    '  m.calibrate(wait=False) ... m.calibrate() # start several ports, then join each (finished: its result at once)\n'
    "  evn.configure_motor(3, 'EV3 Medium')      # what is on the port, stored on the board: 'EV3 Large' / 'EV3 Medium' / 'NXT' / 'jga25' / 'pololu25d_9_7' / 'chr16_63' / 'cm22_49' / 'custom'\n"
    "  evn.configure_motor(2, 'jga25')           # a library motor: the JGA25-370 6V 77RPM (3432 counts, 6 V cap)\n"
    "  evn.configure_motor(1, 'pololu25d_9_7')   # a library motor: the Pololu 25D 9.7:1 HP 12V (464.64 counts)\n"
    "  evn.configure_motor(3, 'chr16_63')        # a library motor: the CHR-GM16-030PA 9V 1:63 (1764 counts, 9 V cap)\n"
    "  evn.configure_motor(2, 'cm22_49')         # a library motor: the CM22-2230 12V 1:49 (3136 counts, 12 V cap)\n"
    "  evn.configure_motor(3, 'custom', counts_per_rev=1400, rated_voltage=6000, no_load_speed=500)\n"
    "  evn.calibration(2)['encoder_reversed']    # calibrate() finds which way a motor's encoder counts\n"
    '  # an encoder counting against its drive runs away: coasted in ~0.25 s, RuntimeError -> calibrate()\n'
    "  evn.calibration(1)['cogging_edges']       # and whether its rotor cogs: the detent period, edges\n"
    '  evn.motor_config(3), evn.calibration(3), evn.clear_calibration(3), evn.clock()\n'
    "  m.control.law()                          # 'adrc' (default) | 'pid'\n"
    '\n'
    'Drive base (Pybricks robotics.DriveBase; mm, mm/s, deg, deg/s, clockwise +):\n'
    '  db = DriveBase(Motor(4, Direction.COUNTERCLOCKWISE), Motor(3), 62.4, 170, imu=3)\n'
    '                      # imu= / compass=: the base builds its own Pose from its geometry\n'
    '  db.straight(300); db.turn(45); db.curve(150, -90)   # then=Stop.HOLD, wait=True\n'
    '  db.drive(200, 30); db.stop()             # forever: speed, turn rate / coast\n'
    '  db.brake(); db.hold()                    # passive brake / stop and hold the place\n'
    '  pc = DriveBase(l, r, 62.4, 170, speed_unit=SpeedUnit.PERCENT); pc.drive(50, 25)\n'
    '                      # % speed, % steering (LEGO move steering: 50 pivots, 100 spins)\n'
    '  db.distance(), db.angle(), db.state(), db.reset(), db.done(), db.stalled()\n'
    '  db.settings(straight_speed=300, turn_rate=150)       # + the accelerations\n'
    "  db.use_gyro(True)   # close the loop over the base's pose (db.pose): the robot\n"
    '                      # follows the path, not just the wheels; follower(), pose_error()\n'
    "  db.pose.position(), db.pose.heading()   # the base's Pose (None without imu= / compass= / pose=)\n"
    '  a new button run starts a kept base at distance / angle 0 and its Pose at\n'
    '  0, 0, 0 (as its reset()), their settings kept; a Motor built with\n'
    '  reset_angle=True (the default) at angle() 0\n'
    '\n'
    'Pose (the planar pose estimator: any subset of two wheel encoders, an IMU, a compass;\n'
    'mm, deg clockwise from north, mm/s, deg/s; x right, y forward at reset()):\n'
    '  pose = Pose(left=4, right=3, wheel_diameter=62.4, axle_track=170, reverse_left=True,\n'
    '              imu=14, compass=None, declination=0)       # every keyword optional\n'
    '  pose.position() -> (x, y); pose.heading(); pose.velocity() -> (mm/s, deg/s)\n'
    '  pose.state() -> (x, y, heading, speed, yaw_rate); pose.covariance(); pose.bounded()\n'
    '  pose.reset(x=0, y=0, heading=0)   # re-frame only: a use_gyro base re-anchors, nothing moves;\n'
    '                                    # a compass keeps the new frame and corrects the drift in it\n'
    '                                    # (it holds off a disagreement the gyro cannot have made)\n'
    "  pose.sources() / configured()     # 'wheels', 'imu', 'compass' (compass absent while its\n"
    '                                    # field is rejected, its frame is measured, or it disagrees)\n'
    '  pose.settings(wheel_diameter=, axle_track=); pose.parameters(); pose.close()\n'
    '    # settings(): a Pose without a base; with a base rebuild the DriveBase (axle_track=)\n'
    '  with Pose(...) as pose:   # one Pose per robot; the with-block closes it on exit\n'
    '  (the standalone form, for a robot without a base or pushed by hand)\n'
    '  Pose(...) again on the same sources takes the running one over (the older raises)\n'
    '  A base adopts a running Pose at use_gyro(True) after checking ports, direction, gears\n'
    '  and geometry, and holds it (or pass it: DriveBase(..., pose=pose)).\n'
    '  It runs on the motor core: Pose(...), reset() and settings() raise OSError EIO when the\n'
    '  motor core does not answer (it stopped on a fault: evn.reset()).\n'
    '\n'
    'Controllers for your own loops (computed in C; nothing moves until you send the output):\n'
    '  pid = PID(1.5, 0.2, 0.08, limits=120)   # kp, ki /s, kd s; filter=20 ms, integral_limit=, dt_max=200 ms\n'
    '  turn = pid.update(target, measured)     # dt measured between calls, or dt=ms\n'
    '  pid.p, pid.i, pid.d, pid.output, pid.saturated; pid.reset(); pid.settings(kp=2)\n'
    '  hold = ADRC(b0=1, wc=6, limits=180)     # order=1 | 2, wo=4 wc (rad/s): an observer cancels the load\n'
    '  db.drive(0, hold.update(0, imu.heading())); hold.disturbance, hold.estimate, hold.rate\n'
    '  a loop slower than dt_max raises ValueError on its second slow update: set dt_max\n'
    '\n'
    'DataLog (recorded on the board: each source at the rate it makes new readings, kept in RAM;\n'
    'a full channel keeps every second sample and halves its rate, so it never stops;\n'
    'a run of identical samples is two rows, its first and its last; log() rows always kept):\n'
    "  log = DataLog('x', 'y', name='run1', size=32768)  # headers = the columns of log()\n"
    "  log.add(Motor(1), 'angle')        # 0 = every new reading (up to 1000/s)\n"
    "  log.add(imu, 'heading', 50)       # 50 a second; DataLog.quantities(imu) lists the names\n"
    '  log.start(); log.log(x, y); log.stop(); log.info()\n'
    '  log.save()   # /data/run1_<date>_<time>.csv once the motors coast (OSError EBUSY while one drives or the motor core does not answer)\n'
    "  autosave=True (default): saved when main.py / the editor's Run ends, at a soft reboot or a with\n"
    "  block's end; close() frees it\n"
    '\n'
    'EVN Standard Peripherals, all bench-validated (I2C ports 1..16, SDA/SCL only;\n'
    'every constructor raises OSError when nothing answers on the port):\n'
    '  ColorSensor(p)     color() color_match() detectable_colors() hsv() rgb() raw() read() percent() normalized()\n'
    '                     ranges(clear=(lo,hi),...) ambient() lux() color_temperature() gain(16)\n'
    '                     integration_time(2.4) wait_time() thresholds(lo,hi,1) interrupt() id() age() close()\n'
    '                     calibrate_black() calibrate_white() black_reference() white_reference()\n'
    '                     stored_calibration() clear_calibration(): calibrate_* STORED for the port;\n'
    '                     black (nothing in front) then white (a white sheet), once; evn.color_calibration(p)\n'
    '                     ranges() = the same calibration in counts, RAM only (never stored)\n'
    "                     exposure() auto_exposure('shutter', 70) calibrate_white(auto='shutter'):\n"
    '                     meters the white first (never clips), stores the gain with it; store_exposure()\n'
    '                     calibrate_gains() (a black card); gain() / integration_time() are RAM only\n'
    '  ADC(p)             voltage(i) raw(i) read(i) inputs((0,1)) range(4.096) data_rate(860)\n'
    '                     continuous(0) age(i) close()\n'
    '  EnvSensor(p)       temperature() pressure() humidity() all() read() raw() oversampling(pressure=16)\n'
    '                     filter(16) standby(0.5) forced(100) measurement_time() age() close()\n'
    '  Compass(p)         heading() heading_confidence() field_strength() read() north() field() raw()\n'
    "                     axes(top='z') data_rate() range()\n"
    '                     oversampling() bias() self_test() overflow() overrun() chip() temperature()\n'
    '                     calibrate() calibrate_progress() calibrate_directions() calibrate_stop() calibrate_cancel()\n'
    '                     calibration() stored_calibration() clear_calibration() age() close()\n'
    '                     calibrate_stop() stores the fit for the port; Compass(p) installs it\n'
    '  TouchArray(p)      touched() read(n) pressed() proximity() events() data(n) thresholds(12, 6)\n'
    '                     debounce(2,2) electrodes(12, proximity=3) sampling() charge() autoconfig()\n'
    '                     out_of_range() overcurrent() clear_overcurrent() age() close()\n'
    '  GestureSensor(p)   gesture() read_gesture(timeout=5000) gesture_detail() proximity() raw() rgb()\n'
    '                     hsv() color() color_match() detectable_colors() ambient() engines(gesture=False) gain()\n'
    '                     integration_time() led() pulses() gesture_config() thresholds() status()\n'
    '                     clear_interrupts() offsets() photodiodes() wait_time() id() age() close()\n'
    '                     calibrate_black() calibrate_white() black_reference() white_reference()\n'
    "                     stored_calibration() clear_calibration(): stored for the port, as ColorSensor's;\n"
    '                     engines(gesture=False) first; LED is IR: black = sensor covered, white = sheet\n'
    "                     in room light; one colour calibration per port (replaces ColorSensor's)\n"
    "                     exposure() auto_exposure('gain') calibrate_white(auto=) store_exposure()\n"
    "                     calibrate_gains(), as ColorSensor's\n"
    '  DistanceSensor(p)  distance() read() raw() status() timing_budget(33) signal_rate_limit()\n'
    "                     vcsel_periods() inter_measurement() profile('long_range') age() close()\n"
    '  IMU(p)             heading() reset_heading() tilt() up() stationary() ready() settings()\n'
    '                     quaternion() euler() acceleration() linear_acceleration() gravity()\n'
    '                     angular_velocity() raw() read() temperature() tap() screen_orientation()\n'
    '                     calibrate() calibration() clear_calibration() calibrate_gyro() ranges()\n'
    '                     filter() sample_rate() dmp(False) axes() age() close()\n'
    '                     IMU(p, calibrate=True) stores a new calibration; IMU(p) applies the stored one\n'
    '                     IMU(p) again takes the running IMU over (heading, bias kept; the older raises)\n'
    '                     a new button run keeps it and its settings too, but at heading 0\n'
    '                     starts from the side it lies on (upright or upside down); keep still until\n'
    '                     ready() - about 1 s calibrated; not: up to 8-25 s (the tilt a second or two\n'
    '                     after), or at once with a small gyro bias, heading() drifting at it until\n'
    '                     the DMP learns it; until the tilt settles heading() follows the gyro alone\n'
    "                     heading_confidence(): 0 not ready, 0.5 ready but the DMP's own gyro\n"
    '                     calibration (8-25 s still) not landed - heading() may still creep - 1 landed\n'
    '                     calibrate(pose=1), turn the robot half a turn, calibrate(pose=2): slope left out\n'
    '                     find_front(): after calibrate(), tip it nose-down 20-45 deg, hold 2 s: front set\n'
    '                     cancel_calibration()\n'
    '  MatrixLED(p)       pixel(row,col) get() hline() vline() rect() bitmap() image() icon(Icon.HEART)\n'
    "                     char('A') number(-99..99) text('HI', on=500, off=50) animate([...], 500)\n"
    '                     animating() stop() orientation(Side.LEFT) brightness(1..16) blink(1) on() off()\n'
    '                     clear() fill() show() raw() keys() close()\n'
    "  SevenSegmentLED(p) number(12.3) integer(-999..9999) text('HELP') digit(pos,n) char(pos,'A')\n"
    '                     point(pos) colon() segments(pos,mask) clear_position(pos) + the shared\n'
    '                     brightness/blink/on/off/clear/fill/show/raw/keys/close\n'
    "  Display(p)         write(0,'hi') label()/data() text(col,row,s,invert=False) print('x',1) clear()\n"
    '                     clear_row() pixel() line() rect() draw_pixel/draw_line/draw_box/draw_circle/\n'
    '                     draw_text width height frame() splash() show() contrast() flip() invert()\n'
    '                     on() off() scroll() scroll_stop() fade() zoom() all_on() command() mirror(True)\n'
    "                     set_font('small') (draw_text's 4x6 font) ports(True) (the 16 I2C ports, live)\n"
    '                     close()\n'
    '  RGBLED(servo)      set(led,r,g,b) fill() range() clear() get() on(Color.RED) off()\n'
    '                     blink(Color.BLUE,[500,500]) animate([...],250) pattern() stop() brightness()\n'
    '                     count() invert() show() hsv(h,s,v) close()\n'
    "  Bluetooth(serial)  write(b'hi') read(n, timeout=0) readline(timeout=5000) read_all() any()/waiting()\n"
    "                     overflow() clear() wait_until(b'OK') set_baudrate() state() ready() repl(True)\n"
    "                     configured() config_errors() in_command_mode() command('AT+..') address()\n"
    '                     version() exit_command_mode() factory_reset() startup_time() close()\n'
    '  Servo(n)           the Geekservo 270 profile by default: angle() move(270, 200) done() pulse()\n'
    '                     profile() set_range() enable() disable() stop() close()\n'
    "                     Servo(n,'geekservo_360').angle(360)  Servo(n,'geekservo_cr').duty(50)\n"
    '                     Servo(n) again takes the port over (the older object then raises)\n'
    '\n'
    'EVN Extended Peripherals (supported like the above, not stocked by EVN; identified by ID, cached):\n'
    '  HiTechnicColorSensor(p) version() firmware() calibrate_black() calibrate_white() black_reference()\n'
    '                     white_reference() stored_calibration() clear_calibration(): calibrate_* STORED\n'
    '                     for the port (evn.color_calibration(p)); color() color_match() detectable_colors()\n'
    '                     color_number() color_index() rgb() normalized_rgb() hsv() reflection() ambient()\n'
    '                     ambient_raw() raw() mains(50) exposure() age() close()   (DataLog takes it)\n'
    '  HiTechnicCompass(p) heading() north() calibrate() calibrate_stop() calibrating() firmware()\n'
    '                     age() close()   (DataLog takes it; heading checked against the word at 0x44)\n'
    '  HuskyLens(p)       algorithm(HuskyLens.OBJECT_TRACKING) blocks(id) arrows(id) count() learned()\n'
    '                     frame() learn(1) forget() age() close()\n'
    "  VL53L1X(p)         distance() status() raw() distance_mode('long') timing_budget(33) age() close()\n"
    '                     inter_measurement(100) roi(8, 8) signal_threshold(1024) sigma_threshold(90)\n'
    "                     distance_threshold('below', 200) detected()\n"
    '                     calibrate_offset(140) offset() calibrate_crosstalk(300) crosstalk()\n'
    '                     stored_calibration() clear_calibration(); evn.vl53l1x_calibration(p)\n'
    '  TCS3430(p)         calibrate_white() calibrate_black() white_reference() black_reference()\n'
    '                     stored_calibration() clear_calibration(): calibrate_* STORED for the port\n'
    '                     color() color_match() detectable_colors() hsv() xyz() raw() ir() ir2() xy()\n'
    '                     saturated() gain(64) integration_time(2.78) wait_time(0) autozero(127)\n'
    '                     exposure() auto_exposure() calibrate_white(auto=) store_exposure() calibrate_gains()\n'
    '                     thresholds(lo,hi,1) interrupt() clear_interrupt() age() close()\n'
    '\n'
    'Other objects in evn: battery, button, led, Flash, Color, Side, Icon,\n'
    "  I2C(p, freq=400000): scan() probe() freq() stats() and machine.I2C's transfers (a stock\n"
    '                     MicroPython driver runs on it): readfrom() readfrom_into() writeto()\n'
    '                     writevto() (stop=False holds a write for the next call) readfrom_mem()\n'
    '                     readfrom_mem_into() writeto_mem() (addrsize=8/16/24/32);\n'
    '                     timeout=50000 us per call (a chip that stretches the clock)\n'
    '  UART(n, 115200, bits=8, parity=None, stop=1, *, timeout=0, timeout_char=0, invert=0)\n'
    '    as machine.UART: write() read() readinto() readline() any() flush() txdone() sendbreak()\n'
    "    init() deinit(); EVN's overflow() flush_rx() repl(); readline() keeps its b'\\n'\n"
    '  core1_status(), stop_all(), reset_cause(), bootloader(), reset(start=False),\n'
    '  set_stop_button(None): the user button is an input, not the stop, until the program ends\n'
    '  autostart(on): main.py waits for a user-button press; evn.autostart(True)\n'
    '  in boot.py starts it at power-on. It runs again at the next press once it ends.\n'
    '\n'
    'battery.voltage() cells() age() present()   # mV\n'
    'battery.low(threshold=6600): the last second below 6.6 V, or the weaker cell below\n'
    '  half of it (the cell usually first); latched until 150 mV above. About 30 min\n'
    '  of driving before the pack cuts the board.\n'
    '\n'
    'Files: an 11 MB LittleFS filesystem is mounted at / (os, open, import).\n'
    '  main.py starts at the user button (after power-on and Ctrl-D), never in\n'
    '  raw-REPL (mpremote) sessions; hold the button while the board boots to skip it.\n'
    '  While it waits, Enter (or Ctrl-A..E) gives the REPL; other bytes, and text\n'
    '  typed before Enter, are dropped.\n'
    '  mpremote connect COM7 cp prog.py :main.py    mpremote connect COM7 ls\n'
    '  A file write while a motor DRIVES (run/dc, an unfinished move, a moving\n'
    '  track) raises OSError [Errno 16] EBUSY - holding, braked or coasting motors\n'
    '  do not block it. A refused close() keeps its data till motors stop;\n'
    '  an unclosed file may lose it. Write logs after a move, or retry.\n'
    '\n'
    'Ctrl-C coasts every motor and interrupts the running program.\n'
    "Ctrl-D soft-reboots the VM (motors coast). help('modules') lists modules.\n"
    'Full reference: docs/MICROPYTHON_API.md in the firmware repository.\n'
)


_MODULES_TEXT = (
    "The simulated board: evn, time / utime, errno / uerrno, micropython, gc, sys, os, json, struct, math, random,\n"
    "re, collections, binascii, array, heapq, io (and their u-names). On the EVN ALPHA, help('modules') lists the\n"
    "firmware's own built-in modules; the simulator's Python is CPython, whose standard library has more.\n"
)


def _help(*a):
    """help(): the board's text; help(obj): MicroPython's object listing (py/builtinhelp.c)"""
    if not a:
        print(_HELP, end="")
        return
    obj = a[0]
    if obj == "modules":
        print(_MODULES_TEXT, end="")
        return
    print("object %s is of type %s" % (obj, type(obj).__name__))
    for name in sorted(dir(obj)):
        if not name.startswith("__"):
            try:
                print("  %s -- %s" % (name, getattr(obj, name)))
            except Exception:
                pass


builtins.help = _help


def _no_pybricks(name, *a, **k):
    raise ImportError("no module named '%s': the EVN ALPHA has no pybricks; evn provides wait, StopWatch" % name)


_real_import = builtins.__import__
_PROGRAM_MODULES = {"time": _t, "utime": _t, "errno": _err, "uerrno": _err}


def _import(name, globals=None, locals=None, fromlist=(), level=0):
    if name == "pybricks" or name.startswith("pybricks."):
        _no_pybricks(name)
    if name == "machine":
        raise ImportError("no module named 'machine': the simulator has the evn module only")
    if level == 0 and name in _PROGRAM_MODULES and _is_program(globals):
        mod = _PROGRAM_MODULES[name]
        for f in fromlist or ():
            if f != "*" and not hasattr(mod, f):
                raise ImportError("can't import name %s" % f)
        return mod
    return _real_import(name, globals, locals, fromlist, level)


builtins.__import__ = _import

# ---------------------------------------------------------------- running a program

# a print reaches the terminal as it happens, as the board's does (the end of each line at the latest)
try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

_main = {}
_user_modules = set()


def reset():
    """A soft reset: a fresh __main__, and the board's modules (evn, files from the board) imported anew."""
    global _main
    # the board's gc_sweep_all closes every file the old program left open (LittleFS commits it; the motors coast
    # first): closed here, not left to CPython's collector, which loses a buffered write when the file was in a
    # reference cycle (a def or a class in the program) - its finalisers run in no set order
    for f in list(_open_files):
        try:
            f.close()
        except BaseException:       # noqa: B036 - nothing of the old program's may stop the reset (a KeyboardInterrupt)
            pass
    _main = {"__name__": "__main__", "__builtins__": builtins}
    try:
        _os.chdir("/flash")             # the program's working folder is the flash again (an os.chdir() is undone)
    except OSError:
        pass
    for name in list(sys.modules):
        m = sys.modules[name]
        f = getattr(m, "__file__", "") or ""
        if name == "evn" or f.startswith("/flash/") or name in _user_modules:
            del sys.modules[name]
    _user_modules.clear()


def _frame_lines(tb):
    # the program's frames only: the board's evn is C, so a traceback never shows a frame inside it
    out = []
    while tb is not None:
        co = tb.tb_frame.f_code
        fn = co.co_filename
        if fn == "<stdin>" or fn.startswith("/flash/"):
            out.append('  File "%s", line %d, in %s' % (fn, tb.tb_lineno, co.co_name))
        tb = tb.tb_next
    return out


def format_exception(e):
    """The traceback as MicroPython prints it: the program's frames, no source lines, then the exception."""
    lines = ["Traceback (most recent call last):"] if e.__traceback__ is not None else []
    if isinstance(e, SyntaxError) and getattr(e, "filename", None) in ("<stdin>",) or (
            isinstance(e, SyntaxError) and str(getattr(e, "filename", "")).startswith("/flash/")):
        lines.append('  File "%s", line %d' % (e.filename, e.lineno or 1))
        lines.append("SyntaxError: %s" % (e.msg or "invalid syntax"))
        return "\n".join(lines) + "\n"
    lines += _frame_lines(e.__traceback__)
    # MicroPython has one OSError (no FileNotFoundError, PermissionError, ...)
    name = "OSError" if isinstance(e, OSError) else type(e).__name__
    msg = str(e)
    if isinstance(e, KeyError) and e.args:
        msg = repr(e.args[0])
    if msg:
        lines.append("%s: %s" % (name, msg))
    elif isinstance(e, KeyboardInterrupt):
        lines.append("KeyboardInterrupt: ")
    else:
        lines.append(name)
    return "\n".join(lines) + "\n"


def run(src):
    """One paste at the raw REPL; '' when it ended normally, else the traceback."""
    try:
        code = compile(src, "<stdin>", "exec")
        exec(code, _main)
        return ""
    except SystemExit:
        return ""
    except BaseException as e:      # noqa: B036 - KeyboardInterrupt is the program's end too
        return format_exception(e)
    finally:
        try:
            sys.stdout.flush()
        except Exception:
            pass


reset()
