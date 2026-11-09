# Accessibility in the EVN ALPHA extension

EVN aims at WCAG 2.2 AA as a target. This page says what works today, as best effort; nothing here has been audited
yet. Each part below is added the day it arrives.

## Hints under an error

When a program you run stops with an error, the terminal shows the error as the board or the simulator prints it, and
then one more line that starts `Hint:`. The hint names the line and says where to look. For example:

```
Traceback (most recent call last):
  File "<stdin>", line 3, in <module>
NameError: name 'prnt' isn't defined
Hint: Line 3: look at 'prnt' here and where it first appears above.
```

- A hint points; it never says what the error means. Working that out stays with the learner.
- Hints come with the errors learners meet most: `SyntaxError`, `IndentationError`, `NameError`, `ImportError`,
  `AttributeError`, `TypeError` (in a call, a name in a call, or two values with a sign between them),
  `ZeroDivisionError`, `IndexError`, `ValueError` (a port number) and `OSError` (a device). Any other error shows with no
  hint.
- A program you stop (Ctrl-C in the terminal) gets no hint: stopping is not an error.
- A challenge run's result does not show hints yet; only Run in the terminal does.
- The hint is one ordinary line of the terminal, so a screen reader reads it with the error. In VS Code, the terminal's
  accessible view (Alt+F2 with a screen reader on) shows the whole run as text.
- The hints are in English.

**Turning them off.** Set `evn.python.errorHints` to `off` (Settings, search "error hints"). It applies from the next
run. Hints show again with `on`, the default. A teacher who wants learners to read errors with no help can turn them
off on the class computers.

## The blocks editor by keyboard

The blocks editor works with the keyboard alone, and a screen reader reads each block by name. The keys come from
Blockly, the library the editor is built on; EVN changes one of them (below).

- **Getting in.** Tab moves through the toolbar buttons, then into the toolbox (the list of categories on the left),
  then the blocks themselves. Inside the editor, T jumps to the toolbox and W to the blocks.
- **Taking a block.** In the toolbox, the up and down arrows choose a category, the right arrow opens it, the up and
  down arrows choose a block, and Enter takes it.
- **Putting it in place.** The arrow keys move the block from one place it can go to the next; the screen reader says
  where ("Moving after set up"). Enter puts it there; Escape puts it back. M starts the same move for a block already
  in the program.
- **The rules hold.** A set-up block goes only under "set up", and the program's blocks only under "program", as when
  you drag them: a keyboard move never offers the other place.
- **Changing a value.** The right arrow moves to the block's values; Enter opens one to type in, and Enter again keeps
  it.
- **Finding your way.** N and B jump to the next and previous stack of blocks, I reads where you are, and Alt+J shows
  the block's tip. (In Blockly the tip is Ctrl+J, which in VS Code also opens and closes the panel, so EVN moved it.)
- **The Python pane.** Tab reaches the line between the blocks and the Python; the left and right arrows widen and
  narrow the Python pane, and Home and End give it its narrowest and widest. Tab then reaches the Python itself, so a
  screen reader can read the program the blocks make.
- **Messages.** What the editor says in its toolbar ("Python copied to the clipboard", a file that did not open) is
  read out by a screen reader as it appears.
- Ctrl+F5 runs the program and Ctrl+Shift+F5 stops the motors from anywhere in the editor, as in the rest of VS Code.

This has been checked by automated tests only, in two browser engines; no one has yet tried it with a screen reader.

## Results of a simulator run without the panel

The Simulator panel does not yet read its results aloud, and it has no text readout of the robot's position. Until it
does, a learner who cannot see the panel gets a run's results in two ways:

- **The program prints them**, for example `print(robot.distance(), robot.angle())` for a drive base. The terminal's
  accessible view (Alt+F2) reads them.
- **A reader:** an adult at the keyboard reads the panel to the learner.

Said plainly: a learner who cannot see the screen cannot yet follow a simulator run on their own.

## On the lessons site

The lesson pages are built to work with the keyboard alone and with a screen reader. Automated tests check them; a
person's check with a screen reader is still to come.

- **Skip to the lesson.** The first press of Tab on a page shows a *Skip to the lesson* link. Enter moves past the top
  bar to the lesson itself.
- **Where the focus is.** Whatever Tab reaches (a link, a button, a code block, a folded part) shows a clear outline.
- **Code blocks.** Tab reaches each code block. The arrow keys then scroll a long line sideways. A screen reader names
  each block by its length, for example "Code, 6 lines".
- **Tables.** A screen reader names each table and reads each cell with its column or row heading.
- **Text size.** The pages follow the browser's text size and zoom. At 200 % zoom, or on a narrow screen, the page does
  not scroll sideways; only a long code line does, inside its block.
- **Colours.** Text and the edges of boxes stand out from the page in the light and the dark theme. Windows contrast
  themes keep the outlines and box edges.

## VS Code's own features

The editor, the terminal, the suggestion list and the notebook are VS Code's. VS Code's own accessibility features
(screen reader mode, the accessible views, high contrast themes, zoom) work with EVN as with any other extension.
