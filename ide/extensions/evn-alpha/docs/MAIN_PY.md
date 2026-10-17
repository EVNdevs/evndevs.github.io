# A program that starts from the user button

Put a program on the board as `main.py` and the robot runs it at a press of the user button, with no computer attached.

## Uploading it

**EVN: Upload current file as main.py** copies the open file to the board as `main.py`. *My projects* and the block editor have an **Upload as main.py** button too.

Choose *Upload and run now* to restart the board and start the program at once, this one time. The message after the upload offers to remember your answer (setting `evn.uploadMain.then`: *Ask every time*, *Upload and run now* or *Upload only*), and after a run its **Stop** button stops the program.

## Starting it

1. Switch the board on, or press RESET.
2. Wait until the user LED blinks four times a second: the board is waiting for the button. A press made before the blinking starts is not counted.
3. **Press the user button.** The program starts.

When the program ends, the next press runs it again.

**With VS Code connected**, the extension's live console talks to the board within a second of every start. That ends the wait and gives the console the prompt. So with VS Code connected, use *Upload and run now*, or pause the live console first (**EVN: Pause the live console (free the port)**; a paused console reads nothing, so the program's prints are not shown until you connect again). The button starts `main.py` when nothing is talking to the board. When the console finds `main.py` already running, it never interrupts it: the **Console** view comes up with the program's output, and the status bar shows `main.py running on the board` with the red **Stop**, as *Upload and run now* does. A program that prints right away is never typed into: the console listens first and only speaks to a board that is silent.

**At a terminal** (*Open REPL*, a serial monitor), press **Enter** first for the prompt. Only Enter or a REPL control key (Ctrl-A to Ctrl-E) ends the wait; any other key is ignored, so text typed during the wait is dropped, never run.

**To start without a press**, for a board that must run unattended, put `import evn; evn.autostart(True)` in a `boot.py` on the board.

## What a button run keeps

Between two button runs there is no soft reset. A module your `main.py` imports (say `robot.py`, with your `IMU`, `DriveBase` and `Pose`) is kept and does not run again. Its objects carry over, with their settings, and each starts the new run fresh:

- an `IMU` at `heading()` 0, warm (no wait for `ready()`);
- a `DriveBase` at `distance()` and `angle()` 0;
- its `Pose` at x, y and heading 0, as its `reset()` does;
- a `Motor` at `angle()` 0 if it was made with `reset_angle=True` (the default). With `reset_angle=False` it keeps its count.

A `Pose(...)` your `main.py` makes again on the same sources takes the last run's over. A setting one run changes is still in force in the next, so set what the program needs at its start.

**Run** from the editor starts with a soft reset instead, which closes everything.

## If the program misbehaves

- Hold the **user button for 2 s** while it runs. The board restarts (motors coast) and waits for the button again.
- Hold the **user button while switching on**: `main.py` is skipped once. Useful with `autostart`.
- **EVN: Stop all motors** stops it from VS Code.
- The *Board* view's console row says when the board runs its own program. Its stop button, **Stop the board's program and connect**, ends it and hands the board back to you. Nothing else the extension does interrupts it.
- **EVN: Remove main.py from the board** deletes it.
- After a watchdog restart (a program that froze the board), `main.py` is skipped by itself.
