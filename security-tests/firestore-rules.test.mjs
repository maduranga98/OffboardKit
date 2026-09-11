import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit, increment } from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
  projectId: 'offboardkit-sec-test',
  firestore: { host: '127.0.0.1', port: 8080,
    rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});

let fails = 0, passes = 0;
const check = async (name, fn, expect) => {
  let outcome, err;
  try { await fn(); outcome = 'ALLOWED'; }
  catch (e) { outcome = 'DENIED'; err = e.message?.slice(0, 90); }
  const ok = outcome === expect;
  ok ? passes++ : fails++;
  const tag = ok ? '  ok  ' : (expect === 'DENIED' ? ' VULN ' : ' BROKE');
  console.log(`${tag} ${outcome.padEnd(7)} ${name}${ok ? '' : `  << expected ${expect}${err ? ` | ${err}` : ''}`}`);
};

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'companies/companyA'), { name:'Victim Corp', ownerUid:'victimAdmin', plan:'business', stripeCustomerId:'cus_VICTIM', features:{}, settings:{} });
  await setDoc(doc(db, 'companies/companyB'), { name:'Other Corp', ownerUid:'otherAdmin', plan:'basic' });
  await setDoc(doc(db, 'users/victimAdmin'), { companyId:'companyA', role:'super_admin', email:'admin@victim.com', isActive:true });
  await setDoc(doc(db, 'users/otherAdmin'),  { companyId:'companyB', role:'super_admin', email:'admin@other.com', isActive:true });
  await setDoc(doc(db, 'offboardFlows/flowA'), { companyId:'companyA', employeeName:'Jane Doe', employeeEmail:'jane@victim.com', salary:120000, portalToken:'secret-token-A', status:'in_progress', progressPercent:10 });
  await setDoc(doc(db, 'flowTasks/taskA'), { flowId:'flowA', companyId:'companyA', title:'Return laptop', portalToken:'secret-token-A', status:'pending', assigneeRole:'employee' });
  await setDoc(doc(db, 'assets/assetA'), { flowId:'flowA', companyId:'companyA', name:'MacBook', status:'assigned' });
  await setDoc(doc(db, 'exitInterviewTemplates/tmplA'), { companyId:'companyA', isDefault:true, questions:[] });
  await setDoc(doc(db, 'exitInterviewResponses/respA'), { flowId:'flowA', companyId:'companyA', portalToken:'secret-token-A', answers:{ whyLeaving:'My manager was abusive' } });
  await setDoc(doc(db, 'knowledgeItems/kiA'), { flowId:'flowA', companyId:'companyA', portalToken:'secret-token-A', title:'Prod DB runbook' });
  await setDoc(doc(db, 'alumniProfiles/alumA'), { companyId:'companyA', email:'jane@victim.com', authUid:'alumniUid', personalEmail:'jane@gmail.com', optedIn:true });
  await setDoc(doc(db, 'alumniDirectory/alumniUid'), { companyId:'companyA', profileId:'alumA', email:'jane@victim.com', optedIn:true });
  await setDoc(doc(db, 'alumniJobs/jobA'), { companyId:'companyA', status:'open', title:'Eng', referralCount:2 });
  await setDoc(doc(db, 'alumniAnnouncements/annA'), { companyId:'companyA', status:'published', readCount:1 });
  await setDoc(doc(db, 'invites/inviteA'), { companyId:'companyA', email:'newhire@victim.com', role:'hr_admin', status:'pending', invitedBy:'victimAdmin' });
  await setDoc(doc(db, 'notifications/notifA'), { companyId:'companyA', body:'Jane exits Friday' });
  await setDoc(doc(db, 'docRequests/drA'), { companyId:'companyA', alumniId:'alumA', type:'salary_letter' });
  await setDoc(doc(db, 'gigRequests/grA'), { companyId:'companyA', alumniId:'alumA', status:'sent' });
  await setDoc(doc(db, 'pulseSurveys/psOther'), { id:'psOther', companyId:'companyA', totalResponded:0 });
  await setDoc(doc(db, 'pulseSurveys/psA'), { id:'psA', companyId:'companyA', totalResponded:1, questions:[] });
  await setDoc(doc(db, 'pulseResponses/prA'), { companyId:'companyA', surveyId:'psA', token:'stok', status:'pending' });
  await setDoc(doc(db, 'knowledgeThreads/ktA'), { companyId:'companyA', alumniId:'alumA', subject:'secret' });
  await setDoc(doc(db, 'accessRevocations/arA'), { companyId:'companyA', system:'AWS' });
  await setDoc(doc(db, 'alumniApplications/aaA'), { companyId:'companyA', alumniId:'alumA', name:'Jane' });
  await setDoc(doc(db, 'letterTemplates/ltA'), { companyId:'companyA', body:'x' });
  await setDoc(doc(db, 'offboardTemplates/otA'), { companyId:'companyA', name:'Standard' });
  await setDoc(doc(db, 'complianceReports/crA'), { companyId:'companyA' });
});

const anon     = testEnv.unauthenticatedContext().firestore();
const attacker = testEnv.authenticatedContext('attackerUid', { email:'attacker@evil.com' }).firestore();
const other    = testEnv.authenticatedContext('otherAdmin', { email:'admin@other.com' }).firestore();
const staff    = testEnv.authenticatedContext('victimAdmin', { email:'admin@victim.com' }).firestore();
const alumni   = testEnv.authenticatedContext('alumniUid', { email:'jane@victim.com' }).firestore();
const portal   = testEnv.authenticatedContext('portal_flowA', { portal:true, flowId:'flowA', portalCompanyId:'companyA' }).firestore();
const evilPortal = testEnv.authenticatedContext('portal_flowX', { portal:true, flowId:'flowX', portalCompanyId:'companyA' }).firestore();
const survey   = testEnv.authenticatedContext('survey_prA', { survey:true, responseId:'prA', surveyId:'psA', surveyCompanyId:'companyA' }).firestore();

console.log('\n═══ A. ORIGINAL ATTACKS (§2, §4) — unauthenticated ═══');
await check('anon: dump ALL offboardFlows via portalToken != null', () => getDocs(query(collection(anon,'offboardFlows'), where('portalToken','!=',null))), 'DENIED');
await check('anon: read a flow by id', () => getDoc(doc(anon,'offboardFlows/flowA')), 'DENIED');
await check('anon: dump ALL exit interview responses', () => getDocs(query(collection(anon,'exitInterviewResponses'), where('portalToken','!=',null))), 'DENIED');
await check('anon: dump ALL knowledgeItems', () => getDocs(query(collection(anon,'knowledgeItems'), where('portalToken','!=',null))), 'DENIED');
await check('anon: dump ALL flowTasks', () => getDocs(query(collection(anon,'flowTasks'), where('portalToken','!=',null))), 'DENIED');
await check('anon: dump ALL pulseResponses', () => getDocs(query(collection(anon,'pulseResponses'), where('token','!=',null))), 'DENIED');
await check('anon: list ALL pending invites', () => getDocs(collection(anon,'invites')), 'DENIED');
await check('anon: read exitInterviewTemplates (was public)', () => getDoc(doc(anon,'exitInterviewTemplates/tmplA')), 'DENIED');
await check('anon: tamper with a flow', () => updateDoc(doc(anon,'offboardFlows/flowA'), { status:'completed', progressPercent:100 }), 'DENIED');

console.log('\n═══ B. PRIVILEGE ESCALATION (§1) ═══');
await check('attacker: create own /users doc as super_admin of companyA', () => setDoc(doc(attacker,'users/attackerUid'), { companyId:'companyA', role:'super_admin', email:'attacker@evil.com', isActive:true }), 'DENIED');
await check('attacker: create tenantless /users doc (legit signup)', () => setDoc(doc(attacker,'users/attackerUid'), { companyId:'', role:'super_admin', email:'attacker@evil.com', isActive:true }), 'ALLOWED');
await check('attacker: then self-escalate companyId', () => updateDoc(doc(attacker,'users/attackerUid'), { companyId:'companyA' }), 'DENIED');
await check('attacker: then self-escalate role', () => updateDoc(doc(attacker,'users/attackerUid'), { role:'super_admin', companyId:'companyA' }), 'DENIED');
await check('attacker: edit own profile fields (legit)', () => updateDoc(doc(attacker,'users/attackerUid'), { displayName:'Bob', department:'Eng' }), 'ALLOWED');
await check('attacker: create company owned by someone else', () => setDoc(doc(attacker,'companies/evilco'), { name:'Evil', ownerUid:'victimAdmin' }), 'DENIED');
await check('attacker: create own company (legit setup)', () => setDoc(doc(attacker,'companies/evilco'), { name:'Evil', ownerUid:'attackerUid' }), 'ALLOWED');
// Company creation is the one write a brand-new user can make, so it must not
// be a way to mint a paid plan, a self-granted trial, or a customer mapping.
await check('attacker: create company on a paid plan', () => setDoc(doc(attacker,'companies/evilco2'), { name:'Evil', ownerUid:'attackerUid', plan:'enterprise' }), 'DENIED');
await check('attacker: create company with a self-granted trial', () => setDoc(doc(attacker,'companies/evilco3'), { name:'Evil', ownerUid:'attackerUid', trialStatus:'active', trialEndsAt:new Date(Date.now()+1e11) }), 'DENIED');
await check('attacker: create company claiming a victim stripe customer', () => setDoc(doc(attacker,'companies/evilco4'), { name:'Evil', ownerUid:'attackerUid', stripeCustomerId:'cus_VICTIM' }), 'DENIED');
await check('attacker: create company with pre-set usage', () => setDoc(doc(attacker,'companies/evilco5'), { name:'Evil', ownerUid:'attackerUid', usageCount:{ offboardingsThisYear:-999 } }), 'DENIED');
await check('attacker: create company on basic (the legit shape)', () => setDoc(doc(attacker,'companies/evilco6'), { name:'Evil', ownerUid:'attackerUid', plan:'basic' }), 'ALLOWED');

console.log('\n═══ C. CROSS-TENANT (§3) — signed-in user of another company ═══');
for (const [label, path] of [['notifications','notifications/notifA'],['docRequests','docRequests/drA'],['knowledgeThreads','knowledgeThreads/ktA'],['accessRevocations','accessRevocations/arA'],['alumniApplications','alumniApplications/aaA'],['alumniProfiles','alumniProfiles/alumA'],['letterTemplates','letterTemplates/ltA'],['companies (billing)','companies/companyA'],['offboardFlows','offboardFlows/flowA'],['gigRequests','gigRequests/grA'],['pulseSurveys','pulseSurveys/psA'],['complianceReports','complianceReports/crA'],['offboardTemplates','offboardTemplates/otA']]) {
  await check(`companyB admin: read ${label}`, () => getDoc(doc(other, path)), 'DENIED');
}
await check('companyB admin: WRITE victim notifications', () => setDoc(doc(other,'notifications/evil'), { companyId:'companyA', body:'phish' }), 'DENIED');
await check('companyB admin: WRITE victim knowledgeThreads', () => setDoc(doc(other,'knowledgeThreads/evil'), { companyId:'companyA' }), 'DENIED');
await check('companyB admin: overwrite victim offboardTemplates', () => setDoc(doc(other,'offboardTemplates/otA'), { companyId:'companyA', name:'pwned' }), 'DENIED');
await check('companyB admin: downgrade victim plan', () => updateDoc(doc(other,'companies/companyA'), { plan:'basic' }), 'DENIED');
await check('companyB admin: invite self as hr_admin of companyA', () => setDoc(doc(other,'invites/evil'), { companyId:'companyA', email:'evil@evil.com', role:'hr_admin', status:'pending' }), 'DENIED');

console.log('\n═══ D. PORTAL SCOPING — token holder for flowA only ═══');
await check('portal(flowA): read own flow', () => getDoc(doc(portal,'offboardFlows/flowA')), 'ALLOWED');
await check('portal(flowA): read own tasks', () => getDocs(query(collection(portal,'flowTasks'), where('flowId','==','flowA'))), 'ALLOWED');
await check('portal(flowA): complete own task', () => updateDoc(doc(portal,'flowTasks/taskA'), { status:'completed', completedBy:'employee' }), 'ALLOWED');
await check('portal(flowA): sync own flow progress', () => updateDoc(doc(portal,'offboardFlows/flowA'), { progressPercent:50, status:'in_progress' }), 'ALLOWED');
await check('portal(flowA): read own assets', () => getDocs(query(collection(portal,'assets'), where('flowId','==','flowA'))), 'ALLOWED');
await check('portal(flowA): mark asset returned', () => updateDoc(doc(portal,'assets/assetA'), { status:'returned' }), 'ALLOWED');
await check('portal(flowA): read own company template', () => getDocs(query(collection(portal,'exitInterviewTemplates'), where('companyId','==','companyA'))), 'ALLOWED');
await check('portal(flowA): submit exit interview', () => setDoc(doc(portal,'exitInterviewResponses/newResp'), { companyId:'companyA', flowId:'flowA', answers:{} }), 'ALLOWED');
await check('portal(flowA): submit knowledge item', () => setDoc(doc(portal,'knowledgeItems/newKi'), { companyId:'companyA', flowId:'flowA', title:'Runbook' }), 'ALLOWED');
await check('portal(flowA): read own knowledge items', () => getDocs(query(collection(portal,'knowledgeItems'), where('flowId','==','flowA'))), 'ALLOWED');
await check('portal(flowA): ESCALATE — dump all flows', () => getDocs(collection(portal,'offboardFlows')), 'DENIED');
await check('portal(flowA): ESCALATE — rewrite employee salary', () => updateDoc(doc(portal,'offboardFlows/flowA'), { salary:1 }), 'DENIED');
await check('portal(flowA): ESCALATE — move flow to another tenant', () => updateDoc(doc(portal,'offboardFlows/flowA'), { companyId:'companyB' }), 'DENIED');
await check('portal(flowA): ESCALATE — read alumni PII', () => getDoc(doc(portal,'alumniProfiles/alumA')), 'DENIED');
await check('portal(flowA): ESCALATE — read invites', () => getDocs(collection(portal,'invites')), 'DENIED');
await check('portal(flowX) of same company: read flowA', () => getDoc(doc(evilPortal,'offboardFlows/flowA')), 'DENIED');
await check('portal(flowX) of same company: edit flowA tasks', () => updateDoc(doc(evilPortal,'flowTasks/taskA'), { status:'completed' }), 'DENIED');

console.log('\n═══ E. SURVEY SCOPING ═══');
await check('survey(prA): read own response', () => getDoc(doc(survey,'pulseResponses/prA')), 'ALLOWED');
await check('survey(prA): read own survey', () => getDocs(query(collection(survey,'pulseSurveys'), where('id','==','psA'))), 'ALLOWED');
await check('survey(prA): submit answers', () => updateDoc(doc(survey,'pulseResponses/prA'), { status:'completed', responses:{q1:5} }), 'ALLOWED');
await check('survey(prA): bump tally by one', () => updateDoc(doc(survey,'pulseSurveys/psA'), { totalResponded:2 }), 'ALLOWED');
await check('survey(prA): ESCALATE — dump all surveys', () => getDocs(collection(survey,'pulseSurveys')), 'DENIED');
await check('survey(prA): ESCALATE — read another survey', () => getDoc(doc(survey,'pulseSurveys/psOther')), 'DENIED');
await check('survey(prA): ESCALATE — dump all responses', () => getDocs(collection(survey,'pulseResponses')), 'DENIED');
await check('survey(prA): ESCALATE — read the flow', () => getDoc(doc(survey,'offboardFlows/flowA')), 'DENIED');

console.log('\n═══ F. LEGITIMATE STAFF ACCESS still works ═══');
await check('staff: read own company', () => getDoc(doc(staff,'companies/companyA')), 'ALLOWED');
await check('staff: read own flows', () => getDocs(query(collection(staff,'offboardFlows'), where('companyId','==','companyA'))), 'ALLOWED');
await check('staff: create a flow', () => setDoc(doc(staff,'offboardFlows/flowNew'), { companyId:'companyA', employeeName:'Bob' }), 'ALLOWED');
await check('staff: update a flow', () => updateDoc(doc(staff,'offboardFlows/flowA'), { status:'completed' }), 'ALLOWED');
await check('staff: read own notifications', () => getDocs(query(collection(staff,'notifications'), where('companyId','==','companyA'))), 'ALLOWED');
await check('staff: read own alumni', () => getDocs(query(collection(staff,'alumniProfiles'), where('companyId','==','companyA'))), 'ALLOWED');
await check('staff admin: read own invites', () => getDocs(query(collection(staff,'invites'), where('companyId','==','companyA'))), 'ALLOWED');
await check('staff admin: create an invite', () => setDoc(doc(staff,'invites/inv2'), { companyId:'companyA', email:'x@victim.com', role:'manager', status:'pending' }), 'ALLOWED');
await check('staff: update company settings', () => updateDoc(doc(staff,'companies/companyA'), { settings:{ brandColor:'#000' } }), 'ALLOWED');
await check('staff: CANNOT self-serve a plan upgrade', () => updateDoc(doc(staff,'companies/companyA'), { plan:'enterprise' }), 'DENIED');
// usageCount decides whether the Basic-plan cap has been hit, so clients must
// never move it — the usageCounters triggers own it server-side. The app used
// to write these from the browser, which silently broke flow creation.
await check('staff: CANNOT increment own usage counter', () => updateDoc(doc(staff,'companies/companyA'), { 'usageCount.offboardingsThisYear': increment(1) }), 'DENIED');
await check('staff: CANNOT reset active offboardings', () => updateDoc(doc(staff,'companies/companyA'), { 'usageCount.activeOffboardings': 0 }), 'DENIED');
// Trial state decides which features are unlocked, so extending it from the
// client would be a permanent free Starter plan.
await check('staff: CANNOT extend own trial', () => updateDoc(doc(staff,'companies/companyA'), { trialEndsAt:new Date(Date.now()+1e11) }), 'DENIED');
await check('staff: CANNOT re-activate an expired trial', () => updateDoc(doc(staff,'companies/companyA'), { trialStatus:'active' }), 'DENIED');
await check('staff: CANNOT point company at another stripe customer', () => updateDoc(doc(staff,'companies/companyA'), { stripeCustomerId:'cus_SOMEONE_ELSE' }), 'DENIED');
await check('staff: LIST company members (users query)', () => getDocs(query(collection(staff,'users'), where('companyId','==','companyA'))), 'ALLOWED');
await check('staff: read own user doc by id', () => getDoc(doc(staff,'users/victimAdmin')), 'ALLOWED');
await check('staff: LIST all users unscoped', () => getDocs(collection(staff,'users')), 'DENIED');
await check('staff: read another tenant user doc', () => getDoc(doc(staff,'users/otherAdmin')), 'DENIED');
await check('staff: read own audit log', () => getDocs(collection(staff,'offboardFlows/flowA/auditLog')), 'ALLOWED');
await check('staff: CANNOT write audit log', () => setDoc(doc(staff,'offboardFlows/flowA/auditLog/fake'), { action:'nope' }), 'DENIED');

console.log('\n═══ G. LEGITIMATE ALUMNI ACCESS still works ═══');
await check('alumni: read own profile', () => getDoc(doc(alumni,'alumniProfiles/alumA')), 'ALLOWED');
await check('alumni: update own profile', () => updateDoc(doc(alumni,'alumniProfiles/alumA'), { personalEmail:'new@gmail.com' }), 'ALLOWED');
await check('alumni: read own directory row', () => getDoc(doc(alumni,'alumniDirectory/alumniUid')), 'ALLOWED');
await check('alumni: read open jobs at own company', () => getDocs(query(collection(alumni,'alumniJobs'), where('companyId','==','companyA'), where('status','==','open'))), 'ALLOWED');
await check('alumni: increment referralCount by 1', () => updateDoc(doc(alumni,'alumniJobs/jobA'), { referralCount:3 }), 'ALLOWED');
await check('alumni: CANNOT set referralCount arbitrarily', () => updateDoc(doc(alumni,'alumniJobs/jobA'), { referralCount:9999 }), 'DENIED');
await check('alumni: read published announcements', () => getDocs(query(collection(alumni,'alumniAnnouncements'), where('companyId','==','companyA'), where('status','==','published'))), 'ALLOWED');
await check('alumni: bump announcement readCount', () => updateDoc(doc(alumni,'alumniAnnouncements/annA'), { readCount:2 }), 'ALLOWED');
await check('alumni: create read receipt', () => setDoc(doc(alumni,'alumniAnnouncementReads/r1'), { companyId:'companyA', alumniId:'alumA', announcementId:'annA' }), 'ALLOWED');
await check('alumni: read own doc requests', () => getDoc(doc(alumni,'docRequests/drA')), 'ALLOWED');
await check('alumni: create a doc request', () => setDoc(doc(alumni,'docRequests/dr2'), { companyId:'companyA', alumniId:'alumA', type:'reference' }), 'ALLOWED');
await check('alumni: respond to own gig', () => updateDoc(doc(alumni,'gigRequests/grA'), { status:'accepted', alumniNote:'yes' }), 'ALLOWED');
await check('alumni: read own applications', () => getDoc(doc(alumni,'alumniApplications/aaA')), 'ALLOWED');
await check('alumni: read expert threads at own company', () => getDocs(query(collection(alumni,'knowledgeThreads'), where('companyId','==','companyA'))), 'ALLOWED');
await check('alumni: ESCALATE — read employee offboarding flow', () => getDoc(doc(alumni,'offboardFlows/flowA')), 'DENIED');
await check('alumni: ESCALATE — read exit interview responses', () => getDoc(doc(alumni,'exitInterviewResponses/respA')), 'DENIED');
await check('alumni: ESCALATE — read company invites', () => getDocs(collection(alumni,'invites')), 'DENIED');
await check('alumni: ESCALATE — read another tenant company', () => getDoc(doc(alumni,'companies/companyB')), 'DENIED');
await check('alumni: ESCALATE — move own profile to another tenant', () => updateDoc(doc(alumni,'alumniProfiles/alumA'), { companyId:'companyB' }), 'DENIED');

console.log(`\n═══════ ${passes} passed, ${fails} failed ═══════`);
await testEnv.cleanup();
process.exit(fails > 0 ? 1 : 0);
