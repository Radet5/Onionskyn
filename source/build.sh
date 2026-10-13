#!/bin/bash
# Assembles src/ into a single standalone file: dist/onionskyn.html (see build.mjs)
set -e
cd "$(dirname "$0")"
node build.mjs
