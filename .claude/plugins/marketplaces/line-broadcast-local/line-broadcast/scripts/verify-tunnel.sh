#!/usr/bin/env bash
# verify-tunnel.sh — sanity-check that the line-broadcast plugin can reach
# everything it needs WITHOUT a local Next.js dev server:
#   1. CNY public API reachable
#   2. inbox.re-ya.com (prod) reachable
#   3. .auth-cookie valid (prod 200 on a cheap GET)
#   4. build-flex.ts runs (tsx + flex-builder.ts intact)
#
# Filename kept for backward-compat with prior README references — but no SSH
# tunnel is involved anymore.
#
# Usage: .claude/plugins/line-broadcast/scripts/verify-tunnel.sh
#
# Exits 0 = OK; 1 = CNY/prod unreachable; 2 = auth/tsx broken.

set -u

CNY_URL="https://www.cnypharmacy.com/api/getDataProductIsGroup?page=1&sort_product_name=asc&isPageGroup=&paginate_num=10&supplier=0&see_query=0&new_sort_type=0"
PROD_BROADCAST_LIST="https://inbox.re-ya.com/api/inbox/broadcasts?status=scheduled&limit=1"

mkdir -p .tmp
FAILED=0

show_body() {
  local f="$1"
  if [ -s "$f" ]; then head -c 400 "$f"; echo; fi
}

# 1. CNY public ─────────────────────────────────────────────────────────────
echo "→ Pinging CNY public API…"
CNY_CODE=$(curl -sS -o .tmp/cny-up.json -w '%{http_code}' --max-time 12 "$CNY_URL" 2>/dev/null)
CNY_CODE=${CNY_CODE:-000}
case "$CNY_CODE" in
  200)
    CNY_COUNT=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('.tmp/cny-up.json','utf8'));console.log(d.product?.length||0)}catch{console.log(-1)}" 2>/dev/null)
    echo "  ✓ CNY OK (${CNY_COUNT} products in probe page)"
    ;;
  000) echo "  ✗ Network unreachable to cnypharmacy.com"; exit 1 ;;
  *)   echo "  ✗ CNY returned HTTP ${CNY_CODE}"; show_body .tmp/cny-up.json; exit 1 ;;
esac

# 2. Prod inbox.re-ya.com ──────────────────────────────────────────────────
echo "→ Pinging prod inbox.re-ya.com…"
PROD_CODE=$(curl -sS -o .tmp/prod-up.json -w '%{http_code}' --max-time 12 \
  --cookie "$(cat .auth-cookie 2>/dev/null || echo '')" \
  "$PROD_BROADCAST_LIST" 2>/dev/null)
PROD_CODE=${PROD_CODE:-000}
case "$PROD_CODE" in
  200)
    LISTED=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('.tmp/prod-up.json','utf8'));console.log(d.data?.broadcasts?.length??'?')}catch{console.log('?')}" 2>/dev/null)
    echo "  ✓ Prod OK (${LISTED} scheduled broadcast(s) listed)"
    ;;
  401)
    echo "  ✗ 401 — login expired / cookie missing"
    echo "    Login https://inbox.re-ya.com → DevTools → Cookies → copy next-auth.session-token"
    echo "    Save ลง .auth-cookie ที่ root project (1 บรรทัด: 'next-auth.session-token=...')"
    FAILED=2
    ;;
  000) echo "  ✗ Network unreachable to inbox.re-ya.com"; FAILED=1 ;;
  *)   echo "  ✗ Prod returned HTTP ${PROD_CODE}"; show_body .tmp/prod-up.json; FAILED=2 ;;
esac

# 3. build-flex.ts runs ────────────────────────────────────────────────────
echo "→ Sanity-running build-flex.ts (synthetic product)…"
BUILD_FLEX_OUT=$(node -e "
const p={
  products:[{productId:1,sku:'TEST',name:'Test Product',imageUrl:'https://manager.cnypharmacy.com/uploads/product_photo/test.jpg',basePrice:100,promotionPrice:80,unitLabel:'ชิ้น',productUrl:'https://www.cnypharmacy.com/product/TEST'}],
  template:'promotion',
  title:'Test',
  intro:'probe',
  footerText:'probe',
  ctaLabel:'ซื้อเลย',
  themeColor:'rose',
  closingText:'probe closing'
};
process.stdout.write(JSON.stringify(p));
" | npx tsx .claude/plugins/line-broadcast/scripts/build-flex.ts 2>/dev/null)
if [ -n "$BUILD_FLEX_OUT" ] && echo "$BUILD_FLEX_OUT" | node -e "
const data=require('fs').readFileSync(0,'utf8');
try{const m=JSON.parse(data); if(!Array.isArray(m)||m.length===0)process.exit(1); console.log('messages:'+m.length)}catch{process.exit(1)}
" 2>/dev/null; then
  echo "  ✓ build-flex OK"
else
  echo "  ✗ build-flex broken — ตรวจ tsx + src/lib/flex-builder.ts"
  FAILED=2
fi

# Result ──────────────────────────────────────────────────────────────────
if [ "$FAILED" -eq 0 ]; then
  echo "✓ All checks passed — plugin พร้อมใช้ผ่าน Claude Code chat (ไม่ต้อง npm run dev)"
  exit 0
else
  echo "✗ One or more checks failed (exit code ${FAILED})."
  exit "$FAILED"
fi
