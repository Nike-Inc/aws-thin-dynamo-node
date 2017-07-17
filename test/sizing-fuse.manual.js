const { FuseBox, QuantumPlugin } = require('fuse-box')

let fuseBox = FuseBox.init({
  cache: false,
  homeDir: `../src/`,
  output: `build/$name.js`,
  plugins: [QuantumPlugin({
    uglify: false,
    target: 'server',
    bakeApiIntoBundle: 'dynamo',
    ensureES5: false,
    treeshake: true
  })],
  globals: { 'lambda': '*' },
  package: {
    name: 'dynamo',
    main: 'dynamo.js'
  },
  ignoreModules: ['util', 'assert', 'url'],
  natives: {
    stream: false,
    process: false,
    Buffer: false,
    http: false
  }
})
fuseBox.bundle('dynamo')
  .instructions(`dynamo.js`)
  .target('server')

fuseBox.run()