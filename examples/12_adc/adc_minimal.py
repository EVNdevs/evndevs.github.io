"""ADC: minimal

Says the voltage on input A0, in volts, five times a second, for ever (stop it with the stop
button). The set-up block has the ADC measure all four inputs in turn, so any of A0..A3 can be
read; this program reads only A0.

The Python of adc_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: the ADC module on I2C port 1, and a voltage of 0 to 3.3 V on A0 (for example a potentiometer between the board's 3.3 V and GND pins, its middle pin on A0); never more than 3.3 V on a pin
"""
from evn import wait, ADC

# Set up all devices.
adc_1 = ADC(1)
adc_1.inputs((0, 1, 2, 3))


# The main program starts here.
while True:
    print(adc_1.voltage(0))
    wait(200)
