import { NextResponse } from 'next/server';
import { authenticatedUid } from '@/server/firebase';
import { enroll } from '@/server/workspace';
import { DomainError } from '@/lib/policy';
export const runtime='nodejs';
export async function POST(request:Request) {
 try {
  const user=await authenticatedUid(request);
  if(!user)return NextResponse.json({error:'Google 로그인이 필요합니다.'},{status:401});
  await enroll(process.env.NEXT_PUBLIC_COHORT_ID||'vibe-2026-01',user);
  return NextResponse.json({ok:true});
 } catch(error) {
  if(error instanceof DomainError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});
  return NextResponse.json({error:'Firebase 연결 또는 기수 설정을 확인해주세요.'},{status:503});
 }
}
