# Shorto

짧은 URL을 만들고 관리하는 간단한 앱입니다.

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 구조

- `server.js`: HTTP 라우팅과 API 핸들러
- `src/store.js`: JSON 데이터 저장소, 로그, 링크 상태 계산
- `src/http.js`: 요청/응답 헬퍼
- `src/validation.js`: URL, 커스텀 코드, 만료일 검증
- `src/pages.js`: 서버 렌더링 HTML 템플릿
- `public/app.css`: 화면 스타일과 라이트/다크 테마
- `public/app.js`: 브라우저 UI 동작

## 기능

- URL 입력 후 `/s/:code` 형태의 짧은 링크 생성
- 커스텀 짧은 코드와 만료 날짜 설정
- 짧은 링크 방문 시 원본 URL로 리다이렉트
- 링크별 QR 코드 생성
- 목록에서 짧은 링크 복사, 상세 분석 이동, 비활성화, 삭제
- Google/Material 스타일 UI와 라이트/다크 모드
- 비활성화/만료 링크 접근 차단
- 생성, 방문, 없는 코드, 비활성, 만료, 삭제 로그 기록
- 접속 로그 필터와 최근 7일 방문 차트
- 링크별 상세 분석 페이지

데이터는 `data/app/db.json`에 저장됩니다.

## API 사용 예시 (API 키 포함)

관리자 UI에서 API 키를 발급받아 외부에서 `/api/shorten`을 호출할 수 있습니다. 발급된 키는 보안상 한 번만 표시되므로 안전하게 보관하세요.

예: 발급받은 키를 `<API_KEY>`로 치환하여 사용합니다.

단축 URL 생성 (API 키 사용):

```bash
curl -sS -X POST https://yourdomain.com/api/shorten \
	-H "Content-Type: application/json" \
	-H "x-api-key: <API_KEY>" \
	-d '{"url":"https://example.com/long/path","customCode":"mypost","domains":["https://short.example.com"]}'
```

QR 이미지 다운로드 (고해상도 PNG):

```bash
curl -sS "https://yourdomain.com/api/qr?data=https%3A%2F%2Fshort.example.com%2Fs%2Fcode123&size=800x800&format=png" -o qr.png
```

운영 권장사항:

- HTTPS를 적용하세요.
- 발급된 키는 최소 권한·만료 정책을 적용하세요.
- 레이트 리밋과 키별 사용량 로깅을 도입하세요.

### .env 파일로 관리자 비밀번호 설정

루트에 `.env` 파일을 만들면 서버가 시작 시 해당 파일을 로드하여 `ADMIN_PASSWORD` 값을 사용할 수 있습니다. 예:

```
ADMIN_PASSWORD=yourStrongPassword
```

이렇게 설정하면 웹 UI에서 최초 로그인 시 DB에 비밀번호를 기록하지 않고도 `ADMIN_PASSWORD`로 로그인할 수 있습니다. 운영 환경에서는 `.env` 파일을 안전하게 관리하거나 서비스 매니저의 환경변수 설정을 사용하세요.

파일: [src/server.ts](src/server.ts), 클라이언트: [src/client.ts](src/client.ts)

## Docker 및 Docker Compose로 실행하기

간단한 Dockerfile과 `docker-compose.yml`을 추가해 컨테이너로 실행할 수 있습니다. 루트에 `.env`를 두고 `ADMIN_PASSWORD`를 설정하면 컨테이너 환경 변수로 전달되어 관리자 비밀번호로 사용됩니다.

빌드 및 실행 (동일 디렉터리에서):

```bash
# 빌드 및 데몬 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 컨테이너 중지
docker-compose down
```

데이터는 호스트의 `./data/app` 디렉터리에 지속적으로 저장됩니다. 운영 환경에서는 도커 시크릿 또는 외부 시크릿 매니저로 `ADMIN_PASSWORD`를 주입하세요.
# Shorto
