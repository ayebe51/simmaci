#!/usr/bin/env python3
"""
Compile October 2026 Reports (Ringkas & Lengkap) to DOCX and HTML,
and synchronize all output files to the artifact directory.
"""

import os
import shutil
import subprocess

WORKSPACE_DIR = r"d:\apss-source\SIMMACI"
ARTIFACT_DIR = r"C:\Users\user\.gemini\antigravity-ide\brain\fe108ee9-de3a-49f7-b15d-45411d2200e1"

DOCX_SCRIPT = os.path.join(WORKSPACE_DIR, "scripts", "generate_laporan_docx.py")
HTML_SCRIPT = os.path.join(WORKSPACE_DIR, "scripts", "generate_laporan_html.py")

reports = [
    {
        "name": "Laporan Ringkas",
        "md": os.path.join(WORKSPACE_DIR, "laporan-kerja-ringkas-30-september-30-oktober-2026.md"),
        "docx": os.path.join(WORKSPACE_DIR, "laporan-kerja-ringkas-30-september-30-oktober-2026.docx"),
        "html": os.path.join(WORKSPACE_DIR, "laporan-kerja-ringkas-30-september-30-oktober-2026.html"),
    },
    {
        "name": "Laporan Lengkap",
        "md": os.path.join(WORKSPACE_DIR, "laporan-kerja-30-september-30-oktober-2026.md"),
        "docx": os.path.join(WORKSPACE_DIR, "laporan-kerja-30-september-30-oktober-2026.docx"),
        "html": os.path.join(WORKSPACE_DIR, "laporan-kerja-30-september-30-oktober-2026.html"),
    }
]

for rep in reports:
    print(f"=== Compiling {rep['name']} ===")
    print(f"Generating DOCX from {rep['md']} -> {rep['docx']}...")
    res_docx = subprocess.run(["python", DOCX_SCRIPT, rep['md'], rep['docx']], capture_output=True, text=True)
    if res_docx.returncode != 0:
        print(f"DOCX Error: {res_docx.stderr}")
    else:
        print(f"DOCX Success: {os.path.getsize(rep['docx']):,} bytes")

    print(f"Generating HTML from {rep['md']} -> {rep['html']}...")
    res_html = subprocess.run(["python", HTML_SCRIPT, rep['md'], rep['html']], capture_output=True, text=True)
    if res_html.returncode != 0:
        print(f"HTML Error: {res_html.stderr}")
    else:
        print(f"HTML Success: {os.path.getsize(rep['html']):,} bytes")

print("=== Synchronizing artifacts ===")
files_to_sync = [
    "laporan-kerja-ringkas-30-september-30-oktober-2026.md",
    "laporan-kerja-ringkas-30-september-30-oktober-2026.docx",
    "laporan-kerja-ringkas-30-september-30-oktober-2026.html",
    "laporan-kerja-30-september-30-oktober-2026.md",
    "laporan-kerja-30-september-30-oktober-2026.docx",
    "laporan-kerja-30-september-30-oktober-2026.html"
]

for fname in files_to_sync:
    src = os.path.join(WORKSPACE_DIR, fname)
    dst = os.path.join(ARTIFACT_DIR, fname)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"Synced: {fname} -> {os.path.getsize(dst):,} bytes")

print("All October reports compiled and synchronized successfully!")
