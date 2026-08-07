#!/bin/bash
set -e

echo "Running pre-publish safeguards..."

echo ""
echo "1/4 Typechecking all packages..."
npm run typecheck

echo ""
echo "2/4 Building CLI bundle..."
npx nx build coders-eye

echo ""
echo "3/4 Verifying bundle output..."
test -f apps/cli/dist/index.js || { echo "FAIL: dist/index.js not found"; exit 1; }
test -f apps/cli/dist/index.js.map || { echo "FAIL: dist/index.js.map not found"; exit 1; }
grep -q "^#!/usr/bin/env node" apps/cli/dist/index.js || { echo "FAIL: missing shebang"; exit 1; }
echo "Bundle OK: $(wc -c < apps/cli/dist/index.js) bytes"

echo ""
echo "4/4 Checking tarball contents..."
cd apps/cli
npm pack --dry-run
cd ../..

echo ""
echo "All safeguards passed."
