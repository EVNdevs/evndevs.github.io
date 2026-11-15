"""_evnboot - how the simulated board runs a program (docs/SIMULATOR.md). Not for programs.

The simulator's interpreter is CPython (Pyodide) rather than MicroPython: MicroPython's WebAssembly port cannot collect
garbage while a program runs, so a robot loop would run out of memory within minutes. What a program for the board
sees is made to look like the board's MicroPython (micropython/port/mpconfigport.h, MicroPython v1.26.1):
  - `time` / `utime`: the board's names only (sleep, sleep_ms, sleep_us, ticks_ms / us / cpu, ticks_add, ticks_diff;
    the board is built without time() / time_ns() / localtime() / gmtime() / mktime()), on the simulated clock;
  - `errno` / `uerrno`: MicroPython's names and numbers, and a file error carries them (ENOENT 2, not WebAssembly's 44);
  - open() and the os module's writes refuse with OSError EBUSY (16) while a motor drives, as the board's flash does;
    a write the flash took (a good close() or flush() of a top-level /flash file) tells the host its name
    (_evnsim.file_written; a level's kernel reads the file: docs/COURSE_CONTENT_DESIGN.md §3.2), and a refusal the
    absolute path refused (_evnsim.file_refused: COURSE_FORMAT_DESIGN.md §17.4);
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
import math as _math
import errno as _cerrno

import _evnsim
import gc as _gc
import weakref as _weakref
from array import array as _jr_array

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

_TICKS_HALF = 1 << 29              # MICROPY_PY_TIME_TICKS_PERIOD / 2: the period is 2**30 on the board


_ticks_add_js = _evnsim.ticks_add


def _ticks_add(ticks, delta, /):
    """ticks_add(ticks, delta) as the board's (extmod/modtime.c v1.26.1 l.178-196): delta is read by mp_obj_get_int -
    an int or a bool, else TypeError; past the 32-bit word OverflowError - and refused at half the period or past it, so
    that ticks_diff(ticks_add(T, delta), T) == delta; the sum wraps at 2**30 (runtime.ts timeModule)"""
    if not isinstance(delta, int):
        raise TypeError("can't convert %s to int" % type(delta).__name__)
    if not -(1 << 31) <= delta < (1 << 31):
        raise OverflowError("overflow converting long int to machine word")
    if not -_TICKS_HALF < delta < _TICKS_HALF:
        raise OverflowError("ticks interval overflow")
    return _ticks_add_js(ticks, delta)


_ticks_add.__name__ = _ticks_add.__qualname__ = "ticks_add"


def _sim_time(t):
    t.sleep = _evnsim.sleep
    t.sleep_ms = _evnsim.sleep_ms
    t.sleep_us = _evnsim.sleep_us
    t.ticks_ms = _evnsim.ticks_ms
    t.ticks_us = _evnsim.ticks_us
    t.ticks_cpu = _evnsim.ticks_cpu
    t.ticks_add = _ticks_add
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


_file_refused = getattr(_evnsim, "file_refused", None)


def _abspath(p):
    """a path argument (a str, bytes or an os.PathLike) as the absolute str the host is told and a _BoardFile keeps (None:
    not a path - a file descriptor, another object)"""
    try:
        return _os.path.abspath(_os.fsdecode(_os.fspath(p)))
    except Exception:       # a bad path: the refusal or the call says so, the host hears nothing
        return None


def _refuse(path):
    """The flash refuses a write while a motor drives (EBUSY): the host is told the absolute path refused
    (_evnsim.file_refused; COURSE_FORMAT_DESIGN.md §17.4 D4: a level's kernel reports a refusal of its report file), then
    OSError 16 is raised. Every refusal point calls this."""
    p = _abspath(path)
    if p is not None and _file_refused is not None:
        try:
            _file_refused(p)
        except Exception:   # the host's fault is never the program's to see
            pass
    raise _mp_oserror(16)


_file_written = getattr(_evnsim, "file_written", None)


def _written(path, moved=False):
    """A write the flash took (a good close() or flush()): the host hears a top-level /flash name
    (docs/COURSE_CONTENT_DESIGN.md §3.2: a level's kernel reads the file then). A refused write is no write and says
    nothing. `moved`: a good os.rename() into or out of the name, or its os.remove() / unlink() (§17.4, V2-S1, R3-S6):
    told as such, so a host hears it for a report file only (kernel.maze's map.txt keeps CC-3's path)."""
    d, name = _os.path.split(path)
    if d == "/flash" and _file_written is not None:
        if moved:
            _file_written(name, True)
        else:
            _file_written(name)


_real_open = builtins.open


_INLINE_MAX = 512       # LittleFS keeps a file this small inline in its directory; past it a write erases a block
_open_files = _weakref.WeakSet()     # the program's files open for writing (the soft reset closes them)
# their inner io files, held strongly until close(): a _BoardFile dropped in a reference cycle is collected with the
# cycle, and CPython's collector finalises an unreachable set in no set order, so an inner file reached only from it
# could be closed first (its buffered bytes lost, no hook). Held here, it is never in the unreachable set: the
# wrapper's finaliser always finds it open and closes it through close() (review cc3_r1_B S1)
_held_files = set()


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
        _held_files.add(f)
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

    def __del__(self):
        # a file dropped unclosed (open(...).write(s)) closes through close(), as the board's gc closes it: committed and
        # heard as a close is (_written), or refused while a motor drives (put back; a finaliser cannot raise to the
        # program, so the program sees nothing, but close()'s _refuse has told the host: §17.4). Lane cc3 c2, review
        # cc3_r1_A S1.
        if self.__dict__.get("_f") is None:
            return
        try:
            self.close()
        except Exception:
            pass

    def write(self, data):
        n = len(data.encode("utf-8")) if isinstance(data, str) else len(data)
        if self._size + n > _INLINE_MAX and _driving():
            _refuse(self._path)
        r = self._f.write(data)
        self._size += n
        return r

    def _commit(self):
        try:
            self._f.flush()
        except OSError as e:
            raise _translate(e) from None
        self._committed = _read_bytes(self._path)
        _written(self._path)

    def flush(self):
        if self._f.closed:
            return self._f.flush()          # ValueError, as CPython says it
        if _driving():
            _refuse(self._path)
        self._commit()

    def close(self):
        if self._f.closed:
            _held_files.discard(self._f)
            return
        refused = _driving()
        if not refused:
            try:
                self._f.close()
            except OSError as e:
                raise _translate(e) from None
            finally:
                _held_files.discard(self._f)
            _written(self._path)
            return
        # closed either way; what was not committed is dropped
        try:
            self._f.close()
        except OSError:
            pass
        _held_files.discard(self._f)
        _put_bytes(self._path, self._committed)
        _refuse(self._path)


def _open(file, mode="r", *a, **k):
    if not _caller_is_program():
        return _real_open(file, mode, *a, **k)
    writes = any(c in str(mode) for c in "wax+")
    if not writes:
        try:
            return _real_open(file, mode, *a, **k)
        except OSError as e:
            raise _translate(e) from None
    path = _abspath(file)
    committed = _read_bytes(path) if path is not None and _os.path.isfile(path) else None
    if committed is None and _driving():
        _refuse(file)                   # a create commits the new file's entry at once
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
# io.open, _io.open (and uio.open: uio is io, below) for the program's callers go through the same _open, as on the
# board's VFS (§17.4); a standard-library caller keeps the real one (_open hands it through)
import io as _io_mod        # noqa: E402
import _io                  # noqa: E402
_io_mod.open = _open
_io.open = _open


def _arg(a, k, i, kw):
    """the call's path argument: positional `i`, else keyword `kw` (None: not given)"""
    return a[i] if len(a) > i else k.get(kw)


def _os_call(name, writes):
    real = getattr(_os, name)
    # the path the flash refuses (rename's destination: the name a write would make), and what a good call prompts:
    # a rename into or out of a top-level name and a removal are heard as commits (§17.4, V2-S1, R3-S6)
    told = (lambda a, k: _arg(a, k, 1, "dst")) if name == "rename" else (lambda a, k: _arg(a, k, 0, "path"))

    def call(*a, **k):
        if not _caller_is_program():
            return real(*a, **k)
        if writes and _driving():
            _refuse(told(a, k))
        try:
            r = real(*a, **k)
        except OSError as e:
            raise _translate(e) from None
        if name == "rename":
            for p in (_arg(a, k, 1, "dst"), _arg(a, k, 0, "src")):
                p = _abspath(p)
                if p is not None:
                    _written(p, True)
        elif name in ("remove", "unlink"):
            p = _abspath(_arg(a, k, 0, "path"))
            if p is not None:
                _written(p, True)
        return r
    call.__name__ = name
    return call


for _n, _w in (("remove", True), ("unlink", True), ("rename", True), ("mkdir", True), ("rmdir", True),
               ("listdir", False), ("stat", False), ("chdir", False), ("statvfs", False), ("getcwd", False)):
    if hasattr(_os, _n):
        setattr(_os, _n, _os_call(_n, _w))


def _os_absent(name):
    """an os function MicroPython's os has not and that writes the flash past the refusals (os.open / os.write ...;
    COURSE_FORMAT_DESIGN.md §17.4, V3-N4): absent for the program's callers (AttributeError, as the board says), the
    standard library's own callers keep it"""
    real = getattr(_os, name)

    def call(*a, **k):
        if _caller_is_program():
            raise AttributeError("'module' object has no attribute '%s'" % name)
        return real(*a, **k)
    call.__name__ = name
    return call


for _n in ("open", "write", "writev", "pwrite", "pwritev", "replace", "truncate", "ftruncate", "link", "symlink",
           "posix_fallocate", "sendfile", "copy_file_range", "splice"):
    if hasattr(_os, _n):
        setattr(_os, _n, _os_absent(_n))

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
    '  m.control.limits(), m.control.target_tolerances(), m.control.state()\n'
    '  m.settings(max_voltage=7000, stall_timeout=1000), m.model.state(), m.close()\n'
    '  wait(500); sw = StopWatch(); sw.time()   # ms\n'
    '  Motor(2, speed_unit=SpeedUnit.PERCENT)   # speeds in % of full_speed()\n'
    '  m.calibrate(); m.full_speed()            # self-calibration (about 12 s, shaft free; stored) / what 100 % is\n'
    '  m.calibrate(wait=False) ... m.calibrate() # start several ports, then join each (finished: its result at once)\n'
    "  evn.configure_motor(3, 'EV3 Medium')      # what is on the port, stored on the board: 'EV3 Large' / 'EV3 Medium' / 'NXT' / 'jga25' / 'pololu25d_9_7' / 'chr16_63' / 'cm22_49' / 'custom'\n"
    "  evn.configure_motor(2, 'jga25')           # a library motor: the JGA25-370 6V 77RPM (3432 counts, rated 6 V)\n"
    "  evn.configure_motor(1, 'pololu25d_9_7')   # a library motor: the Pololu 25D 9.7:1 HP 12V (464.64 counts)\n"
    "  evn.configure_motor(3, 'chr16_63')        # a library motor: the CHR-GM16-030PA 9V 1:63 (1764 counts, 9 V cap)\n"
    "  evn.configure_motor(2, 'cm22_49')         # a library motor: the CM22-2230 12V 1:49 (3136 counts, 12 V cap)\n"
    "  evn.configure_motor(3, 'custom', counts_per_rev=1400, rated_voltage=6000, no_load_speed=500)\n"
    "  evn.calibration(2)['encoder_reversed']    # calibrate() finds which way a motor's encoder counts\n"
    '  # an encoder counting against its drive runs away: coasted in ~0.25 s, RuntimeError -> calibrate()\n'
    "  evn.calibration(1)['cogging_edges']       # and whether its rotor cogs: the detent period, edges\n"
    '  evn.motor_config(3), evn.calibration(3), evn.clear_calibration(3), evn.clock()\n'
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

# ---------------------------------------------------------------- simtrail: the panel's measuring tools
# A simulator-only module (docs/SIMULATOR.md "The tools pane"): the board has no pen and no ground truth, so `evn` stays
# the board's API and a program using this fails on the board at its import. It exists in every interpreter, so a program
# that lifts the pen runs as it is in a challenge; the reader `_evntrail` is the panel worker's only (vm.ts `tools`).
# Every read is the true pose (README §9 GT, never readable from learner code during a scored run): where there is no
# reader, or where it answers nothing (a referee judging, workerCore.ts trailRefused), the read is refused: ReadRefused,
# which a scored run takes as the program's end, not its failure (challengeRun.ts refusedRead, OQ 222).

_TRAIL_REFUSED = "simtrail: true values cannot be read in a scored or sealed run: read them in a practice run, or after the run in the panel"


def _trail_module():
    m = types.ModuleType("simtrail")
    m.__doc__ = "The simulator panel's pen and the end-point, closing and true heading errors. Simulator only."

    class ReadRefused(RuntimeError):
        """A true value read in a scored or sealed run: the program stops here, and the run goes on as if it had ended."""

    def tools():
        try:
            return _real_import("_evntrail")
        except ImportError:
            return None

    def read(what, *a):
        t = tools()
        v = t.read(what, *a) if t else None
        if v is None:
            raise ReadRefused(_TRAIL_REFUSED)
        return v

    def pen_down():
        """The pen on the middle of the axle goes down: the path is drawn, and a new stroke starts here."""
        t = tools()
        if t:
            t.pen(True)

    def pen_up():
        """The pen comes up: nothing is drawn, and the stroke ends here."""
        t = tools()
        if t:
            t.pen(False)

    def number(v):
        # what a float holds and is finite: no bool, no text, no nan or inf, no int too large for a float
        try:
            return isinstance(v, (int, float)) and not isinstance(v, bool) and _math.isfinite(float(v))
        except OverflowError:
            return False

    def target(x=None, y=None, heading=None):
        """Where the run should end: x and y in mm on the floor, with a heading in degrees if wanted; no arguments: the run's start again."""
        # here, before the reader, so a practice run and a sealed one refuse the same call; the panel's fields refuse it too
        if (x is None) != (y is None) or (x is None and heading is not None):
            raise ValueError("simtrail.target() takes x and y together, then a heading if wanted; no arguments go back to the run's start")
        if not all(v is None or number(v) for v in (x, y, heading)):
            raise ValueError("simtrail.target() takes finite numbers: x and y in mm, a heading in degrees")
        # floats, for an int past 2**53 reaches the reader as no number (a BigInt) and would drop the target
        x, y, heading = [None if v is None else float(v) for v in (x, y, heading)]
        t = tools()
        if t:
            t.target(x, y, heading)

    def end_error():
        """The gap in mm from the robot to the target (none set: to the run's start)."""
        return read("end")

    def closing_error(per_degree=0):
        """The gap in mm between the ends of the last stroke, plus per_degree mm for each degree between them."""
        return read("closing", per_degree)

    def heading_error():
        """The true heading now less the target's (none: the run's start's) in degrees, + to the left."""
        return read("heading")

    def report():
        """The panel's line: the end pose and the three errors."""
        return read("report")

    for f in (pen_down, pen_up, target, end_error, closing_error, heading_error, report):
        setattr(m, f.__name__, f)
    m.ReadRefused = ReadRefused
    return m


sys.modules["simtrail"] = _trail_module()

# ---------------------------------------------------------------- running a program

# a print reaches the terminal as it happens, as the board's does (the end of each line at the latest)
try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

_main = {}
_user_modules = set()


def _sweep_body():
    """The open-file sweep (the board's gc_sweep_all at a program's end: every file left open closed, LittleFS commits it,
    the motors coasted first; COURSE_FORMAT_DESIGN.md §17.2 D3, §17.4). Never called as it stands: its code object, which
    no program can change, is run as a new function over a globals dict of references captured at boot - by the host for
    the end's sweep (SimVM.sweepOpenFiles builds the dict itself, from the parts it took before any program ran), by
    _sweep_fn below for reset() - so a program that rebinds _evnboot's names, patches _BoardFile, rewrites a function's
    __code__ / __defaults__ / closure cells or the builtins runs none of its code in it (§17.14 R3-S1). Every name here is
    one of those globals; nothing is looked up in the builtins.
    Bounded: only an exact _BoardFile whose instance dict has str keys alone, whose path is a str, and whose inner file is
    the exact io stack the real open() makes (a TextIOWrapper over a Buffered* over a FileIO, a Buffered* over a FileIO, or
    a FileIO) with nothing in each layer's instance dict but open()'s own `mode` / `name` (so no close / flush shadowed on
    the instance), a text layer with strict errors (any encoding), is closed - through the unbound C close of its type. No
    driving test (D3, R2-B1: the board coasts before its sweep): each close commits and is heard, a top-level /flash name
    told to the host (HOOK: _evnsim.file_written); no refusal is told (V3-N7). The host clears the profile, the trace, the
    collector and sys.monitoring around it (vm.ts). LOOSE (a test mutant, FILE_ROUTE_MUTANT.sweepLoose): no layer check,
    close through the attribute."""
    n = 0
    for r in LIST(STORE):
        try:
            if TYPE(r) is not REF:
                continue
            f = r()
            if TYPE(f) is not CLS:
                continue
            d = INST.__get__(f, CLS)
            bad = False
            for k in LIST(d):
                if TYPE(k) is not STR:
                    bad = True
            if bad:
                continue
            inner = d.get("_f")
            path = d.get("_path")
            if TYPE(path) is not STR:
                continue
            x = inner
            tx = TYPE(x)
            close = None
            layers = LIST()
            if tx is TEXT:
                if TYPE(x.encoding) is not STR or TYPE(x.errors) is not STR:
                    continue
                # any encoding (the board's open() ignores it: review b2 N1, an honest cp1252 file is committed); strict errors
                if x.errors != "strict":
                    continue
                close = TEXT_CLOSE
                layers.append(x)
                x = x.buffer
                tx = TYPE(x)
            if tx is BW or tx is BR or tx is BRD:
                if close is None:
                    close = BW_CLOSE if tx is BW else BR_CLOSE if tx is BR else BRD_CLOSE
                layers.append(x)
                x = x.raw
                tx = TYPE(x)
            if tx is not FIO:
                continue
            if close is None:
                close = FIO_CLOSE
            layers.append(x)
            for L in layers:
                ld = IOD.__get__(L, TYPE(L))
                for k in LIST(ld):
                    if TYPE(k) is not STR or k not in KEYS:
                        bad = True
                    else:
                        tv = TYPE(ld[k])
                        if tv is not STR and tv is not INT and tv is not BYTES:
                            bad = True
            if (bad and not LOOSE) or inner.closed:
                continue
            try:
                if LOOSE:
                    inner.close()
                else:
                    close(inner)
            except OSError:
                continue                        # not committed: nothing heard
            finally:
                HELD.discard(inner)
            i = path.rfind("/")
            if path[:i] == "/flash" and HOOK is not None:
                HOOK(path[i + 1:])
            n += 1
        except BaseException:                   # noqa: B036 - nothing of the program's may stop the sweep (a KeyboardInterrupt)
            pass
    return n


def _sweep_parts():
    """the sweep's globals as captured now, before any program (the host takes them at boot: SimVM.start)"""
    import io
    return {
        "__builtins__": {}, "LIST": list, "TYPE": type, "STR": str, "INT": int, "BYTES": bytes, "REF": _weakref.ref,
        "STORE": _open_files.data, "HELD": _held_files, "HOOK": _file_written, "CLS": _BoardFile,
        "INST": _BoardFile.__dict__["__dict__"], "IOD": _io._IOBase.__dict__["__dict__"],
        "TEXT": io.TextIOWrapper, "BW": io.BufferedWriter, "BR": io.BufferedRandom, "BRD": io.BufferedReader, "FIO": io.FileIO,
        "TEXT_CLOSE": io.TextIOWrapper.close, "BW_CLOSE": io.BufferedWriter.close, "BR_CLOSE": io.BufferedRandom.close,
        "BRD_CLOSE": io.BufferedReader.close, "FIO_CLOSE": io.FileIO.close,
        "KEYS": frozenset(("mode", "name")), "ENCODINGS": frozenset(("utf-8", "utf8", "utf_8", "ascii", "latin-1", "latin1", "iso-8859-1")),
        "OSError": OSError, "BaseException": BaseException, "LOOSE": False,
    }


_sweep_fn = types.FunctionType(_sweep_body.__code__, _sweep_parts(), "sweep")
# the host's names (vm.ts start()): the code and the parts, taken before any program runs
sweep_code = _sweep_body.__code__
sweep_parts = _sweep_parts
sweep_open_files = _sweep_fn


def reset(_sweep=sweep_open_files):
    """A soft reset: a fresh __main__, and the board's modules (evn, files from the board) imported anew. `_sweep` the
    open-file sweep as built at boot (a program's rebinding of the name changes nothing here)."""
    global _main
    # the board's soft reboot ends a recording DataLog first, and autosaves it once the motors coast (the runtime has
    # coasted them: Runtime.softReset; evn_mp_datalog_program_end)
    try:
        getattr(sys.modules.get("evn"), "_program_end", lambda: None)()
    except BaseException:           # noqa: B036 - nothing of the old program's may stop the reset
        pass
    # the board's gc_sweep_all closes every file the old program left open (LittleFS commits it; the motors coast
    # first): closed here, not left to CPython's collector, which loses a buffered write when the file was in a
    # reference cycle (a def or a class in the program) - its finalisers run in no set order. The runtime has coasted the
    # motors, so the sweep's closes are the closes close() would make (the sweep, built at boot: _sweep_body)
    _sweep()
    # a backstop: every close() lets go of its inner file, whatever it raises, so none is left once the wrappers closed
    for f in list(_held_files):
        try:
            f.close()
        except BaseException:       # noqa: B036 - as above
            pass
    _held_files.clear()
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


# ---------------------------------------------------------------- the Junior block trace (docs/design/JR_J4_TRACE.md §3)
#
# run(src, jr): the page's table (trace.js table(): own, blk, pass, span, hdr, body, hdrAt, n) drives a streaming state
# machine fed by sys.monitoring LINE events on the program's own code objects. Tool 3 (4 is BTIME's), taken by force
# when another run left it held; local events only, never global; DISABLE for code that is not this program's. The
# live state is one array('i'), ST = [ev, blk, ln, total[0..L-1], entry[0..L-1], step], counts saturating at 2**31 - 1,
# read by the host through a buffer view (no Python in a frame: vm.ts jrRead). The record goes to _LAST_JR (this
# module's, never the program's __main__), copied out first in the guarded teardown; SimVM reads and clears it.
# The step (J4b, §4): with `hold` (the host's), a block event calls it - after the counts and the line - only while ST's
# step word is 1 (the host writes it, no call per event in a free run). Shared path: `hold` is the host's sync wait. Live
# path (`park`): _evnsim.jr_hold (parks) where can_run_sync() is true in the callback's frame, else `hold` (no hold taken).

_LAST_JR = None
_JR_TOOL = 3
_JR_NAME = "evn-jr"
_JR_SEQ_CAP = 4096
_JR_MAX = (1 << 31) - 1
_JR_EVENTS = ("PY_START", "PY_RESUME", "PY_RETURN", "PY_YIELD", "CALL", "LINE", "INSTRUCTION", "JUMP", "BRANCH",
              "STOP_ITERATION", "RAISE", "EXCEPTION_HANDLED", "PY_UNWIND", "PY_THROW", "RERAISE", "C_RETURN", "C_RAISE",
              "BRANCH_LEFT", "BRANCH_RIGHT")


def _jr_codes(co, out):
    """the program's code object and every one nested in its co_consts (Junior output has none: no def, no lambda)"""
    out.append(co)
    for c in co.co_consts:
        if isinstance(c, types.CodeType):
            _jr_codes(c, out)
    return out


def _jr_holder(hold, park):
    """the callback's hold: the host's `hold` (the shared path's wait), or on the live path _evnsim.jr_hold where the
    callback's frame can switch and the host's no-hold where it cannot (§4: never PARK where no turn can be taken)"""
    if hold is None or not park:
        return hold
    try:
        from pyodide.ffi import can_run_sync
        jh = sys.modules["_evnsim"].jr_hold
    except Exception:           # no live hold here: the run is traced, never held
        return None

    def H(k):
        if can_run_sync():
            jh(k)
        else:
            hold(k)
    return H


def _jr_start(code, src, jr, take, S, hold=None, park=False):
    """the trace on `code`, its state in S; on a refusal or a failed step S['absent'] says why and the run goes untraced"""
    M = sys.monitoring
    try:
        t = jr.to_py() if hasattr(jr, "to_py") else jr
        n = int(t["n"])
        OWN = tuple(int(x) for x in t["own"])
        BLK = tuple(int(x) for x in t["blk"])
        PASS = tuple(tuple(int(L) for L in p) for p in t["pass"])
        SPAN = tuple(frozenset(int(j) for j in s) for s in t["span"])
        BODY = tuple(frozenset(int(j) for j in s) for s in t["body"])
        HDR_AT = tuple(tuple(int(L) for L in h) for h in t["hdrAt"])
    except (KeyboardInterrupt, SystemExit):
        # review j4a_build_r1 B1: a Stop taken here is the program's end, never a refusal (sig() has cleared the press)
        S["absent"] = "stopped"
        raise
    except BaseException:       # noqa: B036 - a bad table is a refusal, whatever it raised
        S["absent"] = "table"
        return
    if n != len(src.split("\n")):
        S["absent"] = "n"
        return
    if len(OWN) != n or len(BLK) != n or len(PASS) != n or len(HDR_AT) != n or len(BODY) != len(SPAN):
        S["absent"] = "table"
        return
    if BLK[0] != -1 or OWN[0] != -1:
        S["absent"] = "line1"
        return
    nL = len(SPAN)
    nK = max(max(BLK), max(OWN), -1) + 1
    EV, BK, LN, T0, E0, SP = 0, 1, 2, 3, 3 + nL, 3 + 2 * nL
    ST = _jr_array("i", [0] * (4 + 2 * nL))
    ST[BK] = -1
    ST[LN] = -1
    RAN = [0] * nK
    SEQ = []
    CUT = [0]
    CODES = frozenset(_jr_codes(code, []))
    DISABLE = M.DISABLE
    MAX = _JR_MAX
    CAP = _JR_SEQ_CAP
    HOLD = _jr_holder(hold, park)

    def line(c, i1):
        if c not in CODES:
            return DISABLE                      # another run's leftover local events on its own code
        i = i1 - 1
        if i < 0 or i >= n:
            return None
        p = ST[LN]
        k = BLK[i]
        event = k >= 0 and (p < 0 or OWN[p] != k)          # a block's own line re-firing is not an event
        for L in HDR_AT[i]:                                 # loop L entered anew: its header from outside its body
            if p < 0 or (p not in BODY[L] and p != i):
                ST[E0 + L] = 0
        for L in PASS[i]:                                   # countPasses' rule, streaming (T1)
            if p == i or p < 0 or p not in SPAN[L]:
                if ST[T0 + L] < MAX:
                    ST[T0 + L] += 1
                if ST[E0 + L] < MAX:
                    ST[E0 + L] += 1
        ST[LN] = i
        if event:
            if ST[EV] < MAX:
                ST[EV] += 1
            ST[BK] = k
            RAN[k] += 1
            if len(SEQ) < CAP:
                SEQ.append(k)
            else:
                CUT[0] = 1
            if ST[SP] and HOLD is not None:     # J4b, §4: after the counts and the line (r1 A S3)
                HOLD(k)
        return None

    S.update(ST=ST, RAN=RAN, SEQ=SEQ, CUT=CUT, CODES=CODES, nL=nL)
    try:
        if M.get_tool(_JR_TOOL) is not None:
            # by force: a hand-written program in this worker took it and left it (on a free tool these raise)
            for name in _JR_EVENTS:
                e = getattr(M.events, name, None)
                if e:
                    try:
                        M.register_callback(_JR_TOOL, e, None)
                    except ValueError:
                        pass
            M.set_events(_JR_TOOL, 0)
            M.free_tool_id(_JR_TOOL)
        # review j4a_build_r2 V1: marked before it is taken, so a Stop landing just after use_tool_id still has the
        # teardown free it (its `lost` test and per-step guards cover a use_tool_id that never ran)
        S["tool"] = True
        M.use_tool_id(_JR_TOOL, _JR_NAME)
        M.register_callback(_JR_TOOL, M.events.LINE, line)
        for c in CODES:
            M.set_local_events(_JR_TOOL, c, M.events.LINE)
        if take is not None:
            take(ST)
    except (KeyboardInterrupt, SystemExit):
        # review j4a_build_r1 B1: a Stop taken while the trace starts ends the run (the teardown frees what was taken)
        S["absent"] = "stopped"
        S["off"] = True
        raise
    except BaseException:       # noqa: B036 - any step's failure: the run goes untraced (the teardown frees what was taken)
        S["absent"] = "tool"
        S["off"] = True


def _jr_record(S, lost):
    """the record copied out of the trace's state: plain lists in _LAST_JR (this module's slot, never __main__'s)"""
    global _LAST_JR
    if _LAST_JR is not None:
        return                  # review j4a_build_r1 S1: a repeated teardown never overwrites the run's record
    try:
        absent = S.get("absent") or ("tool lost" if lost else None)
        ST = S.get("ST")
        nL = S.get("nL", 0)
        rec = {"ev": 0, "seq": [], "cut": False, "ran": [], "total": []}
        if ST is not None and not S.get("off"):
            rec = {"ev": int(ST[0]), "seq": list(S.get("SEQ", ())), "cut": bool(S.get("CUT", (0,))[0]),
                   "ran": list(S.get("RAN", ())), "total": list(ST[3:3 + nL])}
        if absent:
            rec["absent"] = absent
        _LAST_JR = rec
    except BaseException:       # noqa: B036
        pass


def _jr_drop(S):
    """the trace's state dropped"""
    try:
        for k in ("SEQ", "RAN"):
            if k in S:
                S[k].clear()
        S.clear()
    except BaseException:       # noqa: B036
        pass


def _jr_stop(S):
    """the guarded teardown (§3), each step on its own, never raising: is the tool still ours ('tool lost' when the
    program freed or took it), the record copied out first, the local events off on every code object, the callback
    unregistered, the tool freed, the state dropped (on 3.13 free_tool_id alone leaves the callback and local events live)"""
    M = sys.monitoring
    lost = False
    if S.get("tool"):
        try:
            lost = M.get_tool(_JR_TOOL) != _JR_NAME
        except BaseException:   # noqa: B036
            lost = True
    _jr_record(S, lost)
    if S.get("tool"):
        for c in S.get("CODES", ()):
            try:
                M.set_local_events(_JR_TOOL, c, 0)
            except BaseException:   # noqa: B036
                pass
        try:
            M.register_callback(_JR_TOOL, M.events.LINE, None)
        except BaseException:   # noqa: B036
            pass
        try:
            if not lost:
                M.free_tool_id(_JR_TOOL)
        except BaseException:   # noqa: B036
            pass
    _jr_drop(S)


def _run_traced(src, jr, take, hold=None, park=False):
    global _LAST_JR
    _LAST_JR = None
    S = {}
    try:
        code = compile(src, "<stdin>", "exec")
        _jr_start(code, src, jr, take, S, hold, park)
        exec(code, _main)
        return ""
    except SystemExit:
        return ""
    except BaseException as e:      # noqa: B036 - KeyboardInterrupt is the program's end too
        return format_exception(e)
    finally:
        if not S:
            S["absent"] = "start"
        # review j4a_build_r1 S1: a KeyboardInterrupt landing between the teardown's guarded steps would leave tool 3
        # live for the next run; every step is safe to repeat (the record is written once), so it is run again
        for _ in range(3):
            try:
                _jr_stop(S)
                break
            except BaseException:   # noqa: B036
                continue
        try:
            sys.stdout.flush()
        except Exception:
            pass


def run(src, jr=None, take=None, hold=None, park=False):
    """One paste at the raw REPL; '' when it ended normally, else the traceback. `jr`: the Junior block trace's table
    (JR_J4_TRACE.md §3; `take(ST)` hands the host the live state once, at the start; `hold` / `park` the step, §4);
    None: today's run, untouched."""
    if jr is not None:
        return _run_traced(src, jr, take, hold, park)
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
