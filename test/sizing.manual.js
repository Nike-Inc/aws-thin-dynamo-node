const {FuseBox} = require('fuse-box')

let fuseBox = FuseBox.init({
  cache: false,
  homeDir: `../src/`,
  output: `build/$name.js`,
  globals: { 'lambda': '*' },
  package: {
    name: 's3',
    main: 's3.js'
  },
  natives: {
    stream: false,
    process: false,
    Buffer: false,
    http: false
  }
})
fuseBox.bundle('dynamo')
  .instructions(`dynamo.js`)
  .target('electron')

fuseBox.run()
