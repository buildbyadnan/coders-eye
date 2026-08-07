#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== CodersEye Local Publish Test ==="
echo ""

# 1. Build CLI
echo "1/5 Building CLI bundle..."
cd "$ROOT_DIR"
npx nx build coders-eye
echo ""

# 2. Verify bundle
echo "2/5 Verifying bundle..."
test -f apps/cli/dist/index.js || { echo "FAIL: dist/index.js not found"; exit 1; }
test -f apps/cli/dist/index.js.map || { echo "FAIL: dist/index.js.map not found"; exit 1; }
grep -q "^#!/usr/bin/env node" apps/cli/dist/index.js || { echo "FAIL: missing shebang in bundle"; exit 1; }
echo "   Bundle OK: $(wc -c < apps/cli/dist/index.js) bytes"
echo ""

# 3. Create tarball
echo "3/5 Creating tarball..."
cd "$ROOT_DIR/apps/cli"
rm -f coders-eye-*.tgz 2>/dev/null
npm pack
echo ""

# 4. Install globally from tarball
echo "4/5 Installing globally from tarball..."
npm install -g ./coders-eye-0.1.0.tgz
echo ""

# 5. Test installed package
echo "5/5 Testing installed package..."
VERSION=$(coders-eye --version 2>&1)
echo "   coders-eye --version: $VERSION"

echo ""
echo "   coders-eye help (first 3 lines):"
coders-eye help 2>&1 | head -3 | sed 's/^/     /'

echo ""
echo "   coders-eye status:"
coders-eye status 2>&1 | sed 's/^/     /'
echo ""

# Cleanup
echo "=== Cleanup ==="
cd "$ROOT_DIR"
npm uninstall -g coders-eye 2>/dev/null || true
rm -f "$ROOT_DIR/apps/cli/coders-eye-0.1.0.tgz"

echo ""
echo "=== PASS: Package published and installed successfully ==="
