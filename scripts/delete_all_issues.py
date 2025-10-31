"""
GitHub Issues 일괄 삭제 스크립트

workspace 레포의 모든 이슈를 닫습니다.
(GitHub API는 이슈 삭제를 지원하지 않으므로 close만 가능)

실행: python3 scripts/delete_all_issues.py
필수: 프로젝트 루트에 git.env 파일 설정
"""

import os
import requests
from dotenv import load_dotenv

# git.env 파일에서 환경 변수 로드 (프로젝트 루트)
load_dotenv('../git.env')

# GitHub 설정
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

# 대상 레포지토리 설정
REPO_OWNER = 'bottle-note'
REPO_NAME = 'workspace'


def fetch_issues(state='all', per_page=100, page=1):
    """
    레포지토리의 이슈를 가져옵니다.

    Args:
        state: 이슈 상태 ('open', 'closed', 'all')
        per_page: 페이지당 이슈 개수 (최대 100)
        page: 페이지 번호

    Returns:
        이슈 리스트
    """
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    params = {
        'state': state,
        'per_page': per_page,
        'page': page
    }

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API 요청 실패: {e}")
        return None


def get_all_issues(state='open'):
    """
    모든 이슈를 페이지네이션으로 가져옵니다.

    Args:
        state: 이슈 상태 ('open', 'closed', 'all')

    Returns:
        전체 이슈 리스트
    """
    all_issues = []
    page = 1

    while True:
        issues = fetch_issues(state=state, per_page=100, page=page)

        if not issues:
            break

        # Pull Request 제외
        issues = [issue for issue in issues if 'pull_request' not in issue]
        all_issues.extend(issues)

        if len(issues) < 100:
            break

        page += 1

    return all_issues


def close_issue(issue_number):
    """
    이슈를 닫습니다.

    Args:
        issue_number: 이슈 번호

    Returns:
        성공 여부
    """
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues/{issue_number}'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    data = {
        'state': 'closed'
    }

    try:
        response = requests.patch(url, headers=headers, json=data)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"이슈 닫기 실패: {e}")
        return False


def delete_all_issues():
    """모든 이슈를 닫는 메인 함수"""
    print(f"대상 레포: {REPO_OWNER}/{REPO_NAME}")
    print()

    # 1. 모든 open 이슈 가져오기
    print("open 상태 이슈를 가져오는 중...")
    issues = get_all_issues(state='open')
    print(f"총 {len(issues)}개의 open 이슈 발견")
    print()

    if len(issues) == 0:
        print("닫을 이슈가 없습니다.")
        return

    # 2. 확인 프롬프트
    print("=" * 80)
    print(f"경고: {REPO_OWNER}/{REPO_NAME} 레포의 {len(issues)}개 이슈를 모두 닫습니다.")
    print("=" * 80)
    confirm = input("계속하시겠습니까? (yes/no): ")

    if confirm.lower() != 'yes':
        print("취소되었습니다.")
        return

    # 3. 이슈 닫기 시작
    print()
    print("=" * 80)
    print("이슈 닫기 시작")
    print("=" * 80)

    closed_count = 0
    failed_count = 0

    for idx, issue in enumerate(issues, 1):
        number = issue['number']
        title = issue['title']

        print(f"\n[{idx}/{len(issues)}] 이슈 #{number}: {title}")

        if close_issue(number):
            print("  → 닫기 완료")
            closed_count += 1
        else:
            print("  → 실패")
            failed_count += 1

    # 4. 최종 리포트
    print()
    print("=" * 80)
    print("작업 완료")
    print("=" * 80)
    print(f"총 이슈: {len(issues)}개")
    print(f"닫기 성공: {closed_count}개")
    print(f"실패: {failed_count}개")


def main():
    """메인 실행 함수"""
    if not GITHUB_TOKEN:
        print("에러: GITHUB_TOKEN이 설정되지 않았습니다.")
        print("git.env 파일에 GITHUB_TOKEN을 설정해주세요.")
        return

    delete_all_issues()


if __name__ == '__main__':
    main()