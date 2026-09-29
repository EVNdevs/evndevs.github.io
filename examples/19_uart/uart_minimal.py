"""UART: minimal

Sends a line out of Serial 1 and prints the line that comes back. With a wire from TX to RX on
the Serial 1 header the board hears itself; with another device on the header, that device
answers.

The Python of uart_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: a jumper wire from TX to RX on Serial 1 (or a device talking 115200 baud lines there)
"""
from evn import StopWatch, UART

# Set up all devices.
uart_1 = UART(1, 115200)

def bytes_to_text(data):
    try:
        return data.decode()
    except UnicodeError:
        return ''.join(chr(byte) for byte in data)

def uart_receive(uart, line_wait=None, pending={}):
    # pending: per port, the part of a line that had arrived when a wait ended
    data = bytearray(pending.pop(id(uart), b''))
    if line_wait is None:
        waiting = uart.any()
        if waiting:
            data += uart.read(waiting) or b''
        return bytes_to_text(bytes(data))
    watch = StopWatch()
    ready = uart.any()  # what has already arrived is read to its line end, however short the wait
    while True:
        if uart.any():
            byte = uart.read(1) or b''
            if byte == b'\n':
                return bytes_to_text(bytes(data)).rstrip('\r')
            data += byte  # grows in place: no new copy of the line for every byte
            if len(data) >= 1024:
                return bytes_to_text(bytes(data))
            ready -= 1
            if ready > 0:
                continue
        else:
            ready = 0
        if watch.time() >= line_wait:
            pending[id(uart)] = bytes(data)
            return ''


# The main program starts here.
uart_1.write(b'hello\n')
print('heard: ' + str(uart_receive(uart_1, 1000)))
