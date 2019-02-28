'use strict'

const co = require('co')
const test = require('blue-tape')
// const uuid = require('uuid')
const dynamo = require('../src/dynamo')
const promisify = require('pify')
let path = require('path')

const region = 'us-west-2'
const testTable = 'DevPortal_Dev_Apps'
const hashkey = 'clientId'
const testItem = 'nike.okta.groups'

var log = (...args) => console.log(...args.map(a => require('util').inspect(a, { colors: true, depth: null }))) // eslint-disable-line

// Load AWS secrets
let credentialsContents = require('fs').readFileSync(path.join(require('os').homedir(), '.aws', 'credentials')).toString()
let creds = credentialsContents.split('\n').slice(1, 3)
process.env.AWS_ACCESS_KEY = creds[0].split('= ')[1]
process.env.AWS_SECRET_KEY = creds[1].split('= ')[1]
// log('creds', process.env.AWS_ACCESS_KEY, process.env.AWS_SECRET_KEY)

const DynamoDB = require('aws-sdk/clients/dynamodb')
let awsClient = new DynamoDB.DocumentClient({ region })

awsClient = {
  query: promisify(awsClient.query.bind(awsClient)),
  scan: promisify(awsClient.scan.bind(awsClient)),
  get: promisify(awsClient.get.bind(awsClient)),
  delete: promisify(awsClient.delete.bind(awsClient)),
  put: promisify(awsClient.put.bind(awsClient)),
  update: promisify(awsClient.update.bind(awsClient)),
  batchGet: promisify(awsClient.batchGet.bind(awsClient)),
  batchWrite: promisify(awsClient.batchWrite.bind(awsClient))
}

let testLogger = {
  log: log,
  debug: log,
  error: log,
  warn: log,
  info: log
}

test('client should be able to query', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })
  return co(function * () {
    let result = yield client.query({
      TableName: testTable,
      KeyConditionExpression: '#k = :k',
      ExpressionAttributeNames: { '#k': hashkey },
      ExpressionAttributeValues: { ':k': testItem }
    })
    log(result.Items)
  })
})

test('client should be able to scan', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })
  return co(function * () {
    let result = yield client.scan({
      TableName: testTable,
      FilterExpression: '#k = :k',
      ExpressionAttributeNames: { '#k': hashkey },
      ExpressionAttributeValues: { ':k': testItem }
    })
    log(result.Items)
  })
})

test('client should be able to get', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })
  return co(function * () {
    let result = yield client.get({
      TableName: testTable,
      Key: { [hashkey]: testItem }
    })
    log(result.Item)
  })
})

test('client should be able to put', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })
  return co(function * () {
    let key = 'delete_me'
    let putResult = yield client.put({ TableName: testTable, Item: { [hashkey]: key, approvers: Buffer.from('string') }, ReturnValues: 'ALL_OLD' })
    log(putResult.Item)
    let getResult = yield client.get({ TableName: testTable, Key: { [hashkey]: key } })
    log('get', getResult.Item, getResult.Item.approvers.toString())

    let awsPut = yield awsClient.put({ TableName: testTable, Item: { [hashkey]: key, approvers: Buffer.from('string') } })
    let awsGet = yield awsClient.get({ TableName: testTable, Key: { [hashkey]: key } })

    log('aws get', awsGet.Item, awsGet.Item.approvers.toString())

    t.deepEqual(getResult, awsGet, 'matches aws')
  })
})

test('client should be able to delete', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })
  return co(function * () {
    let key = 'delete_me'
    let awsPut = yield awsClient.put({ TableName: testTable, Item: { [hashkey]: key, approvers: Buffer.from('string') } })
    let deleteResult = yield client.delete({ TableName: testTable, Key: { [hashkey]: key } })
    log('delete', deleteResult)
  })
})

test('client should be able to batchGet and batchWrite', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })
  let batchItems = [1, 2, 3].map(id => ({ id: `TEST_ENTRY_DELETE_ME_${id}`, name: id }))
  return co(function * () {
    for (let item of batchItems) {
      yield awsClient.put({ TableName: testTable, Item: { [hashkey]: item.id, testValue: item.name } })
    }

    let result = yield client.batchGet({
      RequestItems: {
        [testTable]: {
          Keys: batchItems.map(item => ({ [hashkey]: item.id }))
        }
      }
    })
    log('batch get', result.Responses[testTable])

    let deleteResult = yield client.batchWrite({
      RequestItems: {
        [testTable]: batchItems.map(item => ({
          DeleteRequest: {
            Key: { [hashkey]: item.id }
          }
        }))
      }
    })
  })
})

test('client should be able to scanAll', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })

  return co(function * () {
    let result = yield client.scanAll({ TableName: testTable, Limit: 1 })
    log('result', result)
  })
})

test('client should be able to batchWriteAll and batchGetAll', t => {
  let client = dynamo({ logger: testLogger, region: 'us-west-2' })

  // force testing of paging by using more than 25
  let data = [...Array(30)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  return co(function * () {
    yield client.batchWriteAll({ RequestItems: { [testTable]: data.map(c => ({ PutRequest: { Item: c } })) } })
    log('\n\n\n')
    let readResult = yield client.batchGetAll({ RequestItems: { [testTable]: { Keys: data } } })
    log('read', readResult)
    data = [...Array(30)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
    yield client.batchWriteAll({ RequestItems: { [testTable]: data.map(c => ({ DeleteRequest: { Key: c } })) } })
  })
})
