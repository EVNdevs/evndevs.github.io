## The documentation

**Open the documentation** takes you to [evn.coresg.tech](https://evn.coresg.tech): every motor call,
the board itself, the battery, button and LED, all fifteen standard peripherals, and the blocks.

It is also the **Documentation** button in the Start section of the EVN ALPHA sidebar.

## Without leaving VS Code

Two commands open the reference that ships with the extension, so they work offline:

- **EVN: Open API reference** - every class and call in the `evn` module.
- **EVN: Open blocks reference** - every block and the Python it generates.
- **EVN: Open getting started guide** - the longer written version of this walkthrough.

Type `EVN:` in the command palette (**Ctrl+Shift+P**) to find them, and everything else the extension
can do.

## Straight to the right page

Put the cursor on a word in a Python file - `run_angle`, `ColorSensor`, `Stop` - and press **Ctrl+F1**.
The online documentation opens at that section.

Autocomplete and inline help work as you type, as long as the Microsoft **Python** and **Pylance**
extensions are installed. Inside your projects folder they work already; *EVN: Enable evn autocomplete
in every Python file* turns them on everywhere.

## When something is wrong

Run **EVN: Collect board diagnostics**. It opens a document with the firmware version, the battery, the
motion-engine counters and the files on the board. Send that, the program you ran, and what the motors
did instead of what you expected.
