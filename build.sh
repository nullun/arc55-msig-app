#!/usr/bin/env bash

set -ex

rm -rf dist
mkdir dist
bunx tealscript src/msig-app.algo.ts dist
