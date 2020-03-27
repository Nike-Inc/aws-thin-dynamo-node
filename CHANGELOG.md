# Change Log /  Release Notes
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/)

## [0.14.0] - 2020-03-27
## Added
`queryAll`
## Fixed
`scanAll` handling of `ScanLimit`

## [0.13.0] - 2018-03-04
## Changed
`useKeepAlive` handling

## [0.12.2] - 2018-02-05
## Fixed
Fixed handling of `query` parameter `KeyConditions`

## [0.12.0] - 2018-05-09
## Added
Custom Agent support and `useKeepAlive` shorthand options

## [0.11.2] - 2018-06-01
## Added
Test utils for creating and deleting tables

## [0.11.1] - 2018-05-09
## Fixed
Various dependency audit warnings

## [0.11.0] -2017-10-19
## Added
support for `endpoint` on dynamo client

## [0.10.4] -2017-07-24
## Fixed
toDynamo conversion of `null` values

## [0.10.2] -2017-07-24
## Added
Converter passthrough for `convertEmptyValues`
## Fixed
toDynamo conversion of `undefined` values

## [0.10.1] -2017-07-21
## Added
Automatic paging method: `scanAll`

## [0.10.0] -2017-07-21
## Added
Automatic paging methods: `batchGetAll` and `batchWriteAll`
README section on differences to official client

## [0.9.0] -2017-07-12
## Added
Initial release
