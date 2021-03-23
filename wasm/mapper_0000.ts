import { MappedAddr32, Mapper } from "./mapper";

export class Mapper_0000 extends Mapper {
    cpuMapRead(addr: u16): MappedAddr32 {
        if(addr >= 0x8000 && addr <= 0xFFFF) {
            const newAddr : u32 = addr & (this.prgBanks > 1 ? 0x7FFF : 0x3FFF);
            return new MappedAddr32(true, newAddr);
        }
        
        return new MappedAddr32(false, 0);
    }
    cpuMapWrite(addr: u16): MappedAddr32 {
        if(addr >= 0x8000 && addr <= 0xFFFF) {
            const newAddr : u32 = addr & (this.prgBanks > 1 ? 0x7FFF : 0x3FFF);
            return new MappedAddr32(true, newAddr);
        }
        
        return new MappedAddr32(false, 0);
    }
    ppuMapRead(addr: u16): MappedAddr32 {
        if(addr >= 0x0000 && addr <= 0x1FFF) {
            return new MappedAddr32(true, addr);
        }
        
        return new MappedAddr32(false, 0);
    }
    ppuMapWrite(addr: u16): MappedAddr32 {
        if(addr >= 0x0000 && addr <= 0x1FFF) {
            if(this.chrBanks == 0) {
                return new MappedAddr32(true, addr);
            }
        }

        return new MappedAddr32(false, 0);
    }

}
