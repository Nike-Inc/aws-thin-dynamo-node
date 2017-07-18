#!/bin/bash
set -e

# make reports directory
mkdir -p reports

# run tests and save as report
npm run test:ci | tee reports/ava.xml; test ${PIPESTATUS[1]}

# generate the html test coverage
npm run report