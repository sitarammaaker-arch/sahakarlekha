// Verifies pay_payslip_lines (migration 117) on staging: applies it, then as a simulated tenant
// session, fetches the demo payslip's line items and asserts the BASIC/DA/HRA/PF breakdown.
import fs from 'node:fs'; import pg from 'pg';
const url=fs.readFileSync('.env.staging.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const pass=url.match(/postgresql:\/\/[^:]+:([^@]+)@/)[1];
const c=new pg.Client({connectionString:`postgresql://postgres.ivmrlhjrqtwftdlxajxk:${pass}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,ssl:{rejectUnauthorized:false}});
let p=0,f=0; const ok=(c2,m)=>{if(c2){p++;console.log('  ✓',m)}else{f++;console.error('  ✗',m)}};
await c.connect();
try{
  await c.query(fs.readFileSync('supabase/migrations/payroll/117_pay_payslip_lines_api.sql','utf8'));
  console.log('applied 117');
  await c.query('begin'); await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims',$1,true)`,[JSON.stringify({role:'authenticated',email:'mfatest@sahakarlekha.test'})]);
  const runs=(await c.query(`select * from public.pay_list_runs()`)).rows;
  const demo=runs.find(r=>Number(r.total_net_minor)===4440000);
  const slips=(await c.query(`select * from public.pay_run_payslips($1)`,[demo.run_id])).rows;
  const lines=(await c.query(`select * from public.pay_payslip_lines($1)`,[slips[0].payslip_id])).rows;
  ok(lines.length===4,`4 line items (got ${lines.length})`);
  const by=Object.fromEntries(lines.map(l=>[l.code,l]));
  ok(by.BASIC&&Number(by.BASIC.computed_minor)===3000000&&by.BASIC.kind==='earning','BASIC 3000000 earning');
  ok(by.DA&&Number(by.DA.computed_minor)===600000&&by.HRA&&Number(by.HRA.computed_minor)===1200000,'DA 600000, HRA 1200000');
  ok(by.PF&&Number(by.PF.computed_minor)===360000&&by.PF.kind==='deduction','PF 360000 deduction');
  ok(by.BASIC.name&&(by.BASIC.name.en||by.BASIC.name.hi),'line carries an i18n label');
  await c.query('rollback');
  console.log(`\n${f===0?'PASS':'FAIL'}  pay lines-api — ${p} passed, ${f} failed`);
  process.exit(f===0?0:1);
}catch(e){try{await c.query('rollback')}catch{};console.error('FATAL:',e.message);process.exit(1)}finally{await c.end()}
