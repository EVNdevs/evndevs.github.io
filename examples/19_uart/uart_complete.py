"""UART: the whole API

Every UART method once, on Serial 1 wired back to itself: writing, reading lines and raw bytes,
what is waiting, dropping input, the receive ring's overflow count, and closing so the port can be
opened again at another speed. Everything it sends comes straight back, so each step can check
itself.

Needs: a jumper wire from TX to RX on Serial 1 (the board hears what it sends). Without the wire
the program still runs and says nothing came back.
"""
from evn import UART, wait

serial = UART(1)                                 # Serial 1 (2 = Serial 2), 115200 baud by default

# --- writing and reading lines --------------------------------------------------------------------
# write() queues every byte (it never drops any) and returns how many it took.
print("queued", serial.write(b"first line\r\nsecond line\n"), "bytes")
print("line 1:", serial.readline())              # b'first line' (no \r\n); waits up to 5 s
print("line 2:", serial.readline(timeout=500))   # None if no whole line came within 0.5 s
print("line 3:", serial.readline(timeout=0))     # 0: only a line already complete, never waits

# --- raw bytes ------------------------------------------------------------------------------------
serial.write(b"ABCDEFGH")
wait(10)                                         # 8 bytes at 115200 baud take under 1 ms
print(serial.any(), "bytes waiting")             # 8 with the wire
print("read(3):", serial.read(3))                # at most 3 of them: b'ABC'
print("read():", serial.read())                  # everything else: b'DEFGH'
print("read() again:", serial.read())            # None: nothing is waiting

# --- dropping input -------------------------------------------------------------------------------
serial.write(b"stale data")
wait(10)
serial.flush_rx()                                # throw away whatever arrived
print("after flush_rx():", serial.any(), "bytes waiting")

# --- the receive ring -----------------------------------------------------------------------------
# Incoming bytes wait in a 256-byte ring until the program reads them. A program that reads too
# rarely loses the rest; overflow() says how many were lost since it was last asked (and clears).
print("overflow before:", serial.overflow())
serial.write(b"x" * 300)                         # more than the ring holds, nobody reading
wait(50)
print("waiting", serial.any(), "- lost", serial.overflow(), "bytes")   # ring full, rest lost
print("overflow again:", serial.overflow())      # 0: read and cleared
serial.flush_rx()

# --- another speed --------------------------------------------------------------------------------
# One object per header: close() hands the port back (it keeps running and keeps any bytes still
# queued to send), so it can be opened again - here at 9600 baud - or given to evn.Bluetooth.
serial.close()
slow = UART(1, 9600)
slow.write(b"slow\n")
print("at 9600 baud:", slow.readline(timeout=1000))
slow.close()
