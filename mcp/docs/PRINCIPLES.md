# MCP 철학 · 권고 · 지침 (페르소나 교차 검토)

이 문서는 별도 페르소나 5개의 권고를 합쳐 **이 게이트웨이의 규범**으로 고정한다.  
구현은 이 규범을 어기지 않아야 한다.

## 페르소나 요약

| ID | 페르소나 | 핵심 철학 |
|----|----------|-----------|
| P1 | MCP Protocol Engineer | 서버는 **stateless Streamable HTTP**. 클라이언트 세션 점착 금지. 도구 스키마·annotation 명확. |
| P2 | Security Engineer | **Token passthrough 금지**. 클라이언트는 Agent Key만. Admin JWT는 프로세스 내부. 시크릿 로그 0. |
| P3 | Platform / SRE | multi-arch, multi-pod, graceful shutdown, correlation id, 작은 blast radius. |
| P4 | Agent Tool Designer | 도구는 **좁고 읽기 쉬운 계약**. size 상한, 실패는 `isError`, NEVER 목록 명시. |
| P5 | Isolation Architect | MCP는 도메인 DB 모름. **기존 Admin API allowlist**만 호출. 전용 백엔드 강제 없음. |

## 준수 체크 (workspace `mcp/` v0.1 → 보강 후)

| 규범 | 이전 | 보강 |
|------|------|------|
| Stateless transport | OK | 유지 |
| Agent Key only / no JWT return | 부분 | JWT 형태 Bearer 거부, prod에서 default key 금지 |
| Outbound allowlist | OK | method+path 이중 검사 |
| 시크릿 스크럽 | OK | 유지 |
| Tool error as `isError` | 미흡 | 핸들러 try/catch + isError |
| Description 컨텍스트 폭증 | 미흡 | 상세 description truncate |
| Server instructions | 없음 | MCP `instructions` 주입 |
| Correlation | 부분 | Admin 호출에 `x-correlation-id` 전파 |
| Graceful shutdown | 없음 | SIGTERM/SIGINT |
| NEVER 문서화 | README 일부 | PRINCIPLES + instructions |

## NEVER (서버·문서·툴 모두)

- 위스키/엔티티 삭제, bulk 수정, 무페이징 list
- Admin JWT 클라이언트 수신·반환·로그
- free-form HTTP 프록시 툴
- 외부 웹검색·출처 판정 툴
- 프로덕션 기본 Agent Key env 의존

## 허용 아웃바운드 (v0.1)

| Method | Path |
|--------|------|
| POST | `/auth/agent` |
| GET | `/alcohols` |
| GET | `/alcohols/{id}` |

## 운영 원칙

1. 키·JWT는 env/Secret에만. 레포·로그·툴 결과에 금지.
2. 쓰기 툴 추가 시 **서버 `confirm=true` 강제** (annotation은 힌트일 뿐).
3. Admin UI 계약 변경에 취약하면 매핑 레이어에서 흡수 (전용 API는 선택).
