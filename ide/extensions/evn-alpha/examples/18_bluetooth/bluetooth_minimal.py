"""Bluetooth: minimal

A Bluetooth echo: the board says hello to the phone, then answers every line the phone sends
with "you said: ..." and prints it on the computer too. Runs until you press Stop. Switch the
board on without holding the module's button (held, the set-up reprograms the module's name,
speed and role), and do not have the board's REPL on this module: while it runs over the module
it takes what the phone sends, and its own Bluetooth object holds the port: Bluetooth(2) here
then fails with "OSError: serial port 2 is already open". The Board view's broadcast button puts
it there by writing `bt = evn.Bluetooth(2); bt.repl(True)` into boot.py; take that line out of
boot.py and reset the board (a plain reset: the REPL stays on the module across a soft reboot).

The Python of bluetooth_minimal.evnblocks: the blocks and this file are the same program (open
the blocks file under Examples to see it as blocks).

Needs: the Bluetooth module on serial port 2, and a phone (Android) or PC paired with it (PIN 1234) running a Bluetooth serial terminal app that ends each line it sends with a newline
"""
from evn import wait, Bluetooth

# Set up all devices.
bluetooth_2 = Bluetooth(2)

line = None


# The main program starts here.
bluetooth_2.write((str('Hello from EVN! Send me a line.') + '\n').encode())
while True:
    if bluetooth_2.any() > 0:
        line = (bluetooth_2.readline(1000) or b'').decode()
        print(line)
        bluetooth_2.write((str('you said: ' + str(line)) + '\n').encode())
    wait(20)
