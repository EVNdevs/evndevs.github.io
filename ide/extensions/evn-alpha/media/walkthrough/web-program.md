## Two ways to write a program

The **Start** section of the EVN ALPHA sidebar has two buttons:

- **New Python program** - a `.py` file with a couple of lines to get you going.
- **New blocks program** - a Scratch-style block editor. Drag blocks from the toolbox on the left; the
  MicroPython they generate is shown on the right.

Either way you are asked for a name, the file is created, and it opens straight away.

## Where your programs live

In this browser: the IDE keeps its projects folder in the browser's own storage for this site, not
on your disk. Everything in it is listed under **My projects**, with **Run on the board** and
**Upload as main.py** next to each program. Clearing this site's data in the browser deletes them.

## Running it

The **Run** button next to the program's name (or the Run button at the top right of an open Python file) runs it on the board. Keep the
wheels off the ground while you try things out.

## Upload as main.py

**Upload as main.py** copies the program to the board as `main.py`. After every power-on the board
waits, LED blinking fast, and **a press of the user button starts the program**, so a robot needs no
computer. *Upload and run now* starts it straight away this once.
