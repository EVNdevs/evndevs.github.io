"""TCS3430 colour sensor: the whole API

Every method of TCS3430 once: the black and white calibration (taken first: without it the module's
warm LED makes a white sheet read yellow), X, Y, Z and infrared, the chromaticity, whether a reading
clipped, the colour it sees and colours taught from its own readings, the gain and the integration
time. The defaults (2.78 ms at 64x) suit a target close in front, lit by the module's own LED.

Needs: an ams-OSRAM TCS3430 colour sensor on I2C port 16, a white sheet of paper
"""
import evn
from evn import StopWatch, TCS3430, wait

PORT = 16


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


xyz = TCS3430(PORT)                              # ID 0xDC: an APDS-9960 at the same address is refused
print(xyz, "gain %dx, integration %.2f ms" % (xyz.gain(), xyz.integration_time()))   # 64x, 2.78 ms

# calibrate first, at the distance the colours will be read (kept by this object, not on the board)
press_button("Nothing in front of the colour sensor (point it at open space).")
xyz.calibrate_black()                            # subtracted from every reading
press_button("Hold a white sheet about 1 cm in front of the colour sensor.")
xyz.calibrate_white()                            # the white now reads s 0, v 100
print("black", xyz.black_reference(), "white", xyz.white_reference())   # (X, Y, Z) per 1x-gain cycle
print("white sheet:", xyz.color_match(), xyz.hsv())   # (Color.WHITE, ~1.0)

press_button("Hold the colour sensor about 1 cm over a coloured surface.")
clock = StopWatch()
while clock.time() < 5000:
    x, y, z = xyz.xyz()                          # raw counts
    print("X %d  Y %d  Z %d  IR %d  raw %s  xy %s  saturated %s  age %d ms"
          % (x, y, z, xyz.ir(), xyz.raw(), xyz.xy(), xyz.saturated(), xyz.age()))
    print("   colour %s  hsv %s" % (xyz.color(), xyz.hsv()))   # from the default detectable colours
    wait(250)

# teach the sensor your own colours from its own hsv() readings
print("default detectable colours:", xyz.detectable_colors())
press_button("Hold the colour sensor about 1 cm over the FIRST colour to teach it.")
first = xyz.hsv()
press_button("Now over the SECOND colour.")
second = xyz.hsv()
xyz.detectable_colors((first, second))
press_button("Move it between the two colours.")
clock.reset()
while clock.time() < 5000:
    colour, confidence = xyz.color_match()       # confidence 1.0 on a taught colour, 0.0 halfway
    print("%s  (confidence %.2f)" % ("first" if colour == first else "second", confidence))
    wait(250)

xyz.gain(16)                                     # less gain for a bright target close up
print("integration time set: %.2f ms" % xyz.integration_time(100))   # far-field / ambient light
print("16x, 100 ms: xyz %s, xy %s" % (xyz.xyz(), xyz.xy()))   # xy() is uncalibrated chromaticity
xyz.black_reference(None)                        # clear both references: raw readings again
xyz.white_reference(None)
print("references cleared:", xyz.black_reference(), xyz.white_reference())   # None None
xyz.close()                                      # powers the chip down
