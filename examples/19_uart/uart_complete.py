"""UART: the whole API

MicroPython's machine.UART on Serial 1 wired back to itself: the settings and the read timeouts,
writing and waiting for the bytes to leave, reading lines, raw bytes and into a buffer, lines in a
loop, changing the speed and the format, a break, inverted lines, dropping input, the receive
ring's overflow count, and handing the port back. Everything it sends comes straight back, so each
step can check itself.

Needs: a jumper wire from TX to RX on Serial 1 (the board hears what it sends). Without the wire
the program still runs and says nothing came back.
"""
from evn import UART, wait

# machine.UART's constructor: the baud rate, then bits / parity / stop, and the read timeouts in ms:
# a read waits at most `timeout` for its first byte and `timeout_char` for each next one. A read that
# stops short of its count (or read() with no count) then waits one more `timeout` for further bytes.
serial = UART(1, 115200, bits=8, parity=None, stop=1, timeout=500, timeout_char=10)
print(serial)                                    # every setting, as machine.UART prints them

# --- writing ----------------------------------------------------------------------------------------
# write() queues every byte (it never drops any) and returns how many it took; txdone() says whether
# they have all left, flush() waits until they have.
print("queued", serial.write(b"first line\r\nsecond line\n"), "bytes")
print("all sent?", serial.txdone())              # False: 24 bytes take 2 ms at 115200
serial.flush()
print("after flush():", serial.txdone())         # True

# --- reading lines -----------------------------------------------------------------------------------
# readline() keeps the line's end (machine.UART): strip() it for the text alone. It returns None when
# nothing came within the timeout, and the part that came when a line stops half way.
print("line 1:", serial.readline())              # b'first line\r\n'
line = serial.readline()
print("line 2:", line.strip() if line else line)  # b'second line'
print("line 3:", serial.readline(timeout=0))     # None: nothing more (timeout= for this call only)

# --- raw bytes ---------------------------------------------------------------------------------------
serial.write(b"ABCDEFGH")
serial.flush()
print(serial.any(), "bytes waiting")             # 8 with the wire
print("read(3):", serial.read(3))                # b'ABC'
buf = bytearray(4)
print("readinto:", serial.readinto(buf), buf)    # 4 bytearray(b'DEFG')
print("read():", serial.read())                  # b'H', about 0.5 s later: the quiet gap, then one more timeout
print("read() again:", serial.read())            # None, after the 0.5 s timeout: nothing came

# --- lines in a loop ---------------------------------------------------------------------------------
serial.write(b"one\ntwo\nthree\n")
for received in serial:                          # a readline() each time, until one comes back empty
    print("got", received)

# --- another speed, another format ------------------------------------------------------------------
# init() changes only what it is given; whatever is still queued goes out first, at the old settings.
serial.init(9600, timeout=1000)
serial.write(b"slow\n")
print("at 9600 baud:", serial.readline())
serial.init(115200, bits=7, parity=0, stop=2)    # 7 data bits, even parity, 2 stop bits
serial.write(b"seven bits\n")
print("7E2:", serial.readline())
serial.init(bits=8, parity=None, stop=1)

# --- a break -----------------------------------------------------------------------------------------
# sendbreak() holds TX low for two characters' time; the receiver throws a break away (it is not data).
serial.sendbreak()
serial.write(b"after the break\n")
print(serial.readline())

# --- inverted lines ----------------------------------------------------------------------------------
# invert= flips a line so that it idles low (INV_TX, INV_RX, or both): flipped at both ends of the
# wire, the loop still hears itself.
serial.init(invert=UART.INV_TX | UART.INV_RX)
serial.write(b"inverted\n")
print("inverted both ways:", serial.readline())
serial.init(invert=0)

# --- dropping input, the receive ring ----------------------------------------------------------------
serial.write(b"stale data")
serial.flush()
wait(5)
serial.flush_rx()                                # throw away whatever arrived (EVN's; flush() is for output)
print("after flush_rx():", serial.any(), "bytes waiting")
# Incoming bytes wait in a 256-byte ring until the program reads them. A program that reads too
# rarely loses the rest; overflow() says how many were lost since it was last asked (and clears).
print("overflow before:", serial.overflow())
serial.write(b"x" * 300)                         # more than the ring holds, nobody reading
serial.flush()
wait(5)
print("waiting", serial.any(), "- lost", serial.overflow(), "bytes")   # 255 kept, 45 lost
print("overflow again:", serial.overflow())      # 0: read and cleared
serial.flush_rx()

# --- handing the port back ---------------------------------------------------------------------------
# One object per header: deinit() hands the port back (it keeps running and keeps any bytes still
# queued to send), so a new object - or evn.Bluetooth - can take it. close() is the same call.
serial.deinit()
again = UART(1, 9600, timeout=1000)
again.write(b"a new object\n")
print(again.readline())
again.close()
