"""TCS3430 colour sensor: minimal

Takes the black (nothing in front) and the white (a white sheet), then prints the colour the
TCS3430 sees five times a second for ten seconds.

The Python of tcs3430_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: an ams-OSRAM TCS3430 colour sensor on I2C port 16
"""
from evn import wait, TCS3430

# Set up all devices.
tcs3430_16 = TCS3430(16)


# The main program starts here.
print('Nothing in front of the TCS3430...')
wait(2000)
tcs3430_16.calibrate_black()
print('Hold a white sheet about 1 cm in front of the TCS3430...')
wait(3000)
tcs3430_16.calibrate_white()
for count in range(50):
    print(tcs3430_16.color())
    wait(200)
