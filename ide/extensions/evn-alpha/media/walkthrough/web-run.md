## Ready-made programs

Open the **EVN ALPHA** tab in the activity bar (the board icon on the far left). Its **Examples**
section holds short programs that already work, in two folders: **Python** and **Blocks**.

Click an example to read it. Press the **Run** button next to its name and it runs on the board,
over the same Web Serial port.

## Before you press Run

**Put the wheels off the ground.** Stand the robot on a box or hold it. The first example turns a motor
on port 1 a full turn, and a robot on the table will drive off it.

Plug a motor into **port 1** and switch the battery pack on; the motors run from the pack, not from USB.

## While it runs

The program's output appears in the **EVN ALPHA** terminal. When the program ends, **every motor
coasts**, and the terminal stays attached to the board's prompt so you can type a line like
`m.angle()`. **Ctrl+]** leaves that prompt.

## Stopping

- **Ctrl+C** in the terminal, or
- *EVN: Stop all motors* (the stop button at the top of the Board view, or the command palette), or
- the **user button** on the board, with no computer involved.

## Closing the tab

**Closing or reloading this tab does not stop the motors.** A program still running, or a motor
started at the board's prompt, keeps going. Press Stop (Ctrl+C in the terminal, or *EVN: Stop all
motors*) before closing the tab, or press the board's **user button** afterwards.
