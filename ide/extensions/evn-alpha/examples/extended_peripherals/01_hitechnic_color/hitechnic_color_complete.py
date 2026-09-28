"""HiTechnic colour sensor: the whole API

Every method of HiTechnicColorSensor once: its version and firmware, the black and white calibration
(taken first, at the distance the colours will be read, and kept by the board for the port: the next
HiTechnicColorSensor(8) starts with it), the Pybricks-style colour and its confidence, the sensor's own
colour number, the reflection, red / green / blue and HSV, and on a V2 its colour index and normalised
red / green / blue, the light around it with the LED off (ambient) and the raw channels. The sensor runs
its port at 100 kHz (the other ports stay at 400 kHz, and evn.I2C(port).freq() shows it). Not called
here: mains(), which the V2 stores itself (set it once to 50 or 60 for the mains where you are), and
clear_calibration() / black_reference(None) / white_reference(None), which would forget the
calibration this example stores.

Needs: a HiTechnic NXT Color Sensor (V1 or V2) on I2C port 8, through an NXT cable adapter, a white
sheet of paper
"""
import evn
from evn import Color, HiTechnicColorSensor, I2C, StopWatch, wait

PORT = 8


def press_button(what_to_do):
    """Print what to do, then wait until the user button is pressed and let go."""
    print()
    print(what_to_do)
    print("   ... then press the user button (to leave: Stop in the editor, or Ctrl-C).")
    while not evn.button.pressed():
        wait(10)
    while evn.button.pressed():
        wait(10)


sensor = HiTechnicColorSensor(PORT)              # finds it by its "HiTechnc" ID string
print(sensor)
print("version V%d, firmware %s, port clock %d Hz"
      % (sensor.version(), sensor.firmware(), I2C(PORT).freq()))
sensor.detectable_colors((Color.RED, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE))
print("detectable colours:", sensor.detectable_colors())

# calibrate first (stored on the board for this port: later programs start with it): hue, saturation
# and brightness are then measured between the black and the white
press_button("Nothing in front of the colour sensor (point it at open space).")
sensor.calibrate_black()
press_button("Hold a white sheet a few millimetres in front of the colour sensor.")
sensor.calibrate_white()
print("black", sensor.black_reference(), "white", sensor.white_reference())   # (R, G, B) counts
print("stored for port %d:" % PORT, sensor.stored_calibration())   # the same as evn.color_calibration(8)
print("white sheet:", sensor.color_match(), sensor.hsv())   # (Color.WHITE, ~1.0)

press_button("Hold the colour sensor a few millimetres over a coloured surface.")
clock = StopWatch()
while clock.time() < 5000:
    # these readings are all taken with the LED on: group them, a mode change costs ~125 ms
    colour, confidence = sensor.color_match()
    print("colour %s (confidence %.2f)  number %2d  reflection %5.1f %%  rgb %s  hsv %s  age %d ms"
          % (sensor.color(), confidence, sensor.color_number(), sensor.reflection(),
             sensor.rgb(), sensor.hsv(), sensor.age()))
    wait(250)
if sensor.version() == 2:                        # the V1 has none of these
    # still the LED on: the colour index (red, green, blue levels 0..3 in one number) and the
    # normalised red / green / blue (the strongest channel set to 255)
    index = sensor.color_index()
    print("colour index %d = red %d, green %d, blue %d; normalised rgb %s"
          % (index, (index >> 4) & 3, (index >> 2) & 3, index & 3, sensor.normalized_rgb()))
    # the LED off (passive mode, one switch of ~125 ms): the light around the sensor
    print("ambient light (LED off): %d" % sensor.ambient())
    print("ambient (r, g, b, white), LED off:", sensor.ambient_raw())
    print("raw (r, g, b, white), LED on, no ambient cancellation:", sensor.raw())
sensor.close()                                   # the LED goes out, the port back at 400 kHz
