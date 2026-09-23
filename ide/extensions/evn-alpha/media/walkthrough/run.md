## Ready-made programs

Open the **EVN ALPHA** tab in the activity bar (the board icon on the far left). Its **Examples**
section holds short programs that already work, in two folders: **Python** (first moves, percent speed,
the colour sensor, the standard peripherals) and **Blocks** (the same ideas as block programs).

Click an example to read it. Press the **Run** button next to its name - or **Ctrl+F5** while it is
open - and it runs on the board.

## Before you press Run

**Put the wheels off the ground.** Stand the robot on a box or hold it. The first example turns a motor
on port 1 a full turn, and a robot on the table will drive off it.

Plug a motor into **port 1** and switch the battery pack on; the motors run from the pack, not from USB.

## While it runs

The program's output appears in the **EVN ALPHA** terminal. When the program ends - finished, or stopped
by an error - **every motor coasts**, as at the end of a Pybricks program (the terminal says `program
finished; the motors are coasting`), and the terminal stays attached to the board's prompt, so you can
type a line like `m.angle()` and press Enter to see what the motor did. **Ctrl+]** leaves that prompt,
and the text stays in the terminal for you to read.

## Stopping

- **Ctrl+C** in the terminal, or
- **Ctrl+Shift+F5** anywhere (*EVN: Stop all motors*), or
- the **user button** on the board, with no computer involved.

All three interrupt the program and let every motor coast.

## Editing an example

You can change an example and run it, but **an example is never overwritten**. Saving asks for a name
and the result becomes a program of your own in your projects folder, listed under *My projects*. The
original stays as it is for the next person.
