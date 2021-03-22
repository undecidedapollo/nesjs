const path = require('path');

module.exports = {
    entry: './src/index.ts',
    mode: `development`,
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            // {
            //     test: /\.wasm$/,
            //     // Tells webpack how to interpret wasm files into JavaScript-land
            //     loader: "wasm-loader"
            // },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
