import { Bus } from "./bus";

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

export class Instruction {
    public name: string;
    public cycles: u8 = 0;
    public operate: (this: CPU) => u8;
    public addrmode: (this: CPU) => u8;

    constructor(name: string, cycles: u8, operate: (this: CPU) => u8, addrmode: (this: CPU) => u8) {
        this.name = name;
        this.cycles = cycles;
        this.operate = operate;
        this.addrmode = addrmode;
    }
}

function i(name: string, operate: (this: CPU) => u8, addrmode: (this: CPU) => u8, cycles: u8): Instruction {
    const inst = new Instruction(name, cycles, operate, addrmode);
    return inst;
}

export class CPU {
    public a: u8 = 0x00;
    public x: u8 = 0x00;
    public y: u8 = 0x00;
    public stkp: u8 = 0x00;
    public pc: u16 = 0x0000;
    public status: u8 = 0x00;

    // Private
    public fetched: u8 = 0x00; // Represents the working input value to the ALU
    public temp: u16 = 0x0000; // A convenience variable used everywhere
    public addr_abs: u16 = 0x0000; // All used memory addresses end up in here
    public addr_rel: u16 = 0x00; // Represents absolute address following a branch
    public opcode: u8 = 0x00; // Is the instruction byte
    public cycles: u8 = 0x00;  // Counts how many cycles the instruction has remaining
    public clock_count: u32 = 0x00000000; // A global accumulation of the number of clocks
    public lookup: Array<Instruction>;

    constructor(public bus: Bus) {
        this.lookup = [
            i("BRK", this.BRK, this.IMM, 7),i("ORA", this.ORA, this.IZX, 6),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 3),i("ORA", this.ORA, this.ZP0, 3),i("ASL", this.ASL, this.ZP0, 5),i("???", this.XXX, this.IMP, 5),i("PHP", this.PHP, this.IMP, 3),i("ORA", this.ORA, this.IMM, 2),i("ASL", this.ASL, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("???", this.NOP, this.IMP, 4),i("ORA", this.ORA, this.ABS, 4),i("ASL", this.ASL, this.ABS, 6),i("???", this.XXX, this.IMP, 6),
            i("BPL", this.BPL, this.REL, 2),i("ORA", this.ORA, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 4),i("ORA", this.ORA, this.ZPX, 4),i("ASL", this.ASL, this.ZPX, 6),i("???", this.XXX, this.IMP, 6),i("CLC", this.CLC, this.IMP, 2),i("ORA", this.ORA, this.ABY, 4),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 7),i("???", this.NOP, this.IMP, 4),i("ORA", this.ORA, this.ABX, 4),i("ASL", this.ASL, this.ABX, 7),i("???", this.XXX, this.IMP, 7),
            i("JSR", this.JSR, this.ABS, 6),i("AND", this.AND, this.IZX, 6),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("BIT", this.BIT, this.ZP0, 3),i("AND", this.AND, this.ZP0, 3),i("ROL", this.ROL, this.ZP0, 5),i("???", this.XXX, this.IMP, 5),i("PLP", this.PLP, this.IMP, 4),i("AND", this.AND, this.IMM, 2),i("ROL", this.ROL, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("BIT", this.BIT, this.ABS, 4),i("AND", this.AND, this.ABS, 4),i("ROL", this.ROL, this.ABS, 6),i("???", this.XXX, this.IMP, 6),
            i("BMI", this.BMI, this.REL, 2),i("AND", this.AND, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 4),i("AND", this.AND, this.ZPX, 4),i("ROL", this.ROL, this.ZPX, 6),i("???", this.XXX, this.IMP, 6),i("SEC", this.SEC, this.IMP, 2),i("AND", this.AND, this.ABY, 4),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 7),i("???", this.NOP, this.IMP, 4),i("AND", this.AND, this.ABX, 4),i("ROL", this.ROL, this.ABX, 7),i("???", this.XXX, this.IMP, 7),
            i("RTI", this.RTI, this.IMP, 6),i("EOR", this.EOR, this.IZX, 6),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 3),i("EOR", this.EOR, this.ZP0, 3),i("LSR", this.LSR, this.ZP0, 5),i("???", this.XXX, this.IMP, 5),i("PHA", this.PHA, this.IMP, 3),i("EOR", this.EOR, this.IMM, 2),i("LSR", this.LSR, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("JMP", this.JMP, this.ABS, 3),i("EOR", this.EOR, this.ABS, 4),i("LSR", this.LSR, this.ABS, 6),i("???", this.XXX, this.IMP, 6),
            i("BVC", this.BVC, this.REL, 2),i("EOR", this.EOR, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 4),i("EOR", this.EOR, this.ZPX, 4),i("LSR", this.LSR, this.ZPX, 6),i("???", this.XXX, this.IMP, 6),i("CLI", this.CLI, this.IMP, 2),i("EOR", this.EOR, this.ABY, 4),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 7),i("???", this.NOP, this.IMP, 4),i("EOR", this.EOR, this.ABX, 4),i("LSR", this.LSR, this.ABX, 7),i("???", this.XXX, this.IMP, 7),
            i("RTS", this.RTS, this.IMP, 6),i("ADC", this.ADC, this.IZX, 6),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 3),i("ADC", this.ADC, this.ZP0, 3),i("ROR", this.ROR, this.ZP0, 5),i("???", this.XXX, this.IMP, 5),i("PLA", this.PLA, this.IMP, 4),i("ADC", this.ADC, this.IMM, 2),i("ROR", this.ROR, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("JMP", this.JMP, this.IND, 5),i("ADC", this.ADC, this.ABS, 4),i("ROR", this.ROR, this.ABS, 6),i("???", this.XXX, this.IMP, 6),
            i("BVS", this.BVS, this.REL, 2),i("ADC", this.ADC, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 4),i("ADC", this.ADC, this.ZPX, 4),i("ROR", this.ROR, this.ZPX, 6),i("???", this.XXX, this.IMP, 6),i("SEI", this.SEI, this.IMP, 2),i("ADC", this.ADC, this.ABY, 4),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 7),i("???", this.NOP, this.IMP, 4),i("ADC", this.ADC, this.ABX, 4),i("ROR", this.ROR, this.ABX, 7),i("???", this.XXX, this.IMP, 7),
            i("???", this.NOP, this.IMP, 2),i("STA", this.STA, this.IZX, 6),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 6),i("STY", this.STY, this.ZP0, 3),i("STA", this.STA, this.ZP0, 3),i("STX", this.STX, this.ZP0, 3),i("???", this.XXX, this.IMP, 3),i("DEY", this.DEY, this.IMP, 2),i("???", this.NOP, this.IMP, 2),i("TXA", this.TXA, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("STY", this.STY, this.ABS, 4),i("STA", this.STA, this.ABS, 4),i("STX", this.STX, this.ABS, 4),i("???", this.XXX, this.IMP, 4),
            i("BCC", this.BCC, this.REL, 2),i("STA", this.STA, this.IZY, 6),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 6),i("STY", this.STY, this.ZPX, 4),i("STA", this.STA, this.ZPX, 4),i("STX", this.STX, this.ZPY, 4),i("???", this.XXX, this.IMP, 4),i("TYA", this.TYA, this.IMP, 2),i("STA", this.STA, this.ABY, 5),i("TXS", this.TXS, this.IMP, 2),i("???", this.XXX, this.IMP, 5),i("???", this.NOP, this.IMP, 5),i("STA", this.STA, this.ABX, 5),i("???", this.XXX, this.IMP, 5),i("???", this.XXX, this.IMP, 5),
            i("LDY", this.LDY, this.IMM, 2),i("LDA", this.LDA, this.IZX, 6),i("LDX", this.LDX, this.IMM, 2),i("???", this.XXX, this.IMP, 6),i("LDY", this.LDY, this.ZP0, 3),i("LDA", this.LDA, this.ZP0, 3),i("LDX", this.LDX, this.ZP0, 3),i("???", this.XXX, this.IMP, 3),i("TAY", this.TAY, this.IMP, 2),i("LDA", this.LDA, this.IMM, 2),i("TAX", this.TAX, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("LDY", this.LDY, this.ABS, 4),i("LDA", this.LDA, this.ABS, 4),i("LDX", this.LDX, this.ABS, 4),i("???", this.XXX, this.IMP, 4),
            i("BCS", this.BCS, this.REL, 2),i("LDA", this.LDA, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 5),i("LDY", this.LDY, this.ZPX, 4),i("LDA", this.LDA, this.ZPX, 4),i("LDX", this.LDX, this.ZPY, 4),i("???", this.XXX, this.IMP, 4),i("CLV", this.CLV, this.IMP, 2),i("LDA", this.LDA, this.ABY, 4),i("TSX", this.TSX, this.IMP, 2),i("???", this.XXX, this.IMP, 4),i("LDY", this.LDY, this.ABX, 4),i("LDA", this.LDA, this.ABX, 4),i("LDX", this.LDX, this.ABY, 4),i("???", this.XXX, this.IMP, 4),
            i("CPY", this.CPY, this.IMM, 2),i("CMP", this.CMP, this.IZX, 6),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("CPY", this.CPY, this.ZP0, 3),i("CMP", this.CMP, this.ZP0, 3),i("DEC", this.DEC, this.ZP0, 5),i("???", this.XXX, this.IMP, 5),i("INY", this.INY, this.IMP, 2),i("CMP", this.CMP, this.IMM, 2),i("DEX", this.DEX, this.IMP, 2),i("???", this.XXX, this.IMP, 2),i("CPY", this.CPY, this.ABS, 4),i("CMP", this.CMP, this.ABS, 4),i("DEC", this.DEC, this.ABS, 6),i("???", this.XXX, this.IMP, 6),
            i("BNE", this.BNE, this.REL, 2),i("CMP", this.CMP, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 4),i("CMP", this.CMP, this.ZPX, 4),i("DEC", this.DEC, this.ZPX, 6),i("???", this.XXX, this.IMP, 6),i("CLD", this.CLD, this.IMP, 2),i("CMP", this.CMP, this.ABY, 4),i("NOP", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 7),i("???", this.NOP, this.IMP, 4),i("CMP", this.CMP, this.ABX, 4),i("DEC", this.DEC, this.ABX, 7),i("???", this.XXX, this.IMP, 7),
            i("CPX", this.CPX, this.IMM, 2),i("SBC", this.SBC, this.IZX, 6),i("???", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("CPX", this.CPX, this.ZP0, 3),i("SBC", this.SBC, this.ZP0, 3),i("INC", this.INC, this.ZP0, 5),i("???", this.XXX, this.IMP, 5),i("INX", this.INX, this.IMP, 2),i("SBC", this.SBC, this.IMM, 2),i("NOP", this.NOP, this.IMP, 2),i("???", this.SBC, this.IMP, 2),i("CPX", this.CPX, this.ABS, 4),i("SBC", this.SBC, this.ABS, 4),i("INC", this.INC, this.ABS, 6),i("???", this.XXX, this.IMP, 6),
            i("BEQ", this.BEQ, this.REL, 2),i("SBC", this.SBC, this.IZY, 5),i("???", this.XXX, this.IMP, 2),i("???", this.XXX, this.IMP, 8),i("???", this.NOP, this.IMP, 4),i("SBC", this.SBC, this.ZPX, 4),i("INC", this.INC, this.ZPX, 6),i("???", this.XXX, this.IMP, 6),i("SED", this.SED, this.IMP, 2),i("SBC", this.SBC, this.ABY, 4),i("NOP", this.NOP, this.IMP, 2),i("???", this.XXX, this.IMP, 7),i("???", this.NOP, this.IMP, 4),i("SBC", this.SBC, this.ABX, 4),i("INC", this.INC, this.ABX, 7),i("???", this.XXX, this.IMP, 7),
        ];

        bus.attachCPU(this);
    }

    write(addr: u16, data: u8): void {
        this.bus.cpuWrite(addr, data);
    }

    read(addr: u16): u8 {
        return this.bus.cpuRead(addr, false);
    }

    clock(): void {
        if (this.cycles === 0) {
            this.opcode = this.read(this.pc);
            this.setFlag(CPU_FLAGS.U, true);
            this.pc++;
            const instruction: Instruction = this.lookup[this.opcode];
            this.cycles = instruction.cycles;

            const addCycle1: u8 = instruction.addrmode.call(this);
            const addCycle2: u8 = instruction.operate.call(this);

            this.cycles += (addCycle1 & addCycle2);
            this.setFlag(CPU_FLAGS.U, true);
        }

        this.clock_count++;
        this.cycles--;
    }

    reset(): void {
        this.addr_abs = 0xFFFC;
        const lo: u16 = this.read(this.addr_abs + 0);
        const hi: u16 = this.read(this.addr_abs + 1);

        this.pc = (hi << 8) | lo;

        this.a = 0;
        this.x = 0;
        this.y = 0;

        this.stkp = 0xFD;
        this.status = 0x00 | <u8>CPU_FLAGS.U;

        this.addr_rel = 0x0000;
        this.addr_abs = 0x0000;
        this.fetched = 0x00;

        this.cycles = 8;
    }

    _pushStack(val: u8): void {
        this.write(0x0100 + this.stkp, val);
        this.stkp--;
    }

    _popStack(): u8 {
        this.stkp++;
        return this.read(0x0100 + this.stkp);
    }

    irq(): void {
        if (this.getFlag(CPU_FLAGS.I) == 0) {
            this._pushStack(<u8>((this.pc >>> 8) & 0x00FF));
            this._pushStack(<u8>(this.pc & 0x00FF));

            this.setFlag(CPU_FLAGS.B, false);
            this.setFlag(CPU_FLAGS.U, true);
            this.setFlag(CPU_FLAGS.I, true);

            this._pushStack(this.status);

            this.addr_abs = 0xFFFE;
            const lo: u16 = this.read(this.addr_abs + 0);
            const hi: u16 = this.read(this.addr_abs + 1);

            this.pc = (hi << 8) | lo;
            this.cycles = 7;
        }
    }

    nmi(): void {
        this._pushStack(<u8>((this.pc >>> 8) & 0x00FF));
        this._pushStack(<u8>(this.pc & 0x00FF));

        this.setFlag(CPU_FLAGS.B, false);
        this.setFlag(CPU_FLAGS.U, true);
        this.setFlag(CPU_FLAGS.I, true);

        this._pushStack(this.status);

        this.addr_abs = 0xFFFA;
        const lo: u16 = this.read(this.addr_abs + 0);
        const hi: u16 = this.read(this.addr_abs + 1);

        this.pc = (hi << 8) | lo;
        this.cycles = 8;
    }

    getFlag(flag: CPU_FLAGS): u8 {
        return ((this.status & flag) > 0) ? 1 : 0;
    }

    setFlag(flag: CPU_FLAGS, v: boolean): void {
        if (v)
            this.status |= flag as u8;
        else
            this.status &= ~flag as u8;
    }

    //#region Address Modes

    IMP(): u8 {
        this.fetched = this.a;
        return 0;
    }

    IMM(): u8 {
        this.addr_abs = this.pc++;
        return 0;
    }

    ZP0(): u8 {
        this.addr_abs = this.read(this.pc) & 0x00FF;
        this.pc++;
        return 0;
    }

    ZPX(): u8 {
        this.addr_abs = (this.read(this.pc) + this.x) & 0x00FF;
        this.pc++;
        return 0;
    }

    ZPY(): u8 {
        this.addr_abs = (this.read(this.pc) + this.y) & 0x00FF;
        this.pc++;
        return 0;
    }

    ABS(): u8 {
        const lo: u16 = this.read(this.pc);
        this.pc++;
        const hi: u16 = this.read(this.pc);
        this.pc++;

        this.addr_abs = (hi << 8) | lo;
        return 0;
    }

    ABX(): u8 {
        const lo: u16 = this.read(this.pc);
        this.pc++;
        const hi: u16 = this.read(this.pc);
        this.pc++;

        this.addr_abs = (hi << 8) | lo;
        this.addr_abs += this.x;

        if ((this.addr_abs & 0xFF00) != (hi << 8)) return 1;

        return 0;
    }

    ABY(): u8 {
        const lo: u16 = this.read(this.pc);
        this.pc++;
        const hi: u16 = this.read(this.pc);
        this.pc++;

        this.addr_abs = (hi << 8) | lo;
        this.addr_abs += this.y;

        if ((this.addr_abs & 0xFF00) != (hi << 8)) return 1;

        return 0;
    }

    IND(): u8 {
        const lo_p: u16 = this.read(this.pc);
        this.pc++;
        const hi_p: u16 = this.read(this.pc);
        this.pc++;

        const ptr: u16 = (hi_p << 8) | lo_p;

        if (lo_p == 0x00FF) // Simulate page boundary hardware bug
        {
            this.addr_abs = (this.read(ptr & 0xFF00) << 8) | this.read(ptr + 0);
        }
        else // Behave normally
        {
            this.addr_abs = (this.read(ptr + 1) << 8) | this.read(ptr + 0);
        }

        return 0;
    }

    IZX(): u8 {
        const t: u16 = this.read(this.pc);
        this.pc++;

        const lo: u16 = this.read(<u16>(t + <u16>this.x) & 0x00FF);
        const hi: u16 = this.read(<u16>(t + <u16>this.x + 1) & 0x00FF);
        this.addr_abs = (hi << 8) | lo;
        return 0;
    }

    IZY(): u8 {
        const t: u16 = this.read(this.pc);
        this.pc++;

        const lo: u16 = this.read(t & 0x00FF);
        const hi: u16 = this.read((t + 1) & 0x00FF);
        this.addr_abs = (hi << 8) | lo;
        this.addr_abs += this.y;

        if ((this.addr_abs & 0xFF00) != (hi << 8)) return 1;

        return 0;
    }

    REL(): u8 {
        this.addr_rel = this.read(this.pc);
        this.pc++;

        if (this.addr_rel & 0x80) {
            this.addr_rel |= 0xFF00;
        }

        return 0;
    }
    //#endregion

    //#region Instructions
    fetch(): u8 {
        if (!(this.lookup[this.opcode].addrmode == this.IMP)) {
            this.fetched = this.read(this.addr_abs);
        }

        return this.fetched;
    }

    ADC(): u8 {
        this.fetch();
        this.temp = <u16>this.a + <u16>this.fetched + <u16>this.getFlag(CPU_FLAGS.C);
        this.setFlag(CPU_FLAGS.C, this.temp > 255);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0);
        this.setFlag(CPU_FLAGS.V, ((~(<u16>this.a ^ <u16>this.fetched) & (<u16>this.a ^ <u16>this.temp)) & 0x0080) != 0);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        this.a = <u8>(this.temp & 0x00FF);
        return 1;
    }
    SBC(): u8 {
        this.fetch();
        const value: u16 = (<u16>this.fetched) ^ 0x00FF;
        this.temp = <u16>this.a + <u16>value + <u16>this.getFlag(CPU_FLAGS.C);
        this.setFlag(CPU_FLAGS.C, this.temp > 255);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0);
        this.setFlag(CPU_FLAGS.V, ((<u16>this.temp ^ <u16>this.a) & (<u16>this.temp ^ <u16>value) & 0x0080) != 0);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        this.a = <u8>(this.temp & 0x00FF);
        return 1;
    }

    AND(): u8 {
        this.fetch();
        this.a = this.a & this.fetched;
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 1;
    }

    ASL(): u8 {
        this.fetch();
        this.temp = (<u16>this.fetched) << 1;
        this.setFlag(CPU_FLAGS.C, (this.temp & 0xFF00) > 0);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        if (this.lookup[this.opcode].addrmode == this.IMP) {
            this.a = <u8>(this.temp & 0x00FF);
            return 0
        }
        this.write(this.addr_abs, <u8>(this.temp & 0x00FF));
        return 0
    }

    private _standardBranch(): u8 {
        this.cycles++;
        this.addr_abs = this.pc + this.addr_rel;
        if ((this.addr_abs & 0xFF00) != (this.pc & 0xFF00)) {
            this.cycles++;
        }

        this.pc = this.addr_abs;

        return 0;
    }

    BCC(): u8 {
        if (this.getFlag(CPU_FLAGS.C) == 1) return 0;
        return this._standardBranch();
    }

    BCS(): u8 {
        if (this.getFlag(CPU_FLAGS.C) == 0) return 0;
        return this._standardBranch();
    }

    BEQ(): u8 {
        if (this.getFlag(CPU_FLAGS.Z) == 0) return 0;
        return this._standardBranch();
    }

    BIT(): u8 {
        this.fetch();
        this.temp = this.a & this.fetched;
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.fetched & (1 << 7)) == 1);
        this.setFlag(CPU_FLAGS.V, (this.fetched & (1 << 6)) == 1);
        return 0;
    }

    BMI(): u8 {
        if (this.getFlag(CPU_FLAGS.N) == 0) return 0;
        return this._standardBranch();
    }

    BNE(): u8 {
        if (this.getFlag(CPU_FLAGS.Z) == 1) return 0;
        return this._standardBranch();
    }

    BPL(): u8 {
        if (this.getFlag(CPU_FLAGS.N) == 1) return 0;
        return this._standardBranch();
    }

    BRK(): u8 {
        this.pc++;
        this.setFlag(CPU_FLAGS.I, true);
        this._pushStack(<u8>((this.pc >>> 8) & 0x00FF));
        this._pushStack(<u8>(this.pc & 0x00FF));

        this.setFlag(CPU_FLAGS.B, true);
        this._pushStack(this.status);
        this.setFlag(CPU_FLAGS.B, false);

        const lo: u16 = this.read(0xFFFE);
        const hi: u16 = this.read(0xFFFF);

        this.pc = (hi << 8) | lo;

        return 0;
    }

    BVC(): u8 {
        if (this.getFlag(CPU_FLAGS.V) == 1) return 0;
        return this._standardBranch();
    }

    BVS(): u8 {
        if (this.getFlag(CPU_FLAGS.V) == 0) return 0;
        return this._standardBranch();
    }

    CLC(): u8 {
        this.setFlag(CPU_FLAGS.C, false);
        return 0;
    }

    CLD(): u8 {
        this.setFlag(CPU_FLAGS.D, false);
        return 0;
    }

    CLI(): u8 {
        this.setFlag(CPU_FLAGS.I, false);
        return 0;
    }

    CLV(): u8 {
        this.setFlag(CPU_FLAGS.V, false);
        return 0;
    }

    CMP(): u8 {
        this.fetch();
        this.temp = (<u16>this.a) - (<u16>this.fetched);
        this.setFlag(CPU_FLAGS.C, this.a >= this.fetched);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        return 1;
    }

    CPX(): u8 {
        this.fetch();
        this.temp = (<u16>this.x) - (<u16>this.fetched);
        this.setFlag(CPU_FLAGS.C, this.x >= this.fetched);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        return 0;
    }

    CPY(): u8 {
        this.fetch();
        this.temp = (<u16>this.y) - (<u16>this.fetched);
        this.setFlag(CPU_FLAGS.C, this.y >= this.fetched);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        return 0;
    }

    DEC(): u8 {
        this.fetch();
        this.temp = this.fetched - 1;
        this.write(this.addr_abs, <u8>(this.temp & 0x00FF));
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        return 0;
    }

    DEX(): u8 {
        this.x--;
        this.setFlag(CPU_FLAGS.Z, this.x == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.x & 0x80) != 0);
        return 0;
    }

    DEY(): u8 {
        this.y--;
        this.setFlag(CPU_FLAGS.Z, this.y == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.y & 0x80) != 0);
        return 0;
    }

    EOR(): u8 {
        this.fetch();
        this.a ^= this.fetched;
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 1;
    }

    INC(): u8 {
        this.fetch();
        this.temp = this.fetched + 1;
        this.write(this.addr_abs, <u8>(this.temp & 0x00FF));
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        return 0;
    }

    INX(): u8 {
        this.x++;
        this.setFlag(CPU_FLAGS.Z, this.x == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.x & 0x80) != 0);
        return 0;
    }

    INY(): u8 {
        this.y++;
        this.setFlag(CPU_FLAGS.Z, this.y == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.y & 0x80) != 0);
        return 0;
    }

    JMP(): u8 {
        this.pc = this.addr_abs;
        return 0;
    }

    JSR(): u8 {
        this.pc--;

        this._pushStack(<u8>((this.pc >>> 8) & 0x00FF));
        this._pushStack(<u8>(this.pc & 0x00FF));

        this.pc = this.addr_abs;
        return 0;
    }

    LDA(): u8 {
        this.fetch();
        this.a = this.fetched;
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 1;
    }

    LDX(): u8 {
        this.fetch();
        this.x = this.fetched;
        this.setFlag(CPU_FLAGS.Z, this.x == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.x & 0x80) != 0);
        return 1;
    }

    LDY(): u8 {
        this.fetch();
        this.y = this.fetched;
        this.setFlag(CPU_FLAGS.Z, this.y == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.y & 0x80) != 0);
        return 1;
    }

    LSR(): u8 {
        this.fetch();
        this.setFlag(CPU_FLAGS.C, (this.fetched & 0x0001) != 0);
        this.temp = this.fetched >>> 1;
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        if (this.lookup[this.opcode].addrmode == this.IMP) {
            this.a = <u8>(this.temp & 0x00FF);
        } else {
            this.write(this.addr_abs, <u8>(this.temp & 0x00FF));
        }

        return 0;
    }

    NOP(): u8 {
        switch (this.opcode) {
            case 0x1C:
            case 0x3C:
            case 0x5C:
            case 0x7C:
            case 0xDC:
            case 0xFC:
                return 1;
        }
        return 0;
    }

    ORA(): u8 {
        this.fetch();
        this.a |= this.fetched;
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 1;
    }

    PHA(): u8 {
        this.write(0x0100 + this.stkp, this.a);
        this.stkp--;
        return 0;
    }

    PHP(): u8 {
        this._pushStack(this.status | <u8>CPU_FLAGS.B | <u8>CPU_FLAGS.U);
        this.setFlag(CPU_FLAGS.B, false);
        this.setFlag(CPU_FLAGS.U, false);
        return 0;
    }

    PLA(): u8 {
        this.stkp++;
        this.a = this.read(0x0100 + this.stkp);
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 0;
    }

    PLP(): u8 {
        this.status = this._popStack();
        this.setFlag(CPU_FLAGS.U, true);
        return 0;
    }

    ROL(): u8 {
        this.fetch();
        this.temp = (<u16>this.fetched << 1) | this.getFlag(CPU_FLAGS.C);
        this.setFlag(CPU_FLAGS.C, (this.fetched & 0xFF00) != 0);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        if (this.lookup[this.opcode].addrmode == this.IMP) {
            this.a = <u8>(this.temp & 0x00FF);
        } else {
            this.write(this.addr_abs, <u8>(this.temp & 0x00FF));
        }

        return 0;
    }

    ROR(): u8 {
        this.fetch();
        this.temp = (<u16>this.getFlag(CPU_FLAGS.C) << 7) | (<u16>this.fetched >>> 1);
        this.setFlag(CPU_FLAGS.C, (this.fetched & 0x0001) != 0);
        this.setFlag(CPU_FLAGS.Z, (this.temp & 0x00FF) == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.temp & 0x80) != 0);
        if (this.lookup[this.opcode].addrmode == this.IMP) {
            this.a = <u8>(this.temp & 0x00FF);
        } else {
            this.write(this.addr_abs, <u8>(this.temp & 0x00FF));
        }

        return 0;
    }

    RTI(): u8 {
        this.status = this._popStack();
        this.status &= ~<u8>CPU_FLAGS.B;
        this.status &= ~<u8>CPU_FLAGS.U;

        this.pc = this._popStack();
        this.pc |= (<u16>this._popStack()) << 8;
        return 0;
    }

    RTS(): u8 {
        this.pc = this._popStack();
        this.pc |= (<u16>this._popStack()) << 8;
        this.pc++;
        return 0;
    }

    SEC(): u8 {
        this.setFlag(CPU_FLAGS.C, true);
        return 0;
    }

    SED(): u8 {
        this.setFlag(CPU_FLAGS.D, true);
        return 0;
    }

    SEI(): u8 {
        this.setFlag(CPU_FLAGS.I, true);
        return 0;
    }

    STA(): u8 {
        this.write(this.addr_abs, this.a);
        return 0;
    }

    STX(): u8 {
        this.write(this.addr_abs, this.x);
        return 0;
    }

    STY(): u8 {
        this.write(this.addr_abs, this.y);
        return 0;
    }

    TAX(): u8 {
        this.x = this.a;
        this.setFlag(CPU_FLAGS.Z, this.x == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.x & 0x80) != 0);
        return 0;
    }

    TAY(): u8 {
        this.y = this.a;
        this.setFlag(CPU_FLAGS.Z, this.y == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.y & 0x80) != 0);
        return 0;
    }

    TSX(): u8 {
        this.x = this.stkp;
        this.setFlag(CPU_FLAGS.Z, this.x == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.x & 0x80) != 0);
        return 0;
    }

    TXA(): u8 {
        this.a = this.x;
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 0;
    }

    TXS(): u8 {
        this.stkp = this.x;
        return 0;
    }

    TYA(): u8 {
        this.a = this.y;
        this.setFlag(CPU_FLAGS.Z, this.a == 0x00);
        this.setFlag(CPU_FLAGS.N, (this.a & 0x80) != 0);
        return 0;
    }

    XXX(): u8 {
        return 0;
    }
    //#endregion
}

