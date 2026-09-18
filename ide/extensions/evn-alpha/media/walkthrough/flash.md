## What firmware is

The firmware is the program that lives inside the board and makes it an EVN ALPHA: it runs MicroPython,
drives the four motor ports a thousand times a second, reads the sensors and answers VS Code. This
extension carries a matching firmware file (a `.uf2`), and **Flash the firmware** copies it onto the
board.

You do this once with a new board, and again whenever a new version of the extension brings a newer
firmware. The Board section of the EVN ALPHA sidebar shows which version is bundled and which one the
board is running.

## Two ways in

Press **Flash the firmware** on the left and confirm.

- **If the board already runs the EVN MicroPython firmware**, the extension asks it to reboot into
  bootloader mode by itself. Nothing for you to do but watch.
- **Otherwise** (a brand-new board, or one whose firmware is not answering): unplug the USB cable,
  **hold the BOOTSEL button down**, plug the cable back in, then let go. The board appears on your
  computer as a USB drive called **RPI-RP2**, the extension copies the firmware onto it, and the board
  reboots by itself.

The extension waits up to 90 seconds for that drive, so there is no rush.

## Good to know

- **Your files are kept.** `main.py` and anything else you copied onto the board survive a flash.
- **Motors coast** while the board reboots - a robot up on blocks will free-wheel for a moment. Keep
  wheels off the ground.
- The battery pack powers the motors; USB alone powers the board but not the motors.
- When it is done the status bar shows the port, for example **EVN: COM7**, and this step ticks itself
  off.

If no `RPI-RP2` drive ever appears, try another USB cable - charge-only cables carry no data.
