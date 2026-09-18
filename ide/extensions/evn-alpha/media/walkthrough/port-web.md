## Nothing to install in the browser

The desktop extension talks to the board through **mpremote**, a small Python tool. In a browser
there is no Python and nothing to install: the extension opens the board's serial port itself, with
**Web Serial**, and speaks the same protocol over it.

## Letting this page use the board

A web page cannot see your serial ports until you say so, once per port:

1. Plug the EVN ALPHA in with the USB cable.
2. Press **Choose the board port** above (or click the board in the status bar, bottom left).
3. Pick **An EVN ALPHA on USB** - the browser then shows its own chooser with the boards it found.
   Select yours and press **Connect**.

The browser remembers that choice for this site, so the next time the board is simply there. Pick
**Any serial port** instead when you use the board over its Bluetooth module: the operating system
shows a Bluetooth link as an ordinary serial port.

## What you need

- **Chrome, Edge or Opera.** Firefox and Safari have no Web Serial; everything that does not need
  the board still works in them.
- **https**, or `localhost`. That is a browser rule for serial ports, not ours.
- The board already has the **MicroPython firmware** on it. A browser cannot write to the RPI-RP2
  drive, so flashing is a desktop job (or a drag-and-drop of the `.uf2` file by hand).
