#!/bin/bash

#bash script to remove the dist directory, make a new dist, then run node build.js
rm -rf dist
mkdir dist
node build.js
npx wrangler deploy
