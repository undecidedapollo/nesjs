document.body.innerHTML = "Hello";
// wasmBuilder for https://github.com/ballercat/wasm-loader webpack loader
// import wasmBuilder from "../bin/emulator.wasm";
// Following the example here https://www.assemblyscript.org/loader.html#typescript-definitions
import EmulatorModule from "./types/wasm/emulator"; // codesandbox doesn't support type only imports yet
import loader from "@assemblyscript/loader"; // or require
export type AssemblyOutput = loader.ASUtil & typeof EmulatorModule;

export enum CPU_FLAGS {
    C = (1 << 0),	// Carry Bit
    Z = (1 << 1),	// Zero
    I = (1 << 2),	// Disable Interrupts
    D = (1 << 3),	// Decimal Mode (unused in this implementation)
    B = (1 << 4),	// Break
    U = (1 << 5),	// Unused
    V = (1 << 6),	// Overflow
    N = (1 << 7),   // Negative
}

const WIDTH = 342;
const HEIGHT = 262;

const PALETTE_WIDTH = 128;
const PALETTE_HEIGHT = 128;

const modeLookup = [
    "IMM", "IZX", "IMP", "IMP", "IMP", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "IMP", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "IMP", "ZPX", "ZPX", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "ABX", "IMP",
    "ABS", "IZX", "IMP", "IMP", "ZP0", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "ABS", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "IMP", "ZPX", "ZPX", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "ABX", "IMP",
    "IMP", "IZX", "IMP", "IMP", "IMP", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "ABS", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "IMP", "ZPX", "ZPX", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "ABX", "IMP",
    "IMP", "IZX", "IMP", "IMP", "IMP", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "IND", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "IMP", "ZPX", "ZPX", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "ABX", "IMP",
    "IMP", "IZX", "IMP", "IMP", "ZP0", "ZP0", "ZP0", "IMP", "IMP", "IMP", "IMP", "IMP", "ABS", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "ZPX", "ZPX", "ZPY", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "IMP", "IMP",
    "IMM", "IZX", "IMM", "IMP", "ZP0", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "ABS", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "ZPX", "ZPX", "ZPY", "IMP", "IMP", "ABY", "IMP", "IMP", "ABX", "ABX", "ABY", "IMP",
    "IMM", "IZX", "IMP", "IMP", "ZP0", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "ABS", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "IMP", "ZPX", "ZPX", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "ABX", "IMP",
    "IMM", "IZX", "IMP", "IMP", "ZP0", "ZP0", "ZP0", "IMP", "IMP", "IMM", "IMP", "IMP", "ABS", "ABS", "ABS", "IMP",
    "REL", "IZY", "IMP", "IMP", "IMP", "ZPX", "ZPX", "IMP", "IMP", "ABY", "IMP", "IMP", "IMP", "ABX", "ABX", "IMP",
];

const VIEW_FLAGS: [string, CPU_FLAGS][] = [
    ["C", CPU_FLAGS.C],
    ["Z", CPU_FLAGS.Z],
    ["I", CPU_FLAGS.I],
    ["D", CPU_FLAGS.D],
    ["B", CPU_FLAGS.B],
    ["V", CPU_FLAGS.V],
    ["N", CPU_FLAGS.N],
];

let selectedPalette = 0;
let drawNameTable = false;
let drawHackedPaletteDisplayer = false;

function hex(num: number, pad: number) {
    return num.toString(16).toUpperCase().padStart(pad, "0");
}


function writeEl(id: string, value: string) {
    const doc = document.getElementById(id);
    if (!doc) return;
    doc.innerHTML = value;
}

function drawCPUInfo(cpu: EmulatorModule.CPU) {
    VIEW_FLAGS.forEach(([span, flag]) => {
        const value = cpu.getFlag(flag.valueOf());
        writeEl(`cpu_status_${span}`, value ? `<span style="color:green;">${span}</span>` : `<span style="color:red;">${span}</span>`);
    });


    writeEl("cpu_pc", `$${hex(cpu.pc, 4)}`);
    writeEl("cpu_a", `$${hex(cpu.a, 2)} [${cpu.a}]`);
    writeEl("cpu_x", `$${hex(cpu.x, 2)} [${cpu.x}]`);
    writeEl("cpu_y", `$${hex(cpu.y, 2)} [${cpu.y}]`);
    writeEl("cpu_stack", `$${hex(cpu.stkp, 4)}`);
    writeEl("cpu_cycles", `$${hex(cpu.cycles, 2)}`);
    writeEl("cpu_clock", `[${cpu.clock_count}]`);
    writeEl("ppu_palette", `${selectedPalette}`);
}

function drawRamBox(cpu: EmulatorModule.CPU) {
    function generateRamString(start: number, end: number, maxRow: number = 16) {
        let str = "";
        let rowCol = 0;
        for (let i = start; i < end; i++) {
            if (rowCol === 0) {
                str += `$${hex(i, 4)}: `;
            }

            str += `${hex(cpu.read(i), 2)} `;

            rowCol++;
            if (rowCol >= maxRow) {
                rowCol = 0;
                str += "<br />";
            }
        }

        return str;
    }

    writeEl("ram_0", generateRamString(0x0000, 0x0100, 16));
    writeEl("ram_1", generateRamString(0x8000, 0x8100, 16));
}

function drawExecution(cpu: EmulatorModule.CPU, executionMap: Map<number, string>) {
    const pc = cpu.pc;
    let idx = pc - 20;

    let str = "";
    let validInstr = 0;
    do {
        if (idx >= 0xFFFF) break;
        let val = executionMap.get(idx);
        idx++;
        if (!val) {
            continue;
        }
        if (pc + 1 === idx) {
            val = `<span style="color: blue;">${val}</span>`;
        }
        str += `${val} <br />`;
        validInstr++;
    } while (validInstr < 20);

    writeEl("execution", str);
}

function uncomplement(val, bitwidth) {
    var isnegative = val & (1 << (bitwidth - 1));
    var boundary = (1 << bitwidth);
    var minval = -boundary;
    var mask = boundary - 1;
    return isnegative ? minval + (val & mask) : val;
}


function generateExecutionMap(bus: EmulatorModule.Bus, cpu: EmulatorModule.CPU, asm: AssemblyOutput, start: number, end: number) {
    let addr = start;
    let mapLines = new Map<number, string>();
    const lookupArr = asm.__getArray(cpu.lookup);
    const cpuLookupArr = lookupArr.map((x) => asm.Instruction.wrap(x));

    while (addr <= end) {
        let line_addr = addr;
        let str = `$${hex(addr, 4)}: `;

        let opcode = bus.cpuRead(addr++, true);

        const instruction = cpuLookupArr[opcode];
        str += asm.__getString(instruction.name) + " ";

        if (modeLookup[opcode] == "IMP") {
            str += " {IMP}";
        } else if (modeLookup[opcode] == "IMM") {
            const value = bus.cpuRead(addr++, true);
            str += `#$${hex(value, 2)} {IMM}`
        } else if (modeLookup[opcode] == "ZP0") {
            const lo = bus.cpuRead(addr++, true);
            str += `$${hex(lo, 2)} {ZP0}`
        } else if (modeLookup[opcode] == "ZPX") {
            const lo = bus.cpuRead(addr++, true);
            str += `$${hex(lo, 2)}, X {ZPX}`
        } else if (modeLookup[opcode] == "ZPY") {
            const lo = bus.cpuRead(addr++, true);
            str += `$${hex(lo, 2)}, Y {ZPY}`
        } else if (modeLookup[opcode] == "IZX") {
            const lo = bus.cpuRead(addr++, true);
            str += `($${hex(lo, 2)}, X) {IZX}`
        } else if (modeLookup[opcode] == "IZY") {
            const lo = bus.cpuRead(addr++, true);
            str += `($${hex(lo, 2)}, Y) {IZY}`
        } else if (modeLookup[opcode] == "ABS") {
            const lo = bus.cpuRead(addr++, true);
            const hi = bus.cpuRead(addr++, true);
            str += `$${hex((hi << 8) | lo, 4)} {ABS}`
        } else if (modeLookup[opcode] == "ABX") {
            const lo = bus.cpuRead(addr++, true);
            const hi = bus.cpuRead(addr++, true);
            str += `$${hex((hi << 8) | lo, 4)}, X {ABX}`
        } else if (modeLookup[opcode] == "ABY") {
            const lo = bus.cpuRead(addr++, true);
            const hi = bus.cpuRead(addr++, true);
            str += `$${hex((hi << 8) | lo, 4)}, Y {ABY}`
        } else if (modeLookup[opcode] == "IND") {
            const lo = bus.cpuRead(addr++, true);
            const hi = bus.cpuRead(addr++, true);
            str += `($${hex((hi << 8) | lo, 4)}) {IND}`
        } else if (modeLookup[opcode] == "REL") {
            const value = bus.cpuRead(addr++, true);
            str += `$${hex(value, 2)} [$${hex(addr + uncomplement(value, 8), 4)}] {REL}`
        }

        mapLines.set(line_addr, str);
    }

    return mapLines;
}

let executionMap: Map<number, string>;

function drawCanvas(ppu: EmulatorModule.PPU, asm: AssemblyOutput) {
    var c = <HTMLCanvasElement>document.getElementById("screen_canvas");
    var ctx = c.getContext("2d");
    const clearBeforeRender = drawNameTable || drawHackedPaletteDisplayer;

    if (clearBeforeRender) ctx.clearRect(0, 0, c.width, c.height);

    const displayArray = asm.__getUint8ClampedArray(ppu.display);
    const imgData = new ImageData(displayArray, WIDTH, HEIGHT);
    var newCanvas = <HTMLCanvasElement>document.createElement("canvas");
    newCanvas.width = imgData.width;
    newCanvas.height = imgData.height;
    const newCtx = newCanvas.getContext("2d");
    newCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(newCanvas, 0, 0, imgData.width * 2, imgData.height * 2);
    if (drawNameTable) {
        ctx.font = "13px monospace";
        const nt = asm.__getUint8ClampedArray(asm.__getArray(ppu.tblName)[0]);
        for (let y = 0; y < 30; y++) {
            for (let x = 0; x < 32; x++) {
                ctx.strokeText(hex(nt[y * 32 + x], 2), x * 16 + 8, (y * 16) + 16);
            }
        }
    }
    if (drawHackedPaletteDisplayer) {
        const nt = asm.__getUint8ClampedArray(asm.__getArray(ppu.tblName)[0]);
        var paletteCanvas = <HTMLCanvasElement>document.getElementById(`canvas_palette_1`);
        for (let y = 0; y < 30; y++) {
            for (let x = 0; x < 32; x++) {
                const id = nt[y * 32 + x];

                const px = (id & 0x0F) << 3;
                const py = ((id >>> 4) & 0x0f) << 3;
                ctx.drawImage(paletteCanvas, px * 2, py * 2, 16, 16, x * 16, y * 16, 16, 16);
            }
        }
    }
}

function drawPalette(id: number, ppu: EmulatorModule.PPU, asm: AssemblyOutput) {
    var c = <HTMLCanvasElement>document.getElementById(`canvas_palette_${id}`);
    var ctx = c.getContext("2d");
    const displayArray = asm.__getUint8ClampedArray(ppu.getPatternTable(id, selectedPalette));
    const imgData = new ImageData(displayArray, PALETTE_WIDTH, PALETTE_HEIGHT);
    var newCanvas = <HTMLCanvasElement>document.createElement("canvas");
    newCanvas.width = imgData.width;
    newCanvas.height = imgData.height;
    newCanvas.getContext("2d").putImageData(imgData, 0, 0);
    ctx.drawImage(newCanvas, 0, 0, imgData.width * 2, imgData.height * 2);
}

function drawInfo(bus: EmulatorModule.Bus, cpu: EmulatorModule.CPU, ppu: EmulatorModule.PPU, asm: AssemblyOutput) {
    if (!executionMap) {
        executionMap = generateExecutionMap(bus, cpu, asm, 0x0000, 0xFFFF);
    }
    drawCPUInfo(cpu);
    drawRamBox(cpu);
    drawExecution(cpu, executionMap);
    drawPalette(0, ppu, asm);
    drawPalette(1, ppu, asm);
    drawCanvas(ppu, asm);
}

function initHTML() {
    document.body.innerHTML = `
    <div class="flex-grid">
      <div class="col-8">
       <div id="memory_disp" hidden>
            <div id="ram_0" style="font-weight: bold;"></div>
            </br>
            </br>
            <div id="ram_1" style="font-weight: bold;"></div>
        </div>
        <canvas id="screen_canvas" width="${WIDTH * 2}" height="${HEIGHT * 2}"></canvas>
        <br />
        <canvas id="canvas_palette_0" width="${PALETTE_WIDTH * 2}" height="${PALETTE_HEIGHT * 2}"></canvas>
        <canvas id="canvas_palette_1" width="${PALETTE_WIDTH * 2}" height="${PALETTE_HEIGHT * 2}"></canvas>
      </div>
      <div class="col-4">
        <div>
          <b>STATUS:</b> <span id="cpu_status_N"></span> <span id="cpu_status_V"></span> - <span id="cpu_status_B"></span> <span id="cpu_status_D"></span> <span id="cpu_status_I"></span> <span id="cpu_status_Z"></span> <span id="cpu_status_C"></span></br>
          <b>PC:</b> <span id="cpu_pc"></span></br>
          <b>A:</b> <span id="cpu_a"></span></br>
          <b>X:</b> <span id="cpu_x"></span></br>
          <b>Y:</b> <span id="cpu_y"></span></br>
          <b>Stack P:</b> <span id="cpu_stack"></span></br>
          <b>Cycles:</b> <span id="cpu_cycles"></span></br>
          <b>Clock:</b> <span id="cpu_clock"></span></br>
          <b>Palette:</b> <span id="ppu_palette"></span></br>
        </div>
        </br>
        </br>
        <div id="execution">
        </div>

      </div>
  `;
}

async function initProgram(bus: EmulatorModule.Bus, cpu: EmulatorModule.CPU, asm: AssemblyOutput) {
    const data = await fetch("nestest.nes").then((x) => x.arrayBuffer()).then((x) => new Uint8Array(x));
    const romArrayId = asm.__newArray(asm.UInt8Array_ID, Array.from(data.values()));
    asm.__pin(romArrayId);
    let cart = new asm.Cartridge(romArrayId);
    asm.__pin(cart.valueOf());
    bus.insertCartridge(cart.valueOf());
    bus.reset();
}

function _now() {
    const now = self.performance.now();
    return now;
}

async function main() {
    let emulationActive = false;
    let residualTime = 0;
    let lastAnimationTimestamp = 0;

    const { exports } = await loader.instantiate<typeof EmulatorModule>(
        fetch("emulator.wasm").then((x) => x.arrayBuffer())
    );

    const { Bus, CPU, PPU, __getArray, Instruction, Cartridge } = exports;

    const b = new Bus();
    exports.__pin(b.valueOf());
    const p = new PPU();
    exports.__pin(p.valueOf());

    const c = new CPU(b.valueOf());
    exports.__pin(c.valueOf());

    b.attachPPU(p.valueOf());

    await initProgram(b, c, exports);
    console.log("POST INIT");

    function onFrameUpdate() {
        requestAnimationFrame(onFrameUpdate);
        const now = _now() / 1000;
        const delta = now - (lastAnimationTimestamp || now);
        lastAnimationTimestamp = now;
        if (!emulationActive) return;

        if (residualTime > 0) {
            residualTime -= delta;
        } else {
            residualTime += (1.0 / 60.0) - delta;
            do {
                b.clock();
            } while (!p.frameComplete);
            p.frameComplete = false;
            drawInfo(b, c, p, exports);
        }
    }

    requestAnimationFrame(onFrameUpdate);

    document.addEventListener("keypress", async (event) => {
        if (event.which === 32) {
            emulationActive = !emulationActive
        }
        if (event.key === "s") {
            do {
                b.clock();
            } while (c.cycles != 0);
            do {
                b.clock();
            } while (c.cycles == 0);
        }
        if (event.key === "f") {
            try {
                do {
                    b.clock();
                } while (!p.frameComplete);
                do {
                    b.clock();
                } while (c.cycles != 0);
                p.frameComplete = false;
            } catch (ex) {
                console.log("Error rendering PPU: ", p.cycle, p.scanLine, p.lastPixelIndex);
                console.log(ex);
            }
        }
        if (event.key === "c") b.clock();
        if (event.key === "r") initProgram(b, c, exports);
        if (event.key === "p") {
            selectedPalette++;
            selectedPalette &= 0x07;
        }

        drawInfo(b, c, p, exports);
    });
    drawInfo(b, c, p, exports);
}

initHTML();
main();




