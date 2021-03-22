module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    // "/node_modules/(?!@assemblyscript/loader).+\\.js$"
    "node_modules/(?!(@assemblyscript/loader)/)"
  ],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.tsx?$": "ts-jest"
  }
};