# Third-party notices

The EVN ALPHA firmware bundled with this extension (`firmware/EVN_ALPHA_MicroPython.uf2`) and published on
the EVN site contains material under the notice below. This file is provisional: which licence governs the
ST material, and whether the firmware and the extension should also carry the notices of the other
components the firmware is built from (the Raspberry Pi pico-sdk, BSD 3-clause; MicroPython, MIT), is an
open question for the EVN owner (item 22 of `docs/OPEN_QUESTIONS.md` in the firmware repository).

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
