'use strict'

const stream = require('stream')

module.exports = class Set {
  constructor (values, options) {
    this.values = values
    this.wrapperName = 'Set'
    this.type = detectType(values)
  }
}

const setTypes = ['String', 'Number', 'Binary']
function detectType (values) {
  var type = typeOf(values[0])
  if (setTypes.indexOf(type) !== -1) return type
  throw new Error('InvalidSetType: Sets can contain string, number, or binary values')
}

function typeOf (data) {
  if (data !== undefined && isBinary(data)) {
    return 'Binary'
  } else if (data !== undefined && data.constructor) {
    return typeName(data.constructor)
  } else {
    return 'undefined'
  }
}

function typeName (type) {
  return Object.prototype.hasOwnProperty.call(type, 'name') && type.name
}

function isType (obj, type) {
  if (typeof type === 'function') type = typeName(type)
  return Object.prototype.toString.call(obj) === '[object ' + type + ']'
}

const binaryTypes = [
  'Buffer', 'File', 'Blob', 'ArrayBuffer', 'DataView',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array'
]
function isBinary (data) {
  if (Buffer.isBuffer(data) || data instanceof stream.Stream) return true
  return binaryTypes.some(t => isType(data, t) || typeName(data.constructor) === t)
}
