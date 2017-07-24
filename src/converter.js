'use strict'

const DynamoSet = require('./DynamoSet')

module.exports = {
  value: {
    toJS: mapAttrFromDb,
    toDynamo: mapAttrToDb
  },
  toDynamo: mapToDb,
  toJS: mapFromDb
}

function asEmpty (key, options) {
  if (options && options.convertEmptyValues) return { NULL: true }
  if (options && options.removeEmptyValues) return undefined
  throw new Error(`empty string and buffer values are invalid. ${key} was empty. Use "removeEmptyValues" option to automatically fix this. options: ${JSON.stringify(options)}`)
}

function base64BufferJson () {
  return this.toString('base64')
}

function mapAttrToDb (val, key, options) {
  var numToStr = _numToStr.bind(null, key)
  if (val === '' || val === undefined || val === null) return asEmpty(key, options)
  switch (typeof val) {
    case 'string': return {S: val}
    case 'boolean': return {BOOL: val}
    case 'number': return {N: numToStr(val)}
    case 'function': return
  }
  if (Buffer.isBuffer(val)) {
    if (!val.length) return asEmpty(key, options)
    val.toJSON = base64BufferJson
    return {B: val}
  }
  if (val.constructor && val.constructor.name === 'Set') {
    if (val.type === 'String') return {SS: val.values}
    if (val.type === 'Number') return {NS: val.values.map(numToStr)}
    if (val.type === 'Binary') {
      return {BS: val.values.map(b => {
        b.toJSON = base64BufferJson
        return b
      })}
    }
  }
  if (Array.isArray(val)) {
    return { L: val.map((v, i) => mapAttrToDb(v, i, options)) }
  }
  if (typeof val === 'object') return { M: mapToDb(val, options) }
  // Other types (inc dates) are mapped as they are in JSON
  val = typeof val.toJSON === 'function' ? val.toJSON() : JSON.stringify(val)
  if (val) return {S: val}
}

function mapAttrFromDb (val, key, recurse) {
  if (val.S != null) return val.S
  if (val.N != null) return +val.N
  if (val.B != null) return new Buffer(val.B, 'base64') // eslint-disable-line node/no-deprecated-api
  if (val.SS != null) return new DynamoSet(val.SS)
  if (val.NS != null) return new DynamoSet(val.NS.map(Number))
  if (val.BS != null) return new DynamoSet(val.BS.map(x => new Buffer(x, 'base64'))) // eslint-disable-line node/no-deprecated-api
  if (val.L != null) return val.L.map(mapAttrFromDb)
  if (val.BOOL != null) return val.BOOL
  if (val.NULL) return null
  if (val.M) return mapFromDb(val.M)
  if (recurse) {
    // console.log('recursing', val)
    return typeof val === 'object' ? mapFromDb(val) : val
  }
  throw new Error('Unknown DynamoDB type for "' + key + '": ' + JSON.stringify(val))
}

function mapToDb (jsObj, options) {
  var dbItem = jsObj != null ? {} : null

  if (dbItem != null && jsObj != null) {
    Object.keys(jsObj).forEach(function (key) {
      var dbAttr = mapAttrToDb(jsObj[key], key, options)
      if (!isEmpty(dbAttr)) dbItem[key] = dbAttr
    })
  }
  return dbItem
}

function mapFromDb (dbItem) {
  var jsObj = dbItem != null ? {} : null

  if (dbItem != null && jsObj != null) {
    if (dbItem instanceof Array) {
      return dbItem.map(mapFromDb)
    } else {
      Object.keys(dbItem).forEach(function (key) {
        var jsAttr = mapAttrFromDb(dbItem[key], key, true)
        if (typeof jsAttr !== 'undefined') jsObj[key] = jsAttr
      })
    }
  }
  return jsObj
}

function isEmpty (attr) {
  return attr == null || attr.S === '' || attr.N === '' || attr.B === '' ||
    attr.SS === '[]' || attr.NS === '[]' || attr.BS === '[]'
}

function _numToStr (attr, num) {
  var numStr = String(+num)
  if (numStr === 'NaN' || numStr === 'Infinity' || numStr === '-Infinity') {
    throw new Error('Cannot convert attribute "' + attr + '" to DynamoDB number: ' + num)
  }
  return numStr
}
