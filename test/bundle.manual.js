var dynamo = require('./build/dynamo')

var log = (...args) => console.log(...args.map(a => require('util').inspect(a, { colors: true, depth: null }))) // eslint-disable-line

log(dynamo, typeof dynamo)
