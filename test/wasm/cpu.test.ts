import Emulator from "../../src/types/wasm/emulator"; // codesandbox doesn't support type only imports yet
import loader from "@assemblyscript/loader"; // or require
import * as fs from "fs/promises";
import {assert} from "chai";

type XEmulator = loader.ASUtil & typeof Emulator;

describe("CPU Tests", () => {
    
    async function getModule() : Promise<XEmulator> {
        const x = await loader.instantiate<typeof Emulator>(
            fs.readFile("./dist/emulator.wasm"),
        );

        return x.exports;
        
    }
    test("Fetch works as expected", async () => {
        const { Bus, CPU } = await getModule();

        const b = new Bus();
        const c = new CPU(b.valueOf());
        c.opcode = 0;
        c.fetch();
        c.opcode = 1;
        c.fetch();

        assert.strictEqual(c.pc, 0);
    });
});
