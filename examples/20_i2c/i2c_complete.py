"""I2C: the whole API

Raw I2C, for a device the evn module has no class for. Every I2C method once: freq() tells the
port's clock (each port has its own; I2C(port, freq=100000) slows one for a device that needs it),
scan() lists the addresses that answer, and each one that has an ID register is named by reading it
(an address alone proves nothing: another chip can sit at it), then the EVN IMU module (an MPU-6500)
is read register by register - its configuration, then acceleration, temperature and turn rate - and
last stats() reports the bus health.

The only writes are harmless ones: a register number before a read, and waking the MPU-6500 when
an IMU object's close() left it asleep (put back as it was at the end). The board refuses 0x70
(its I2C multiplexers, on every port) and 0x6A on port 16 (its battery charger) with ValueError.

Needs: an EVN IMU module (MPU-6500) on I2C port 1. Other EVN modules on that port are named when
they have an ID register; the rest (display 0x3C, LED matrix 0x71, seven-segment 0x74, touch pads
0x5A, ADC 0x48) are listed by address only, not identified.
"""
import struct
from evn import I2C, wait

PORT = 1

# EVN modules that have an ID register: (address, ID register, the ID it reads, name).
# Two chips share 0x29, so the colour sensor is tried first: its ID register is 0x12 with the
# command bit 0x80 set, and reading that on the distance sensor is harmless.
KNOWN = [
    (0x0D, 0x0D, [b"\xff"], "QMC5883L compass"),
    (0x1E, 0x0A, [b"H43"], "HMC5883L compass"),              # three ID registers, 0x0A..0x0C
    (0x29, 0x92, [b"\x44", b"\x4d"], "TCS34725 colour sensor"),
    (0x29, 0xC0, [b"\xee\xaa\x10"], "VL53L0X distance sensor"),       # 0xC0..0xC2, as the driver checks
    (0x39, 0x92, [b"\xab", b"\xa8"], "APDS-9960 gesture sensor"),
    (0x68, 0x75, [b"\x70"], "MPU-6500 IMU"),
    (0x76, 0xD0, [b"\x60"], "BME280 environment sensor"),
]


def identify(bus, addr):
    """The name of the device at addr, from its ID register, or None."""
    for known_addr, reg, ids, name in KNOWN:
        if known_addr != addr:
            continue
        try:
            if bus.readfrom_mem(addr, reg, len(ids[0])) in ids:   # read-only
                return name
        except OSError:                          # did not answer that register: not this chip
            pass
    return None


bus = I2C(PORT)                                  # I2C(PORT, freq=100000) would slow this port only
print("port %d runs at %d Hz" % (PORT, bus.freq()))   # 400000 unless slowed

# --- scan: who answers, and what is it -------------------------------------------------------------
for addr in bus.scan():                          # every address 0x01..0x77 that answers
    name = identify(bus, addr)
    print(hex(addr), name if name else "- not identified (no ID register known here)")

# --- the MPU-6500, register by register ----------------------------------------------------------
MPU = 0x68
WHO_AM_I = 0x75          # reads 0x70 on an MPU-6500
PWR_MGMT_1 = 0x6B        # bit 6 = asleep
GYRO_CONFIG = 0x1B       # bits 4..3: range 250 / 500 / 1000 / 2000 deg/s
ACCEL_CONFIG = 0x1C      # bits 4..3: range 2 / 4 / 8 / 16 g
ACCEL_XOUT_H = 0x3B      # 14 bytes: accel x, y, z, temperature, gyro x, y, z (16-bit, high byte first)

if not bus.probe(MPU):                           # does anything answer at 0x68?
    print("nothing at 0x68 on port", PORT)
elif identify(bus, MPU) != "MPU-6500 IMU":
    print("0x68 answers, but it is not an MPU-6500: left alone")
else:
    # the same WHO_AM_I read in two steps: write the register number, then read from there
    bus.writeto(MPU, bytes([WHO_AM_I]))
    print("WHO_AM_I", hex(bus.readfrom(MPU, 1)[0]))

    # awake from power-on (PWR_MGMT_1 = 0x01), but an IMU object's close() puts it to sleep
    power = bus.readfrom_mem(MPU, PWR_MGMT_1, 1)[0]
    if power & 0x40:
        bus.writeto_mem(MPU, PWR_MGMT_1, bytes([0x01]))   # awake, clocked from the gyro
        wait(100)                                         # the first samples take a moment

    # the ranges in force say what one count is worth
    gyro_fs = (bus.readfrom_mem(MPU, GYRO_CONFIG, 1)[0] >> 3) & 3
    accel_fs = (bus.readfrom_mem(MPU, ACCEL_CONFIG, 1)[0] >> 3) & 3
    counts_per_g = 16384 >> accel_fs              # 16384 counts per g at 2 g, half that at 4 g ...
    counts_per_dps = 131 / (1 << gyro_fs)         # 131 counts per deg/s at 250 deg/s ...
    print("ranges: %d g, %d deg/s" % (2 << accel_fs, 250 << gyro_fs))

    for _ in range(5):
        ax, ay, az, t, gx, gy, gz = struct.unpack(">7h", bus.readfrom_mem(MPU, ACCEL_XOUT_H, 14))
        print("accel (%.2f, %.2f, %.2f) g   %.1f C   turn (%.1f, %.1f, %.1f) deg/s (chip axes)"
              % (ax / counts_per_g, ay / counts_per_g, az / counts_per_g, t / 333.87 + 21,
                 gx / counts_per_dps, gy / counts_per_dps, gz / counts_per_dps))
        wait(200)

    bus.writeto_mem(MPU, PWR_MGMT_1, bytes([power]))      # put back: asleep again if it was

# --- bus health ----------------------------------------------------------------------------------------
# per bus (ports 1-8, ports 9-16): failed transactions since boot, bus resets after a timeout, and
# whether a line was still held low after the last reset. A number that keeps climbing is a fault.
(errors0, resets0, stuck0), (errors1, resets1, stuck1) = bus.stats()
print("ports 1-8: %d errors, %d resets, stuck %s" % (errors0, resets0, stuck0))
print("ports 9-16: %d errors, %d resets, stuck %s" % (errors1, resets1, stuck1))
