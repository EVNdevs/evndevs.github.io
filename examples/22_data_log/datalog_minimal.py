"""Data log: minimal

Record a motor's angle and the IMU's heading on the board for 5 s while the motor turns, then
save them to a CSV file on the board (/data/run1_<date>_<time>.csv once the console has set the
board's clock).

The Python of datalog_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: a motor on port 1, free to turn; an EVN IMU module on I2C port 1, kept still
"""
from evn import Motor, wait, IMU, DataLog

# Set up all devices.
motor_1 = Motor(1)

imu_1 = IMU(1)

data_log = DataLog(name='run1')


# The main program starts here.
data_log.add(motor_1, 'angle')
data_log.add(imu_1, 'heading')
data_log.start()
motor_1.run(300)
wait(5000)
motor_1.stop()
data_log.stop()
data_log.save()
