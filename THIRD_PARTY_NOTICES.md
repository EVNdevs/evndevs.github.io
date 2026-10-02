# Third-party notices

The EVN ALPHA firmware bundled with this extension (`firmware/EVN_ALPHA_MicroPython.uf2`) and published on
the EVN site is built from the components below, and this file carries their notices: the Raspberry Pi pico-sdk,
MicroPython (with the libraries of its tree the firmware compiles in), and ST's VL53L1X ultra lite driver. Which
licence governs the ST material is still an open question for the EVN owner (item 22 of `docs/OPEN_QUESTIONS.md`
in the firmware repository); the ST entry below is a precaution until it is settled. The extension's own
third-party files, the Blockly block editor (Apache License 2.0) and the Jost typeface (SIL Open Font License 1.1),
ship in the extension with their licence files beside them (`media/blockly/LICENSE`, `media/fonts/LICENSE-Jost.txt`).

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
