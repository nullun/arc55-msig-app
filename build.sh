#!/usr/bin/env bash

set -ex

rm -rf output
mkdir output
npx tealscript src/msig-app.algo.ts output
