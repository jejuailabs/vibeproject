import { NextResponse } from 'next/server';
import { authenticatedUid } from '@/server/firebase';
import { envelopeSchema, getWorkspace, runCommand } from '@/server/workspace';
import { DomainError } from '@/lib/policy';
import { ZodError } from 'zod';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function failure(error:unknown) {
 if(error instanceof DomainError) return NextResponse.json({error:error.message,code:error.code},{status:error.status});
 if(error instanceof ZodError) return NextResponse.json({error:'입력 형식과 길이를 확인해주세요.',code:'VALIDATION_ERROR'},{status:400});
 console.error('workspace_failure',error instanceof Error ? error.name : 'UnknownError');
 return NextResponse.json({error:'서비스 연결을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',code:'SERVICE_ERROR'},{status:503});
}
export async function GET(request:Request) {
 try {
  const user=await authenticatedUid(request); if(!user) return NextResponse.json({error:'Google 로그인이 필요합니다.'},{status:401});
  const cohortId=new URL(request.url).searchParams.get('cohortId')||'';
  const data=await getWorkspace(cohortId,user.uid);
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 } catch(error) {return failure(error);}
}
export async function POST(request:Request) {
 try {
  const user=await authenticatedUid(request);if(!user) return NextResponse.json({error:'Google 로그인이 필요합니다.'},{status:401});
  if(Number(request.headers.get('content-length')||0)>30000) return NextResponse.json({error:'요청이 너무 큽니다.'},{status:413});
  const raw=await request.text();if(raw.length>30000)return NextResponse.json({error:'요청이 너무 큽니다.'},{status:413});
  let parsed;try{parsed=JSON.parse(raw);}catch{return NextResponse.json({error:'잘못된 요청입니다.'},{status:400});}
  const data=envelopeSchema.parse(parsed);
  return NextResponse.json(await runCommand(data.cohortId,user.uid,data.requestId,data.command));
 } catch(error) {return failure(error);}
}
