# Commands and updates

Every command of the extension is in the command palette (**Ctrl+Shift+P**); type `EVN:` to list them.

## The commands

| Command | What it does |
| :--- | :--- |
| Run current file on the board / Stop all motors | **Ctrl+F5** / **Ctrl+Shift+F5** ([Programs](PROGRAMS.md#running-a-program)) |
| Open REPL | the board's prompt (Ctrl+] leaves it and coasts the motors); also the `REPL` button in the status bar and the terminal icon next to Run |
| Upload current file as main.py / Remove main.py from the board | the program the user button starts ([A program that starts from the user button](MAIN_PY.md)) |
| Flash MicroPython firmware | put the extension's firmware on the board ([Getting started](GETTING_STARTED.md#4-put-the-firmware-on-the-board)) |
| Restart the board without flashing | a board in BOOTSEL mode starts the firmware already on it, writing nothing |
| Install mpremote | install the Python tool the extension talks to the board with |
| Select board port | choose which board to use when several are connected; it is remembered by its USB serial number |
| Name this board | give the board a name, shown in the status bar as `EVN: Kenneth's robot (COM7)` |
| List files on the board | the board's files, in the *EVN ALPHA log* output panel |
| Reset the board | restart it (motors coast; `main.py` then waits for the user button) |
| Collect board diagnostics | firmware version, battery, motion-engine counters and files, to paste into a bug report |
| Read the board (firmware, battery, files) | read the firmware, the files and the I2C devices into the *Board* view again; also its refresh button |
| Send a command to the board | one line of Python through the live console; the *Command line* row ([The Board view](BOARD_VIEW.md#the-command-line)) |
| Show the board output | the *EVN Board output* panel: what the command line answered, and what a program the board started by itself prints |
| Clear the console view | empty the *Console* view's transcript (Ctrl+L in the view does the same) |
| Connect the live console / Pause the live console (free the port) | take the port for the live console, or let go of it for another tool |
| Open data logger / Open a data log / Stop the data logger recording | record what the board measures, open a recording, end a recording ([Recording data](DATA_LOGGER.md)) |
| Open in data viewer | a `.csv` in the data viewer (right-click it in the Explorer, or **Reopen Editor With...**) |
| Pair the Bluetooth module in Windows | open the Windows Bluetooth settings to add the module (`HC-05` or `EVN Bluetooth`, PIN `1234`) ([Working without the USB cable](BLUETOOTH.md)) |
| Switch the board to Bluetooth now (test the wireless link) / Switch the board back to USB | move the live console onto the wireless link with the cable still in, and back |
| Getting started walkthrough | the five guided steps (four in the browser IDE) |
| Enable evn autocomplete in every Python file | `evn` autocompletes in any Python file, not only inside your projects folder |
| Check Python setup | for the open Python file: whether the `evn` stubs reach it, and what is in the way; offers a fix ([Troubleshooting](TROUBLESHOOTING.md#if-evn-is-not-found)) |
| Open online documentation for the symbol under the cursor | **Ctrl+F1**: the online API reference at the word under the cursor |
| Check for extension and firmware updates | ask the documentation site whether a newer extension or firmware is out ([Updates](#updates)) |
| Update the extension / Update the extension and reload the window | install the newer extension; the second also reloads the window so it runs |
| Open API reference / getting started guide / blocks reference / calibration guide | these documents, inside VS Code |
| Open online documentation (evn.coresg.tech) | the same documents on this site |

The buttons on the *Board* rows (run a motor, drive a servo port, set or read a device, download or delete a file) are not in the palette. Each belongs to its row and needs the live console. File downloads and deletes also work with the console off, while nothing else holds the port.

**Enable evn autocomplete in every Python file** is also offered once by itself, when you open a `.py` file that imports `evn` outside your projects folder: *Turn it on*, *Not now* (it asks again in a week) or *Never*.

## Updates

The last row of *Start* in the EVN ALPHA side bar says where the extension stands:

- **Up to date**: the extension is the latest published. The time says when it last looked; click to look again.
- **Update to 0.2.x**: a newer extension is out. **Update** downloads and installs it. **Update and Reload** also reloads the window, so the new version, and the firmware it brings, runs at once. After a plain *Update* the row reads **Reload to start 0.2.x** until you reload.
- **Could not check for updates**: the site did not answer, for example with no internet connection. Click the row to try again.

In the browser IDE the page itself is the latest version, so an update is a reload.

With `evn.updates.check` on (the default), the extension checks when a window opens (reusing an answer less than a day old) and once a day after. A message appears only when something newer is out, once per version, with the same *Update* and *Update and Reload* buttons; *Remind me later* waits a week. Nothing is ever downloaded or installed until you press a button.

A newer extension brings a newer firmware: the *Board* view's firmware row then offers the [flash](GETTING_STARTED.md#4-put-the-firmware-on-the-board).
