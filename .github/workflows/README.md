# GitHub Actions 워크플로우

이 디렉토리는 보틀노트 프로젝트의 이슈 관리를 자동화하기 위한 GitHub Actions 워크플로우를 포함합니다.

## 워크플로우 목록

### setup-labels.yml

레포지토리의 라벨을 표준화하기 위한 일회성 설정 워크플로우입니다.

#### 기능

- 기존의 모든 라벨 삭제
- 표준화된 라벨 세트 생성
- 이모지는 최대 2개만 사용 (🔥 긴급, 🐛 버그)

#### 실행 방법

1. GitHub 레포지토리 페이지로 이동
2. **Actions** 탭 클릭
3. 왼쪽 사이드바에서 **Setup Repository Labels** 선택
4. **Run workflow** 버튼 클릭
5. 브랜치 선택 후 **Run workflow** 실행

#### 라벨 카테고리

##### 우선순위 (Priority)

- 🔥 priority: critical - 긴급하게 처리가 필요한 이슈
- priority: high - 높은 우선순위
- priority: medium - 중간 우선순위
- priority: low - 낮은 우선순위

##### 타입 (Type)

- type: feature - 새로운 기능 요청
- 🐛 type: bug - 버그 리포트
- type: enhancement - 기존 기능 개선
- type: documentation - 문서 작업
- type: question - 질문 또는 논의
- type: refactor - 코드 리팩토링
- type: test - 테스트 관련

##### 상태 (Status)

- status: in-progress - 작업 진행 중
- status: review - 리뷰 대기 중
- status: blocked - 차단됨
- status: on-hold - 보류됨
- status: completed - 완료됨

##### 영역 (Area)

- area: backend - 백엔드 관련
- area: frontend - 프론트엔드 관련
- area: database - 데이터베이스 관련
- area: api - API 관련
- area: infra - 인프라 관련

##### 기타 (Other)

- good first issue - 처음 기여하기 좋은 이슈
- help wanted - 도움이 필요한 이슈
- duplicate - 중복된 이슈
- invalid - 유효하지 않은 이슈
- wontfix - 수정하지 않을 이슈

#### 주의사항

- 이 워크플로우는 **모든 기존 라벨을 삭제**합니다
- 일회성 설정을 위한 워크플로우이므로 신중하게 실행하세요
- 워크플로우 실행 후 로그를 확인하여 성공적으로 완료되었는지 확인하세요
