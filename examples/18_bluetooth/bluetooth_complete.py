"""Bluetooth: the whole API

Every Bluetooth method a program uses: what the module reports about itself, sending lines to a
phone, and the ways of receiving: a whole line, waiting for a word, a few bytes, everything
waiting, and a line only if one is complete. The calls that change the module's own settings
(its name, speed, role, factory reset, raw AT commands, the REPL over Bluetooth) are left out on
purpose: see the Bluetooth section of the API reference.

Once a phone is connected the module is a cable without wires: the bytes the board writes come
out on the phone, and what the phone sends waits on the board until the program reads it. The
board queues every byte you write, it never drops one; with no phone connected the module itself
throws them away.

Switch the board on WITHOUT holding the module's button: with the button held, Bluetooth(2)
programs the module (its name, speed and role). If the REPL runs over this module (the Board view's
broadcast button wrote `bt = evn.Bluetooth(2); bt.repl(True)` into boot.py), that boot.py object
holds the port and Bluetooth(2) here raises "OSError: serial port 2 is already open": the example
then only says what to do and leaves the module as it is.

Needs: the Bluetooth module on serial port 2, and a phone (Android) or PC paired with it (PIN 1234)
running a Bluetooth serial terminal app that ends each line it sends with a newline.
"""
from evn import Bluetooth, StopWatch, wait

# --- the constructor ---------------------------------------------------------------------------
try:
    bt = Bluetooth(2)                    # serial port 1 or 2, 230400 baud; waits up to 3 s
except OSError as e:                     # "serial port 2 is already open": boot.py's Bluetooth holds it
    print("Bluetooth(2):", e)
    print("Another object already uses the module - usually boot.py's `bt = evn.Bluetooth(2); bt.repl(True)`,")
    print("written by the Board view's broadcast button. Take that line out of boot.py and reset the board,")
    print("then run this again.")
    raise SystemExit
print(bt)                                # port, baud, name, mode, state


def tour():
    """Everything below runs only when the module is free for this program."""
    # --- what the module reports ---------------------------------------------------------------
    print("state:", bt.state())              # 'data': ready to carry your bytes
    print("ready:", bt.ready())              # True (it cannot tell whether a phone is connected)
    print("ready after", bt.startup_time(), "ms")
    # configured() is True only when the module's button was held at power-on and the board has just
    # programmed it; normally it is False: the module is used as it was set up before.
    print("programmed now:", bt.configured())
    print("refused settings:", bt.config_errors())   # () when nothing was refused
    print("command mode:", bt.in_command_mode())   # False: the module carries data, not AT commands

    # --- sending -------------------------------------------------------------------------------
    bt.clear()                               # forget anything that arrived before now
    bt.write(b"Hello from EVN!\n")           # bytes; end a line with \n for the phone app
    bt.write("Text works too.\n".encode())  # text becomes bytes with .encode()

    # --- receiving a line -------------------------------------------------------------------------
    bt.write(b"Send me a line (30 s).\n")
    line = bt.readline(30000)                # up to 30 s: the line without its newline, or None
    if line is None:
        print("no line in 30 s: is the phone connected?")
    else:
        print("got", line)
        bt.write(b"you said: " + line + b"\n")

    # --- waiting for a word --------------------------------------------------------------------
    bt.write(b"Now send the word go (30 s).\n")
    if bt.wait_until(b"go", 30000):          # everything up to and including "go" is thrown away
        bt.write(b"going!\n")
    else:
        print("no go in 30 s")

    # --- bytes: how many are waiting, a few of them, all of them ---------------------------------
    bt.clear()
    bt.write(b"Send anything in the next 5 s.\n")
    wait(5000)
    print("waiting:", bt.any(), "bytes")     # any() and waiting() are the same count
    print("same:", bt.waiting())
    first = bt.read(4)                       # up to 4 bytes, at once (b"" when none)
    rest = bt.read_all()                     # everything else, at once
    print("first", first, "rest", rest)
    bt.write(b"And one more key (5 s).\n")
    key = bt.read(1, timeout=5000)           # wait up to 5 s for 1 byte
    print("key", key)
    print("lost:", bt.overflow(), "bytes")   # dropped by a too slow reader (0 is good)

    # --- an echo that never waits: the program could do other work in the loop ------------------
    bt.write(b"Echo for 20 s: send lines.\n")
    timer = StopWatch()
    while timer.time() < 20000:
        line = bt.readline(0)                # a whole line if there is one, else None
        if line is not None:
            bt.write(line.upper() + b"\n")   # send it back in capitals
        wait(10)


# --- the REPL check, the tour, the end --------------------------------------------------------
if bt.repl():                            # the REPL runs over this module: leave it that way
    print("The REPL runs over this Bluetooth module, so it would take the phone's lines.")
    print("Take bt.repl(True) out of boot.py (the Board view's broadcast button put it there) and reset the board,")
    print("or run bt.repl(False) once; then run this again.")
else:
    tour()
    bt.write(b"bye\n")                   # the queued bytes still go out after close()
    bt.close()                           # evn.UART(2) or a new Bluetooth(2) can use the port now
