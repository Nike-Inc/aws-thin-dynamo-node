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
    query: query.bind(null, context),
    scan: scan.bind(null, context),
    get: get.bind(null, context),
    put: put.bind(null, context),
    update: update.bind(null, context),
    delete: deleteItem.bind(null, context),
    batchGet: batchGet.bind(null, context),
    batchWrite: batchWrite.bind(null, context),
    batchWriteAll: batchWriteAll.bind(null, context),
    batchGetAll: batchGetAll.bind(null, context)
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

/*
These are convenience methods to handle automatic paging for batch requests
They are not a part of the AWS DocumentClient, but "page all" is a generally
useful feature that is likely to be written by multiple consumers
*/

function batchWriteAll (context, params, callback) {
  let items = []
  util.eachObj(params.RequestItems, (table, requests) => {
    items = items.concat(requests.map(r => ({ table: table, request: r })))
  })
  let batches = util.createBatches(items)

  let process = (batch) => {
    let items = batch.reduce((r, item) => {
      if (r[item.table] === undefined) r[item.table] = []
      r[item.table].push(item.request)
    }, {})
    return util.processBatch((p) => batchWrite(context, Object.assign({}, params, p), items))
      .then(() => batches.length !== 0 ? process(batches.shift()) : null)
  }
  return process(batches.shift())
}

function batchGetAll (context, params, callback) {
  let tables = Object.keys(params.RequestItems)
  if (tables.length !== 1) {
    throw new Error('batchGetAll currently only supports paging for one table. If you need support for multiple tables consider adding a Pull Request')
  }
  let table = tables[0]
  let batches = util.createBatches(params.RequestItems[table].Keys)
  let responses = { [table]: [] }
  let process = (batch) => {
    return util.processBatch(p => batchGet(context, Object.assign({}, params, p)))
      .then(result => {
        responses[table] = responses[table].concat(result.Responses[table])
        return batches.length !== 0 ? process(batches.shift()) : { Responses: responses }
      })
  }
  return process(batches.shift())
}

// UnprocessedKeys
