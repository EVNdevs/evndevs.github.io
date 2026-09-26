"""HuskyLens: the whole API

Every method of HuskyLens once: an algorithm, learning an object, the blocks the camera sees (all, or
one ID), the object count, the frame number and the arrows of line tracking. Not called here:
forget(), which erases what the camera has learned in the current algorithm.

Needs: a DFRobot HuskyLens set to Protocol Type I2C on I2C port 11
"""
import evn
from evn import HuskyLens, StopWatch, wait

PORT = 11


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


camera = HuskyLens(PORT)                         # knocks, and needs an answer
print(camera, "algorithm set through this driver:", camera.algorithm())   # None: the camera cannot say
camera.algorithm(HuskyLens.OBJECT_TRACKING)
press_button("Frame an object on the camera's screen (inside the white box).")
camera.learn(1)                                  # learn it as ID 1
print("learned IDs: %d" % camera.learned())
clock = StopWatch()
while clock.time() < 5000:
    # x, y = the block's centre on the 320 x 240 screen; id 0 = seen but not learned
    print("frame %d: %d object(s), blocks %s, ID 1 only %s, age %d ms"
          % (camera.frame(), camera.count(), camera.blocks(), camera.blocks(1), camera.age()))
    wait(250)

camera.algorithm(HuskyLens.LINE_TRACKING)
press_button("Point the camera at a line to follow (learn it on the camera if it has none).")
clock.reset()
while clock.time() < 5000:
    # an arrow is (x_origin, y_origin, x_target, y_target, id)
    print("arrows %s  ID 1 only %s" % (camera.arrows(), camera.arrows(1)))
    wait(250)
camera.close()                                   # the camera keeps its algorithm and what it learned
