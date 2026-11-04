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

## Results of a simulator run without the panel

The Simulator panel does not yet read its results aloud, and it has no text readout of the robot's position. Until it
does, a learner who cannot see the panel gets a run's results in two ways:

- **The program prints them**, for example `print(robot.distance(), robot.angle())` for a drive base. The terminal's
  accessible view (Alt+F2) reads them.
- **A reader:** an adult at the keyboard reads the panel to the learner.

Said plainly: a learner who cannot see the screen cannot yet follow a simulator run on their own.

## VS Code's own features

The editor, the terminal, the suggestion list and the notebook are VS Code's. VS Code's own accessibility features
(screen reader mode, the accessible views, high contrast themes, zoom) work with EVN as with any other extension.
