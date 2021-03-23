import { Cartridge, MIRROR } from "./cartridge";
import { ControlRead } from "./shared";

class Pixel {
    constructor(public r: u8, public g: u8, public b: u8) {

    }
}

enum PPUStatus {
    sprite_overflow = (1 << 5),
    sprite_zero_hit = (1 << 6),
    vertical_blank = (1 << 7),
}

enum PPUMask {
    grayscale = (1 << 0),
    render_background_left = (1 << 1),
    render_sprites_left = (1 << 2),
    render_background = (1 << 3),
    render_sprites = (1 << 4),
    enhance_red = (1 << 5),
    enhance_green = (1 << 6),
    enhance_blue = (1 << 7),
}

enum PPUControl {
    nametable_x = (1 << 0),
    nametable_y = (1 << 1),
    increment_mode = (1 << 2),
    pattern_sprite = (1 << 3),
    pattern_background = (1 << 4),
    sprite_size = (1 << 5),
    slave_mode = (1 << 6),
    enable_nmi = (1 << 7),
}

class LoopyRegister {
    constructor(public reg: u16 = 0) {

    }

    _get(length: u16, offset: u16): u16 {
        const mask: u16 = (1 << length) - 1;
        return (this.reg >>> offset) & mask;
    }

    _set(length: u16, offset: u16, x: u16): void {
        const baseMask: u16 = (1 << length) - 1;
        x &= baseMask;
        const mask: u16 = baseMask << offset;
        this.reg &= ~mask;
        this.reg |= x << offset;
    }

    get coarse_x(): u8 {
        return <u8>this._get(5, 0);
    }

    set coarse_x(x: u8) {
        this._set(5, 0, x);
    }

    get coarse_y(): u8 {
        return <u8>this._get(5, 5);
    }

    set coarse_y(x: u8) {
        this._set(5, 5, x);
    }

    get nametable_x(): u8 {
        return <u8>this._get(1, 10);
    }

    set nametable_x(x: u8) {
        this._set(1, 10, x);
    }

    get nametable_y(): u8 {
        return <u8>this._get(1, 11);
    }

    set nametable_y(x: u8) {
        this._set(1, 11, x);
    }

    get fine_y(): u8 {
        return <u8>this._get(3, 12);
    }

    set fine_y(x: u8) {
        this._set(3, 12, x);
    }

    get unused(): u8 {
        return <u8>this._get(1, 15);
    }

    set unused(x: u8) {
        this._set(1, 15, x);
    }
}

const WIDTH = 342;
const HEIGHT = 262;

function setFlag(status: u8, flag: i32, value: boolean): u8 {
    if (value)
        status |= flag as u8;
    else
        status &= ~flag as u8;

    return status;
}

function getFlag(status: u8, flag: i32): u8 {
    return ((status & (flag as u8)) > 0) ? 1 : 0;
}

export class PPU {
    public cart: Cartridge | null;
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
    public scanLine: i16 = 0;
    public cycle: i16 = 0;
    public lastPixelIndex: i32 = 0;

    public palScreen: Array<Pixel>;

    public display: Uint8ClampedArray;
    public spritePatternTable: Array<Uint8ClampedArray>;

    public status: u8 = 0;
    public mask: u8 = 0;
    public control: u8 = 0;

    public addressLatch: u8 = 0;
    public ppuDataBuffer: u8 = 0;
    public ppuAddress: u16 = 0;
    public nmi: boolean = false;

    public readonly vram_addr: LoopyRegister = new LoopyRegister(0);
    public readonly tram_addr: LoopyRegister = new LoopyRegister(0);

    public fine_x: u8 = 0x00;

    public bg_next_tile_id: u8 = 0x00;
    public bg_next_tile_attrib: u8 = 0x00;
    public bg_next_tile_lsb: u8 = 0x00;
    public bg_next_tile_msb: u8 = 0x00;

    public bg_shifter_pattern_lo: u16 = 0x0000;
    public bg_shifter_pattern_hi: u16 = 0x0000;
    public bg_shifter_attrib_lo: u16 = 0x0000;
    public bg_shifter_attrib_hi: u16 = 0x0000;

    constructor() {
        this.display = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
        this.display.fill(0);
        this.palScreen = [
            new Pixel(84, 84, 84),
            new Pixel(0, 30, 116),
            new Pixel(8, 16, 144),
            new Pixel(48, 0, 136),
            new Pixel(68, 0, 100),
            new Pixel(92, 0, 48),
            new Pixel(84, 4, 0),
            new Pixel(60, 24, 0),
            new Pixel(32, 42, 0),
            new Pixel(8, 58, 0),
            new Pixel(0, 64, 0),
            new Pixel(0, 60, 0),
            new Pixel(0, 50, 60),
            new Pixel(0, 0, 0),
            new Pixel(0, 0, 0),
            new Pixel(0, 0, 0),
            new Pixel(152, 150, 152),
            new Pixel(8, 76, 196),
            new Pixel(48, 50, 236),
            new Pixel(92, 30, 228),
            new Pixel(136, 20, 176),
            new Pixel(160, 20, 100),
            new Pixel(152, 34, 32),
            new Pixel(120, 60, 0),
            new Pixel(84, 90, 0),
            new Pixel(40, 114, 0),
            new Pixel(8, 124, 0),
            new Pixel(0, 118, 40),
            new Pixel(0, 102, 120),
            new Pixel(0, 0, 0),
            new Pixel(0, 0, 0),
            new Pixel(0, 0, 0),
            new Pixel(236, 238, 236),
            new Pixel(76, 154, 236),
            new Pixel(120, 124, 236),
            new Pixel(176, 98, 236),
            new Pixel(228, 84, 236),
            new Pixel(236, 88, 180),
            new Pixel(236, 106, 100),
            new Pixel(212, 136, 32),
            new Pixel(160, 170, 0),
            new Pixel(116, 196, 0),
            new Pixel(76, 208, 32),
            new Pixel(56, 204, 108),
            new Pixel(56, 180, 204),
            new Pixel(60, 60, 60),
            new Pixel(0, 0, 0),
            new Pixel(0, 0, 0),
            new Pixel(236, 238, 236),
            new Pixel(168, 204, 236),
            new Pixel(188, 188, 236),
            new Pixel(212, 178, 236),
            new Pixel(236, 174, 236),
            new Pixel(236, 174, 212),
            new Pixel(236, 180, 176),
            new Pixel(228, 196, 144),
            new Pixel(204, 210, 120),
            new Pixel(180, 222, 120),
            new Pixel(168, 226, 144),
            new Pixel(152, 226, 180),
            new Pixel(160, 214, 228),
            new Pixel(160, 162, 160),
            new Pixel(0, 0, 0),
            new Pixel(0, 0, 0),
        ];
        this.spritePatternTable = [
            new Uint8ClampedArray(128 * 128 * 4),
            new Uint8ClampedArray(128 * 128 * 4),
        ];
    }

    connectCartridge(cart: Cartridge): void {
        this.cart = cart;
    }

    @inline
    _cart(): Cartridge {
        let cart = this.cart;
        if (!cart) throw new Error("Null Cart Reference");
        return cart;
    }

    cpuRead(addr: u16, bReadOnly: boolean): u8 {
        let data: u8 = 0x00;

        switch (addr) {
            case 0x0000: // Control
                break;
            case 0x0001: // Mask
                break;
            case 0x0002: // Status
                data = (this.status & 0xE0) | (this.ppuDataBuffer & 0x1F);
                this.status = setFlag(this.status, PPUStatus.vertical_blank, false);
                this.addressLatch = 0;
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
                data = this.ppuDataBuffer;
                this.ppuDataBuffer = this.ppuRead(this.vram_addr.reg, false);

                if (this.vram_addr.reg >= 0x3f00) data = this.ppuDataBuffer;
                this.vram_addr.reg += getFlag(this.control, PPUControl.increment_mode) ? 32 : 1;
                break;
        }

        return data;
    }

    cpuWrite(addr: u16, data: u8): void {
        switch (addr) {
            case 0x0000: // Control
                this.control = data;
                this.tram_addr.nametable_x = getFlag(this.control, PPUControl.nametable_x);
                this.tram_addr.nametable_y = getFlag(this.control, PPUControl.nametable_y);
                break;
            case 0x0001: // Mask
                this.mask = data;
                break;
            case 0x0002: // Status
                break;
            case 0x0003: // OAM Address
                break;
            case 0x0004: // OAM Data
                break;
            case 0x0005: // Scroll
                if (this.addressLatch == 0) {
                    this.fine_x = data & 0x07;
                    this.tram_addr.coarse_x = data >>> 3;
                    this.addressLatch = 1;
                } else {
                    this.tram_addr.fine_y = data & 0x07;
                    this.tram_addr.coarse_y = data >>> 3;
                    this.addressLatch = 0;
                }
                break;
            case 0x0006: // PPU Address
                if (this.addressLatch == 0) {
                    this.tram_addr.reg = (this.tram_addr.reg & 0x00FF) | (<u16>(data & 0x3F) << 8);
                    this.addressLatch = 1;
                } else {
                    this.tram_addr.reg = (this.tram_addr.reg & 0xFF00) | data;
                    this.vram_addr.reg = this.tram_addr.reg;
                    this.addressLatch = 0;
                }
                break;
            case 0x0007: // PPU Data
                this.ppuWrite(this.vram_addr.reg, data);
                this.vram_addr.reg += getFlag(this.control, PPUControl.increment_mode) ? 32 : 1;
                break;
        }
    }

    ppuRead(addr: u16, bReadOnly: boolean): u8 {
        let data: u8 = 0x00;
        addr &= 0x3FFF;
        const cartResponse: ControlRead = this._cart().ppuRead(addr, bReadOnly);
        data = cartResponse.value;
        if (cartResponse.control) {

        } else if (addr >= 0x0000 && addr <= 0x1FFF) { // Pattern
            data = this.tblPattern[(addr & 0x1000) >>> 12][addr & 0x0FFF];
        } else if (addr >= 0x2000 && addr <= 0x3EFF) { // Table
            addr &= 0x0FFF;

            if (this._cart().mirror == MIRROR.VERTICAL) {
                if (addr >= 0x0000 && addr <= 0x03FF)
                    data = this.tblName[0][addr & 0x03FF];
                if (addr >= 0x0400 && addr <= 0x07FF)
                    data = this.tblName[1][addr & 0x03FF];
                if (addr >= 0x0800 && addr <= 0x0BFF)
                    data = this.tblName[0][addr & 0x03FF];
                if (addr >= 0x0C00 && addr <= 0x0FFF)
                    data = this.tblName[1][addr & 0x03FF];
            } else if (this._cart().mirror == MIRROR.HORIZONTAL) {
                if (addr >= 0x0000 && addr <= 0x03FF)
                    data = this.tblName[0][addr & 0x03FF];
                if (addr >= 0x0400 && addr <= 0x07FF)
                    data = this.tblName[0][addr & 0x03FF];
                if (addr >= 0x0800 && addr <= 0x0BFF)
                    data = this.tblName[1][addr & 0x03FF];
                if (addr >= 0x0C00 && addr <= 0x0FFF)
                    data = this.tblName[1][addr & 0x03FF];
            }
        } else if (addr >= 0x3F00 && addr <= 0x3FFF) { // Palette
            addr &= 0x001F;
            if (addr == 0x0010) addr = 0x0000;
            if (addr == 0x0014) addr = 0x0004;
            if (addr == 0x0018) addr = 0x0008;
            if (addr == 0x001C) addr = 0x000C;
            data = this.tblPalette[addr];
        }

        return data;
    }

    ppuWrite(addr: u16, data: u8): void {
        addr &= 0x3FFF;
        if (this._cart().ppuWrite(addr, data)) {

        } else if (addr >= 0x0000 && addr <= 0x1FFF) { // Pattern
            this.tblPattern[(addr & 0x1000) >>> 12][addr & 0x0FFF] = data;
        } else if (addr >= 0x2000 && addr <= 0x3EFF) { // Table
            addr &= 0x0FFF;

            if (this._cart().mirror == MIRROR.VERTICAL) {
                // Vertical
                if (addr >= 0x0000 && addr <= 0x03FF)
                    this.tblName[0][addr & 0x03FF] = data;
                if (addr >= 0x0400 && addr <= 0x07FF)
                    this.tblName[1][addr & 0x03FF] = data;
                if (addr >= 0x0800 && addr <= 0x0BFF)
                    this.tblName[0][addr & 0x03FF] = data;
                if (addr >= 0x0C00 && addr <= 0x0FFF)
                    this.tblName[1][addr & 0x03FF] = data;
            }
            else if (this._cart().mirror == MIRROR.HORIZONTAL) {
                // Horizontal
                if (addr >= 0x0000 && addr <= 0x03FF)
                    this.tblName[0][addr & 0x03FF] = data;
                if (addr >= 0x0400 && addr <= 0x07FF)
                    this.tblName[0][addr & 0x03FF] = data;
                if (addr >= 0x0800 && addr <= 0x0BFF)
                    this.tblName[1][addr & 0x03FF] = data;
                if (addr >= 0x0C00 && addr <= 0x0FFF)
                    this.tblName[1][addr & 0x03FF] = data;
            }
        } else if (addr >= 0x3F00 && addr <= 0x3FFF) { // Palette
            addr &= 0x001F;
            if (addr == 0x0010) addr = 0x0000;
            if (addr == 0x0014) addr = 0x0004;
            if (addr == 0x0018) addr = 0x0008;
            if (addr == 0x001C) addr = 0x000C;
            this.tblPalette[addr] = data;
        }
    }

    getColorFromPaletteRam(palette: u8, pixel: u8): Pixel {
        return this.palScreen[this.ppuRead(0x3F00 + (palette << 2) + pixel, false) & 0x3F];
    }

    getPatternTable(i: u8, palette: u8): Uint8ClampedArray {
        for (let tileY: u16 = 0; tileY < 16; tileY++) {
            for (let tileX: u16 = 0; tileX < 16; tileX++) {
                const offset: u16 = tileY * 256 + tileX * 16;

                for (let row: u16 = 0; row < 8; row++) {
                    let tile_lsb: u8 = this.ppuRead(<u16>(i * 0x1000) + offset + row + 0, false);
                    let tile_msb: u8 = this.ppuRead(<u16>(i * 0x1000) + offset + row + 8, false);
                    for (let col: u16 = 0; col < 8; col++) {
                        let pixel: u8 = (tile_lsb & 0x01) + ((tile_msb & 0x01) << 1);
                        tile_lsb >>>= 1;
                        tile_msb >>>= 1;

                        const _row: u16 = tileY * 8 + row;
                        const _col: u16 = tileX * 8 + (7 - col);

                        const pixelRGB = this.getColorFromPaletteRam(palette, pixel);
                        const base = (_row * 128 + _col) * 4;
                        this.spritePatternTable[i][base + 0] = pixelRGB.r;
                        this.spritePatternTable[i][base + 1] = pixelRGB.g;
                        this.spritePatternTable[i][base + 2] = pixelRGB.b;
                        this.spritePatternTable[i][base + 3] = 255;
                    }
                }
            }
        }

        return this.spritePatternTable[i];
    }

    clock(): void {
        function incrementScrollX(self: PPU): void {
            if (getFlag(self.mask, PPUMask.render_background) || getFlag(self.mask, PPUMask.render_sprites)) {
                if (self.vram_addr.coarse_x == 31) {
                    self.vram_addr.coarse_x = 0;
                    self.vram_addr.nametable_x = ~self.vram_addr.nametable_x;
                } else {
                    self.vram_addr.coarse_x++;
                }
            }
        }

        function incrementScrollY(self: PPU): void {
            if (getFlag(self.mask, PPUMask.render_background) || getFlag(self.mask, PPUMask.render_sprites)) {
                if (self.vram_addr.fine_y < 7) {
                    self.vram_addr.fine_y++;
                } else {
                    self.vram_addr.fine_y = 0;

                    if (self.vram_addr.coarse_y == 29) {
                        self.vram_addr.coarse_y = 0;
                        self.vram_addr.nametable_y = ~self.vram_addr.nametable_y;
                    } else if (self.vram_addr.coarse_y == 31) {
                        self.vram_addr.coarse_y = 0;
                    } else {
                        self.vram_addr.coarse_y++;
                    }
                }
            }
        }

        function transferAddressX(self: PPU): void {
            if (getFlag(self.mask, PPUMask.render_background) || getFlag(self.mask, PPUMask.render_sprites)) {
                self.vram_addr.nametable_x = self.tram_addr.nametable_x;
                self.vram_addr.coarse_x = self.tram_addr.coarse_x;
            }
        }

        function transferAddressY(self: PPU): void {
            if (getFlag(self.mask, PPUMask.render_background) || getFlag(self.mask, PPUMask.render_sprites)) {
                self.vram_addr.nametable_y = self.tram_addr.nametable_y;
                self.vram_addr.coarse_y = self.tram_addr.coarse_y;
            }
        }

        function loadBackgroundShifters(self: PPU): void {
            self.bg_shifter_pattern_lo = (self.bg_shifter_pattern_lo & 0xFF00) | self.bg_next_tile_lsb;
            self.bg_shifter_pattern_hi = (self.bg_shifter_pattern_hi & 0xFF00) | self.bg_next_tile_msb;
            self.bg_shifter_attrib_lo = (self.bg_shifter_attrib_lo & 0xFF00) | ((self.bg_next_tile_attrib & 0b01) ? 0xFF : 0x00);
            self.bg_shifter_attrib_hi = (self.bg_shifter_attrib_hi & 0xFF00) | ((self.bg_next_tile_attrib & 0b10) ? 0xFF : 0x00);
        }

        function updateShifters(self: PPU): void {
            if (getFlag(self.mask, PPUMask.render_background)) {
                self.bg_shifter_pattern_lo <<= 1;
                self.bg_shifter_pattern_hi <<= 1;
                self.bg_shifter_attrib_lo <<= 1;
                self.bg_shifter_attrib_hi <<= 1;
            }
        }

        if (this.scanLine >= -1 && this.scanLine < 240) {
            if (this.scanLine == 0 && this.cycle == 0) {
                this.cycle = 1; // "Odd Frame" cycle skip
            }
            if (this.scanLine == -1 && this.cycle == 1) {
                this.status = setFlag(this.status, PPUStatus.vertical_blank, false);
            }

            if ((this.cycle >= 2 && this.cycle < 258) || (this.cycle >= 321 && this.cycle < 328)) {
                updateShifters(this);
                switch ((this.cycle - 1) % 8) {
                    case 0:
                        loadBackgroundShifters(this);
                        this.bg_next_tile_id = this.ppuRead(0x2000 | (this.vram_addr.reg & 0x0FFF), false);
                        break;
                    case 2:
                        this.bg_next_tile_attrib = this.ppuRead(0x23C0 | (this.vram_addr.nametable_y << 11)
                            | (this.vram_addr.nametable_x << 10)
                            | ((this.vram_addr.coarse_y >>> 2) << 3)
                            | (this.vram_addr.coarse_x >>> 2)
                            , false);
                        if (this.vram_addr.coarse_y & 0x02) this.bg_next_tile_attrib >>>= 4;
                        if (this.vram_addr.coarse_x & 0x02) this.bg_next_tile_attrib >>>= 2;
                        this.bg_next_tile_attrib &= 0x03;
                        break;
                    case 4:
                        this.bg_next_tile_lsb = this.ppuRead(
                            (getFlag(this.control, PPUControl.pattern_background) << 12)
                            + ((<u16>this.bg_next_tile_id) << 4)
                            + (this.vram_addr.fine_y) + 0
                            , false);
                        break;
                    case 6:
                        this.bg_next_tile_lsb = this.ppuRead(
                            (getFlag(this.control, PPUControl.pattern_background) << 12)
                            + ((<u16>this.bg_next_tile_id) << 4)
                            + (this.vram_addr.fine_y) + 8
                            , false);
                        break;
                    case 7:
                        incrementScrollX(this);
                        break;

                }
            }

            if (this.cycle == 256) {
                incrementScrollY(this);
            }

            if (this.cycle == 257) {
                transferAddressX(this);
            }

            if (this.scanLine == -1 && this.cycle >= 280 && this.cycle < 305) {
                transferAddressY(this);
            }
        }

        if (this.scanLine == 240) {
            // Post Render Scanline - Do Nothing!
        }

        if (this.scanLine == 241 && this.cycle == 1) {
            this.status = setFlag(this.status, PPUStatus.vertical_blank, true);
            if (getFlag(this.control, PPUControl.enable_nmi) === 1) {
                this.nmi = true;
            }
        }

        let bgPixel: u8 = 0x00;
        let bgPalete: u8 = 0x00;

        if (getFlag(this.mask, PPUMask.render_background)) {
            const bitMux = 0x8000 >>> this.fine_x;

            const p0Pixel : u8 = (this.bg_shifter_pattern_lo & bitMux) > 0 ? 1: 0;
            const p1Pixel : u8 = (this.bg_shifter_pattern_hi & bitMux) > 0 ? 1: 0;
            bgPixel = (p1Pixel << 1) | p0Pixel;

            const bgPal0 : u8 = (this.bg_shifter_attrib_lo & bitMux) > 0 ? 1 : 0;
            const bgPal1 : u8 = (this.bg_shifter_attrib_hi & bitMux) > 0 ? 1 : 0;
            bgPalete = (bgPal1 << 1) | bgPal0;
        }

        this.lastPixelIndex = ((this.scanLine + 1) * WIDTH + this.cycle) * 4;
        let pixel = this.getColorFromPaletteRam(bgPalete, bgPixel);
        // let pixel = this.palScreen[(Math.round(Math.random()) === 1) ? 0x3F : 0x30];
        this.display[this.lastPixelIndex] = pixel.r;
        this.display[this.lastPixelIndex + 1] = pixel.g;
        this.display[this.lastPixelIndex + 2] = pixel.b;
        this.display[this.lastPixelIndex + 3] = 255;

        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanLine++;
            if (this.scanLine >= 261) {
                this.scanLine = -1;
                this.frameComplete = true;
            }
        }
    }

}