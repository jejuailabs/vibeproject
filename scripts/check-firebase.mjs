import { applicationDefault } from 'firebase-admin/app';
const credential=applicationDefault();
const {access_token}=await credential.getAccessToken();
const project=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const headers={Authorization:'Bearer '+access_token};
for(const [name,url] of [
 ['auth','https://identitytoolkit.googleapis.com/admin/v2/projects/'+project+'/config'],
 ['google','https://identitytoolkit.googleapis.com/admin/v2/projects/'+project+'/defaultSupportedIdpConfigs/google.com'],
 ['firestore-release','https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore']
]){
 const response=await fetch(url,{headers});const data=await response.json();
 if(name==='auth')console.log(JSON.stringify({name,status:response.status,authorizedDomains:data.authorizedDomains,error:data.error?.message}));
 if(name==='google')console.log(JSON.stringify({name,status:response.status,enabled:data.enabled,error:data.error?.message}));
 if(name==='firestore-release'){
  console.log(JSON.stringify({name,status:response.status,rulesetName:data.rulesetName,error:data.error?.message}));
  if(response.ok&&data.rulesetName){
   const r=await fetch('https://firebaserules.googleapis.com/v1/'+data.rulesetName,{headers});
   const rules=await r.json();console.log(JSON.stringify({name:'firestore-rules',files:rules.source?.files}));
  }
 }
}
