# Shorto

짧은 URL을 만들고 관리하는 간단한 웹 앱입니다.

## 빠른 시작

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`(관리 콘솔)을 엽니다.  
리다이렉트는 `http://localhost:3001/s/:code`로 처리됩니다.

개발 모드:

```bash
npm run dev
```

## 기능

- `/s/:code` 형태의 짧은 링크 생성 및 리다이렉트
- 커스텀 코드, 만료일, 도메인 선택
- 링크 목록/상태 관리, 상세 분석 페이지
- 로그/통계(최근 7일, 기기 분포) 확인
- 라이트/다크 테마 및 설정 페이지

## 주요 구조

- `server.ts`: HTTP 라우팅과 API 핸들러
- `src/store.ts`: JSON 데이터 저장소, 로그 처리
- `src/http.ts`: 요청/응답 헬퍼
- `src/validation.ts`: 입력 검증
- `src/pages_templates.ts`: 서버 렌더링 템플릿 로더
- `public/templates/`: HTML 템플릿 (`app.html`, `message.html`, `pages/*.html`)
- `public/app.css`: UI 스타일
- `public/app.js`: 브라우저 UI 로직
- `data/app/db.json`: 데이터 저장소

## API 간단 예시

관리자 UI에서 API 키를 발급받아 `/api/shorten` 호출 시 헤더로 전달할 수 있습니다.

```bash
curl -sS -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{"url":"https://example.com/long/path","customCode":"mypost","domains":["https://short.example.com"]}'
```

QR 이미지 다운로드:

```bash
curl -sS "http://localhost:3000/api/qr?data=https%3A%2F%2Fshort.example.com%2Fs%2Fcode123&size=800x800&format=png" -o qr.png
```

## 포트 설정

- `PORT`: 관리 콘솔/UI 포트 (기본 3000)
- `REDIRECT_PORT`: 리다이렉트 전용 포트 (기본 3001)

## 관리자 비밀번호 (.env)

루트에 `.env`를 만들고 다음을 설정하면 서버가 시작 시 로드합니다.

```
ADMIN_PASSWORD=yourStrongPassword
```

운영 환경에서는 환경변수 또는 시크릿 매니저 사용을 권장합니다.

## Docker 실행

```bash
docker-compose up -d --build
docker-compose logs -f
docker-compose down
```

데이터는 호스트의 `./data/app`에 저장됩니다.
