import { ControlRead } from "./shared";

import { Mapper, MappedAddr32 } from "./mapper";
import { Mapper_0000 } from "./mapper_0000";

export class Header {
    constructor(
        public name: string,
        public prg_rom_chunks: u8,
        public chr_rom_chunks: u8,
        public mapper1: u8,
        public mapper2: u8,
        public prg_ram_size: u8,
        public tv_system1: u8,
        public tv_system2: u8,
        public unused: string,
    ) { }
}

function uint8ToArray(u8Arr: Uint8Array): Array<i32> {
    let newArr = new Array<i32>(u8Arr.length);
    for(let i = 0; i < u8Arr.length; i++) {
        newArr[i] = u8Arr[i];
    }

    return newArr;
}

export enum MIRROR {
    HORIZONTAL,
    VERTICAL,
    ONESCREEN_LO,
    ONESCREEN_HI,
}

export class Cartridge {
    public prgMemory: Uint8Array;
    public chrMemory: Uint8Array;

    public mapperId: u8 = 0;
    public prgBanks: u8 = 0;
    public chrBanks: u8 = 0;

    public mapper: Mapper;
    public mirror: MIRROR = MIRROR.HORIZONTAL;

    constructor(fileData: Uint8Array) {
        let pointer = 0;
        let name = String.fromCharCodes(uint8ToArray(fileData.slice(pointer, 4)));
        pointer += 4;
        let prg_rom_chunks = fileData[pointer++];
        let chr_rom_chunks = fileData[pointer++];
        let mapper1 = fileData[pointer++];
        let mapper2 = fileData[pointer++];
        let prg_ram_size = fileData[pointer++];
        let tv_system1 = fileData[pointer++];
        let tv_system2 = fileData[pointer++];
        let unused = String.fromCharCodes(uint8ToArray(fileData.slice(pointer, 5)));
        pointer += 5;
        let header = new Header(name, prg_rom_chunks, chr_rom_chunks, mapper1, mapper2, prg_ram_size, tv_system1, tv_system2, unused);
        if (header.mapper1 & 0x04) {
            pointer += 512;
        }

        this.mapperId = ((header.mapper2 >>> 4) << 4) | (header.mapper1 >>> 4);
        this.mirror = (header.mapper1 & 0x01) ? MIRROR.VERTICAL : MIRROR.HORIZONTAL;

        const fileType: u8 = 1;

        trace("File Type", 1, fileType);
        if (fileType == 0) {
            // Placeholder
            this.prgBanks = 0;
            this.chrBanks = 0;
            this.prgMemory = new Uint8Array(0);
            this.chrMemory = new Uint8Array(0);
        } else if (fileType == 1) {
            this.prgBanks = header.prg_rom_chunks;
            const prgMemorySize: u32 = (<u32>this.prgBanks) * 16384;
            trace("Reading PRG", 2, pointer, prgMemorySize);
            this.prgMemory = fileData.slice(pointer, pointer + prgMemorySize);
            pointer += prgMemorySize;

            this.chrBanks = header.chr_rom_chunks;
            let chrMemorySize: u32 = (<u32>this.chrBanks) * 8192;
            if(chrMemorySize == 0) chrMemorySize = 8192;
            trace("Reading CHR", 2, pointer, chrMemorySize);
            this.chrMemory = fileData.slice(pointer, pointer + chrMemorySize);
            pointer += chrMemorySize;
        } else if (fileType == 2) {
            // Placeholder
            this.prgBanks = 0;
            this.chrBanks = 0;
            this.prgMemory = new Uint8Array(0);
            this.chrMemory = new Uint8Array(0);
        }

        this.mapper = new Mapper_0000(this.prgBanks, this.chrBanks);

        switch (this.mapperId) {
            case 0:
                this.mapper = new Mapper_0000(this.prgBanks, this.chrBanks);
                break;
        }
    }

    reset(): void {
        this.mapper.reset();
    }

    cpuRead(addr: u16, bReadOnly: boolean): ControlRead {
        let data: u8 = 0x00;
        let mapperResponse = this.mapper.cpuMapRead(addr);
        if (mapperResponse.control) {
            data = this.prgMemory[mapperResponse.mapped];
            return new ControlRead(true, data);
        }

        return new ControlRead(false, data);
    }

    cpuWrite(addr: u16, data: u8): bool {
        let mapperResponse = this.mapper.cpuMapWrite(addr);
        if (mapperResponse.control) {
            this.prgMemory[mapperResponse.mapped] = data;
            return true;
        }

        return false;
    }

    ppuRead(addr: u16, bReadOnly: boolean): ControlRead {
        let data: u8 = 0x00;
        let mapperResponse = this.mapper.ppuMapRead(addr);
        if (mapperResponse.control) {
            data = this.chrMemory[mapperResponse.mapped];
            return new ControlRead(true, data);
        }

        return new ControlRead(false, data);
    }

    ppuWrite(addr: u16, data: u8): bool {
        let mapperResponse = this.mapper.ppuMapWrite(addr);
        if (mapperResponse.control) {
            this.chrMemory[mapperResponse.mapped] = data;
            return true;
        }

        return false;
    }
}