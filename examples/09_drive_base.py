"""A drive base: two motors driven together as a robot (the Pybricks DriveBase API).

Distances are in mm, angles in degrees (positive = clockwise, seen from above),
speeds in mm/s and deg/s. Each move runs both wheels on one time base, so a
straight is straight and a turn ends on the spot.

Needs: two motors driving two wheels (left on port 4, mounted mirrored; right on
port 3), 62.4 mm wheels 170 mm apart, and about 40 cm of clear floor ahead.
Measure your own wheel diameter and axle track; the track that matters is the
distance between the two contact patches, so check it with one turn(360)
against a mark on the floor and adjust until the robot ends on the mark.
"""
from evn import Motor, Direction, DriveBase, Stop, wait

left = Motor(4, Direction.COUNTERCLOCKWISE)   # the mirrored motor: forward is counterclockwise
right = Motor(3)
robot = DriveBase(left, right, wheel_diameter=62.4, axle_track=170)

print("defaults (mm/s, mm/s^2, deg/s, deg/s^2):", robot.settings())

# A square-ish out and back: 30 cm forward, 45 degrees right, back again.
robot.straight(300)
robot.turn(45)
robot.turn(-45)
robot.straight(-300)
print("back at", robot.distance(), "mm,", robot.angle(), "deg")

# An arc: 150 mm radius through 45 degrees to the right, then retraced backwards
# (Pybricks curve(): the angle's sign picks the side, the radius's sign the direction).
robot.curve(150, 45)
robot.curve(-150, 45)

# Drive at a speed and turn rate until told otherwise (a line follower's loop).
robot.drive(150, 0)
wait(1000)
robot.drive(0, 45)        # turn in place at 45 deg/s
wait(1000)
robot.drive(0, -45)
wait(1000)
robot.stop()              # coast both wheels

# A slower, gentler robot for the next moves.
robot.settings(straight_speed=150, straight_acceleration=300, turn_rate=60)
robot.straight(-150)
print("state (distance, speed, angle, turn rate):", robot.state())

robot.close()
left.close()
right.close()
