declare module '*.wasm' {
    // Strongly type the exports with T
    function wasmBuilderFunc<T>(importsObject?: WebAssembly.Imports): Promise<{instance: WebAssembly.Instance & { exports: T }}>;

    export = wasmBuilderFunc;
}
