export class MappedAddr32 {
    constructor(public control: boolean, public mapped: u32) {
    }
}


export abstract class Mapper {
    constructor(public prgBanks: u8, public chrBanks: u8) {
        
    }

    abstract cpuMapRead(addr: u16): MappedAddr32;
    abstract cpuMapWrite(addr: u16): MappedAddr32;
    abstract ppuMapRead(addr: u16): MappedAddr32;
    abstract ppuMapWrite(addr: u16): MappedAddr32;
    abstract reset(): void;
}
