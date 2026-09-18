## The one tool the extension needs

VS Code cannot talk to the EVN ALPHA on its own. It uses **mpremote**, a small program from the
MicroPython project that opens the board's USB serial port, copies files to it and runs them. Every
button in the EVN ALPHA sidebar goes through it.

mpremote is written in Python, so your computer needs **Python 3** first.

## If you do not have Python yet

Download it from [python.org/downloads](https://www.python.org/downloads/) and install it. On Windows,
**tick "Add Python to PATH"** on the first page of the installer - without it VS Code will not find
Python afterwards.

## Installing mpremote

Press **Install mpremote** on the left. A terminal opens and runs:

    pip install mpremote

It takes a few seconds. You only ever do this once per computer.

## How you know it worked

Look at the status bar at the bottom of the VS Code window.

- **EVN: mpremote missing** - not there yet. Install Python, then press the button again.
- **EVN: no board** - mpremote works, no board is plugged in. This step is done.
- **EVN: COM7** (any number, or `/dev/tty...` on Mac and Linux) - mpremote works and it can see your
  board. This step is done.

The status bar can take up to ten seconds to catch up after an install.

Nothing happening? *View, Output*, pick **EVN ALPHA** in the dropdown: the log there says which Python
was tried. The **evn.pythonPath** setting points the extension at a particular Python if you have
several.
