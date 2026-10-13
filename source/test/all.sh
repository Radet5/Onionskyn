#!/bin/bash
# Full regression run; prints one line per suite. Needs `npm install` and `npx playwright install chromium` first.
cd "$(dirname "$0")/.."
./build.sh > /dev/null || exit 1
run(){ name=$1; shift; out=$(timeout 280 "$@" 2>&1); code=$?; bad=$(echo "$out" | grep -E "^FAIL |MISMATCH|SYNTAX|PAGEERR|STEP-THROW|ALL FAIL" | head -2); if [ $code -eq 0 ] && [ -z "$bad" ]; then echo "PASS $name"; else echo "FAIL $name (exit $code) $bad"; fi; }
run core node test/core.test.js
run flaedge node test/flaedge.js
run harness node test/harness.js
for t in smoke2 beta roundtrip sparse persist brush fluid merge bucket gradient ease mask clip symdel xss explimit audit1 audit2 audit3; do run $t node test/$t.js; done
