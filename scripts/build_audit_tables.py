#!/usr/bin/env python3
"""
Generate GitHub Commit Audit Tables for SIMMACI & Keuangan Maarif
Periode: 30 September 2026 - 30 Oktober 2026 (WIB, UTC+7)
Format URL: https://github.com/{owner}/{repo}/commits?author=ayebe51&since=YYYY-MM-DD&until=YYYY-MM-DD
Tanpa detail jam pada tampilan audit commit harian.
"""

import json
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))

# 31 Calendar dates from 2026-09-30 to 2026-10-30
START_DATE = datetime(2026, 9, 30)
END_DATE = datetime(2026, 10, 30)

dates = []
curr = START_DATE
while curr <= END_DATE:
    dates.append(curr.strftime('%Y-%m-%d'))
    curr += timedelta(days=1)

def get_daily_url(owner, repo_slug, date_str):
    return f"https://github.com/{owner}/{repo_slug}/commits?author=ayebe51&since={date_str}&until={date_str}"

def get_full_period_url(owner, repo_slug):
    return f"https://github.com/{owner}/{repo_slug}/commits?author=ayebe51&since=2026-09-30&until=2026-10-30"

with open(r'd:\apss-source\SIMMACI\scripts\simmaci_commits_audit.json', encoding='utf-8') as f:
    sim_commits = json.load(f)

with open(r'd:\apss-source\SIMMACI\scripts\keuangan_commits_audit.json', encoding='utf-8') as f:
    keu_commits = json.load(f)

def generate_markdown_audit(commits, repo_name, owner, repo_slug, default_branch='main'):
    # Group by date_wib
    by_date = {d: [] for d in dates}
    for c in commits:
        d = c['date_wib']
        if d in by_date:
            by_date[d].append(c)
        else:
            print(f"Warning: commit {c['sha']} has date {d} outside range!")

    md_lines = []
    
    # Summary of metrics
    unique_shas = set(c['sha'] for c in commits)
    active_dates = [d for d in dates if len(by_date[d]) > 0]
    inactive_dates = [d for d in dates if len(by_date[d]) == 0]
    
    full_period_url = get_full_period_url(owner, repo_slug)
    
    md_lines.append(f"### Audit Commit GitHub: {repo_name}")
    md_lines.append(f"- **URL Repositori GitHub:** `https://github.com/{owner}/{repo_slug}`")
    md_lines.append(f"- **Branch Default:** `{default_branch}`")
    md_lines.append(f"- **Link Filter Seluruh Periode (30 Sep – 30 Okt 2026):** [{repo_slug} Full Period Commits]({full_period_url})")
    md_lines.append(f"- **Total Commit Unik Terverifikasi:** **{len(unique_shas)} Commit**")
    md_lines.append(f"- **Jumlah Tanggal Aktif Commit:** **{len(active_dates)} Hari**")
    md_lines.append(f"- **Jumlah Tanggal Tanpa Commit:** **{len(inactive_dates)} Hari** ({', '.join(inactive_dates) if inactive_dates else 'Nihil'})\n")
    
    md_lines.append("| Tanggal (WIB) | Repository | Branch | Commit SHA | Pesan Commit | Author | Author Date | Committer Date | File/Area Berubah | Ringkasan Diff dan Tujuan | Status Verifikasi | Link Commit | Link Harian |")
    md_lines.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    
    for d in dates:
        day_commits = by_date[d]
        daily_link = get_daily_url(owner, repo_slug, d)
        if not day_commits:
            md_lines.append(f"| **{d}** | {repo_name} | `{default_branch}` | - | *Tidak ditemukan commit dalam sumber yang diperiksa* | - | - | - | - | Libur operasional / Tidak ada aktivitas commit | **Nihil** | - | [Filter {d}]({daily_link}) |")
        else:
            for c in day_commits:
                sha_short = c['short_sha']
                sha_full = c['sha']
                # Hanya tampilkan tanggal, tanpa detail jam
                dt_display = d
                subject = c['subject'].replace('|', '\\|')
                author = c['author_name']
                # Hanya ambil tanggal (10 karakter YYYY-MM-DD) tanpa jam
                a_date = c['author_date'][:10]
                c_date = c['committer_date'][:10]
                
                # Format primary branch
                branch_str = default_branch if c['is_on_main'] else (c['branches'][0] if c['branches'] else 'other')
                if len(branch_str) > 25:
                    branch_str = branch_str[:22] + "..."
                    
                # Format files / area
                file_cnt = c['file_count']
                files_sample = ", ".join([f.split('/')[-1] for f in c['files'][:2]])
                if file_cnt > 2:
                    files_str = f"{file_cnt} file ({files_sample}, dll)"
                elif file_cnt == 0:
                    files_str = "0 file"
                else:
                    files_str = f"{file_cnt} file ({files_sample})"
                files_str = files_str.replace('|', '\\|')
                
                # Diff stat / summary
                stat = c['stat'].replace('|', '\\|')
                diff_summary = f"{stat}" if stat else "Modifikasi berkas"
                
                # Status verifikasi
                if c['is_on_main']:
                    status_verif = "🟢 Verified (Main)"
                else:
                    status_verif = "🟡 Branch-Only"
                    
                commit_link = f"[`{sha_short}`]({c['commit_url']})"
                day_filter = f"[Filter {d}]({daily_link})"
                
                md_lines.append(f"| {dt_display} | {repo_name} | `{branch_str}` | {commit_link} | {subject} | {author} | {a_date} | {c_date} | {files_str} | {diff_summary} | {status_verif} | [GitHub]({c['commit_url']}) | {day_filter} |")
                
    return "\n".join(md_lines)

sim_md = generate_markdown_audit(sim_commits, "SIMMACI", "ayebe51", "simmaci", "main")
keu_md = generate_markdown_audit(keu_commits, "Keuangan", "ayebe51", "Keuangan-Maarif", "main")

with open(r'd:\apss-source\SIMMACI\scripts\simmaci_audit_table.md', 'w', encoding='utf-8') as f:
    f.write(sim_md)

with open(r'd:\apss-source\SIMMACI\scripts\keuangan_audit_table.md', 'w', encoding='utf-8') as f:
    f.write(keu_md)

print("Markdown audit tables successfully generated with updated URL format and date-only display!")
