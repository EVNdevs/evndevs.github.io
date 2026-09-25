"""UART: minimal

Sends a line out of Serial 1 and prints the line that comes back. With a wire from TX to RX on
the Serial 1 header the board hears itself; with another device on the header, that device
answers.

Needs: a jumper wire from TX to RX on Serial 1 (or a device talking 115200 baud lines there)
"""
from evn import UART

serial = UART(1, 115200)                         # Serial 1 at 115200 baud
serial.write(b"hello\n")                         # queued and sent in the background
print("heard:", serial.readline(timeout=1000))   # the line without its newline, or None after 1 s
serial.close()
