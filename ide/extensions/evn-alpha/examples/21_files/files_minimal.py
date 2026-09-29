"""Files: minimal

Writes a short file to the board's flash, reads it back, and lists the files on the board. The
file stays there after a power cycle (delete it from the extension's Board view, or with the
"delete file" block).

The Python of files_minimal.evnblocks: the blocks and this file are the same program (open the
blocks file under Examples to see it as blocks).

Needs: nothing but the board
"""
import os

def read_file(name):
    try:
        with open(name) as file:
            return file.read()
    except OSError as error:
        if error.errno != 2:  # 2 = ENOENT, no such file
            raise
        return ''


# The main program starts here.
with open('hello.txt', 'w') as file:
    file.write('Hello from EVN ALPHA\n')
print(read_file('hello.txt'))
print('files on the board: ' + str(os.listdir()))
