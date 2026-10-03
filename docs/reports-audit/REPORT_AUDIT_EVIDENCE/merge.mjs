import fs from 'node:fs';
const F='REPORT_AUDIT_EVIDENCE/fragments/';
const rd=n=>fs.readFileSync(F+n,'utf8').replace(/^﻿/,'').replace(/\r\n/g,'\n');
const csv=(kind,out)=>{let h=null,rows=[];for(const s of 'ABCD'){const f=`${s}_${kind}.csv`;if(!fs.existsSync(F+f))continue;const l=rd(f).split('\n').filter(Boolean);h??=l[0];rows.push(...l.slice(1).map(r=>r));}
 fs.writeFileSync(out,'﻿'+[h,...rows].join('\r\n')+'\r\n');console.log(out,rows.length);};
csv('inventory','REPORT_INVENTORY.csv');csv('compliance','REPORT_STATUTORY_COMPLIANCE_MATRIX.csv');csv('export','REPORT_EXPORT_COVERAGE.csv');
const sl={A:'A — Core financial statements',B:'B — Registers & statutory',C:'C — Trade, tax, payroll, domain',D:'D — Export infrastructure & security'};
const join=(files,title,intro)=>`# ${title}\n\n${intro}\n\n`+files.filter(f=>fs.existsSync(F+f[0])).map(([f,h])=>`\n---\n\n## ${h}\n\n`+rd(f).replace(/^# .*\n/,'')).join('\n');
fs.writeFileSync('REPORT_VISUAL_QA.md',join([['D_visual_qa.md','Generated-output QA (actual PDFs rendered — slice D)']],'Report Visual / Print QA','Evidence files are in `REPORT_AUDIT_EVIDENCE/` (D_*.pdf, D_render_*.png). Only Cash Book, Bank Book, Trial Balance and Sale Register were rendered; the other generators are UNVERIFIED visually.'));
fs.writeFileSync('REPORT_DATA_RECONCILIATION.md',join([['A_reconciliation.md','Slice A — statements reconciliation & test results']],'Report Data Reconciliation','Test log: `REPORT_AUDIT_EVIDENCE/fragments/_A_testlog.txt`. Runtime/production-data checks are UNVERIFIED unless stated.'));
fs.writeFileSync('REPORT_SECURITY_AUDIT.md',join([['D_security.md','Tenant / RLS / permission / export leakage']],'Report Security Audit','Includes security-relevant findings raised by slices A–C (see their finding sections: permission checks on exports, role gating).'));
fs.writeFileSync('REPORT_GAP_REGISTER.md',join(['A','B','C','D'].map(s=>[s+'_gaps.md',sl[s]]),'Report Gap Register','Missing reports, fields, formats, print features and compliance items, by slice.'));
fs.writeFileSync('REPORT_AUDIT_EVIDENCE/ALL_FINDINGS.md',join(['A','B','C','D'].map(s=>[s+'_findings.md',sl[s]]),'All findings (verbatim from slice auditors)',''));
