"""TCS34725 colour sensor on an I2C port.

A standard peripheral: plug the sensor into any I2C port (SDA/SCL only), name the
port, and read. The firmware keeps the latest reading fresh in the background
(every 4.8 ms at the defaults: 2.4 ms integration, 16x gain, the same defaults
as the EVN Arduino library), so reading in a loop costs nothing on the bus.
color() names the colour the Pybricks way; hsv()/raw()/... give the numbers.

Needs: the colour sensor on I2C port 5 (PORT below) and something coloured to look at.
"""
from evn import ColorSensor, Color, wait

PORT = 5                                # the I2C port the sensor is plugged into

cs = ColorSensor(PORT)                  # OSError here if no TCS34725 answers on that port
print(cs)                               # ColorSensor(5, id=0x44, gain=16x, integration_time=2.4)

# 1. Name the colour. color() picks the nearest of detectable_colors(), by
#    default Color.RED, YELLOW, GREEN, BLUE, WHITE or NONE. Coloured surfaces
#    are recognised by hue alone, at any distance or light level.
for _ in range(20):
    print("color", cs.color(), "hsv", cs.hsv(), "raw", cs.raw())
    wait(100)

if cs.color() == Color.RED:
    print("that is red")

# 2. Your own palette: standard colours or measured ones (print cs.hsv() over
#    the object you want to detect and put those numbers in a Color).
my_colors = (Color.GREEN, Color.MAGENTA, Color(h=348, s=96, v=40), Color.NONE)
cs.detectable_colors(my_colors)
print("detectable:", cs.detectable_colors(), "->", cs.color())
cs.detectable_colors((Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE))

# 3. Telling WHITE from NONE needs the reading's brightness to mean something:
#    calibrate once on white and black (as setClearRange/... in the Arduino
#    library). normalized() then reports 0..100 between them and color() /
#    hsv(normalized=True) use that.
print("hold the sensor over WHITE"); wait(2000); white = cs.read()
print("hold the sensor over BLACK"); wait(2000); black = cs.read()
if all(w > b for w, b in zip(white, black)):    # each range needs low < high
    cs.ranges(clear=(black[0], white[0]), red=(black[1], white[1]),
              green=(black[2], white[2]), blue=(black[3], white[3]))
    print("ranges", cs.ranges(), "normalized", cs.normalized(), "color", cs.color())
else:
    print("white", white, "is not brighter than black", black, "on every channel: calibration skipped")

# 4. The numbers behind it, and the chip settings.
c = cs.hsv()
print("hue", c.h, "saturation", c.s, "value", c.v, "| pct", cs.percent(), "ambient", cs.ambient(), "%")
cs.gain(60)                             # dim scene: more gain and a longer integration
print("integration_time set to", cs.integration_time(101), "ms")
wait(250)
print("dim-scene raw", cs.raw(), "lux ~", cs.lux(), "cct ~", cs.color_temperature(), "K")
cs.gain(16)
cs.integration_time(2.4)

cs.close()                              # sensor to sleep, port released
