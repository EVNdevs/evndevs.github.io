"""Files: minimal

Writes a short file to the board's flash, reads it back, and lists the files on the board. The
file stays there after a power cycle (delete it from the extension's Board view, or with
os.remove("hello.txt")).

Needs: nothing but the board
"""
import os

with open("hello.txt", "w") as f:                # "w" makes the file (or empties it) and writes
    f.write("Hello from EVN ALPHA\n")

with open("hello.txt") as f:                     # reading is the default
    print(f.read())

print("files on the board:", os.listdir("/"))
