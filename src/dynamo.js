'use strict'

const util = require('./util')
const assert = require('assert')
const DynamoSet = require('./DynamoSet')

module.exports = makeClient

function makeClient (options) {
  let context = Object.assign({}, options)
  assert(context.region, 'Region is a required option for Dynamo clients')

  context.logger = util.logWrapper(context.logger)
  context.convert = util.convertParamsToDynamo.bind(null, context)
  context.converterOptions = { removeEmptyValues: context.removeEmptyValues }
  if (!context.credentials && context.secretAccessKey) {
    context.credentials = {
      secretAccessKey: context.secretAccessKey,
      accessKeyId: context.accessKeyId,
      sessionToken: context.sessionToken
    }
  }

  return {
    createSet: createSet.bind(null, context),
    // query: query.bind(null, context),
    scan: scan.bind(null, context),
    get: get.bind(null, context),
    put: put.bind(null, context),
    update: update.bind(null, context),
    delete: deleteItem.bind(null, context),
    batchGet: batchGet.bind(null, context),
    batchWrite: batchWrite.bind(null, context)
  }
}

// TODO: add retry logic for retryable requests like ProvisionedThroughputExceededException and Internal Server Error
function dynamoRequest (context, action, params, callback) {
  context.logger.info('starting request', action)
  return util.optionalCallback(context, callback, util.signedRequest(context, {
    action: action,
    body: JSON.stringify(params)
  }).then(response => {
    context.logger.info('response received', action)
    return response.data
  }))
}

const queryParamsToConvert = ['ExclusiveStartKey', 'ExpressionAttributeValues', 'KeyConditions', 'QueryFilter']
function query (context, params, callback) {
  return dynamoRequest(context, 'Query', context.convert(params, queryParamsToConvert), callback)
}

const getParamsToConvert = ['Key']
function get (context, params, callback) {
  return dynamoRequest(context, 'GetItem', context.convert(params, getParamsToConvert), callback)
}

const deleteParamsToConvert = ['Key', 'ExpressionAttributeValues']
function deleteItem (context, params, callback) {
  return dynamoRequest(context, 'DeleteItem', context.convert(params, deleteParamsToConvert), callback)
}

const putParamsToConvert = ['Item', 'ExpressionAttributeValues']
function put (context, params, callback) {
  return dynamoRequest(context, 'PutItem', context.convert(params, putParamsToConvert), callback)
}

const scanParamsToConvert = ['ExclusiveStartKey', 'ExpressionAttributeValues', 'ScanFilter']
function scan (context, params, callback) {
  return dynamoRequest(context, 'Scan', context.convert(params, scanParamsToConvert), callback)
}

const updateParamsToConvert = ['Key', 'ExpressionAttributeValues']
function update (context, params, callback) {
  return dynamoRequest(context, 'UpdateItem', context.convert(params, updateParamsToConvert), callback)
}

function batchGet (context, params, callback) {
  params = Object.assign({}, params)
  util.eachObj(params.RequestItems, (table, props) => {
    props.Keys = props.Keys.map(val => util.convertToDynamo(val, context.converterOptions))
  })
  return dynamoRequest(context, 'BatchGetItem', params, callback)
}

function batchWrite (context, params, callback) {
  params = Object.assign({}, params)
  util.eachObj(params.RequestItems, (table, props) => {
    params.RequestItems[table] = props.map(item => {
      if (item.PutRequest) {
        item.PutRequest = context.convert(item.PutRequest, ['Item'])
      }
      if (item.DeleteRequest) {
        item.DeleteRequest = context.convert(item.DeleteRequest, ['Key'])
      }
      return item
    })
  })
  return dynamoRequest(context, 'BatchWriteItem', params, callback)
}

function createSet (context, list, options) {
  return new DynamoSet(list, options)
}
