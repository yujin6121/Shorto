#!/usr/bin/env bash
# curl_examples.sh — API 키 사용 예시 스크립트
# 사용법: chmod +x scripts/curl_examples.sh && ./scripts/curl_examples.sh

BASE_URL="https://yourdomain.com"
API_KEY="<API_KEY>" # 발급받은 키로 변경

set -euo pipefail

echo "1) 단축 URL 생성 (API 키 사용)"
curl -sS -X POST "$BASE_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"url":"https://example.com/long/path","customCode":"example123"}' | jq || true

echo

echo "2) 단축 URL 생성 (키 없이)"
curl -sS -X POST "$BASE_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/long/path"}' | jq || true

echo

echo "3) QR 다운로드 (PNG)"
QR_DATA=$(python3 -c "import urllib.parse; print(urllib.parse.quote('https://short.example.com/s/example123'))")
curl -sS "$BASE_URL/api/qr?data=$QR_DATA&size=800x800&format=png" -o qr_example.png && echo "Saved qr_example.png"

echo

echo "4) 도메인 목록 조회"
curl -sS "$BASE_URL/api/domains" | jq || true

echo

echo "5) 통계 조회"
curl -sS "$BASE_URL/api/stats" | jq || true
