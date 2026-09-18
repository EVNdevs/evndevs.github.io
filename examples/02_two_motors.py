"""Two motors together: start the first with wait=False, wait on the second.

A drive base has one motor mounted mirrored, hence COUNTERCLOCKWISE on the right.
Wheels off the ground for this test.

Needs: two motors, on ports 1 and 2, wheels off the ground.
"""
from evn import Motor, Direction, Stop, wait, StopWatch

left = Motor(1)
right = Motor(2, Direction.COUNTERCLOCKWISE)

sw = StopWatch()
left.run_angle(600, 720, wait=False)   # returns immediately
right.run_angle(600, 720)              # blocks until the right motor is done
while not left.done():                 # then wait for the left one too
    wait(10)
print("both done after", sw.time(), "ms:", left.angle(), right.angle())

# Spin in place: opposite directions, then coast both.
left.run(400)
right.run(-400)
wait(1500)
left.stop()
right.stop()

# A move that ends braked instead of held.
left.run_angle(400, -360, then=Stop.BRAKE, wait=False)
right.run_angle(400, -360, then=Stop.BRAKE)
while not left.done():
    wait(10)
print("back at", left.angle(), right.angle())

left.close()
right.close()
