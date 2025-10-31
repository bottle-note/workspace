"""
GitHub Labels 초기화 스크립트

workspace 레포의 모든 라벨을 삭제하고 새로운 라벨 그룹을 추가합니다.

실행: python3 scripts/initialize_labels.py
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

# 라벨 구성
LABEL_GROUPS = {
    'type': {
        'color': '0366d6',  # 파란색 계열
        'labels': [
            {'name': 'type: feature', 'description': '새로운 기능'},
            {'name': 'type: bug', 'description': '버그 수정'},
            {'name': 'type: docs', 'description': '문서 작업'},
            {'name': 'type: refactor', 'description': '코드 리팩토링'},
        ]
    },
    'priority': {
        'colors': {
            'critical': 'b60205',  # 진한 빨강
            'high': 'd93f0b',      # 빨강
            'medium': 'fbca04',    # 주황
            'low': 'fef2c0',       # 연한 주황
        },
        'labels': [
            {'name': 'priority: critical', 'description': '치명적', 'color': 'b60205'},
            {'name': 'priority: high', 'description': '높음', 'color': 'd93f0b'},
            {'name': 'priority: medium', 'description': '보통', 'color': 'fbca04'},
            {'name': 'priority: low', 'description': '낮음', 'color': 'fef2c0'},
        ]
    },
    'status': {
        'color': '5319e7',  # 보라색 계열
        'labels': [
            {'name': 'status: 작업중', 'description': '현재 작업 진행 중'},
            {'name': 'status: 배포 요청', 'description': '배포 승인 대기'},
            {'name': 'status: 배포 완료', 'description': '프로덕션 배포 완료'},
            {'name': 'status: 스테이징', 'description': '스테이징 환경에 배포됨'},
        ]
    },
    'area': {
        'color': '0e8a16',  # 초록색 계열
        'labels': [
            {'name': 'area: frontend', 'description': '프론트엔드'},
            {'name': 'area: backend', 'description': '백엔드'},
            {'name': 'area: infra', 'description': '인프라'},
        ]
    }
}


def get_all_labels():
    """
    레포지토리의 모든 라벨을 가져옵니다.

    Returns:
        라벨 리스트
    """
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/labels'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    params = {
        'per_page': 100
    }

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API 요청 실패: {e}")
        return None


def delete_label(label_name):
    """
    라벨을 삭제합니다.

    Args:
        label_name: 삭제할 라벨 이름

    Returns:
        성공 여부
    """
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/labels/{label_name}'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }

    try:
        response = requests.delete(url, headers=headers)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"라벨 삭제 실패: {e}")
        return False


def create_label(name, description, color):
    """
    새로운 라벨을 생성합니다.

    Args:
        name: 라벨 이름
        description: 라벨 설명
        color: 라벨 색상 (hex, # 제외)

    Returns:
        생성된 라벨 정보 또는 None
    """
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/labels'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    data = {
        'name': name,
        'description': description,
        'color': color
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"라벨 생성 실패: {e}")
        return None


def delete_all_labels():
    """모든 라벨을 삭제합니다."""
    print("=" * 80)
    print("1단계: 기존 라벨 삭제")
    print("=" * 80)
    print()

    labels = get_all_labels()
    if not labels:
        print("라벨을 가져오는데 실패했습니다.")
        return False

    if len(labels) == 0:
        print("삭제할 라벨이 없습니다.")
        return True

    print(f"총 {len(labels)}개의 라벨 발견")
    print()

    deleted_count = 0
    failed_count = 0

    for idx, label in enumerate(labels, 1):
        name = label['name']
        print(f"[{idx}/{len(labels)}] 라벨 삭제 중: {name}")

        if delete_label(name):
            print("  → 삭제 완료")
            deleted_count += 1
        else:
            print("  → 실패")
            failed_count += 1

    print()
    print(f"삭제 성공: {deleted_count}개")
    print(f"실패: {failed_count}개")
    print()

    return failed_count == 0


def create_new_labels():
    """새로운 라벨 그룹을 생성합니다."""
    print("=" * 80)
    print("2단계: 새로운 라벨 생성")
    print("=" * 80)
    print()

    created_count = 0
    failed_count = 0
    total_labels = sum(len(group['labels']) for group in LABEL_GROUPS.values())

    current = 0

    for group_name, group_config in LABEL_GROUPS.items():
        print(f"\n{group_name.upper()} 그룹 생성 중...")
        print("-" * 40)

        for label_config in group_config['labels']:
            current += 1
            name = label_config['name']
            description = label_config['description']
            # 개별 색상이 지정되어 있으면 사용, 아니면 그룹 색상 사용
            color = label_config.get('color', group_config.get('color'))

            print(f"[{current}/{total_labels}] {name}")

            result = create_label(name, description, color)
            if result:
                print(f"  → 생성 완료 (#{color})")
                created_count += 1
            else:
                print("  → 실패")
                failed_count += 1

    print()
    print("=" * 80)
    print("라벨 생성 완료")
    print("=" * 80)
    print(f"총 라벨: {total_labels}개")
    print(f"생성 성공: {created_count}개")
    print(f"실패: {failed_count}개")

    return failed_count == 0


def print_label_summary():
    """생성될 라벨 요약을 출력합니다."""
    print("=" * 80)
    print("생성될 라벨 그룹")
    print("=" * 80)
    print()

    for group_name, group_config in LABEL_GROUPS.items():
        print(f"{group_name.upper()}:")
        for label in group_config['labels']:
            color = label.get('color', group_config.get('color'))
            print(f"  - {label['name']} (#{color}): {label['description']}")
        print()


def main():
    """메인 실행 함수"""
    if not GITHUB_TOKEN:
        print("에러: GITHUB_TOKEN이 설정되지 않았습니다.")
        print("git.env 파일에 GITHUB_TOKEN을 설정해주세요.")
        return

    print(f"대상 레포: {REPO_OWNER}/{REPO_NAME}")
    print()

    # 생성될 라벨 요약 출력
    print_label_summary()

    # 확인 프롬프트
    print("=" * 80)
    print(f"경고: {REPO_OWNER}/{REPO_NAME} 레포의 모든 기존 라벨을 삭제하고")
    print("위의 새로운 라벨 그룹으로 교체합니다.")
    print("=" * 80)
    confirm = input("계속하시겠습니까? (yes/no): ")

    if confirm.lower() != 'yes':
        print("취소되었습니다.")
        return

    print()

    # 1. 기존 라벨 삭제
    if not delete_all_labels():
        print("\n기존 라벨 삭제 중 오류가 발생했습니다.")
        print("계속 진행하시겠습니까? (yes/no): ", end='')
        if input().lower() != 'yes':
            return

    print()

    # 2. 새로운 라벨 생성
    create_new_labels()

    print()
    print("=" * 80)
    print("모든 작업 완료!")
    print("=" * 80)


if __name__ == '__main__':
    main()
