"""The simulator panel's pen and errors (simulator only: the board has no such module).

Every error reads the simulator's true pose, so reading one in a scored or sealed run raises ReadRefused.
"""
from typing import Optional, overload

class ReadRefused(RuntimeError):
    """A true value read in a scored or sealed run: the program stops here, and the run goes on as if it had ended."""

def pen_down() -> None:
    """The pen on the middle of the axle goes down: the path is drawn, and a new stroke starts here."""

def pen_up() -> None:
    """The pen comes up: nothing is drawn, and the stroke ends here."""

@overload
def target() -> None: ...
@overload
def target(x: float, y: float, heading: Optional[float] = None) -> None:
    """Where the run should end: x and y in mm on the floor, with a heading in degrees if wanted; no arguments: the run's start again. Anything else raises ValueError."""

def end_error() -> float:
    """The gap in mm from the robot to the target (none set: to the run's start)."""

def closing_error(per_degree: float = 0) -> float:
    """The gap in mm between the ends of the last stroke, plus per_degree mm for each degree between them. The last stroke is the run only while the pen stays down."""

def heading_error() -> float:
    """The true heading now less the target's (none: the run's start's) in degrees, + to the left."""

def report() -> str:
    """The panel's line: the end pose and the three errors."""
