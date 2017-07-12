'use strict'
const secretKey = process.env.AWS_ACCESS_KEY_ID = 'aws_secret_key'
const accessKey = process.env.AWS_SECRET_ACCESS_KEY = 'access_key'

const test = require('blue-tape')
const co = require('co')
const promisify = require('pify')
const nock = require('nock')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const dynamo = require('../src/dynamo')
const converter = require('../src/converter')
const awsConverter = DynamoDB.Converter

var log = (...args) => console.log(...args.map(a => require('util').inspect(a, { colors: true, depth: null }))) // eslint-disable-line

const dynamoEndpoint = 'https://dynamodb.us-west-2.amazonaws.com:443'
const dynamoHeaders = { 'content-type': 'application/x-amz-json-1.0' }
const region = 'us-west-2'
const table = 'test-table'

let logger = {
  // log: log,
  // debug: log,
  error: log,
  // info: log,
  warn: log
}

const client = dynamo({ region, logger })
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

const p = (obj) => Object.assign({ TableName: table }, obj)

/*
-----------------------------------
A note to future contributors:

This method is designed to simplify basic comparisons between this lib
and the official AWS Dyanmo SDK. It is not the *only* valid method for
doing so. If you need to add a tests that doesn't fit into this utility
method you don't need to hack it in. Just write your test.
-----------------------------------
*/
const matchesAws = co.wrap(function * (t, method, params, result, statusCode = 200) {
  t.plan(2)
  let awsInput
  nock(dynamoEndpoint).replyContentLength().replyDate().defaultReplyHeaders(dynamoHeaders).post('/')
    .reply(function (uri, requestBody, cb) {
      awsInput = requestBody
      cb(null, [statusCode, JSON.stringify(result)])
    })
  nock(dynamoEndpoint).replyContentLength().replyDate().defaultReplyHeaders(dynamoHeaders).post('/')
    .reply(function (uri, requestBody, cb) {
      t.deepEqual(requestBody, awsInput, 'matches aws input')
      cb(null, [statusCode, JSON.stringify(result)])
    })
  let awsResult = yield awsClient[method](params)
  let clientResult = yield client[method](params)
  t.deepEqual(clientResult, awsResult, 'matches aws result')
})

const simpleItem = { name: '1', age: 20, addresses: [1.2, 2.2, 3.3] }
const complexItem = { name: '1', sub: '2', limits: { count: 2, types: [ {filter: '1'}, { filter: '2' } ] }, addresses: [1.2, 2.2, 3.3] }

test('query', spec => {
  let querySimple = {Count: 1, Items: [awsConverter.marshall(simpleItem), awsConverter.marshall(simpleItem)], ScannedCount: 1}
  let queryComplex = {Count: 1, Items: [{suspendedIn: {L: []}, client: {M: {claimGroups: {L: [{M: {name: {S: 'Application.US.FTE.Users'}, devId: {S: '00g82uls25fzne7Zb0h7'}, prodId: {S: '00g8buyb05cuJ08EG0h7'}}}]}, applicationType: {S: 'browser'}, grantTypes: {L: [{S: 'implicit'}]}, clientId: {S: 'nike.okta.groups'}, name: {S: 'group test'}, groups: {L: [{S: 'everyone'}]}, redirectUris: {M: {dev: {L: [{S: 'http://127.0.0.1:3000'}, {S: 'http://localhost:3000'}]}, prod: {L: [{S: 'http://localhost:3000'}]}}}}}, createdOn: {N: '1498767340882'}, ownerType: {S: 'user'}, clients: {M: {dev: {M: {okta: {M: {app_id: {S: '0oab0asnd0nYlRECL0h7'}, application_type: {S: 'browser'}, client_id: {S: 'nike.okta.groups'}}}, ping: {M: {clientId: {S: 'nike.okta.groups'}}}}}, prod: {M: {okta: {M: {app_id: {S: '0oab0asnkrn6Gu7uQ0h7'}, application_type: {S: 'browser'}, client_id: {S: 'nike.okta.groups'}}}, ping: {M: {clientId: {S: 'nike.okta.groups'}}}}}}}, auditLog: {L: [{M: {message: {S: 'Approved app for dev'}, createdOn: {N: '1498768644240'}, username: {S: 'a.techrev.jenkins'}}}, {M: {message: {S: 'Requested production access'}, createdOn: {N: '1498769125006'}, username: {S: 'tkye'}}}, {M: {message: {S: 'Approved app for prod'}, createdOn: {N: '1498769133519'}, username: {S: 'a.techrev.jenkins'}}}]}, name: {S: 'group test'}, approvers: {L: []}, clientId: {S: 'nike.okta.groups'}, ownerId: {S: 'tkye'}}], ScannedCount: 1}
  let queryParams = p({ KeyConditionExpression: 'name = :name', ExpressionAttributeValues: { ':name': 1 } })
  spec.test('should match simple', t => matchesAws(t, 'query', queryParams, querySimple))
  spec.test('should match complex', t => matchesAws(t, 'query', queryParams, queryComplex))
})

test('scan', spec => {
  let scanSimple = {Count: 2, Items: [awsConverter.marshall(simpleItem), awsConverter.marshall(simpleItem)], ScannedCount: 2}
  let scanComplex = {Count: 1, Items: [{suspendedIn: {L: []}, client: {M: {claimGroups: {L: [{M: {name: {S: 'Application.US.FTE.Users'}, devId: {S: '00g82uls25fzne7Zb0h7'}, prodId: {S: '00g8buyb05cuJ08EG0h7'}}}]}, applicationType: {S: 'browser'}, grantTypes: {L: [{S: 'implicit'}]}, clientId: {S: 'nike.okta.groups'}, name: {S: 'group test'}, groups: {L: [{S: 'everyone'}]}, redirectUris: {M: {dev: {L: [{S: 'http://127.0.0.1:3000'}, {S: 'http://localhost:3000'}]}, prod: {L: [{S: 'http://localhost:3000'}]}}}}}, createdOn: {N: '1498767340882'}, ownerType: {S: 'user'}, clients: {M: {dev: {M: {okta: {M: {app_id: {S: '0oab0asnd0nYlRECL0h7'}, application_type: {S: 'browser'}, client_id: {S: 'nike.okta.groups'}}}, ping: {M: {clientId: {S: 'nike.okta.groups'}}}}}, prod: {M: {okta: {M: {app_id: {S: '0oab0asnkrn6Gu7uQ0h7'}, application_type: {S: 'browser'}, client_id: {S: 'nike.okta.groups'}}}, ping: {M: {clientId: {S: 'nike.okta.groups'}}}}}}}, auditLog: {L: [{M: {message: {S: 'Approved app for dev'}, createdOn: {N: '1498768644240'}, username: {S: 'a.techrev.jenkins'}}}, {M: {message: {S: 'Requested production access'}, createdOn: {N: '1498769125006'}, username: {S: 'tkye'}}}, {M: {message: {S: 'Approved app for prod'}, createdOn: {N: '1498769133519'}, username: {S: 'a.techrev.jenkins'}}}]}, name: {S: 'group test'}, approvers: {L: []}, clientId: {S: 'nike.okta.groups'}, ownerId: {S: 'tkye'}}], ScannedCount: 5}
  let scanParams = p({ FilterExpression: '#k = :k', ExpressionAttributeNames: { '#k': 'name' }, ExpressionAttributeValues: { ':k': 1 } })
  spec.test('should match simple', t => matchesAws(t, 'scan', scanParams, scanSimple))
  spec.test('should match complex', t => matchesAws(t, 'scan', scanParams, scanComplex))
})

test('get', spec => {
  spec.test('should match simple', t => matchesAws(t, 'get', p({ Key: { name: '1' } }), { Item: awsConverter.marshall(simpleItem) }))
  spec.test('should match complex', t => matchesAws(t, 'get', p({ Key: { name: '1', sub: '2' } }), { Item: awsConverter.marshall(complexItem) }))

  spec.test('should match error', t => {
    let errorResponse = {'__type': 'com.amazon.coral.validate#ValidationException', 'message': "1 validation error detected: Value null at 'key' failed to satisfy constraint: Member must not be null"}
    return co(function * () {
      nock(dynamoEndpoint).replyContentLength().replyDate().defaultReplyHeaders(dynamoHeaders).post('/')
        .reply(function (uri, requestBody, cb) {
          cb(null, [400, JSON.stringify(errorResponse)])
        })
      let clientResult = yield client.get(p({ Key: null })).catch(e => e)
      t.equal(clientResult.toString(), 'Error: ' + errorResponse.message, 'recieved error')
    })
  })
})

test('put', spec => {
  let putSimple = { Attributes: awsConverter.marshall(simpleItem) }
  let putComplex = { Attributes: {approvers: {B: 'c3RyaW5n'}, clientId: {S: 'delete_me'}} }
  let putParams = p({ Item: simpleItem, ReturnValues: 'ALL_OLD' })
  spec.test('should match simple', t => matchesAws(t, 'put', putParams, putSimple))
  spec.test('should match complex', t => matchesAws(t, 'put', putParams, putComplex))
})

test('delete', spec => {
  spec.test('should match simple', t => matchesAws(t, 'delete', p({ Key: { name: '1' } }), {}))
})

test('batchGet', spec => {
  let batchComplex = { Responses: { [table]: [ awsConverter.marshall(simpleItem), awsConverter.marshall(simpleItem), awsConverter.marshall(simpleItem) ] }, UnprocessedKeys: {} }
  let getParams = { RequestItems: { [table]: { Keys: [simpleItem, simpleItem].map(a => ({ name: simpleItem.name })) } } }
  spec.test('should match complex', t => matchesAws(t, 'batchGet', getParams, batchComplex))
})

test('batchWrite', spec => {
  let batchComplex = { UnprocessedItems: { } }
  let getParams = { RequestItems: { [table]: [ { DeleteRequest: { Key: { name: simpleItem.name } } } ] } }
  spec.test('should match complex', t => matchesAws(t, 'batchWrite', getParams, batchComplex))
})
