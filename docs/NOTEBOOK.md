# The notebook

A notebook is a file of Python cells you run one at a time, each showing its result under it: text, a number, a chart.
Use one to look at a data log, work out a speed or a standard deviation, or draw a graph for a report. The extension
runs the Python itself. Nothing is installed, and nothing goes to the internet.

Notebooks are `.ipynb` files, the same format Jupyter uses. VS Code opens them, and the extension adds its own Python,
called **EVN Python (offline)**.

## Making a notebook

- **EVN: New notebook** (in the command palette) makes `Notebook.ipynb` in the **Notebooks** folder of your projects
  folder (then `Notebook 2.ipynb`, and so on). Its first cell reads the newest log in your **Data** folder. Run it to
  see what the log holds.
- **Open in notebook** on a CSV file makes a notebook that reads that file. It is in three places:
  - the **Open in notebook** button at the top of a log in the data viewer ([Recording data](DATA_LOGGER.md#looking-at-a-log));
  - the menu when you right-click a `.csv` file in the Explorer;
  - the message after you download a log from the *Board* view.

  Do it again on the same file and the same notebook opens: you never get a second copy. A CSV from outside your
  projects folder is first copied into **Data**, never over a file already there.
- A lesson's starter notebook opens as your own copy in **Notebooks**, named after the lesson. Opening the starter
  again opens that copy, with your work in it.

To run a cell, click the run arrow beside it or press **Shift+Enter**. If VS Code asks which kernel to use, pick
**EVN Python (offline)**. For a notebook inside your projects folder it is offered first.

## The first cell

```python
import evn_nb

log = evn_nb.read_log(evn_nb.data())
print(log)
```

- `evn_nb.data()` is the newest CSV in **Data**. `evn_nb.data('run1.csv')` is the file `run1.csv` there.
- `evn_nb.read_log(path)` reads any CSV the EVN tools write: a log from the data logger, a log your program saved with
  `DataLog`, a file of captured points, or a plain CSV with a header row.
- `log.channels` lists what was recorded. `t, v = log.series('Motor', 1, 'angle')` gives the times and the values of
  one reading. `log.columns` gives the columns of a plain CSV, or of your own `log.log()` values, by name.
- `log.runs` splits a file that was saved more than once (`append=True`) into its runs.

You can also read files with plain Python: `open()`, the `csv` module, `os.listdir()`.

## What it has

- **Python's standard library:** `csv`, `statistics`, `math`, `random`, `json`, `datetime` and the rest. A few parts
  (`sqlite3`, `lzma`, `ssl`) come with NumPy, SciPy and Matplotlib, so on the desktop they arrive with them.
- **NumPy, SciPy and Matplotlib.** The browser IDE has them. On the desktop they are one download, the first time you
  need them (see [NumPy, SciPy and Matplotlib on the desktop](#numpy-scipy-and-matplotlib-on-the-desktop)). SciPy
  brings `scipy.optimize` (`curve_fit`), `scipy.signal` (`lfilter`, `bode`, `cont2discrete`), `scipy.linalg` (`expm`,
  `solve_discrete_are`), `scipy.integrate` (`solve_ivp`), `scipy.ndimage` and `scipy.spatial` (`cKDTree`).
- **Charts.** A Matplotlib figure shows under its cell. Each one has a description a screen reader reads out (its
  title, its axes and their ranges, its lines), and a data table: the numbers it was drawn from. Both are saved in the
  notebook, so they are still there when you open it again. Give your charts a title and axis labels with
  `plt.title()` and `plt.xlabel()`: the description uses them.
  - **Show data table** (in the cell's `...` menu) opens the table of a chart as text beside the notebook. It works on a
    notebook you saved and opened again too.
  - `evn_nb.table()` prints the table of the last chart in the cell's output.
- **Check this cell** (in the cell's `...` menu) runs a lesson's check on a cell that has one and writes the verdict,
  `PASS ...` or `FAIL ...`, under the cell. Lesson checks come in a later version: until then the command tells you that
  the check cannot run yet.

pandas, OpenCV and scikit-learn are not in the notebook. A cell that imports one says so in one line.

## Your files

Before each cell runs, the notebook's Python gets a copy of the notebook's folder (with its subfolders) and of your
**Data** folder. After the cell, the files it made or changed are written back.

- A file you changed yourself while the cell ran is never written over. The cell's version is saved beside it as
  `name (notebook).csv`, and the cell's output says so.
- A file deleted in a cell is not deleted on your computer.
- One file can be up to 32 MB, and all the files together up to 64 MB, newest first. A file left out is named in the
  cell's output with the line that brings it in, for example `await evn_nb.copy_in('Data/long_run.csv')` (up to
  256 MB).
- A notebook outside your projects folder gets its own folder only, without the subfolders.

## Its limits

- **No internet.** The notebook's Python cannot open a web page or download a package.
- **`input()` does not work.** Put the value in the cell instead, for example `name = 'Ada'`.
- **Stop** (the square beside a running cell) stops the cell.
  - On the desktop the variables stay. A cell that does not stop within 3 seconds has its Python started again, and
    its variables are cleared.
  - In the browser IDE, Stop always starts the Python again, and the variables are cleared. Run the cells above it
    again.
- **EVN: Restart notebook kernel** (the button at the top of the notebook) clears all the variables.
- **4 notebooks at once** on the desktop, and 2 in a browser tab. When you run one more, the notebook left idle the
  longest has its Python stopped, and its variables are cleared: its next cell says so, and you run its cells again.
  If every notebook is busy running a cell, the new one starts anyway.
- **Memory.** If a notebook's Python uses more than 1 GB, the cell's output says so. Restart it to free the memory.
- **A folder you do not trust** runs no cell. Each cell says `Trust this folder to run notebooks in it`.
- The notebook does not talk to the board or the simulator. Download a log first, then read it.

## Without a network

The browser IDE keeps the notebook's Python and its packages once they have loaded. Once the IDE and a notebook are
open, the network can go and notebooks keep running, a new kernel included (after a restart, or in another
notebook). A reload of the page needs the network until a later version keeps the whole IDE offline.

The first time a browser runs a notebook that uses NumPy and Matplotlib, it downloads about 19 MB (about 34 MB with
SciPy too); after that, about 24 KB. If the browser's site data is cleared while a notebook is open, a restart of the notebook's Python needs the
network again.

On an iPad, Safari deletes a site's storage after 7 days without use. So the notebook's packages stay within that
window, or always for the IDE added to the Home Screen.

The desktop extension needs the network once, to download NumPy, SciPy and Matplotlib (next section). After that its
notebooks need no network.

## NumPy, SciPy and Matplotlib on the desktop

The desktop extension does not come with NumPy, SciPy and Matplotlib. You install them once, with one click, the same way as
mpremote:

1. The first time a cell imports one (`import numpy as np`), the cell stops with one line saying they are not installed
   yet, and a message offers **Install NumPy, SciPy and Matplotlib (30.0 MB)** or **Cancel**.
2. **Install** downloads them from the EVN site (the same files the browser IDE uses). The message shows how much has
   arrived and has a **Cancel** button.
3. When it is done, click **Restart Python** (this clears the notebook's variables) and run the cell again. If you
   missed that button, the next cell that imports NumPy offers it again.

To install them before you go offline (for a class without Wi-Fi), run **EVN: Install notebook packages** from the
Command Palette.

- **Nothing is sent before you click Install.** Until then the notebook makes no network request.
- **Every file is checked.** Each one must match the fingerprint (SHA-256) in the list that comes with the extension.
  A damaged file is fetched once more; if it is still wrong, nothing is installed and the message says so.
- **Cancel keeps nothing.** A cancelled download is deleted, and a set you had installed stays as it was.
- **Offline, or a broken connection,** gives one line saying what is missing and how to get it, never a wait without
  end. A download that stops part-way keeps what arrived, and the next **EVN: Install notebook packages** carries on
  from there. A part-downloaded set is never used.
- **After an extension update** that needs a newer Python for the notebook, a cell that imports NumPy says the
  installed packages are for the older one and offers the download again; the old ones are deleted once the new ones
  are in. If the EVN site is on a different version from your extension, the message says so and asks you to update
  the extension.
- The packages are kept in VS Code's storage for the extension, not in your projects folder.

## When the notebook is not the right tool

- **A spreadsheet.** Excel, Numbers or Google Sheets open a log as it is; filter the `quantity` column
  ([Recording data](DATA_LOGGER.md#the-files)).
- **Python on your computer.** Any Python 3 reads the same files, with the packages you install
  (`pandas.read_csv(f, comment='#')` reads a log).
