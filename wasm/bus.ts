import { CPU } from "./cpu";
import { PPU } from "./ppu";
import { Cartridge } from "./cartridge";
import { ControlRead } from "./shared";

export class Bus {
    public _cpuRam: ArrayBuffer;
    public cpuRam: Uint8Array;
    public cpu: CPU | null;
    public ppu: PPU | null;
    public cart: Cartridge | null;
    public nSystemClockCounter: u32;
    public controller: u8[] = [0, 0];
    public controllerState: u8[] = [0, 0];

    constructor() {
        this._cpuRam = new ArrayBuffer(2048);
        this.cpuRam = Uint8Array.wrap(this._cpuRam);
        this.nSystemClockCounter = 0;
    }

    init(): void {
        for (let i = 0; i < this.cpuRam.byteLength; i++) {
            this.cpuRam[i] = 0x00;
        }
    }

    attachCPU(cpu: CPU): void {
        this.cpu = cpu;
    }

    attachPPU(ppu: PPU): void {
        this.ppu = ppu;
    }

    _cpu(): CPU {
        let cpu = this.cpu;
        if (!cpu) throw new Error("Null CPU Reference");
        return cpu;
    }

    _ppu(): PPU {
        let ppu = this.ppu;
        if (!ppu) throw new Error("Null PPU Reference");
        return ppu;
    }

    _cart(): Cartridge {
        let cart = this.cart;
        if (!cart) throw new Error("Null Cart Reference");
        return cart;
    }

    cpuWrite(addr: u16, data: u8): void {
        if (this._cart().cpuWrite(addr, data)) {

        } else if (addr >= 0x0000 && addr <= 0x1FFF) {
            this.cpuRam[addr & 0x07FF] = data;
        } else if (addr >= 0x2000 && addr <= 0x3FFF) {
            this._ppu().cpuWrite(addr & 0x0007, data);
        } else if (addr >= 0x4016 && addr <= 0x4017) {
            this.controllerState[addr & 0x0001] = this.controller[addr & 0x0001];
        }
    }

    cpuRead(addr: u16, bReadOnly: boolean): u8 {
        let data: u8 = 0x00;
        const cartResponse: ControlRead = this._cart().cpuRead(addr, bReadOnly);
        data = cartResponse.value;
        if (cartResponse.control) {

        } else if (addr >= 0x0000 && addr <= 0x1FFF) {
            data = this.cpuRam[addr & 0x07FF];
        } else if (addr >= 0x2000 && addr <= 0x3FFF) {
            data = this._ppu().cpuRead(addr & 0x0007, bReadOnly);
        } else if (addr >= 0x4016 && addr <= 0x4017) {
            data = (this.controllerState[addr & 0x0001] & 0x80) > 0 ? 1 : 0;
            this.controllerState[addr & 0x0001] <<= 1;

        }

        return data;
    }

    insertCartridge(cart: Cartridge): void {
        this.cart = cart;
        this._ppu().connectCartridge(cart);
    }

    reset(): void {
        this._cart().reset();
        this._cpu().reset();
        this._ppu().reset();
        this.nSystemClockCounter = 0;
    }

    clock(): void {
        const ppu = this._ppu();
        const cpu = this._cpu();
        ppu.clock();
        if(this.nSystemClockCounter % 3 == 0) {
            cpu.clock();
        }

        if (ppu.nmi) {
            ppu.nmi = false;
            cpu.nmi();
        }

        this.nSystemClockCounter++;
    }
}
