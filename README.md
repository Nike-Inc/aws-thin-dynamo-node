[![NPM version](https://img.shields.io/npm/v/aws-thin-dynamo.svg)](https://www.npmjs.com/package/aws-thin-dynamo)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
![Build Status](https://circleci.com/gh/Nike-Inc/aws-thin-dynamo-node.svg?style=shield&circle-token=4281d6b875c7441734baa32820855e45b4b4ae72)


# What is this for?

The [AWS JS SDK](https://github.com/aws/aws-sdk-js) does a lot. For Lambdas is does *too much*; the "core" is loaded even for individual services like dynamo and includes things like an XML builder and lodash, which are rarely needed. This impacts the cold-start time of lambda's significantly. 

On a 256mb Node Lambda
* 300-500ms to load the Full AWS SDK 
* 150-250ms to just load the AWS SDK dynamo client (`require('aws-sdk/clients/dynamodb')`)

Compare that to **aws-thin-dynamo** on a 256mb lambda: **~15ms**.

**aws-thin-dynamo** attempts to be a drop-in replacement for the API it does cover. For ease of use the `callback` parameter can be ommitted from all async calls to get a Promise instead.

As this attempts to duplicate the Official Client's API, you can use [the AWS docs](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html). Don't forget this client will return a promise if you don't provide a `callback` parameter.

# Installation

```
npm i aws-thin-dynamo
```

# Usage

```javascript
var dynamo = require('aws-thin-dynamo')
var client = dynamo({ region: 'us-west-2'})
// client is a API-compliant implemention of the AWS DocumentClient

```

# Constructor differences

The DocumentClient constructor supports some different options than the AWS version. They are below

* **Missing options** - The AWS DocumentClient constructor has these, this client does not
  * `service`. To specify maximum retries or custom backoff timings, see below
* **Additional options** - The AWS Document client does not have these options, this client does
  * `removeEmptyValues` - unlike `convertEmptyValues` which uses the DynamoDB `Null` type, this option will remove empty values entirely. This option has lower precedence than `convertEmptyValues`; if both are specified, this one is ignored.
  * `maxRetries` - Maximum number of retries. **(COMING SOON)**
  * `retryBackoff` - same as the `retryDelayOptions.customBackoff` that the DocumentClient's `service` option takes: a function with the signature `(retryCount) => msToWait`. **(COMING SOON)**

# Automatically Paging Requests

`batchGet` and `batchWrite` allow a maximum of 25 requests, and leave the retrying of "Unprocessed Items" to you. The most common goal with these functions is to retry all unprocessed requests and then move on to the next page, so this client provides two methods that can handle any number of items by breaking them into batches, and automatically retries Unprocessed items.

**batchGetAll** and **batchWriteAll** take the same parameters as **batchGet** and **batchWrite**, except
 * No `callback`, they only support returning promises
 * `params.PageSize` can control the maximum page size used. This number cannot be over 25, but AWS only supports requests of up to 16mb. If 25 items is higher than 16mb you will need to provide a page size small enough that each batch will be under the limit.

 **scanAll** will auto page through the table, it takes the same parameters as **scan** except
 * No `callback`, it only supports returning promises.
 * `ScanLimit` - since `Limit` controls the maximum number of results per scan, `ScanLimit` will stop automatically paging after reaching `ScannedCount` (this is the number of items scanned, not the number of items returned). Since `scan` returns as many requests as it can under `Limit`, it is possible to get back more results than `ScanLimit` if the last scan start under the limit and finishes by crossing it.
 * `ItemLimit - Like `ScanLimit` except it stops are `Count` has been reached.

 # Notes on load time
Lambdas take time to load code, the more code the more time. This cost is the work to parse and JIT, Minifying/Uglifying/Bundling the code does not make an impact. Because the CPU size of a lambda is bound to the memory, a 128mb lambda will load slower than a 256mb lambda. The CPU parse time has rapidly diminishing returns, and in most cases more than 512mb won't improve things by more than 1-3%. Since minifying your code doesn't impact the time it takes to load it the size of your code in KB can only give you a rough idea of how long it will take (The "Core" code in the AWS SDK is ~800kb, the aws-thin-dynamo client is ~30kb). Accurate information requires performance profiling.

# Test Utilities

When writing integration tests instead of mocking the database it is better to use tools like [Dynalite](https://github.com/mhart/dynalite) to create an in-memory Dynamo database. The AWS SDK supports table creation, but including the sdk just to create tables for testing is a bit cumbersome. This library includes a small utilities class with `createTable` and `deleteTable` that take the same parameters as those on the SDK. These methods are not loaded normally by the library, so their presence should not impact cold start.

*Example Use*
```
const dynamoUtils = require('aws-thin-dynamo/src/testUtils')({
  region: 'us-west-2',
  endpoint: dynamoEndpoint // http://localhost:4567 for dynalite
})
dynamoUtils.createTable({ /* params 8> }).then(/* ... */)
```
