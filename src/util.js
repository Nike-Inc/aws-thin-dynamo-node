'use strict'

const request = require('request-micro')
const aws4 = require('aws4')
const converter = require('./converter')
const util = require('util')
const url = require('url')

module.exports = {
  logWrapper: logWrapper,
  eachObj: eachObj,
  optionalCallback: optionalCallback,
  formatError: formatError,
  signedRequest: signedRequest,
  convertParamsToDynamo: convertParamsToDynamo,
  convertToDynamo: converter.toDynamo
}

function noop () { }
function functionElseNoop (func) {
  if (func && typeof func === 'function') {
    return func
  }
  return noop
}
function logWrapper (loggerArg) {
  const logger = loggerArg || {}
  return {
    error: functionElseNoop(logger.error),
    warn: functionElseNoop(logger.warn),
    info: functionElseNoop(logger.info),
    debug: functionElseNoop(logger.debug)
  }
}

function eachObj (obj, func) {
  Object.keys(obj).forEach(key => {
    func(key, obj[key])
  })
}

function optionalCallback (context, callback, promise) {
  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      optionalCallback(context, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      }, promise)
    })
  }
  promise
    .then(result => {
      context.logger.debug('done', result)
      callback(null, result)
    })
    .catch(error => callback(error))
}

let xmlErrorRegex = /<Message>(.+?)<\/Message>/
function formatError (context, obj) {
  let message = ''
  if (obj.statusMessage) message += `${obj.statusMessage}: `
  if (obj.data) obj.data = obj.data.toString()
  if (obj.headers && obj.headers['content-type'] === 'application/xml' && xmlErrorRegex.test(obj.data)) message += obj.data.match(xmlErrorRegex)[1]
  if (obj.headers && obj.headers['content-type'] === 'application/x-amz-json-1.0') {
    let parsedData = JSON.parse(obj.data)
    message += parsedData.message || parsedData.Message || parsedData['__type'] // Yes, they really do use both
  }
  if (obj.message) message += obj.message
  if (message === '') message = util.inspect({ message: 'Error', data: obj }, { depth: 1 })
  // context.logger.debug('error handle', obj)
  context.logger.error(message)
  return new Error(message)
}

function signedRequest (context, params) {
  let endpoint
  if (context.endpoint) {
    endpoint = url.parse(context.endpoint)
  }
  try {
    let defaultParams = {
      service: 'dynamodb',
      agent: context.agent,
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': `DynamoDB_20120810.${params.action}`
      },
      hostname: endpoint ? endpoint.hostname : undefined,
      port: endpoint ? endpoint.port : undefined,
      method: 'POST',
      path: '/',
      region: context.region,
      protocol: endpoint ? endpoint.protocol : 'https:'
    }
    context.logger.debug('sending request', params, defaultParams)
    let signed = aws4.sign(Object.assign(defaultParams, params), context.credentials)
    return request(signed).then(result => {
      context.logger.info('response status', result.statusCode)
      context.logger.debug('response headers', result.headers)
      context.logger.debug('receieved raw data', result.data.toString())
      if (result.statusCode >= 400) throw formatError(context, result)
      if (result.headers['content-type'] === 'application/x-amz-json-1.0' ||
        result.headers['content-type'] === 'application/json') result.data = converter.toJS(JSON.parse(result.data))
      context.logger.debug('receieved data', result.data)
      return result
    })
  } catch (e) {
    return Promise.reject(e)
  }
}

function convertParamsToDynamo (context, params, keysToConvert) {
  params = Object.assign({}, params)
  keysToConvert.filter(k => params[k] !== undefined).forEach(key => {
    context.logger.debug('converting', key, params[key], context.converterOptions)
    params[key] = converter.toDynamo(params[key], context.converterOptions)
    context.logger.debug('conversion complete', key, params[key])
  })
  if (params.Expected) {
    eachObj(params.Expected, (key, value) => {
      if (value.value !== undefined) value.Value = converter.toDynamo(value.Value, context.converterOptions)
      if (value.AttributeValueList !== undefined) value.AttributeValueList = value.AttributeValueList.map(converter.toDynamo)
    })
  }
  return params
}
