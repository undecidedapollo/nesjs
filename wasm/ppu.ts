import {Cartridge} from "./cartridge";
import { ControlRead } from "./shared";

export class PPU {
    public cart : Cartridge | null;
    public tblName: Array<Uint8Array> = [
        new Uint8Array(1024),
        new Uint8Array(1024),
    ];
    public tblPalette: Uint8Array = new Uint8Array(32);
    public tblPattern: Array<Uint8Array> = [
        new Uint8Array(4096),
        new Uint8Array(4096),
    ]; // Unused by normal NES Emulation

    public frameComplete: boolean = false;
    public scanLine : i16 = 0;
    public cycle : i16 = 0;

    connectCartridge(cart: Cartridge): void {
        this.cart = cart;
    }

    @inline
    _cart() : Cartridge {
        let cart = this.cart;
        if(!cart) throw new Error("Null Cart Reference");
        return cart;
    }

    cpuRead(addr: u16, bReadOnly: boolean): u8 {
        const data: u8 = 0x00;

        switch (addr) {
            case 0x0000: // Control
                break;
            case 0x0001: // Mask
                break;
            case 0x0002: // Status
                break;
            case 0x0003: // OAM Address
                break;
            case 0x0004: // OAM Data
                break;
            case 0x0005: // Scroll
                break;
            case 0x0006: // PPU Address
                break;
            case 0x0007: // PPU Data
                break;
        }

        return data;
    }

    cpuWrite(addr: u16, data: u8): void {
        switch (addr) {
            case 0x0000: // Control
                break;
            case 0x0001: // Mask
                break;
            case 0x0002: // Status
                break;
            case 0x0003: // OAM Address
                break;
            case 0x0004: // OAM Data
                break;
            case 0x0005: // Scroll
                break;
            case 0x0006: // PPU Address
                break;
            case 0x0007: // PPU Data
                break;
        }
    }

    ppuRead(addr: u16, bReadOnly: boolean): u8 {
        let data : u8 = 0x00;
        addr &= 0x3FFF;
        const cartResponse: ControlRead = this._cart().ppuRead(addr, bReadOnly);
        data = cartResponse.value;
        if (cartResponse.control) {
            
        }
        return data;
    }

    ppuWrite(addr: u16, data: u8): void {
        addr &= 0x3FFF;
        if (this._cart().ppuWrite(addr, data)) {
            
        }
    }

    clock() : void {
        this.cycle++;
        if(this.cycle >= 341) {
            this.cycle = 0;
            this.scanLine++;
            if(this.scanLine >= 261) {
                this.scanLine = -1;
                this.frameComplete = true;
            }
        }
    }

}