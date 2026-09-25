"""Board: minimal

Says the battery voltage, waits for the user button, then lights the LED for a second.

The Python of board_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: nothing but the board; you press the user button when it asks
"""
from evn import wait, battery, button, led


# The main program starts here.
print('battery (mV): ' + str(battery.voltage()))
print('press the user button')
while not button.pressed():
    wait(10)
while button.pressed():
    wait(10)
led.on()
wait(1000)
led.off()
