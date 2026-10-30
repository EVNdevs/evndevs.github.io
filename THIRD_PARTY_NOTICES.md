# Third-party notices

The EVN ALPHA firmware bundled with this extension (`firmware/EVN_ALPHA_MicroPython.uf2`) and published on
the EVN site is built from the components below, and this file carries their notices: the Raspberry Pi pico-sdk,
MicroPython (with the libraries of its tree the firmware compiles in), ST's VL53L1X ultra lite driver, and the
Fixed4x6 bitmap font (the OLED's small font). Which
licence governs the ST material is still an open question for the EVN owner (item 22 of `docs/OPEN_QUESTIONS.md`
in the firmware repository); the ST entry below is a precaution until it is settled. The extension's own
third-party files, the Blockly block editor (Apache License 2.0), the Jost typeface (SIL Open Font License 1.1),
Pyodide 0.28.3 - CPython 3.13 compiled to WebAssembly, the robot simulator's Python (Mozilla Public License 2.0;
CPython itself: the PSF License Agreement) - pdf.js 6.4.299, the simulator's renderer of a WRO mat (Apache License
2.0) - and Jolt Physics through JoltPhysics.js 1.1.1, the simulator's physics engine (MIT) - ship in the extension with
their licence files beside them (`media/blockly/LICENSE`, `media/fonts/LICENSE-Jost.txt`, for Pyodide the files in
`media/pyodide/` listed under "Pyodide" below, for pdf.js `dist/sim/LICENSE-pdfjs.txt`, for Jolt the files in
`media/jolt/` listed under "Jolt Physics" below; the sources: <https://github.com/pyodide/pyodide/tree/0.28.3>,
<https://github.com/python/cpython>, <https://github.com/mozilla/pdf.js/tree/v6.4.299> and
<https://github.com/jrouwe/JoltPhysics.js/tree/1.1.1>).

## Raspberry Pi pico-sdk

The firmware is built with the Raspberry Pi Pico SDK 2.3.0 (<https://github.com/raspberrypi/pico-sdk>), under
the licence in its `LICENSE.TXT`, reproduced verbatim:

```
Copyright 2020 (c) 2020 Raspberry Pi (Trading) Ltd.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

The SDK's USB stack, TinyUSB (<https://github.com/hathach/tinyusb>, the copy in the SDK's `lib/tinyusb`), is
"Copyright (c) 2018, hathach (tinyusb.org)" under the MIT License, whose text is the one reproduced for
MicroPython below with that copyright line.

## MicroPython

The firmware's Python is MicroPython v1.26.1 (<https://github.com/micropython/micropython>), under the licence
in its `LICENSE`, reproduced verbatim (its first part; the second part of that file is a tree of the licences
of third-party code in MicroPython's other ports and libraries):

```
The MIT License (MIT)

Copyright (c) 2013-2025 Damien P. George

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Individual files may include additional copyright holders. Of the third-party libraries in MicroPython's tree,
the firmware compiles in two, each under the terms its files state:

- littlefs (`lib/littlefs`, the board's file system): "Copyright (c) 2022, The littlefs authors. Copyright (c)
  2017, Arm Limited. All rights reserved.", SPDX BSD-3-Clause - the BSD 3-clause conditions and disclaimer
  reproduced for the pico-sdk above, with these copyright lines;
- re1.5 (`lib/re1.5`, the `re` module): "Copyright 2007-2009 Russ Cox. All Rights Reserved. Copyright 2014 Paul
  Sokolovsky.", a BSD-style licence (BSD 3-clause in MicroPython's licence tree).

## ST VL53L1X ultra lite driver (STSW-IMG009)

The VL53L1X driver's register tables — the 91-byte default configuration, the distance-mode and timing-budget
tables and the range-status mapping in `hal/hal_vl53l1x.c` — are derived from ST's VL53L1X ultra lite driver,
STSW-IMG009 v3.5.5 (`API/core/VL53L1X_api.c`). No ST file is copied into the EVN sources.

Which licence governs that material is not settled; ST's package states it three ways:

- `VL53L1X_api.c` / `.h`: licensed under the terms in the LICENSE file in the root directory of the component;
- that file, `API/LICENSE.txt`: the terms are in the package's `Package_license` file for a component received as
  part of a package, and ST's BSD open-source licence SLA0103 (<https://www.st.com/SLA0103>) applies to one
  received outside a package or without applicable terms — the package as downloaded holds no `Package_license`;
- the package's `API/Release_Notes.html`: "Licensed under Software License Agreement SLA0080".

Until that is settled, ST's copyright notice is reproduced below with the BSD 3-clause conditions and disclaimer,
verbatim as ST ships them in the same package (`Example/Drivers/BSP/STM32F4xx-Nucleo/stm32f4xx_nucleo.c`). This
is a precaution, not a statement that SLA0103 (or SLA0080) is the licence in force.

```
Copyright (c) 2023 STMicroelectronics. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:
  1. Redistributions of source code must retain the above copyright notice,
     this list of conditions and the following disclaimer.
  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.
  3. Neither the name of STMicroelectronics nor the names of its contributors
     may be used to endorse or promote products derived from this software
     without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Fixed4x6 bitmap font (tom-thumb.bdf)

The OLED's small font - the port map's text and `Display.set_font('small')` - is the ASCII part (32..126) of a BDF
font supplied by the owner as `tom-thumb.bdf`, 2026-10-20 (kept in the firmware repository as
`tools/fonts/tom-thumb.bdf`, md5 e3fe9446a3fc3c90b43b6776b5e28f6a), packed into `hal/hal_ssd1306_font4x6.h` by
`tools/oled_font_gen.py`. The file identifies itself as FONT `-Raccoon-Fixed4x6-Medium-R-Normal--6-60-75-75-P-40-ISO10646-1`,
FAMILY_NAME "Fixed4x6", FOUNDRY "Raccoon", and its COPYRIGHT property reads `MIT`; it carries no COMMENT, no author and
no copyright holder line, so none is stated here. The MIT licence's terms:

```
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Pyodide (the robot simulator's Python)

The robot simulator runs Pyodide 0.28.3 (<https://github.com/pyodide/pyodide/tree/0.28.3>): CPython 3.13.2
compiled to WebAssembly with Emscripten 4.0.9 (Pyodide's `Makefile.envs`). Its files ship in `media/pyodide/`
(in the extension and in the browser IDE), and these licence texts ship beside them, each copied verbatim from the
upstream file named:

| Component in `pyodide.asm.wasm` / `pyodide.asm.js` / `python_stdlib.zip` | Licence | File beside it | Copied from |
|---|---|---|---|
| Pyodide | Mozilla Public License 2.0 | `LICENSE-Pyodide.txt` | Pyodide's `LICENSE` |
| CPython 3.13 | PSF License Agreement | `LICENSE-CPython.txt` | CPython's `LICENSE` |
| The code CPython incorporates: expat, libmpdec (mpdecimal), zlib and the others it lists | each its own, as listed | `LICENSE-CPython-incorporated.txt` | "Licenses and Acknowledgements for Incorporated Software", `Doc/license.rst` at CPython v3.13.2 |
| Emscripten's runtime | MIT / University of Illinois NCSA | `LICENSE-Emscripten.txt` | Emscripten 4.0.9 `LICENSE` |
| musl libc (Emscripten's C library) | MIT | `COPYRIGHT-musl.txt` | Emscripten 4.0.9 `system/lib/libc/musl/COPYRIGHT` |
| libffi | MIT | `LICENSE-libffi.txt` | libffi `LICENSE` at f08493d2 (the commit Pyodide's `cpython/Makefile` builds) |
| HACL* (the hash functions) | MIT | `LICENSE-HACL.txt` | the header of `Modules/_hacl/Hacl_Hash_SHA2.h` at CPython v3.13.2 |

## Jolt Physics (the simulator's physics engine)

The simulator's physics engine is Jolt Physics (Copyright 2021 Jorrit Rouwe, MIT; <https://github.com/jrouwe/JoltPhysics>,
commit 6f8bc72f) through its WebAssembly binding JoltPhysics.js 1.1.1 (Copyright 2022 Jorrit Rouwe, MIT;
<https://github.com/jrouwe/JoltPhysics.js/tree/1.1.1>), compiled for EVN with Emscripten 6.0.13 and
`-DCROSS_PLATFORM_DETERMINISTIC=ON` (`tools/sim/jolt/build_jolt.sh` in the firmware repository; one change to the
binding's build, `tools/sim/jolt/glue.patch`, passes that define and `-ffp-contract=off` to its glue). Its two files ship
in `media/jolt/` (`jolt.wasm`, `jolt.glue.js`; in the extension and in the browser IDE), and these licence texts ship
beside them, each copied verbatim from the upstream file named:

| Component in `jolt.wasm` / `jolt.glue.js` | Licence | File beside it | Copied from |
|---|---|---|---|
| Jolt Physics | MIT | `LICENSE-JoltPhysics.txt` | Jolt Physics `LICENSE` at 6f8bc72f |
| JoltPhysics.js (the binding and its glue) | MIT | `LICENSE-JoltPhysics.js.txt` | JoltPhysics.js `LICENSE` at tag 1.1.1 |
| Emscripten's runtime | MIT / University of Illinois NCSA | `LICENSE-Emscripten.txt` | Emscripten 6.0.13 `LICENSE` |
| libc++ (Emscripten's C++ library) | Apache License 2.0 with LLVM Exceptions | `LICENSE-libcxx.txt` | Emscripten 6.0.13 `system/lib/libcxx/LICENSE.TXT` |
| compiler-rt (Emscripten's runtime builtins) | Apache License 2.0 with LLVM Exceptions | `LICENSE-compiler-rt.txt` | Emscripten 6.0.13 `system/lib/compiler-rt/LICENSE.TXT` |
| musl libc (Emscripten's C library) | MIT | `COPYRIGHT-musl.txt` | Emscripten 6.0.13 `system/lib/libc/musl/COPYRIGHT` |

## pdf.js (the simulator's renderer of a WRO mat)

The simulator renders the WRO mat a user loads (their own copy of WRO's printing file; "WRO RoboMission geometry"
below) with pdf.js 6.4.299 (the npm package `pdfjs-dist`, <https://github.com/mozilla/pdf.js/tree/v6.4.299>), Copyright
2024 Mozilla Foundation, licensed under the Apache License, Version 2.0. Its two files ship minified by esbuild, their code otherwise unchanged, as
`dist/sim/pdf.js` (the library) and `dist/sim/pdf.worker.js` (its worker), each headed by a line naming pdf.js and its
licence, with the licence's text beside them in `dist/sim/LICENSE-pdfjs.txt` (copied from the package's `LICENSE`).
pdf.js ships no NOTICE file. None of pdf.js's CMaps, standard fonts, ICC profiles or WebAssembly decoders is shipped
or used.

## RCJ Rescue CMS tile images and the 2026 official fields (the simulator's RCJ courses)

`assets/rcj/tiles/` holds the line-tile images of the RoboCup Junior Rescue CMS
(<https://github.com/robocup-junior/rcj-rescue-cms>, `public/images/tiles`, MIT License, Copyright (c) 2016 Fredrik
Lofgren; the licence text is in `assets/rcj/tiles/NOTICE.md`). `assets/rcj/fields-2026/` holds the eight 2026
official Rescue Line fields the RCJ Rescue Committee publishes
(<https://rescue.rcj.cloud/events/2026/RoboCup2026/line/practice>), bundled with the EVN owner's permission
(`assets/rcj/fields-2026/NOTICE.md`). `assets/rcj/tiles.json` is EVN's tracing of the tile images.

## WRO RoboMission geometry (the simulator's WRO course)

`assets/wro/junior-2026.json` is EVN's own measurement of the World Robot Olympiad 2026 RoboMission Junior game mat
("Heritage Heroes"): the sizes and places of its scoring areas, start marks, roads and black lines, and the fill
colours they are printed in, traced by `tools/wro/trace_mat.py` (in the EVN ALPHA repository) from WRO's printing file
and the RoboMission Junior Game Rules 2026, with short attributed quotes of those rules. It holds numbers only: no
image, artwork or page of WRO's. The mat itself is never shipped with the extension: the simulator draws a plain
schematic from these numbers, and WRO's artwork appears only from a printing file the user downloads from
<https://wro-association.org> and loads themself. World Robot
Olympiad, WRO and RoboMission are names and trademarks of the World Robot Olympiad Association; EVN is not affiliated
with, endorsed by or sponsored by it, and neither is the simulator. WRO's mat and rules are WRO's: the user loads their
own copy of the mat, which the extension keeps in its own storage on the user's computer (never uploaded, never in a
run record) until they forget it.
