"""Files: the whole tour

The board has an 11 MB file system in its flash, mounted at "/": open() and the os module work as
in MicroPython. This example works in a folder of its own and removes it at the end: text and
binary files, writing, appending and reading them back, JSON for settings, sizes and free space,
renaming, and the one EVN rule - the flash is not written while a motor is driving.

Needs: the board, and a motor on port 1 with its wheel off the ground (for the last part: a log
recorded while the motor runs, written once it has stopped).
"""
import os
import json
from evn import Motor, wait

EBUSY = 16                                       # the errno of a write refused while a motor drives
FOLDER = "/files_example"

print("board:", os.uname().machine)
print("working folder:", os.getcwd())
print("files in /:", os.listdir("/"))
st = os.statvfs("/")                             # (block size, -, blocks, free blocks, ...)
print("free space: %d kB of %d kB" % (st[0] * st[3] // 1024, st[0] * st[2] // 1024))

# --- a folder of our own --------------------------------------------------------------------------
def remove_folder(path):
    """Delete a folder with the files in it (a folder must be empty before rmdir())."""
    for name in os.listdir(path):
        os.remove(path + "/" + name)
    os.rmdir(path)

if FOLDER[1:] in os.listdir("/"):                # left over from a run that was stopped
    remove_folder(FOLDER)
os.mkdir(FOLDER)
os.chdir(FOLDER)                                 # plain file names are in this folder now
print("working folder:", os.getcwd())

# --- a text file: write, append, read -------------------------------------------------------------
with open("notes.txt", "w") as f:                # "w": make the file, or empty an existing one
    f.write("line one\n")
    f.write("line two\n")
with open("notes.txt", "a") as f:                # "a": add to the end
    f.write("line three\n")

with open("notes.txt") as f:                     # "r" (read) is the default
    print(repr(f.read()))                        # the whole file as one string
with open("notes.txt") as f:
    print("first line:", repr(f.readline()))     # one line, with its "\n"
    for line in f:                               # the rest, line by line
        print("then:", line.strip())
with open("notes.txt") as f:
    f.seek(5)                                    # jump to a position (bytes from the start)
    print("5 characters from position 5:", repr(f.read(5)), "- now at", f.tell())

# --- a binary file: bytes in, bytes out -----------------------------------------------------------
with open("data.bin", "wb") as f:
    f.write(bytes([0, 1, 2, 250, 255]))
with open("data.bin", "rb") as f:
    print("bytes:", list(f.read()))

# --- JSON: settings that survive a power cycle ----------------------------------------------------
settings = {"wheel_diameter": 62.4, "axle_track": 170, "name": "robot 1"}
with open("settings.json", "w") as f:
    json.dump(settings, f)
with open("settings.json") as f:
    loaded = json.load(f)
print("track from the file:", loaded["axle_track"])

# --- sizes, renaming, what is a folder ------------------------------------------------------------
os.rename("notes.txt", "diary.txt")
for name in os.listdir():                        # the working folder
    info = os.stat(name)
    kind = "folder" if info[0] & 0x4000 else "file"
    print("%-14s %-6s %d bytes" % (name, kind, info[6]))

# --- the flash is not written while a motor drives ------------------------------------------------
# A flash write stops the 1 kHz motion engine for 45..400 ms, so the board refuses it while any
# motor is driving (run(), dc(), a move still under way): OSError with errno 16 (EBUSY), from
# open(), write(), flush() or close() - whichever reaches the flash first. Holding, braked and
# coasting motors do not block a write, and reading is never refused.
motor = Motor(1)
angles = []                                      # keep the log in RAM while the motor runs ...
motor.run(300)
for _ in range(10):
    angles.append(motor.angle())
    wait(100)
try:
    with open("log.txt", "w") as f:
        f.write("too early\n")
except OSError as e:
    if e.errno != EBUSY:
        raise
    print("refused while the motor runs (EBUSY), as it should be")
motor.stop()                                     # ... and write it once the motor has stopped:
wait(10)                                         # the coast lands at the next 1 ms tick, so give it one
with open("log.txt", "w") as f:
    for a in angles:
        f.write("%d\n" % a)
with open("log.txt") as f:
    print("logged", len(f.read().split()), "angles after the stop")
motor.close()

# --- the end: remove the folder and go back to "/" ------------------------------------------------
os.chdir("/")
remove_folder(FOLDER)
print("files in /:", os.listdir("/"))
