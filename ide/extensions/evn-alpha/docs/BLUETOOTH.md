# Working without the USB cable

With an EVN Bluetooth module on Serial 1 or 2, the board's prompt comes to your computer over the air. Run, the REPL, Upload as main.py and the *Board* view then work as they do over USB.

**This guide has been tested on Windows.** The steps name Windows' Bluetooth settings and its *COM* ports. On a Mac or a Linux computer, see [On macOS and Linux](#on-macos-and-linux): those steps follow Apple's and BlueZ's own documentation and have not been tried with an EVN Bluetooth module yet.

## Setting it up from the Board view

Keep the board on USB with the [live console](BOARD_VIEW.md#the-live-console) connected. Everything is on the **Serial ports** rows of the *Board* view.

1. **Say what is on the header.** Press the gear on **Serial 1** or **Serial 2** and choose **EVN Bluetooth module**. The row then shows the module's state and whether the REPL is on it.
2. **Pair the module.** **Pair the Bluetooth module** (the link button, also in the palette) opens the Windows Bluetooth settings (on a Mac or a Linux computer it says where to pair instead: [On macOS and Linux](#on-macos-and-linux)). Add the device shown as `HC-05` or `EVN Bluetooth`; the PIN is `1234`. Windows then lists a *Standard Serial over Bluetooth link (COMxx)* port for it.
3. **Put the REPL on the module.** **Put the REPL on this Bluetooth module** (the broadcast button) switches the board's prompt onto it. It offers **Make it permanent**, which writes the lines into `boot.py` on the board, so the REPL is on the module at every start. Only one module carries the REPL at a time.
4. **Choose the module's port.** **Use the Bluetooth port for the board** (the plug button) lists the *Standard Serial over Bluetooth link* ports (on Windows); pick the module's. It is now this board's **wireless link**: the row reads `link COM11 (98:D3:41:F7:18:02)`, with the module's Bluetooth address.

![Serial 1 set to an EVN Bluetooth module on the Board view, reading "Bluetooth · no answer (a module in data mode, or nothing attached)", its buttons beside it and the gear, and its tooltip: "Serial 1: an EVN Bluetooth module, bt1 in the command line. No wireless link yet. Buttons: pair it, put the REPL on it, choose its COM port, try the link now."](images/bluetooth-serial-row.png)

You never have to pick that port again. The link is kept by the module's address, so the board is still found if Windows gives the port another number. The list leaves out Windows' *incoming* Bluetooth ports, which can never reach a module.

<details>
<summary>When the board cannot see the module</summary>

The board finds a module by sending it `AT`. A module switched on with its button held answers, and is set up. A module already in data mode, the usual case once it is set up, stays silent: the row reads *no answer (a module in data mode, or nothing attached)*, and says *data mode* once the module has shown itself. An **empty header** is refused: since firmware 0.2.76 the board sees that nothing drives the header's receive line, and the row shows `no Bluetooth module on serial port n` as its error (on an older firmware an empty header read as silent too).

On a silent header, step 3 asks first. Connect to the module's COM port; only if the board's prompt comes through, press **The prompt comes through: make it permanent**. Otherwise the module is on the other header, and `boot.py` is left alone.

Step 3 is refused when the header has no Bluetooth object, or the REPL did not land on it. When the other header's module had the REPL, both the question and the refusal offer **Put the REPL back on Serial *n***. While the live console itself arrives over Bluetooth, the REPL moves only onto the module it arrives through; plug the USB cable in first.

</details>

## Going wireless

**Unplug the USB cable.** The extension notices within about 4 s and comes back over Bluetooth within about 6 s. The status bar reads `EVN: Kenneth's robot (Bluetooth)`, and the top of the *Board* view *live over Bluetooth · connected 3 minutes ago*.

The telemetry, the buttons, the REPL, Run and Stop all motors all go over the air. **Ctrl+C** is still the emergency stop.

**Plug the cable back in and everything moves back to USB by itself.** USB is preferred whenever it is there, and it is faster. Nothing has to be set up again: the motor models, servo profiles, serial headers, live reads and the last values you typed are kept for that board, by its USB serial number.

If the link drops (out of range, or the board switched off), the console row says *the Bluetooth link dropped* and keeps trying. A board that has never been on USB has no serial number to key anything to: plug it in once, then choose the link.

### Trying it at your desk

The arrow-swap button on the Bluetooth serial row, **Switch the board to Bluetooth now**, moves the live console onto the wireless link with the cable still in. The console row reads *Live console: connected over Bluetooth (USB ignored)*.

The same button, now **Switch the board back to USB**, ends it, and so does restarting VS Code. The choice is never saved, so USB is used again whenever it is there.

### Slower telemetry over the air

Over Bluetooth the *Board* view updates 2 times a second instead of 4. The link is shared with whatever your own program sends through the module. `evn.console.bluetoothRate` takes 1, 2 or 4; the console row shows the rate in force (`2 updates/s · COM11`). A change applies the next time the console connects.

### Run waits for the link

Windows opens a Bluetooth port's link only when something asks for it, and the first tries can fail. The *EVN ALPHA* terminal then says `waiting for the Bluetooth link on COM11 ...` and tries for up to 8 s before the program starts.

If the port still will not open, the terminal says so in red: the program was **not** started, and nothing was sent to the board. Check that the board is on, and the module paired, in range and carrying the REPL. Check that nothing else (another Run terminal, a REPL) holds the port. The coast at the end of a program waits for the link the same way.

## Setting it up by hand

1. **Pair the module** in your computer's Bluetooth settings. It shows as `HC-05` or `EVN Bluetooth`, PIN `1234`. On Windows, use the outgoing *Standard Serial over Bluetooth link (COMxx)* port (*More Bluetooth settings* → *COM Ports* shows which).
2. **Switch the REPL onto the module**, once per start-up. Over USB, at the REPL: `import evn; bt = evn.Bluetooth(2); bt.repl(True)`, with the module's serial port number.
   To make it permanent, put those lines in a `boot.py` on the board. From the USB REPL: `open('boot.py','w').write("import evn\nbt = evn.Bluetooth(2)\nbt.repl(True)\n")`, or `mpremote cp boot.py :` from a terminal.
   The name `bt` is how a program reaches the module later (`bt.repl(False)`, `bt.write(...)`).
3. **Choose the Bluetooth port in VS Code**: click the port in the status bar and pick it (it has a broadcast icon). If the board has been on USB before, the extension keeps that port as its wireless link, and USB is used again as soon as the cable is in.

## On macOS and Linux

> **Note:** These steps are written from Apple's and BlueZ's documentation (linked at each step). They have not been tried with an EVN Bluetooth module on a Mac or a Linux computer yet. If a step does not work for you, please [report it](https://github.com/EVNdevs/evndevs.github.io/issues/new?template=report-a-problem.yml), with your system's version.

Do the pairing as below: **Pair the Bluetooth module** in the *Board* view opens a settings page only on Windows; on a Mac or a Linux computer it says where to pair. Step 2 of [Setting it up by hand](#setting-it-up-by-hand), the REPL onto the module, is the same on every computer, and so is **Put the REPL on this Bluetooth module** in the *Board* view (it works over USB).

The extension recognises a Bluetooth port by its name:

- **Linux:** every `/dev/rfcomm` port (`/dev/rfcomm0`, made in step 2 below).
- **macOS:** a `/dev/cu.` port that is not a USB device and whose name says `HC-05` or `Bluetooth`, such as `/dev/cu.HC-05` or a module named `EVN Bluetooth` (spaces, dashes and capitals do not matter, and the older `-DevB` / `-SPPDev` / `-SerialPort` endings are allowed). macOS' own `/dev/cu.Bluetooth-Incoming-Port` is left out of the lists: it reaches no module.

Such a port has the broadcast icon, and **Use the Bluetooth port for the board** (the plug button) lists it. The extension, Run and the live console then treat it as Windows' Bluetooth ports: *Run waits for the link* and the slower telemetry apply whenever the board is reached through it, and the automatic move between USB and Bluetooth once it is the board's wireless link.

On Linux any module name works, as the port is always `/dev/rfcomm`. On a Mac, a module renamed to a name without `HC-05` or `Bluetooth` in it is a plain cable port: those Bluetooth-only parts do not apply to it, and **Use the Bluetooth port for the board** does not list it (pick it in the status bar's port picker instead, or give the module such a name again).

### macOS

1. **Pair the module.** With the board on, choose Apple menu > **System Settings**, then click **Bluetooth** in the sidebar. Hold the pointer over `HC-05` or `EVN Bluetooth` in the list, then click **Connect**. If you are asked for a code, type `1234` and press Enter. (Apple: [Connect a Bluetooth device with your Mac](https://support.apple.com/guide/mac-help/connect-a-wireless-accessory-blth1004/mac).)
2. **Find its serial port.** macOS gives a serial port two device files, `/dev/cu.<name>` and `/dev/tty.<name>`; a program that opens the port uses the `cu.` one. (Apple: [Working With a Serial Device](https://developer.apple.com/library/archive/documentation/DeviceDrivers/Conceptual/WorkingWSerial/WWSerial_SerialDevs/SerialDevices.html).) In Terminal, `ls /dev/cu.*` lists them; the module's carries its name, such as `/dev/cu.HC-05` (the exact name is not checked yet).
3. **Choose it in VS Code**: with the board on USB, press **Use the Bluetooth port for the board** (the plug button) and pick the module's `/dev/cu.` port. Or click the port in the status bar and pick it there.

### Linux

These steps use BlueZ, the Bluetooth stack of most Linux distributions. Your desktop's own Bluetooth settings can do step 1 as well.

1. **Pair the module** with `bluetoothctl` (BlueZ: [bluetoothctl](https://github.com/bluez/bluez/blob/master/doc/bluetoothctl.rst)). With the board on:

   ```text
   $ bluetoothctl
   [bluetooth]# power on
   [bluetooth]# agent on
   [bluetooth]# default-agent
   [bluetooth]# scan on
   ```

   Wait for a line with `HC-05` or `EVN Bluetooth` and the module's address, such as `98:D3:41:F7:18:02`, then:

   ```text
   [bluetooth]# scan off
   [bluetooth]# pair 98:D3:41:F7:18:02
   [bluetooth]# trust 98:D3:41:F7:18:02
   [bluetooth]# quit
   ```

   When `pair` asks for a PIN code, type `1234`.
2. **Give it a serial port** with `rfcomm` (BlueZ: [rfcomm](https://github.com/bluez/bluez/blob/master/doc/rfcomm.rst)):

   ```text
   sudo rfcomm bind 0 98:D3:41:F7:18:02 1
   ```

   This makes `/dev/rfcomm0` for the module on RFCOMM channel 1. It does not connect yet: the link opens when a program opens `/dev/rfcomm0`. The port lasts until `sudo rfcomm release 0` or a restart, so bind it again after a restart. BlueZ counts `rfcomm` among its deprecated tools, so some distributions put it in a separate package or leave it out.
3. **Check that you may open it.** If opening `/dev/rfcomm0` fails with *Permission denied*, `ls -l /dev/rfcomm0` shows the group that owns it; add yourself to that group (`sudo usermod -aG <group> $USER`), then log out and in again.
4. **Choose it in VS Code**: with the board on USB, press **Use the Bluetooth port for the board** (the plug button) and pick `/dev/rfcomm0`. Or click the port in the status bar and pick it there.

## Your program and the module

A program that sends its own data through the module should turn the REPL off first: `bt.repl(False)`. Bytes the REPL takes never reach `read()`. If `boot.py` did not name the module, `bt = evn.Bluetooth(2)` adopts the module the REPL is on.

While the module carries the REPL, a plain `Bluetooth(2)` adopts it as it is. `Bluetooth(2, name=...)`, or a different `baud`, `mode`, `addr` or `stay_in_command`, raises `ValueError`: the module cannot be reprogrammed under the REPL. Turn the REPL off, program the module, then turn the REPL on again. The USB prompt keeps working alongside.

Over Bluetooth, a board that answers nothing may be running its own `main.py`, or its REPL may not be on this module. The console row says both rather than guess, and never interrupts a running program to find out.
