var path = require('path')

module.exports = {
  entry: path.resolve(__dirname, '../src/dynamo.js'),
  output: {
    filename: 'dynamo.js',
    path: path.resolve(__dirname, 'build'),
    library: 'dynamo',
    libraryTarget: 'commonjs2'
  },
  target: 'node'
}
