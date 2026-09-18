"""First moves: one motor on EVN port 1.

Run it with "EVN: Run current file on the board" (Ctrl+F5). Ctrl+C in the
terminal stops the program and coasts the motor. Keep the wheel off the ground.

Needs: one motor on port 1, wheels off the ground.
"""
from evn import Motor, Stop, wait

m = Motor(1)                      # EVN port 1..4

print("angle at start:", m.angle())

m.run_angle(500, 360)             # 500 deg/s, one turn, hold at the end, wait until done
print("after run_angle(500, 360):", m.angle(), "deg")

m.run_target(500, 0)              # back to the 0 reference
print("after run_target(500, 0):", m.angle(), "deg")

m.run(300)                        # run at 300 deg/s until told otherwise
wait(1000)                        # ms
print("speed while running:", m.speed(), "deg/s, load:", m.load(), "mNm")

m.run_time(300, 800, then=Stop.COAST)   # 0.8 s more, then release the motor
print("angle after run_time:", m.angle(), "done:", m.done())

m.stop()                          # coast (already coasted here; harmless)
m.close()
print("finished")
