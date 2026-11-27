#!/usr/bin/env python3
"""
High-Speed Audit Commit GitHub Per Tanggal
Periode: 30 September 2026 - 30 Oktober 2026 (WIB, UTC+7)
"""

import subprocess
import json
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))
START_WIB = datetime(2026, 9, 30, 0, 0, 0, tzinfo=WIB)
END_WIB = datetime(2026, 10, 30, 23, 59, 59, 999999, tzinfo=WIB)

def parse_iso(dt_str):
    return datetime.fromisoformat(dt_str)

def get_branch_commit_map(repo_path):
    # Get all branches
    res = subprocess.run(['git', 'branch', '-a'], cwd=repo_path, capture_output=True, text=True, encoding='utf-8')
    branches = []
    for line in res.stdout.strip().split('\n'):
        b = line.strip().replace('* ', '').strip()
        if b and not b.startswith('remotes/origin/HEAD'):
            branches.append(b)
            
    # For each branch, get commit hashes
    branch_map = {} # sha -> list of branches
    for b in branches:
        res = subprocess.run(['git', 'log', b, '--format=%H'], cwd=repo_path, capture_output=True, text=True, encoding='utf-8')
        for sha in res.stdout.strip().split('\n'):
            if sha:
                if sha not in branch_map:
                    branch_map[sha] = []
                branch_map[sha].append(b)
    return branch_map

def audit_repository(repo_path, repo_name, owner, repo_slug, default_branch='main'):
    print(f"Auditing {repo_name}...")
    branch_map = get_branch_commit_map(repo_path)
    
    # Get all commits with log
    format_str = '%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%cn%x1f%ce%x1f%cd%x1f%s'
    cmd = ['git', 'log', '--all', f'--format={format_str}', '--date=iso-strict']
    res = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True, encoding='utf-8')
    lines = res.stdout.strip().split('\n')
    
    period_commits = []
    seen_shas = set()
    for line in lines:
        if not line: continue
        parts = line.split('\x1f')
        if len(parts) == 9:
            sha = parts[0]
            c_date = parse_iso(parts[7]).astimezone(WIB)
            a_date = parse_iso(parts[4]).astimezone(WIB)
            if START_WIB <= c_date <= END_WIB:
                if sha not in seen_shas:
                    seen_shas.add(sha)
                    
                    # Get diff stat and file list
                    stat_res = subprocess.run(['git', 'show', '--shortstat', '--format=', sha], cwd=repo_path, capture_output=True, text=True, encoding='utf-8')
                    stat_line = stat_res.stdout.strip()
                    files_res = subprocess.run(['git', 'show', '--name-only', '--format=', sha], cwd=repo_path, capture_output=True, text=True, encoding='utf-8')
                    files = [f for f in files_res.stdout.strip().split('\n') if f]
                    
                    branches = branch_map.get(sha, [])
                    is_on_main = any('main' in b for b in branches)
                    
                    period_commits.append({
                        'sha': sha,
                        'short_sha': parts[1],
                        'author_name': parts[2],
                        'author_email': parts[3],
                        'author_date': a_date.isoformat(),
                        'author_date_display': a_date.strftime('%Y-%m-%d %H:%M:%S WIB'),
                        'committer_name': parts[5],
                        'committer_email': parts[6],
                        'committer_date': c_date.isoformat(),
                        'committer_date_display': c_date.strftime('%Y-%m-%d %H:%M:%S WIB'),
                        'date_wib': c_date.strftime('%Y-%m-%d'),
                        'time_wib': c_date.strftime('%H:%M:%S'),
                        'subject': parts[8],
                        'branches': branches,
                        'is_on_main': is_on_main,
                        'stat': stat_line,
                        'file_count': len(files),
                        'files': files,
                        'commit_url': f"https://github.com/{owner}/{repo_slug}/commit/{sha}"
                    })
                    
    # Sort chronologically by committer date
    period_commits.sort(key=lambda x: x['committer_date'])
    print(f"Finished {repo_name}: {len(period_commits)} unique commits found.")
    return period_commits

if __name__ == '__main__':
    sim_commits = audit_repository(r'd:\apss-source\SIMMACI', 'SIMMACI', 'ayebe51', 'simmaci', 'main')
    keu_commits = audit_repository(r'd:\apss-source\Keuangan maarif', 'Keuangan Maarif', 'ayebe51', 'Keuangan-Maarif', 'main')
    
    with open(r'd:\apss-source\SIMMACI\scripts\simmaci_commits_audit.json', 'w', encoding='utf-8') as f:
        json.dump(sim_commits, f, indent=2, ensure_ascii=False)
        
    with open(r'd:\apss-source\SIMMACI\scripts\keuangan_commits_audit.json', 'w', encoding='utf-8') as f:
        json.dump(keu_commits, f, indent=2, ensure_ascii=False)
        
    print("Audit JSON successfully created!")
