## Two ways to write a program

The **Start** section of the EVN ALPHA sidebar has two buttons:

- **New Python program** - a `.py` file with a couple of lines to get you going.
- **New blocks program** - a Scratch-style block editor. Drag blocks from the toolbox on the left; the
  MicroPython they generate is shown on the right, so you can see what each block really does.

Either way you are asked for a name, the file is created, and it opens straight away.

## Where your programs live

In your projects folder: **EVN Projects** inside your Documents folder. Everything in it is listed under
**My projects** in the sidebar, Python programs in its **Python** folder and blocks programs in its
**Blocks** folder, with **Run on the board** and **Upload as main.py** next to each program,
and Rename, Duplicate, Delete and *Show in the file explorer* in the right-click menu.

Somewhere else suits you better? Change the **evn.projectsFolder** setting and the sidebar follows.

## Running it

**Ctrl+F5** runs the open program on the board (the same as the Run button next to its name). **Ctrl+Shift+F5**
stops everything. Keep the wheels off the ground while you try things out.

## Making it start by itself

**Upload as main.py** copies the program onto the board as `main.py`. From then on it runs every time
the board is powered on - no computer needed. You can choose to reset the board and start it right away.

Three ways out if `main.py` misbehaves: hold the **user button while powering on** to skip it once,
**Ctrl+Shift+F5** to interrupt it from VS Code, or *EVN: Remove main.py from the board* to delete it.

## Blocks are Python

A blocks program can be turned into a `.py` file at any time with **Export Python** in the editor's
toolbar - a good way to move a class from blocks to text once they are ready.
