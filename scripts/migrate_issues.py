"""
GitHub Issues 마이그레이션 스크립트

bottle-note-official-app 레포의 이슈를 workspace 레포로 이관합니다.

실행: python3 scripts/migrate_issues.py
필수: 프로젝트 루트에 git.env 파일 설정
"""

import os
import requests
from dotenv import load_dotenv

# git.env 파일에서 환경 변수 로드 (프로젝트 루트)
load_dotenv('../git.env')

# GitHub 설정
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

# 레포지토리 설정
SOURCE_REPO_OWNER = 'bottle-note'
SOURCE_REPO_NAME = 'bottle-note-official-app'
TARGET_REPO_OWNER = 'bottle-note'
TARGET_REPO_NAME = 'workspace'


def fetch_issues(repo_owner, repo_name, state='all', per_page=100, page=1):
    """
    특정 레포지토리의 이슈를 가져옵니다.

    Args:
        repo_owner: 레포지토리 소유자
        repo_name: 레포지토리 이름
        state: 이슈 상태 ('open', 'closed', 'all')
        per_page: 페이지당 이슈 개수 (최대 100)
        page: 페이지 번호

    Returns:
        이슈 리스트
    """
    url = f'https://api.github.com/repos/{repo_owner}/{repo_name}/issues'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    params = {
        'state': state,
        'per_page': per_page,
        'page': page,
        'sort': 'created',  # 생성일 기준 정렬
        'direction': 'asc'  # 오름차순 (오래된 것부터)
    }

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API 요청 실패: {e}")
        return None


def get_all_issues(repo_owner, repo_name, state='all'):
    """
    특정 레포지토리의 모든 이슈를 페이지네이션으로 가져옵니다.

    Args:
        repo_owner: 레포지토리 소유자
        repo_name: 레포지토리 이름
        state: 이슈 상태 ('open', 'closed', 'all')

    Returns:
        전체 이슈 리스트
    """
    all_issues = []
    page = 1

    while True:
        issues = fetch_issues(repo_owner, repo_name, state=state, per_page=100, page=page)

        if not issues:
            break

        # Pull Request 제외
        issues = [issue for issue in issues if 'pull_request' not in issue]
        all_issues.extend(issues)

        if len(issues) < 100:
            break

        page += 1

    return all_issues


def is_duplicate(title, existing_issues):
    """
    동일한 제목의 이슈가 이미 존재하는지 확인합니다.

    Args:
        title: 확인할 이슈 제목
        existing_issues: 기존 이슈 리스트

    Returns:
        중복 여부 (True/False)
    """
    for issue in existing_issues:
        if issue['title'] == title:
            return True
    return False


def format_issue_body(original_issue):
    """
    이슈 본문을 포맷팅합니다.

    Args:
        original_issue: 원본 이슈 데이터

    Returns:
        포맷팅된 본문
    """
    body = original_issue.get('body') or ''
    labels = original_issue.get('labels', [])
    author = original_issue['user']['login']
    created_at = original_issue['created_at']
    issue_url = original_issue['html_url']
    assignees = original_issue.get('assignees', [])

    # 라벨 텍스트 (@라벨명 형식)
    labels_text = ' '.join([f'@{label["name"]}' for label in labels]) if labels else '없음'

    # 작업자 텍스트
    assignees_text = ', '.join([f'@{assignee["login"]}' for assignee in assignees]) if assignees else '없음'

    # 본문 포맷팅
    formatted_body = f"""{body}

---
라벨: {labels_text}
작업자: {assignees_text}
원본 이슈: {issue_url}
작성자: @{author}
작성일: {created_at}
"""

    return formatted_body


def create_issue(repo_owner, repo_name, title, body, labels=None, assignees=None):
    """
    새로운 이슈를 생성합니다.

    Args:
        repo_owner: 레포지토리 소유자
        repo_name: 레포지토리 이름
        title: 이슈 제목
        body: 이슈 본문
        labels: 라벨 리스트 (선택)
        assignees: 작업자 리스트 (선택)

    Returns:
        생성된 이슈 정보 또는 None
    """
    url = f'https://api.github.com/repos/{repo_owner}/{repo_name}/issues'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    data = {
        'title': title,
        'body': body
    }

    # 라벨 추가
    if labels:
        data['labels'] = labels

    # 작업자 추가
    if assignees:
        data['assignees'] = assignees

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"이슈 생성 실패: {e}")
        return None


def migrate_issues():
    """메인 마이그레이션 함수"""
    print(f"원본 레포: {SOURCE_REPO_OWNER}/{SOURCE_REPO_NAME}")
    print(f"대상 레포: {TARGET_REPO_OWNER}/{TARGET_REPO_NAME}")
    print()

    # 1. 원본 레포의 열린 이슈 가져오기
    print("원본 레포의 열린 이슈를 가져오는 중...")
    source_issues = get_all_issues(SOURCE_REPO_OWNER, SOURCE_REPO_NAME, state='open')
    print(f"원본 이슈 {len(source_issues)}개 발견")
    print()

    # 2. 대상 레포의 기존 이슈 가져오기 (중복 체크용)
    print("대상 레포의 열린 이슈를 가져오는 중...")
    target_issues = get_all_issues(TARGET_REPO_OWNER, TARGET_REPO_NAME, state='open')
    print(f"대상 레포에 기존 이슈 {len(target_issues)}개 존재")
    print()

    # 3. 마이그레이션 시작
    print("=" * 80)
    print("마이그레이션 시작")
    print("=" * 80)

    migrated_count = 0
    skipped_count = 0
    failed_count = 0

    for idx, issue in enumerate(source_issues, 1):
        title = issue['title']
        number = issue['number']

        print(f"\n[{idx}/{len(source_issues)}] 이슈 #{number}: {title}")

        # 중복 체크
        if is_duplicate(title, target_issues):
            print("  → 스킵 (동일한 제목의 이슈가 이미 존재)")
            skipped_count += 1
            continue

        # 작업자 추출
        assignees = [assignee['login'] for assignee in issue.get('assignees', [])]

        # 본문 포맷팅
        formatted_body = format_issue_body(issue)

        # 이슈 생성
        created_issue = create_issue(
            TARGET_REPO_OWNER,
            TARGET_REPO_NAME,
            title,
            formatted_body,
            assignees=assignees
        )

        if created_issue:
            print(f"  → 마이그레이션 완료: {created_issue['html_url']}")
            if assignees:
                print(f"     작업자: {', '.join(assignees)}")
            migrated_count += 1
        else:
            print("  → 실패")
            failed_count += 1

    # 4. 최종 리포트
    print()
    print("=" * 80)
    print("마이그레이션 완료")
    print("=" * 80)
    print(f"총 이슈: {len(source_issues)}개")
    print(f"마이그레이션 성공: {migrated_count}개")
    print(f"스킵 (중복): {skipped_count}개")
    print(f"실패: {failed_count}개")


def main():
    """메인 실행 함수"""
    if not GITHUB_TOKEN:
        print("에러: GITHUB_TOKEN이 설정되지 않았습니다.")
        print("git.env 파일에 GITHUB_TOKEN을 설정해주세요.")
        return

    migrate_issues()


if __name__ == '__main__':
    main()
