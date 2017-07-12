var path = require('path')

module.exports = {
  entry: path.resolve(__dirname, '../src/dynamo.js'),
  output: {
    filename: 'dynamo.bundle.js',
    path: path.resolve(__dirname, 'build')
  },
  target: 'node'
}
