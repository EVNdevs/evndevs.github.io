"""RGB LEDs: minimal

The RGB LEDs turn red, green and blue, one second each, then go off.

The Python of rgb_leds_minimal.evnblocks: the blocks and this file are the same program (open
the blocks file under Examples to see it as blocks).

Needs: the RGB LED module (8 LEDs) on servo port 1
"""
from evn import wait, Color, RGBLED

# Set up all devices.
rgb_1 = RGBLED(1, 8)


# The main program starts here.
rgb_1.brightness(40)
rgb_1.fill(Color.RED)
wait(1000)
rgb_1.fill(Color.GREEN)
wait(1000)
rgb_1.fill(Color.BLUE)
wait(1000)
rgb_1.off()
