#!/bin/bash
set -e
mkdir -p reports

npm run test:ci | tee reports/ava.xml; test ${PIPESTATUS[1]}
npm run report