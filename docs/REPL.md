# Using the REPL

The **REPL** (read, evaluate, print, loop) is the board's own Python prompt. You type a line of Python at the `>>>`
prompt, press Enter, and the board runs it at once and prints the answer. It is the quickest way to try a call, to
look at a sensor, or to find out what an object can do, without writing a file first.

## Opening and leaving it

In VS Code and in the browser IDE alike:

- press the **REPL** button in the status bar, next to the board's port, or
- **Open REPL** in the drop-down next to the editor's **Run** button, or
- **Open REPL** in the *Board* view's title bar and in the *Console* view's `...` menu, or
- **EVN: Open REPL** in the command palette.

The REPL opens in the *EVN ALPHA* terminal. It also follows every **Run** (setting `evn.replAfterRun`, on by
default): when your program ends, the terminal stays at the prompt with the program's variables still there, so you
can look at them.

**Leave it with Ctrl-]** (Ctrl and the closing square bracket). Leaving coasts every motor and closes the terminal.
Closing the terminal's tab does the same. In the browser IDE, closing or reloading the browser tab is the exception:
the browser gives the page no time to send anything, so a motor started at the REPL keeps its last command (press
the board's user button, or open the IDE again and stop it).

While the REPL is open it holds the board's port: the *Board* view stops updating and the live console waits. Run,
Upload and the other commands close the REPL first and take the port themselves.

## A first session

```python
>>> from evn import Motor
>>> m = Motor(1)
>>> m.run_angle(300, 90)
>>> print(m.angle())
>>> help()
```

`help()` prints a short guide to the `evn` module. `help(m)` lists everything a motor object has, and
`help('modules')` lists the modules on the board. Type `m.` and press **Tab** to see the names that can follow; Tab
also completes a name you have started.

## The keys

| Key | What it does |
| :--- | :--- |
| **Enter** | runs the line. After a line ending in `:` (an `if`, a `for`, a `def`) the prompt becomes `...` and indents the next line for you; an empty line ends the block and runs it |
| **Tab** | completes the name you are typing, or lists what can follow (`m.` then Tab) |
| **Up**, **Down** | the lines you typed before |
| **Ctrl-C** | stops what is running and **coasts every motor**, whether a program is running or not |
| **Ctrl-D** | soft reboot: the board's Python starts afresh (every variable is gone) and every motor coasts. A `main.py` on the board then waits for the user button again |
| **Ctrl-E** | paste mode: paste a block of several lines, then press **Ctrl-D** to run it (Ctrl-C cancels). Use it for pasted code, which the automatic indent would otherwise indent twice |
| **Ctrl-]** | leaves the REPL, coasts every motor and closes the terminal |

## Motors at the REPL

A program run from the extension ends with every motor coasting. Lines typed at the REPL have no such end: a motor
keeps its last command (`m.run(300)` keeps it turning) until you `stop()` or `close()` it, call `evn.stop_all()`,
press Ctrl-C or Ctrl-D, press the user button, or leave the REPL. A block such as `with Motor(1) as m:` coasts its
motor when the block ends.

## The friendly REPL and the raw REPL

The prompt you type at is the **friendly REPL**: it echoes what you type, completes names and indents blocks. The
extension also uses a second mode, the **raw REPL**, to send whole programs and files to the board (Run, Upload,
the live console, *Files on the board*). You never need to type in it. If a terminal ever shows
`raw REPL; CTRL-B to exit` and a bare `>`, press **Ctrl-B** to get the friendly prompt back.

## The REPL, the command line and the Console view

There are three places to type Python to the board. All three run on the board itself:

| | The REPL | The command line | The Console view |
| :--- | :--- | :--- | :--- |
| Where | the *EVN ALPHA* terminal | the *Command line* row of the *Board* view | the *Console* view under the *Board* view |
| What you type | one line at a time; blocks with `...` | one line | one line, or a small block (**Shift+Enter** adds a line) |
| Ready-made names | none to count on: import what you need | `m1`..`m4`, `s1`..`s4`, `d5` and the others, `evn` imported | the same as the command line |
| The *Board* view | stops updating while the REPL is open | keeps updating | keeps updating |
| Tab completion, `help()` | yes | `help()` only | `help()` only |

The command line and the Console view run on top of the live console: see
[The Board view: the command line](BOARD_VIEW.md#the-command-line) and [the Console view](BOARD_VIEW.md#the-console-view).

## The REPL elsewhere

- **Over Bluetooth:** with an EVN Bluetooth module, `bt.repl(True)` puts the REPL on the module, and the PC's
  Bluetooth COM port carries the prompt, Run and Stop ([Bluetooth](API_DISPLAYS.md#bluetooth--bluetooth-module-hc-05);
  [Working without the USB cable](BLUETOOTH.md)).
- **On an OLED:** `Display(port).mirror(True)` copies everything the REPL prints to the display
  ([Display](API_DISPLAYS.md#display--12864-oled-ssd1306--ssd1315)).
- **While `main.py` waits for the user button:** press Enter in the REPL terminal to skip the program and get the
  prompt.
