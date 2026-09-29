# Ports, programs, the data logger and timing

Part 5 of the [EVN ALPHA MicroPython API reference](API.md), which has the units, the port numbers and the differences from Pybricks. Previous: [Extended peripherals: HiTechnic, HuskyLens, VL53L1X and TCS3430](API_EXTENDED.md).

The raw serial and I2C ports, programs and files, the on-board data logger, timing, and the appendix: diagnostics and the validation record.

## UART — raw serial port

A serial header (Serial 1 or Serial 2) as a plain UART, for anything that talks serial: a USB-serial adapter, another controller, a GPS. It is MicroPython's [`machine.UART`](https://docs.micropython.org/en/latest/library/machine.UART.html) (as on the Raspberry Pi Pico, the rp2 port), with the differences in the table below. The EVN Bluetooth module has its own class, [`Bluetooth`](API_DISPLAYS.md#bluetooth--bluetooth-module-hc-05). More in `examples/19_uart/` (Python and blocks); in blocks, **Serial and I2C** > **UART** ([blocks reference](BLOCKS.md#serial-and-i2c-the-raw-ports)).

**Constructor**

```python
evn.UART(id, baudrate=115200, bits=8, parity=None, stop=1, *, timeout=0, timeout_char=0, invert=0, txbuf=1023, rxbuf=255)
```

| Parameter | Default | Meaning |
| :--- | :--- | :--- |
| `id` | — | 1 or 2 (Serial 1: TX GP0, RX GP1; Serial 2: TX GP8, RX GP9), else `ValueError`. Positional |
| `baudrate` | 115200 | 300..3000000, else `ValueError`. Positional or keyword: `UART(1, 9600)` and `UART(1, baudrate=9600)` are the same |
| `bits` | 8 | data bits, 5..8 |
| `parity` | `None` | `None`, `0` (even) or `1` (odd) |
| `stop` | 1 | stop bits, 1 or 2 |
| `timeout` | 0 | ms a read waits for its first byte (`read()`, `readinto()`, and each byte of `readline()`) |
| `timeout_char` | 0 | ms a read waits for each next byte; raised to one character time + 1 ms (13 bits: 2 ms at 9600, 1 ms at 115200, 44 ms at 300) |
| `invert` | 0 | `UART.INV_TX`, `UART.INV_RX` or both: that line idles low (the RX pad is then pulled down, so an unplugged header still reads idle) |
| `txbuf`, `rxbuf` | 1023, 255 | the transmit and receive rings are fixed in static RAM: a size up to theirs (or 0 / negative, as rp2's "not given") is accepted so `machine.UART` code runs unchanged, and the ring stays its full size (`print(uart)` shows 1023 / 255); a larger one raises `ValueError` |

**Methods**

| Call | Does |
| :--- | :--- |
| `init(baudrate, bits, parity, stop, *, timeout, timeout_char, invert, txbuf, rxbuf)` | re-configure; every setting left out stays as it is (`init(9600)` changes the baud only). The bytes already queued go out first, at the old settings (`OSError(ETIMEDOUT)` past the `flush()` bound); nothing queued or received is dropped |
| `write(buf)` | queue the bytes (a `str` is sent as UTF-8); returns `len(buf)`. Every byte is queued, never dropped: it waits only while the 1 KiB transmit ring is full |
| `read()`, `read(n)` | up to `n` bytes (everything without `n`): the first byte waits at most `timeout`, each next one at most `timeout_char`. When a gap of `timeout_char` ends a burst short of `n` (always, without `n`), the read waits once more, up to `timeout`, for further bytes, then returns what came (as `machine.UART`: the stream reads again); `None` when nothing came |
| `readinto(buf)`, `readinto(buf, n)` | the same into a `bytearray` / `memoryview` (with the same extra `timeout` wait after a short burst): the number of bytes stored, or `None` |
| `readline()`, `readline(size)` | the next line **with** its `b"\n"`, each byte waiting at most `timeout`; the part that came when the line stops half way; `None` when nothing came. `readline(timeout=ms)` waits as if the object had that `timeout`, for this call only (EVN's) |
| `for line in uart:` | a `readline()` each time, until one comes back empty |
| `any()` | bytes that can be read without waiting |
| `flush()` | wait until everything queued has been sent (ring, FIFO and shift register); `OSError(ETIMEDOUT)` past (33 + 1024) × 26 bit times: 0.24 s at 115200, 92 s at 300 |
| `txdone()` | `True` when nothing is left to send |
| `sendbreak()` | the queued bytes go out first, then TX is held low for two frames (2.1 ms at 9600 8N1) |
| `deinit()`, `close()` | release the port — it keeps running and keeps its queued bytes — so a `Bluetooth` object or another `UART` can take it; the REPL is taken off it; every later call raises `ValueError("UART is closed")` (build a new object to use it again) |
| `overflow()` | EVN's: bytes the 256-byte receive ring dropped since the last call, plus FIFO overrun events (read and clear; 0 = nothing lost) |
| `flush_rx()` | EVN's: drop everything received and not read yet (not `flush()`, which waits for output) |
| `repl(True)`, `repl(False)`, `repl()` | EVN's: the MicroPython REPL on this port as well as USB (a USB-serial adapter on the header); survives a soft reboot |

`print(uart)` shows every setting: `UART(1, baudrate=115200, bits=8, parity=None, stop=1, tx=0, rx=1, txbuf=1023, rxbuf=255, timeout=0, timeout_char=1, invert=None)`.

**Example**

```python
from evn import UART
u = UART(1, 9600, timeout=1000)      # a read waits up to 1 s for its first byte
u.write(b"hello\n")
line = u.readline()                  # b'...\n', or None after 1 s
print(line.strip() if line else "nothing came")
```

**Differences from `machine.UART`**

| `machine.UART` (rp2) | `evn.UART` | Why |
| :--- | :--- | :--- |
| `UART(0)`, `UART(1)` | `UART(1)`, `UART(2)` | the numbers printed on the board's serial headers |
| `tx=`, `rx=`, `cts=`, `rts=` pins | not accepted (`TypeError`) | each header is wired to fixed pins |
| `flow=`, `UART.RTS`, `UART.CTS` | not accepted | the headers carry TX and RX only; the PL011's CTS / RTS pins are servo ports 1–4 |
| `txbuf=` / `rxbuf=` any size | up to 1023 / 255 accepted, the ring staying its full size; larger: `ValueError` | the rings are fixed in static RAM, shared with `Bluetooth` and the serial REPL; a smaller request is accepted so ported code runs, and a GPS program's `rxbuf=512` is refused rather than silently given 255 |
| `bits` 5..8 unchecked (9 misbehaves), `parity` any int | `bits` 5..8, `parity` `None` / `0` / `1`, else `ValueError` | a setting the hardware cannot take is refused, never ignored |
| `write()` returns a short count (or `None`) after `timeout` | every byte queued, `len(buf)` returned, no timeout | EVN's rule: serial writes are never lossy |
| `init()` resets the UART (queued bytes lost) | waits for the queued bytes, then changes only what differs | never lossy; bytes received at the old settings stay readable |
| `deinit()` turns the UART off | releases the port; it keeps running for its queued bytes and the next owner; `close()` is the same | `Bluetooth` and the serial REPL share the port |
| `sendbreak()` breaks at once | sends the queued bytes first, then a two-frame break | a break over a byte in flight would corrupt a byte `write()` accepted |
| `irq()`, `IRQ_RXIDLE` / `IRQ_TXIDLE` / `IRQ_BREAK` | not provided: poll `any()` / `txdone()` | the receive interrupt already drains the FIFO into the ring for every user of the port (Bluetooth, the serial REPL), so an idle-line event cannot be told apart |
| `readline()` only | `readline(timeout=ms)` for one call as well | a line with a longer wait without re-configuring the port |
| `read(None)`: `TypeError` | the same as `read()` | kept from before 0.2.60 |
| `UART(1, ...)` again returns the same object, re-initialised | `OSError("serial port N is already open")` until the first object's `deinit()`; an object dropped without `deinit()` keeps the port until a soft reset | one object per header (a `Bluetooth` object and the serial REPL share the ports): keep the object and call `init()` to change its settings |
| — | `overflow()`, `flush_rx()`, `repl()` | EVN's |

**Before 0.2.60** `UART(n, baudrate)` took no keywords, `readline(timeout=5000)` waited 5 s by default and returned the line *without* its newline, and a long line never completed. Now the line keeps its `b"\n"` (`.strip()` it) and the wait is the object's `timeout` (0 unless you set it): a program written for the old `readline()` should pass `timeout=` to the constructor or to `readline()`. The old first argument was the timeout: `readline(2000)` now asks for at most 2000 bytes with the object's `timeout` (0 by default: it returns at once), so write `readline(timeout=2000)`.

**Notes.** One object per header: `UART(n)` raises `OSError` while an `evn.Bluetooth` object holds the port, `OSError("serial port N is already open")` while another `UART` object does, and the other way round. Opening or re-configuring a port that is already open never resets it and never drops queued or received bytes. A format or speed change on an open port pauses the port (its receiver included) for 15 bit times while the setting is written, as the SDK requires; `sendbreak()` pays that pause twice, once to start the break and once to end it (2 × 1.6 ms at 9600, 2 × 50 ms at 300).

## I2C — raw I2C port

Any I2C device on I2C port 1..16, through the board's multiplexers, for chips that are not standard peripherals. More in `examples/20_i2c/`; in blocks, **Serial and I2C** > **I2C** ([blocks reference](BLOCKS.md#serial-and-i2c-the-raw-ports)).

**Constructor**

```python
evn.I2C(port, *, freq=None, timeout=50000)
```

`freq` sets this port's clock, 10000..400000 Hz (else `ValueError`), for a device that needs a slower bus; `None` keeps the rate the port runs at. Every port has its own rate: the others stay as they are. The end of a program (the soft reset) puts every port back at 400 kHz. The clock period is exactly 1 / rate before the lines' rise time adds to it (a port never runs faster than its rate; earlier firmware ran "400 kHz" at about 350 kHz).

`timeout` is how long one call on this object may take on the bus, in µs (1..2000000, else `ValueError`), 50000 by default as MicroPython's `machine.I2C` on the Pico. It is for a chip that holds the clock low while it measures (clock stretching: an Si7021 or HTU21D read in its "hold master" mode, an SHT3x single shot with clock stretching, 10–50 ms). It covers the whole call, a held `stop=False` write included, and is never shorter than the transfer's own time on the wire (1 ms + 40 µs per byte at 400 kHz, proportionally more at a slower clock), so a long transfer never times out by being long. Past it the call raises `OSError(ETIMEDOUT)` and the bus is reset.

While a call is on the bus the board's main core does nothing else: the sensors it refreshes by itself (the IMU, the compass, the colour sensors ...), `evn.Pose` and a `DriveBase`'s `use_gyro(True)` correction wait until the call ends (the motors' own control runs on the other core and carries on). A chip that holds the clock for 50 ms pauses them for 50 ms, and a 4096-byte transfer at 400 kHz takes about 0.1 s. On a robot driving with `use_gyro(True)`, keep transfers short; for a chip that can measure without holding the clock (the Si7021 / HTU21D "no hold master" commands, an SHT3x without clock stretching), start the measurement and read the result on a later pass of your loop, and a smaller `timeout` caps the pause (the call then raises `OSError(ETIMEDOUT)`).

**Methods**

| Call | Does |
| :--- | :--- |
| `scan()` | the addresses 0x01..0x77 that answer (never lists 0x70) |
| `freq()` | the clock this port runs at, in Hz: 400000 unless slowed by `I2C(port, freq=...)` or by an extended peripheral on the port (the HiTechnic sensors: 100000) |
| `probe(addr)` | `True` if something answers at `addr` |
| `readfrom(addr, nbytes, stop=True, /)` | read `nbytes` (1..4096) bytes, returned as `bytes` |
| `readfrom_into(addr, buf, stop=True, /)` | read `len(buf)` bytes (1..4096) into `buf` (a `bytearray` or `memoryview`) |
| `writeto(addr, buf, stop=True, /)` | write `buf` (1..4096 bytes); returns the number of bytes acknowledged, `len(buf)` |
| `writevto(addr, vector, stop=True, /)` | write a tuple or list of buffers as one write (the address sent once), 1..4096 bytes in all; returns the bytes acknowledged |
| `readfrom_mem(addr, memaddr, nbytes, *, addrsize=8)` | write the register address `memaddr`, then read `nbytes` (1..4096) with a repeated start |
| `readfrom_mem_into(addr, memaddr, buf, *, addrsize=8)` | the same, into `buf` (1..4096 bytes) |
| `writeto_mem(addr, memaddr, buf, *, addrsize=8)` | write `buf` (0..4096 bytes, e.g. an EEPROM page) at the register address `memaddr`, address and data in one write |
| `stats()` | `((errors, recoveries, stuck), (...))` per bus. `errors` are failed transactions since boot; the expected NACK of a probe, of a constructor's ID-register identify on an empty port or of a driver's re-probe of an unplugged device is not one, so a climbing count means a real fault |

The transfer methods are MicroPython's `machine.I2C` methods with the same arguments, so a driver written for MicroPython (one that is handed an `I2C` object) runs unchanged: give it `evn.I2C(port)` where it expects `machine.I2C(...)`. As there, `stop` is passed by position only (the `/` above): `writeto(addr, buf, False)`; `stop=False` written as a keyword raises `TypeError`. `addrsize` is the register address's size in bits, 8, 16, 24 or 32 (sent most significant byte first); `memaddr` must fit in it.

**Example**

```python
from evn import I2C
bus = I2C(5)
print([hex(a) for a in bus.scan()])
```

**A MicroPython driver on an EVN port.** A driver written for `machine.I2C` takes an `evn.I2C` as it is. The TCS34727 colour sensor's ID, read the three ways such drivers read a register:

```python
from evn import I2C

class ChipID:
    """The shape of a stock MicroPython driver: it is handed a bus and an address."""
    def __init__(self, i2c, addr):
        self.i2c = i2c
        self.addr = addr
        self.buf = bytearray(1)

    def id_mem(self, reg):                        # readfrom_mem_into
        self.i2c.readfrom_mem_into(self.addr, reg, self.buf)
        return self.buf[0]

    def id_restart(self, reg):                    # writeto(stop=False), then readfrom_into
        self.i2c.writeto(self.addr, bytes([reg]), False)
        self.i2c.readfrom_into(self.addr, self.buf)
        return self.buf[0]

chip = ChipID(I2C(14), 0x29)                      # a TCS34727 on I2C port 14
print(hex(chip.id_mem(0x92)), hex(chip.id_restart(0x92)))   # 0x4d 0x4d
```

**Notes.** Addresses 0x01..0x77 are reachable; 0x01..0x07 matter for NXT-era sensors (0x01 is the 7-bit form of the NXT's 8-bit address 0x02), and 0x00, the general call, is refused. **0x70** (the multiplexers) is refused everywhere, and **0x6A on port 16** (the battery charger), with `ValueError`. Errors: `OSError(ENODEV)` nothing answered, `OSError(EIO)` present but refused a byte, `OSError(ETIMEDOUT)` the bus was held past the object's `timeout` and has been reset; on a bus still held after its reset (`stats()`'s `stuck`) every call raises `OSError(ETIMEDOUT)` at once instead of waiting out its `timeout`, and the reset is tried again as soon as the lines are free (else about every 130 ms). An `I2C(port).scan()` of a port with an IMU on it costs the IMU one FIFO byte (see [IMU](API_SENSORS.md#imu--gyro-and-accelerometer-mpu-6500)).

**`stop=False`.** On `writeto()` or `writevto()` (passed by position: `writeto(addr, buf, False)`) it holds the write (at most 4 writes and 32 bytes, else `ValueError`) and sends it just before this object's next transfer, which ends with the STOP: the usual register read `writeto(addr, bytes([reg]), False)` then `readfrom_into(addr, buf)` works as on any MicroPython board. The board cannot leave the bus open between two calls (it keeps serving the other sensors on the same bus in between), so the held bytes go out with the next call, not at the `writeto()`: a program that waits between a `stop=False` command and its read sends the command late (write a command that starts a measurement with `stop=True`), `scan()` and `probe()` leave it held, and nothing is sent if no call follows. An error in the held write (nothing at its address, a refused byte) is raised by the object's next call, whichever driver makes it, and that call's own transfer is then not sent: give each driver its own `I2C(port)` object when one of them uses `stop=False`, and an error always reaches the driver that caused it. Between the held write and the call's own transfer the board asks for no STOP (a repeated start), exactly as in `readfrom_mem()` and every built-in sensor's register read; the bench checks the order and the delivery, but a capture of the bus proving that no STOP reaches the wire is still to be made, so a chip that forgets its register at a STOP (an SMBus-style chip such as the MLX90614) is not yet verified. A read always ends with a STOP: `stop=False` on a read raises `ValueError`. Other differences from `machine.I2C`: a byte the device refuses raises `OSError(EIO)` (MicroPython's `writeto()` returns a smaller count instead), except the first byte after the address, which raises `OSError(ENODEV)` as an absent device does (the controller reports both as nothing sent); nothing answering at the address raises `OSError(ENODEV)`, as MicroPython's `SoftI2C` does, where the Pico's `machine.I2C` raises `OSError(EIO)` for every failure but a timeout (a driver that tests `e.errno == errno.EIO` should accept `errno.ENODEV` too); a transfer of zero bytes (`writeto(addr, b'')`, `writevto(addr, [])`, `readfrom(addr, 0)`, `readfrom_mem(addr, reg, 0)`) raises `ValueError`, so a driver that tests for its chip with an empty write gets `ValueError`, not `OSError`: use `probe(addr)` (`writeto_mem(addr, reg, b'')` still writes the register address alone); `addrsize=0` (no register address) and a `memaddr` that does not fit `addrsize` (a 16-bit register with the default `addrsize=8`, a negative one) raise `ValueError`, where `machine.I2C` sends no address or silently keeps the address's low bytes; `timeout` bounds a whole call where MicroPython's bounds each message of it, a transfer is at most 4096 bytes (on a slowed port what fits one second of the bus, `freq // 9` bytes, else `ValueError`), and there are no `start()`, `stop()`, `readinto()` or `write()` bus primitives (MicroPython has those on `SoftI2C` only).

## Programs, files and main.py

An 11 MB file system is mounted at `/`. `open()`, `import`, `os` and `vfs` work as in MicroPython. More in `examples/21_files/`; in blocks, the **Files** category ([blocks reference](BLOCKS.md#files-on-the-board)).

- **Start-up:** `boot.py` runs at power-on and after Ctrl-D; `main.py` then waits for a press of the user button (LED blinking fast) and runs again at the next press once it has ended. Enter or a REPL control (Ctrl-A to Ctrl-E) at the port during the wait (what the extension's own connections and `mpremote` send first) gives the REPL instead, so a session never runs `main.py`; any other byte is ignored, so a device at the wrong baud rate on a serial header that carries the REPL no longer cancels the start. At a terminal (*Open REPL*, a serial monitor) **press Enter first**: text typed before it during the wait is dropped, not run. With the extension's live console attached, only *Upload and run now* starts it. `evn.autostart(True)` in `boot.py` starts it without the press; `evn.reset(start=True)` does so for one boot.
- **Skipping it:** hold the user button while powering on to skip `main.py` once; after a watchdog reboot it is skipped automatically.
- **When it ends:** every motor coasts.
- **A file write is refused while a motor is driving:** `open(...).write(...)`, `flush()`, `close()`, `os.remove()` and any other flash write raise `OSError: [Errno 16] EBUSY` while any motor is in `run()`/`dc()`, in an unfinished `run_angle`/`run_target`/`run_time`/DriveBase maneuver, or tracking a moving target (a flash write would stall the 1 kHz motion engine for 45–400 ms, so the firmware refuses instead). A holding, braked or coasting motor does not block a write. The refusal surfaces from whichever call reaches the flash first — `open()`, `write()`, `flush()` or `close()`. Write your log after the move (`stop()`, `hold()` or `wait=True`, then write: `stop()`, `brake()`, `close()` and `evn.stop_all()` return only once the motor has taken the command, so the write straight after them is accepted), or catch `OSError` and compare `e.errno == 16` (the board's `errno` module has no `EBUSY` name: `errno.EBUSY` raises `AttributeError`) and write later; keep readings in a list meanwhile, or record them with [`DataLog`](#datalog--recording-on-the-board), which holds them in RAM and saves once the motors coast. Reads (`open(...).read()`, `import`) are never refused. (`evn.Flash` is the block device behind the file system and follows the same rule.)

## DataLog — recording on the board

`evn.DataLog` records motors, sensors, the battery, the user button and rows of the program's own values **on the board**: each source at the rate it makes new readings, kept in RAM, and written to a CSV file on the board once the motors coast. The same logger records for the extension's data logger (the graph button on the *Board* view). More in `examples/22_data_log/`.

**Constructor**

```python
DataLog(*headers, name='log', timestamp=True, extension='csv', append=False, size=32768, autosave=True, on_full='halve')
```

| Parameter | Default | Meaning |
| :--- | :--- | :--- |
| `*headers` | none | the columns of `log()`: at most 8 strings. Without headers the log has no `log()` |
| `name` | `'log'` | the file is `/data/<name>.<extension>`; without the clock (or `timestamp=False`) the name gets `_1`, `_2` ... rather than overwrite a file. `save(path)` does not create the folder |
| `timestamp` | `True` | add `_<date>_<time>` to the file name (`/data/run1_2026-09-26_14-03-11.csv`), only when the board's clock is set: the extension's live console sets it when it connects |
| `extension` | `'csv'` | the file's extension |
| `append` | `False` | add the samples to an existing file, without a new header (a header first when the file does not exist yet) |
| `size` | 32768 | bytes of RAM for the samples, 1024..1000000, taken from the heap at the first `start()` (`MemoryError` if the heap cannot give it). A sample of one value is 8 bytes: the default holds about 4 s of one 1 kHz channel before its first halving |
| `autosave` | `True` | a DataLog **not yet saved** (still recording, or stopped) is stopped and saved by itself when `main.py` ends, the editor's Run finishes, the board soft-reboots or its `with` block ends, once the motors coast; a stopped one still owed its autosave is saved first when another DataLog `start()`s; a motor still driving is reported (`DataLog: not saved ...`) and the samples stay for a `save()` |
| `on_full` | `'halve'` | what a channel whose share of the RAM is full does: `'halve'` keeps every second sample and halves its rate, so the recording never stops by itself and a long run comes back evenly thinned; `'drop'` drops the newest samples and counts them |

The first five are Pybricks' (`pybricks.tools.DataLog`); `size`, `autosave`, `on_full` and every method but `log()` are EVN's own.

### Channels

| Method | Does |
| :--- | :--- |
| `add(source, quantity, rate=0, *, input=None)` | add a channel and return its index (before `start()`: `RuntimeError` while recording; at most 16). `source` is a `Motor`, `evn.battery`, `evn.button`, a standard-peripheral object or an Extended `TCS3430`, `VL53L1X`, `HiTechnicColorSensor` or `HiTechnicCompass`; `quantity` the method name (table below; `ValueError` for one the device on the port does not have, e.g. a HiTechnic Color V1's `color_index`); `rate` samples a second, **0 = every new reading**. A rate above the source's own gives the source's. `input=` (0..7, 4..7 the differential pairs as in `ADC.voltage()`) picks an `ADC` input (default: the one `voltage()` reads) |
| `DataLog.quantities(source)` | a staticmethod: the quantity names `add()` takes for this source, e.g. `('angle', 'speed', 'load', 'stalled')` for a `Motor`. The sources are motors, `evn.battery`, `evn.button`, the standard peripherals and the Extended `TCS3430`, `VL53L1X`, `HiTechnicColorSensor` / `HiTechnicCompass` (a HiTechnic colour quantity is recorded only while the sensor is in its mode: the program's calls choose it, the logger never switches it); for a HiTechnic Color V1 only the names it has (`color`, `color_number`, `rgb`, `hsv`, `reflection`) |

| Source | Quantities (unit) | New readings a second |
| :--- | :--- | :--- |
| `Motor` | `angle` (deg), `speed` (deg/s), `load` (mNm, at the motor as `Motor.load()`) - unrounded, where the methods round to an int - `stalled` (0/1) | every new reading: up to 1000 (the motor engine's tick; about 460 with an IMU on the bus) |
| `evn.battery` | `voltage` (mV), `cells` (mV: `cells.cell1`, `cells.cell2`) | 25 |
| `evn.button` | `pressed` (0/1) | 1000 |
| `IMU` | `heading` (deg), `tilt` (deg: `.pitch`, `.roll`), `euler` (deg: `.heading`, `.pitch`, `.roll`), `acceleration` (mm/s²: `.x`, `.y`, `.z`), `angular_velocity` (deg/s: `.x`, `.y`, `.z`), `up` (the side's name), `stationary` (0/1), `temperature` (°C) | 200 |
| `Compass` | `heading` (deg), `heading_confidence`, `field` (G: `.x`, `.y`, `.z`), `raw` (`.x`, `.y`, `.z`), `temperature` (°C, QMC5883L) | 75 |
| `ColorSensor` | `hsv` (as `hsv()`: through the port's colour calibration when it has one), `rgb`, `raw` / `read` (`.c`, `.r`, `.g`, `.b`), `percent` (%: `.c`, `.r`, `.g`, `.b`), `color` (the colour's name, from the object's detectable colours; a colour outside the named set is written as its palette index), `ambient` (%), `lux` (lx), `color_temperature` (K) | its integration time |
| `DistanceSensor` | `distance` (mm; empty when out of range), `status` (the status's name) | its timing budget |
| `GestureSensor` | `gesture` (its name), `proximity`, `hsv` (as `hsv()`: through the port's colour calibration when it has one), `rgb`, `ambient` (%) | its cycle |
| `EnvSensor` | `temperature` (°C), `pressure` (Pa), `humidity` (%), `all` (the three) | its cycle |
| `TouchArray` | `touched` (the bit mask of the pads), `proximity` (0/1), `pressed` (0/1: any pad) | its cycle |
| `ADC` | `voltage` (V), `raw` | its data rate |
| [`TCS3430`](API_EXTENDED.md#tcs3430--xyz-colour-and-ambient-light-sensor) (Extended) | `xyz` (`.x`, `.y`, `.z`), `raw` (`.x`, `.y`, `.z`, `.ir1`), `ir`, `xy` (`.x`, `.y`; empty in the dark), `hsv` (through the port's colour calibration), `color` (the colour's name, from the object's detectable colours) - raw counts; `ir2()` is measured on request and is not a quantity | its cycle (integration + wait) |
| `HiTechnicColorSensor` (Extended) | LED on (active mode): `color` (the colour's name, from the object's detectable colours), `color_number` (0..17), `rgb` (0..255: `.r`, `.g`, `.b`), `hsv` (as `hsv()`: through the black / white in force, the port's stored ones from the start), `reflection` (%), and on a V2 `color_index` (0..63), `normalized_rgb` (0..255: `.r`, `.g`, `.b`); LED off (passive mode, V2): `ambient` (counts), `ambient_raw` (counts: `.r`, `.g`, `.b`, `.white`); raw mode (V2): `raw` (counts: `.r`, `.g`, `.b`, `.white`). A quantity is recorded **only while the sensor is in its mode**: the program's own calls choose the mode, the logger never switches it. A V1 has the first five; `color_index` / `normalized_rgb` on a V1 raise `ValueError` at `add()` | 100, in its mode |
| `HiTechnicCompass` (Extended) | `heading` (deg, relative to `north()`, as `heading()`) | 100 |
| `VL53L1X` (extended) | `distance` (mm; empty when not valid or not detected), `status` (the status's name, `not detected` under a distance threshold), `raw` (`.distance`, `.status`, `.signal`, `.ambient` in kcps), `detected` (1 when the latest measurement was valid and met the distance threshold, else 0; empty without one) | its measurement period (`inter_measurement()`, else the timing budget); under a distance threshold one reading a period either way |

A multi-part quantity is one channel of several values, written as `quantity.part` in the file (`acceleration.x`). Values are recorded in the physical units above, never in `SpeedUnit.PERCENT`.

### Recording

| Method | Does |
| :--- | :--- |
| `start()` | start a new recording (the samples of an earlier one are gone) and return the seconds the fastest-filling channel records before its first halving (`None` if it was already recording). The first `start()` takes `size` from the heap as one contiguous block (`size` plus about 3.4 KB), kept for the object's later starts until `close()`: a long program leaves the heap in pieces, so the block can be refused (`MemoryError`) with more than that free in total - make the `DataLog` and `start()` it early in the program, or give a smaller `size`. `ValueError` with no channel and no headers, or when `size` cannot give every channel room for 8 samples; `RuntimeError` while another DataLog records |
| `stop()` | stop recording; the samples stay in RAM for `save()`. With `autosave` a stopped log not yet saved is saved by itself when `main.py` ends, the editor's Run finishes, the board soft-reboots or a `with` block ends, once the motors coast |
| `running()` | `True` while recording |
| `log(*values)` | Pybricks: one row of the program's own numbers, one per header, stamped with the board's time (`ValueError` for another count; `None` is an empty cell, `True`/`False` are 1/0). Starts the log if it was never started; after `stop()` it raises `RuntimeError` (`start()` again for a new recording) |
| `info()` | a dict: `running`, `size`, `saved` (since the last start), `channels` (one dict each: `device`, `port`, `quantity`, `unit`, `rate` (samples a second now), `halvings`, `samples` (the rows held), `taken` (the samples taken), `same` (the samples folded into a run's end row, see *Notes*), `dropped` (the samples lost with `on_full='drop'`)); once started also `seconds`, `polls`, `cost_us` (the longest poll) and `cost_mean_us` |

### Saving

| Method | Does |
| :--- | :--- |
| `save(path=None)` | write the recording and return the file's path: `/data/<name>[_<date>_<time>].<extension>`, or `path` (positional). A coast the program just issued is given up to 5 ms to land, so `motor.stop(); log.stop(); log.save()` works; **while a motor still drives it is refused**, with `OSError(EBUSY)` (errno 16) and nothing written: stop or coast the motors first. `RuntimeError` while recording (`stop()` first), `ValueError` before anything was recorded |
| `close()` | stop and free the RAM, **without saving**. `with DataLog(...) as log:` stops, saves if `autosave` is on and nothing was saved yet, then closes on exit |

The file is the extension's CSV: `# key: value` header lines (the firmware, the RAM, one `# channel:` line per channel with its rate, how often it was halved and its rows and samples, e.g. `| 1081 rows of 1221 samples`; the `log()` rows' line ends `| 2 columns | 5 rows`), then `time_s,device,port,quantity,value,unit,note`, one line per value; the program's rows are under device `log` with the header names as quantities. `time_s` is the source's own time stamp since `start()`, in seconds, to the microsecond. Copy it to the computer with `mpremote cp :/data/run1.csv .` and open it with **Open in data viewer** (right-click the `.csv`; its statistics show a reading's rows and, while all of it is in view, the samples its `# channel:` line counts: `2 (1284 samples)`), or `pandas.read_csv(f, comment='#')`.

**Example**

```python
from evn import Motor, IMU, DataLog
motor = Motor(1)
imu = IMU(1)
log = DataLog('turn', 'heading', name='run1')
log.add(motor, 'angle')              # every new reading (up to 1000 a second)
log.add(imu, 'heading', 50)          # 50 a second
log.start()
for turn in range(4):
    motor.run_angle(500, 180)
    log.log(turn, imu.heading())     # one row of your own values
motor.stop()
log.stop()
print(log.save())                    # /data/run1_2026-09-26_14-03-11.csv
```

**Notes**

- **Best effort, lowest priority.** The sampler runs on Core 0 after every other service, reads only what the drivers already hold (no extra I2C traffic, no waiting) and records only **new** readings, each stamped with its source's own time — a stale value is never recorded twice. It never delays the motors or your program: Core 1 missed no tick while recording on the bench (2026-09-26).
- **What it costs and how fast it gets** (measured on the board, 2026-09-26): about 11–14 µs per poll with one motor channel, about 100 µs with seven channels at max including an IMU, 17–30 µs under a Python loop that never sleeps. The poll, and so a motor channel at max, runs at about 820 Hz with nothing on I2C and about 460 Hz with an IMU attached (its FIFO read holds Core 0). An IMU's acceleration at max records about 180 samples a second beside five other channels through the console (about 60 Hz for the heading with a compass also on the bus in the program bench), never twice within 2 ms.
- **A run of identical samples is two rows.** A sample bit-identical to the channel's previous row (every part of a multi-part quantity; numbers and names alike) adds no row: the run's first row stays, and its second row, the run's end, has its time stamp moved forward to the newest sample. However many samples of one source do not change, they cost two rows, and the file and the viewer show the value flat from the first stamp to the last. The window is exact, not a dead-band: every sample in it was taken and compared, and a change of one bit is recorded. `info()` counts the folded samples in `same`, so `taken` is more than `samples`. `log()` rows are never folded: every call is a row. Measured on the board (2026-09-26): a motor at rest recorded at max for 1.5 s is 2 rows of 1284 samples, the second stamped 1.499 s; a motor turning at 300 deg/s keeps about 88 % of its samples as rows (its 0.5° encoder steps repeat between ticks); the sampler's cost is unchanged.
- **When the RAM is full** (`on_full='halve'`), a channel keeps every second sample it holds and records at half its rate from then on; `info()` counts the `halvings`, and the file's `# channel:` line names the rate it ended at. Folded runs make a channel's share fill more slowly. Each channel's share of `size` is set at `start()` from its expected rate, so a slow channel is not thinned by a fast one.
- **Why the file waits.** A Pybricks hub writes each `log()` row at once; the EVN ALPHA must not write its flash while a motor drives (a sector erase stalls the 1 kHz motor loop), so rows and samples wait in RAM for `save()` or autosave. A `save()` of a few kB costs Core 1 about 45 missed ticks per flash sector it erases, which is why it is refused while a motor drives.
- One recording at a time: `start()` of another DataLog raises `RuntimeError` while one records; the same object's second `start()` returns `None`. A recording object is kept alive while it records, so `DataLog(...).start()` without a name records until the program ends. Every other call after `close()` raises `ValueError('DataLog is closed')`; `running()` answers `False` and `close()` is idempotent.
- The extension's data logger drives this same class through the live console (`on_full='drop'` for a light set it streams live, `'halve'` for a heavier one it holds on the board): see [GETTING_STARTED §3c](GETTING_STARTED.md#3c-recording-data-the-data-logger).

## Timing: `wait` and `StopWatch`

| Call | Does |
| :--- | :--- |
| `evn.wait(time)` | pause the program for `time` ms (positional, or `time=` as in Pybricks), a fraction included (`wait(1.5)` is 1.5 ms) - never less, and at most the one background refresh running when the time is up more: tens of µs with little open, a few ms while a `Pose` runs, more if a sensor times out; the sensors keep being refreshed all the way (2026-09-28; before, a wait could end up to 1 ms early, dropped the fraction, and ran up to 1 ms over); motors keep doing what they were told |
| `evn.StopWatch()` | `time()` ms since construction, `pause()`, `resume()`, `reset()` |

## Appendix: diagnostics and validation

This part is for bench work and bug reports, not for programs.

### Diagnostics

| Call | Returns |
| :--- | :--- |
| `evn.core1_status()` | `(ticks, period_min_us, period_max_us, exec_max_us, missed, late)` of the 1 kHz motion engine, or `None` when it is not running — `missed` = deadlines the alarm ISR skipped (a flash lockout gap), `late` = loop-body overruns (a body that ran past its 1 ms; the count `exec_max_us` alone cannot give). Both should read 0 |
| `control.state()` | `(reference_deg, x1_deg, x2_degs, x3_degs2, applied_mv, hold, assist)`: the position reference, the ADRC observer's position / speed / total-disturbance estimates (output units; `x3` is the unmodelled acceleration being cancelled — `load()` is it through the torque constant), the voltage applied last tick, and whether the observer is at its hold bandwidth / the breakaway assist is armed. A 1 kHz diagnostic for tuning and benches. `model.state()` (below) is the legacy Luenberger observer, not this estimator |
| `model.state()` | `(angle, speed, current, stalled)`: the legacy observer's estimates in deg, deg/s, mA and a flag; the angle is the estimate for its next 5 ms step, so while the shaft turns it runs on average speed × 3 ms ahead of `angle()` |
| `model.settings()`, `model.settings(values)` | the observer's settings in firmware units; only the first four can be written (the four gain constants must be passed back unchanged, else `ValueError`); debug use |

Bench diagnostics, not for programs: `_stats()` (nine counters: steps, rejected wheel / lateral / magnetometer updates, the yaw-rate row's reject run near rest, wheel-gate escapes taken, steps the wheels took while the IMU was silent or behind (its newest sample older than 25 ms, as after a Core 0 stall), steps that integrated a time gap — a Core 0 stall over 100 ms, whose exact encoder travel is integrated as one arc instead of being lost — and compass samples dropped for a field that is not the Earth's), `_bias()` (the filter's gyro bias and its sigma in deg/s, counter-clockwise positive — the filter's frame, not the heading's) and `_step(...)` (one filter step on SI values, for a `Pose(_test=True)` object).

### Validation record

What the defaults and figures in this reference were measured on.

- **Motor defaults:** the default limits and the `control.pid()` / `control.evn()` values are the fastest moves of the validation harness.
- **Motor figures on the reference rig:** `calibrate()` at 8.16 V measured EV3 Large 967 deg/s and EV3 Medium 1560 deg/s no-load. `run_until_stalled` breakaway: EV3 Medium ≈ 50 %, EV3 Large < 40 % duty. `run_time(0, 10**10)` used to finish at once (bug B-035); the `time` bound came from it.
- **DriveBase:** endpoints within 1°, the two wheel profiles ending within 5 ms of each other on the reference robot. The straight-acceleration default: at the full 1630 mm/s² five 30 cm out-and-backs left the robot 8 mm off its floor mark from tyre slip the encoders cannot see; at 1230 and below it came back within 1–3 mm, and the turns showed no such dependence.
- **Standard peripherals:** all fifteen on hardware — colour sensor, distance sensor, gesture sensor, environment sensor, compass, seven-segment display and OLED 2026-09-17; ADC, touch array, IMU, LED matrix, RGB LED module 2026-09-18; the Bluetooth module and both Geekservo profiles 2026-09-17; the compass on the HMC5883L (the QMC5883L path has not been benched yet). Per device:

- **ColorSensor:** Bench-validated 2026-09-17 on three TCS34725 sensors at once: every setting and derived value against the datasheet, `age` ≤ 5 ms with three attached, hot-plug with the settings re-applied.
- **ADC:** Bench-validated 2026-09-18 on the EVN ADC module with three decoys: 0 V, 3.3 V and ±3.3 V differential at every range, a servo-pulse average as a mid-scale signal, hot-plug with the settings kept; re-benched 2026-09-18 on the loaded rig with all four motors running (68 / 68, no pickup on an open input) and 2026-09-19 on firmware 0.2.23 (74 / 74).
- **EnvSensor:** Bench-validated 2026-09-17 on the EVN module with three decoys: every getter and setter, the noise figures against the datasheet, forced mode (99.4–100.4 ms, never a repeat), a breath and a fingertip, hot-plug with the settings kept; re-benched 2026-09-19 on firmware 0.2.23 (91 / 91).
- **DistanceSensor:** Bench-validated 2026-09-17 on three sensors at once with a colour sensor as a decoy at the same address: every setting with its effect, `age` ≤ 30 ms with three attached, hot-plug with the settings kept; re-benched 2026-09-18 with a target at 59 mm (58 / 58) and 2026-09-19 on firmware 0.2.23 (57 / 58, the target band since widened).
- **Compass:** Bench-validated 2026-09-17 on the EVN HMC5883L module with three decoys: every setter and refusal against the datasheet, heading sign by a clockwise turn, a 25 s tumble calibration (coverage 22/26, residual 3.7 %), heading noise 0.14° RMS when still, hot-plug with the settings kept; on the loaded rig (2026-09-18), away from the motors, the field moved ≤ 0.015 G with every motor running. The QMC5883L path has not been on hardware yet.
- **IMU:** Bench-validated 2026-09-17 (104 self-checks on an upside-down module with a decoy: frames, every setting and refusal, the DMP's gyro calibration at 14.2 s, drift 0.2° per 5 s, `age` ≤ 6 ms) **and 2026-09-18 by hand**: a quarter turn clockwise → `heading()` +89.8°, unwrapped past 360°; pitch and roll signs; `up()` on every side; taps and the orientation events; same-socket hot-plug.
- **TouchArray:** Bench-validated 2026-09-18 on the EVN touch module with decoys on other ports: every default and setter cross-read from the chip's registers, single pads, three pads at once, a 3 s hold without chatter, five taps counted by `events()`, proximity with the electrodes summed, hot-plug; re-benched the same evening next to the drive motors — no touch or event from four running motors, the deepest dip 4 counts against the threshold of 12.
- **GestureSensor:** Bench-validated 2026-09-17 on the EVN module (ID 0xA8) with two VL53L0X and a TCS34725 as decoys: every setting against the datasheet's scaling, 12/12 swipes named the way the hand moved, `age` ≤ 3 ms, hot-plug with gain and integration time kept, 88/88 checks.
- **MatrixLED:** Bench-validated 2026-09-18 on the EVN 8×8 module with two decoy devices: every drawing call checked on the chip's own RAM, the pictures read by eye (corners, `-42`, `HI`, the arrow after `orientation(Side.RIGHT)`, dim and bright, the heart), a forced chip reset healed in 107 ms, an unplug and replug restoring the picture, brightness and orientation.
- **SevenSegmentLED:** Bench-validated 2026-09-17 on the EVN seven-segment board with three decoy devices: every call checked on the chip's own RAM and read by eye (`12.50`, ` -42`, `HELP`, `12:34`, brightness 1 and 16, blinking at 1 Hz), an unplug and replug restoring the brightness, blink and number.
- **Display:** Bench-validated 2026-09-17 on the EVN OLED (an SSD1315) with three decoy devices: every drawing call checked in the firmware's picture and the panel read by eye (the logo, the text grid, flip, invert, contrast, the shapes, the `print()` console, the hardware scroll, blink, zoom), an unplug and replug restoring the contrast, flip and picture.
- **RGBLED:** Bench-validated 2026-09-18 on the EVN RGB LED module (servo ports 1, 2 and 4): colour order, LED 0 at the module's connector end, `invert`, brightness, `count`, blink / animate confirmed by eye; 83 / 83 self-checks, frames at the wire time (620 µs for 8 LEDs), patterns within 1 ms of the requested times.
- **EVN Extended Peripherals:** Bench-validated 2026-09-26 on the rig with an HMC5883L and an MPU-6500 on other ports: a HiTechnic Color Sensor V2 (firmware V1.5) and a HiTechnic Compass (V1.23), 54 / 54 checks with 0 bus errors and the HMC5883L on the same bus still fresh (age ≤ 15 ms); a standard HuskyLens, 42 / 42 checks at 78 frames a second, all seven algorithms switched in 76–346 ms, 0 bus errors. The HiTechnic V1 has not been on hardware (its support is from the register map).
- **VL53L1X, TCS3430 (EVN Extended Peripherals):** bench 2026-09-26 on the rig: VL53L1X port 1, TCS3430 port 16. VL53L1X: model ID 0xEACC read back, long mode at 33 ms giving about 31 readings a second, a distance-mode or timing-budget change applied in 58–179 ms. TCS3430: ID 0xDC (REVID 0x41), one new reading per integration cycle (every ~3 ms at the 2.78 ms default; 48–52 ms apart at 50 ms), 16–18 counts at 64x with nothing in front, and the gains against 64x at the datasheet's ratios (128x 2.06, 16x 0.243, 1x 0.016). Bench scripts: `mpy_vl53l1x.py` 37/37 (median 149 mm, 10-90 % within 146-151 mm on a fixed target; all 13 mode / budget pairs), `mpy_tcs3430.py` 42/42 (under the first, CIELAB matcher, since replaced), 0 bus errors. TCS3430 colour by hand (owner, 2026-09-26; 2.78 ms at 64x, targets about 1 cm, after `calibrate_black()` with nothing in front and `calibrate_white()` on a white sheet): nothing `NONE` 1.00, white `WHITE` 1.00 (s 0, v 100), red `RED` 0.98 (h 1, s 83), green `GREEN` 0.75 (h 140, s 94), blue `BLUE` 0.91–0.93 (h 231, s 73); uncalibrated, the warm LED made a white sheet read `YELLOW` (0.29–0.38, h ~36, s ~76) and nothing in front read `BLUE`.
- **Bluetooth:** Bench-validated 2026-09-17 with two modules on both serial ports: the PC's own adapter as the peer (64 KiB echoed intact full duplex and 21 ms round trips at 230400), command mode 12 / 12 with the address matching the PC's inquiry, module to module 8 / 8 (32 KiB host → remote intact at 12.9 KB/s), 96 KB of back-to-back writes intact at 230400, and the REPL, Run and Ctrl-C over the air.
- **UART:** the transport under `Bluetooth` above (rings, overflow count, never-lossy writes) is the one benched 2026-09-17. The `machine.UART` layer of 0.2.60 (formats, inversion, the read timeouts, `flush()` / `txdone()` / `sendbreak()`) is host-checked on the real `hal_uart.c` (`tools/host_tests/run_uart.py`, 54 checks on a simulated PL011 whose pin mux clears the pad overrides, as the SDK's does) and bench-validated 2026-09-28 on Serial 1 with a TX-to-RX jumper (`tools/bench/host_uart_machine.py --loopback 1`, 46 / 46 twice, no missed or late control tick): a first open with `invert=INV_TX` inverting the line; three bytes, under the receive interrupt's trigger, seen at once by `any()`, `readline()`, `read(3)` and `readinto()` with `timeout=0`; 200 bytes in one `read(200)` at 9600; 5N1, 6E1, 7O2, 8E2 and 8O1, each byte cut to its data bits and each frame its length on the wire (200 frames within 2 % of start + data + parity + stop bits); both lines inverted; `sendbreak()` taking its two register waits and the two-frame hold (5.6 ms at 9600) and never read as data, alone or between two lines; 300 unread bytes kept 255 / counted 45; 4096 bytes in one `write()` all on the wire, `flush()` ending with the last one (356.0 ms against 355.6); `readline()` with its newline, the object's timeout (501 ms for 500), a partial line, `timeout=` for one call; `read()` / `readinto()` / `any()`; iteration; `init(stop=2)` waiting for 200 queued bytes (210 ms) and dropping nothing received; every refusal. The run with a peer at the other end (through the Bluetooth module) is still to come.
- **Servo:** Bench-validated 2026-09-17, both Geekservo profiles against an encoder coupled to the horn: the 270° servo travels 277..281° over its 0..270 command, linear, and follows `move(270, 200)` at 200..206 deg/s; the continuous-rotation servo shows no creep at duty 0, about 185 / 315 / 450 deg/s at duty 50 / 75 / 100, starts in about 100 ms and stops in about 150 ms (under a heavy load it is torque-limited below duty 50).
