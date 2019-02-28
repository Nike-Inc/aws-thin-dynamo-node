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
  context.converterOptions = { removeEmptyValues: context.removeEmptyValues, convertEmptyValues: context.convertEmptyValues }
  if (!context.credentials && context.secretAccessKey) {
    context.credentials = {
      secretAccessKey: context.secretAccessKey,
      accessKeyId: context.accessKeyId,
      sessionToken: context.sessionToken
    }
  }

  if (context.useKeepAlive) {
    const Agent = context.endpoint && context.endpoint.includes('http:')
      ? require('agentkeepalive')
      : require('agentkeepalive').HttpsAgent

    context.agent = new Agent({
      maxSockets: 50
    })
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
    scanAll: scanAll.bind(null, context),
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

const scanParamsToConvert = ['ExclusiveStartKey', 'ExpressionAttributeValues', 'ScanFilter']
function scan (context, params, callback) {
  return dynamoRequest(context, 'Scan', context.convert(params, scanParamsToConvert), callback)
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

function scanAll (context, params) {
  params = Object.assign({}, params)
  let result
  let lastKey
  let scanLimit = params.ScanLimit
  let itemLimit = params.ItemLimit
  delete params.ScanLimit
  delete params.ItemLimit
  let run = () => scan(context, Object.assign({}, params, { ExclusiveStartKey: lastKey })).then(response => {
    if (result === undefined) result = response
    else {
      result.Count += response.Count
      result.ScannedCount += response.ScannedCount
      result.Items = result.Items.concat(response.Items)
    }
    if (response.LastEvaluatedKey &&
      (scanLimit === undefined || result.ScannedCount < scanLimit) &&
      (itemLimit === undefined || result.Count < itemLimit)) {
      lastKey = response.LastEvaluatedKey
      return run()
    }
    delete result.LastEvaluatedKey
    return result
  })

  return Promise.resolve(run())
}

function batchWriteAll (context, params) {
  let requestPool = Object.assign({}, params.RequestItems)
  let pageSize = params.PageSize
  delete params.PageSize

  let run = () => {
    let batch = sliceWriteBatch(requestPool, pageSize)
    context.logger.debug('batch', batch)
    context.logger.debug('pool remaining', requestPool)
    if (batch === undefined || Object.keys(batch).length === 0) return
    context.logger.debug('writing')
    return batchWrite(context, Object.assign({}, params, { RequestItems: batch }))
      .then(response => {
        let unprocessed = response.UnprocessedItems && Object.keys(response.UnprocessedItems).length !== 0 ? response.UnprocessedItems : null
        context.logger.debug('unprocessed', unprocessed)
        if (!unprocessed) return
        util.eachObj(unprocessed, (table, items) => {
          requestPool[table] = requestPool[table].concat(items)
        })
      }).then(() => run())
  }

  return Promise.resolve(run())
}

function sliceWriteBatch (pool, pageSize) {
  pageSize = pageSize || 25
  let requestCount = 0
  let batch = {}
  let tables = Object.keys(pool)
  if (tables.length === 0) return
  tables.forEach((tableName, i) => {
    let table = pool[tableName]
    if (requestCount === pageSize || !table.length) return
    let items = table.splice(0, pageSize - requestCount)
    if (items.length === 0) return
    requestCount += items.length
    batch[tableName] = batch[tableName] !== undefined ? batch[tableName].concat(items) : items
  })
  return batch
}

function batchGetAll (context, params) {
  let requestPool = Object.assign({}, params.RequestItems)
  let pageSize = params.PageSize
  delete params.PageSize
  let responses = {}
  let run = () => {
    let batch = sliceGetBatch(requestPool, pageSize)
    context.logger.debug('batch', batch)
    context.logger.debug('pool remaining', requestPool)
    if (batch === undefined || Object.keys(batch).length === 0) return

    return batchGet(context, Object.assign({}, params, { RequestItems: batch }))
      .then(response => {
        util.eachObj(response.Responses, (table, items) => {
          if (!responses[table]) responses[table] = []
          responses[table] = responses[table].concat(items)
        })
        let unprocessed = response.UnprocessedKeys && Object.keys(response.UnprocessedKeys).length !== 0 ? response.UnprocessedKeys : null
        if (!unprocessed) return
        util.eachObj(unprocessed, (table, items) => {
          requestPool[table].Keys = requestPool[table].Keys.concat(items)
        })
      }).then(() => run())
  }

  return Promise.resolve(run()).then(() => ({ Responses: responses }))
}

function sliceGetBatch (pool, pageSize) {
  pageSize = pageSize || 25
  let requestCount = 0
  let batch = {}
  let tables = Object.keys(pool)
  if (tables.length === 0) return
  tables.forEach((tableName, i) => {
    let table = pool[tableName]
    if (requestCount === pageSize || !table.Keys.length) return
    let keys = table.Keys.splice(0, pageSize - requestCount)
    if (keys.length === 0) return
    requestCount += keys.length
    if (!batch[tableName]) batch[tableName] = Object.assign({}, table, { Keys: [] })
    batch[tableName].Keys = batch[tableName].Keys.concat(keys)
  })
  return batch
}
