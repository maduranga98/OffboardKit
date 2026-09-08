import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
  projectId: 'offboardkit-storage-test',
  firestore: { host:'127.0.0.1', port:8080, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url),'utf8') },
  storage:   { host:'127.0.0.1', port:9199, rules: fs.readFileSync(new URL('../storage.rules', import.meta.url),'utf8') },
});

let fails=0, passes=0;
const check = async (name, fn, expect) => {
  let outcome; try { await fn(); outcome='ALLOWED'; } catch { outcome='DENIED'; }
  const ok = outcome===expect; ok?passes++:fails++;
  console.log(`${ok?'  ok  ':(expect==='DENIED'?'🔴VULN':'🟠BROKE')} ${outcome.padEnd(7)} ${name}${ok?'':`  << expected ${expect}`}`);
};

// Storage rules read /users from Firestore, so seed it there too.
await testEnv.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db,'users/staffA'), { companyId:'companyA', role:'super_admin', email:'a@a.com' });
  await setDoc(doc(db,'users/staffB'), { companyId:'companyB', role:'super_admin', email:'b@b.com' });
  const s = ctx.storage();
  await uploadBytes(ref(s,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf'), new Uint8Array([1,2,3]), { contentType:'application/pdf' });
  await uploadBytes(ref(s,'companies/companyA/knowledge/flowA/runbook.pdf'), new Uint8Array([1,2,3]), { contentType:'application/pdf' });
  await uploadBytes(ref(s,'companies/companyA/letters/ref.pdf'), new Uint8Array([1,2,3]), { contentType:'application/pdf' });
});

const anon      = testEnv.unauthenticatedContext().storage();
const staffA    = testEnv.authenticatedContext('staffA', { email:'a@a.com', companyId:'companyA', role:'super_admin' }).storage();
const staffB    = testEnv.authenticatedContext('staffB', { email:'b@b.com', companyId:'companyB', role:'super_admin' }).storage();
const portalA   = testEnv.authenticatedContext('portal_flowA', { portal:true, flowId:'flowA', portalCompanyId:'companyA' }).storage();
const portalX   = testEnv.authenticatedContext('portal_flowX', { portal:true, flowId:'flowX', portalCompanyId:'companyA' }).storage();
const PDF = { contentType:'application/pdf' };
const blob = () => new Uint8Array([1,2,3]);

console.log('\n═══ §5 STORAGE ═══');
await check('anon: read a signed NDA (was world-readable)', () => getBytes(ref(anon,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf')), 'DENIED');
await check('anon: upload into any company folder', () => uploadBytes(ref(anon,'companies/companyA/offboardings/flowA/tasks/taskA/evil.pdf'), blob(), PDF), 'DENIED');
await check('anon: overwrite an existing task file', () => uploadBytes(ref(anon,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf'), blob(), PDF), 'DENIED');
await check('anon: read a generated letter', () => getBytes(ref(anon,'companies/companyA/letters/ref.pdf')), 'DENIED');

await check('portal(flowA): read own task file', () => getBytes(ref(portalA,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf')), 'ALLOWED');
await check('portal(flowA): upload a task file', () => uploadBytes(ref(portalA,'companies/companyA/offboardings/flowA/tasks/taskA/signed.pdf'), blob(), PDF), 'ALLOWED');
await check('portal(flowA): upload a signature png', () => uploadBytes(ref(portalA,'companies/companyA/offboardings/flowA/tasks/taskA/sig.png'), blob(), { contentType:'image/png' }), 'ALLOWED');
await check('portal(flowA): upload knowledge doc (was broken)', () => uploadBytes(ref(portalA,'companies/companyA/knowledge/flowA/notes.pdf'), blob(), PDF), 'ALLOWED');
await check('portal(flowA): octet-stream rejected', () => uploadBytes(ref(portalA,'companies/companyA/offboardings/flowA/tasks/taskA/x.bin'), blob(), { contentType:'application/octet-stream' }), 'DENIED');
await check('portal(flowA): write to ANOTHER flow', () => uploadBytes(ref(portalA,'companies/companyA/offboardings/flowOther/tasks/t/x.pdf'), blob(), PDF), 'DENIED');
await check('portal(flowA): write to ANOTHER company', () => uploadBytes(ref(portalA,'companies/companyB/offboardings/flowA/tasks/t/x.pdf'), blob(), PDF), 'DENIED');
await check('portal(flowA): read generated letters', () => getBytes(ref(portalA,'companies/companyA/letters/ref.pdf')), 'DENIED');
await check('portal(flowA): delete a task file', () => deleteObject(ref(portalA,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf')), 'DENIED');
await check('portal(flowX): read flowA task file', () => getBytes(ref(portalX,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf')), 'DENIED');

await check('staffA: read own task file', () => getBytes(ref(staffA,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf')), 'ALLOWED');
await check('staffA: read own letters', () => getBytes(ref(staffA,'companies/companyA/letters/ref.pdf')), 'ALLOWED');
await check('staffA: delete own task file', () => deleteObject(ref(staffA,'companies/companyA/offboardings/flowA/tasks/taskA/nda.pdf')), 'ALLOWED');
await check('staffB: read companyA task file', () => getBytes(ref(staffB,'companies/companyA/knowledge/flowA/runbook.pdf')), 'DENIED');
await check('staffB: read companyA letters', () => getBytes(ref(staffB,'companies/companyA/letters/ref.pdf')), 'DENIED');
await check('staffB: write into companyA', () => uploadBytes(ref(staffB,'companies/companyA/letters/evil.pdf'), blob(), PDF), 'DENIED');
await check('staffB: read outside any company path', () => getBytes(ref(staffB,'random/path.pdf')), 'DENIED');

console.log(`\n═══════ ${passes} passed, ${fails} failed ═══════`);
await testEnv.cleanup();
process.exit(fails>0?1:0);
