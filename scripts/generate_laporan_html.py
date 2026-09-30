#!/usr/bin/env python3
"""
Generator Laporan Kerja Staff IT (Markdown to Self-Contained Printable HTML / PDF-Ready)
LP Ma'arif NU Kabupaten Cilacap
Periode: 30 Agustus - 29 September 2026
"""

import os
import re
import markdown

def convert_md_to_html(md_path, html_path):
    print(f"Reading markdown from: {md_path}")
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Pre-process mermaid blocks so they render with mermaid.js
    def replace_mermaid(match):
        diagram_code = match.group(1).strip()
        return f'<div class="mermaid-container"><div class="mermaid">\n{diagram_code}\n</div></div>'

    md_content = re.sub(r'```mermaid\s*\n(.*?)\n```', replace_mermaid, md_content, flags=re.DOTALL)

    # Convert Markdown to HTML with tables, fenced_code, and toc
    extensions = ['tables', 'fenced_code', 'nl2br', 'sane_lists']
    html_body = markdown.markdown(md_content, extensions=extensions)

    # Post-process HTML to add badge styling for status values in tables
    html_body = re.sub(r'<td>\s*(DONE|PASS|FIXED)\s*</td>', r'<td><span class="badge badge-done">\1</span></td>', html_body, flags=re.IGNORECASE)
    html_body = re.sub(r'<td>\s*(ON TRACK|IN PROGRESS|WIP)\s*</td>', r'<td><span class="badge badge-wip">\1</span></td>', html_body, flags=re.IGNORECASE)
    html_body = re.sub(r'<td>\s*(RESOLVED)\s*</td>', r'<td><span class="badge badge-done">\1</span></td>', html_body, flags=re.IGNORECASE)
    html_body = re.sub(r'<td>\s*(MONITORED|MITIGATED)\s*</td>', r'<td><span class="badge badge-wip">\1</span></td>', html_body, flags=re.IGNORECASE)
    html_body = re.sub(r'<strong>\s*(DONE|PASS|FIXED)\s*</strong>', r'<span class="badge badge-done">\1</span>', html_body, flags=re.IGNORECASE)

    # Format numbers / stats
    docx_filename = os.path.splitext(os.path.basename(html_path))[0] + ".docx"

    html_template = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Kerja Staff IT — 30 Agustus s.d. 29 September 2026 | LP Ma'arif NU Cilacap</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      if (typeof mermaid !== 'undefined') {{
        mermaid.initialize({{
          startOnLoad: true,
          theme: 'neutral',
          flowchart: {{ useMaxWidth: true, htmlLabels: true, curve: 'basis' }},
          timeline: {{ useMaxWidth: true }}
        }});
      }}
    }});
  </script>
  <style>
    :root {{
      --primary: #047857;
      --primary-dark: #065f46;
      --primary-light: #ecfdf5;
      --secondary: #1e3a8a;
      --text: #1f2937;
      --text-muted: #4b5563;
      --bg: #f3f4f6;
      --card-bg: #ffffff;
      --border: #e5e7eb;
      --border-dark: #cbd5e1;
    }}

    * {{ box-sizing: border-box; }}
    
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
      color: var(--text);
      background: var(--bg);
      padding: 30px 15px;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }}

    .container {{
      max-width: 1100px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 50px 65px;
      border-radius: 14px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.07);
      border: 1px solid var(--border);
    }}

    /* Print action bar */
    .print-bar {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 35px;
      padding: 16px 24px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      position: sticky;
      top: 15px;
      z-index: 100;
      box-shadow: 0 4px 15px rgba(4, 120, 87, 0.1);
      backdrop-filter: blur(8px);
    }}

    .print-bar-info strong {{
      color: #065f46;
      font-size: 15.5px;
      display: block;
      margin-bottom: 2px;
    }}

    .print-bar-info div {{
      font-size: 12.5px;
      color: #047857;
    }}

    .print-actions {{
      display: flex;
      gap: 12px;
    }}

    .print-btn {{
      background: var(--primary);
      color: white;
      border: none;
      padding: 11px 24px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 7px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(4, 120, 87, 0.25);
    }}
    .print-btn:hover {{
      background: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(4, 120, 87, 0.35);
    }}

    .btn-secondary {{
      background: #ffffff;
      color: #047857;
      border: 1.5px solid #a7f3d0;
      padding: 10px 18px;
      font-size: 13.5px;
      font-weight: 600;
      border-radius: 7px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }}
    .btn-secondary:hover {{
      background: #f0fdf4;
      border-color: #34d399;
    }}

    /* Typography */
    h1 {{
      color: #111827;
      font-size: 26px;
      border-bottom: 3.5px solid var(--primary);
      padding-bottom: 14px;
      margin-top: 10px;
      margin-bottom: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.3;
    }}

    h2 {{
      color: var(--primary);
      font-size: 19.5px;
      margin-top: 42px;
      margin-bottom: 16px;
      border-bottom: 1.5px solid var(--border);
      padding-bottom: 9px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }}

    h3 {{
      color: #1e293b;
      font-size: 15.5px;
      margin-top: 26px;
      margin-bottom: 11px;
      font-weight: 600;
    }}

    h4 {{
      color: #334155;
      font-size: 14px;
      margin-top: 18px;
      margin-bottom: 8px;
      font-weight: 600;
    }}

    p, li {{
      font-size: 13.5px;
      color: #374151;
      line-height: 1.68;
    }}

    ul, ol {{
      padding-left: 24px;
      margin: 10px 0 16px 0;
    }}
    li {{ margin-bottom: 6px; }}

    /* Tables */
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 12.5px;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }}

    th, td {{
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }}

    th {{
      background: #f8fafc;
      color: #0f172a;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #cbd5e1;
    }}

    tr:nth-child(even) {{ background: #fbfcfd; }}
    tr:hover {{ background: #f0fdf4; }}

    /* Badges */
    .badge {{
      display: inline-block;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }}

    .badge-done {{
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }}

    .badge-wip {{
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fcd34d;
    }}

    /* Blockquotes */
    blockquote {{
      background: #f0fdf4;
      border-left: 4.5px solid var(--primary);
      margin: 20px 0;
      padding: 14px 22px;
      border-radius: 0 9px 9px 0;
      color: #065f46;
      font-size: 13.5px;
    }}

    /* Code & Telemetry */
    pre {{
      background: #0f172a;
      color: #f8fafc;
      padding: 18px 22px;
      border-radius: 9px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      line-height: 1.55;
      border: 1px solid #334155;
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
    }}

    code {{
      font-family: 'JetBrains Mono', monospace;
      background: #f1f5f9;
      padding: 2.5px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: #b91c1c;
      border: 1px solid #e2e8f0;
    }}

    pre code {{
      background: transparent;
      padding: 0;
      color: inherit;
      border: none;
    }}

    /* Mermaid diagrams container */
    .mermaid-container {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
      overflow-x: auto;
    }}
    .mermaid-container .mermaid {{
      display: inline-block;
      text-align: left;
    }}

    hr {{
      border: 0;
      height: 1px;
      background: var(--border);
      margin: 36px 0;
    }}

    /* Links */
    a {{
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }}
    a:hover {{
      text-decoration: underline;
      color: var(--primary-dark);
    }}

    /* Print Rules for High-Fidelity PDF Export */
    @media print {{
      @page {{
        size: A4;
        margin: 15mm 12mm 15mm 12mm;
      }}
      body {{
        background: white;
        padding: 0;
        color: #000;
      }}
      .container {{
        border: none;
        box-shadow: none;
        padding: 0;
        width: 100%;
        max-width: 100%;
      }}
      .print-bar {{
        display: none !important;
      }}
      h1, h2, h3, h4 {{
        page-break-after: avoid;
        break-after: avoid;
      }}
      table {{
        page-break-inside: auto;
        font-size: 10.5px;
        margin: 14px 0;
      }}
      th, td {{
        padding: 6px 8px;
      }}
      tr {{
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: auto;
      }}
      pre {{
        font-size: 9.5px;
        padding: 12px;
        page-break-inside: avoid;
        break-inside: avoid;
        background: #1e293b !important;
        color: #f8fafc !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }}
      .mermaid-container {{
        page-break-inside: avoid;
        break-inside: avoid;
        padding: 14px;
        border: 1px solid #ccc;
      }}
      .badge {{
        border: 1px solid #999;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }}
      blockquote {{
        page-break-inside: avoid;
        break-inside: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="print-bar">
      <div class="print-bar-info">
        <strong>Dokumen Laporan Kerja Staff IT (Siap Cetak / Download PDF)</strong>
        <div>SIMMACI & Keuangan Ma'arif — PC LP Ma'arif NU Kab. Cilacap (Periode 30 Agustus s.d. 29 September 2026)</div>
      </div>
      <div class="print-actions">
        <a href="{docx_filename}" class="btn-secondary" title="Unduh versi Word">
          📄 Download Word (.docx)
        </a>
        <button class="print-btn" onclick="window.print()">
          🖨️ Cetak / Simpan ke PDF (Ctrl + P)
        </button>
      </div>
    </div>

{html_body}

    <hr/>
    <div style="text-align: center; font-size: 12px; color: var(--text-muted); padding: 15px 0;">
      © 2026 Pengurus Cabang Lembaga Pendidikan Ma'arif NU Kabupaten Cilacap • Sistem Informasi Manajemen (SIMMACI) & Sistem Keuangan
    </div>
  </div>
</body>
</html>
"""

    print(f"Writing HTML to: {html_path}")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    print("HTML successfully generated!")

if __name__ == '__main__':
    import sys
    md_file = sys.argv[1] if len(sys.argv) > 1 else r"d:\apss-source\SIMMACI\laporan-kerja-30-agustus-29-september-2026.md"
    html_file = sys.argv[2] if len(sys.argv) > 2 else r"d:\apss-source\SIMMACI\laporan-kerja-30-agustus-29-september-2026.html"
    convert_md_to_html(md_file, html_file)
