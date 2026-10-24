'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Check,ImagePlus,LoaderCircle,X} from 'lucide-react';
import {characterFor,characters,isPhotoAvatar,type CharacterId} from '@/lib/characters';
import type {Member} from '@/lib/types';
export const MAX_PHOTO_BYTES=3*1024*1024;
const photoTypes=['image/png','image/jpeg','image/webp'];
export type ProfileChoice={name:string;avatar?:CharacterId;photo?:File};
// Nickname plus image: one of the 16 characters or the member's own photo.
export function ProfileEditor({open,me,busy,error,onClose,onSave}:{open:boolean;me:Member;busy:boolean;error:string;onClose:()=>void;onSave:(choice:ProfileChoice)=>Promise<boolean>}) {
 const ref=useRef<HTMLDialogElement>(null),fileRef=useRef<HTMLInputElement>(null);
 const current=characterFor(me);
 const [name,setName]=useState(me.name);
 const [chosen,setChosen]=useState<CharacterId|'photo'>(isPhotoAvatar(me.avatar)?'photo':current.id);
 const [photo,setPhoto]=useState<{url:string;file?:File}|null>(isPhotoAvatar(me.avatar)?{url:me.avatar}:null);
 const [problem,setProblem]=useState('');
 useEffect(()=>{if(open){setName(me.name);setChosen(isPhotoAvatar(me.avatar)?'photo':characterFor(me).id);setPhoto(isPhotoAvatar(me.avatar)?{url:me.avatar}:null);setProblem('');if(!ref.current?.open)ref.current?.showModal();}else ref.current?.close();
 // Only opening resets the form; the workspace refreshing in the background must not wipe what is being typed.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);
 function pick(file?:File){
  if(!file)return;
  if(!photoTypes.includes(file.type)){setProblem('PNG, JPG, WebP 사진만 올릴 수 있어요.');return;}
  if(file.size>MAX_PHOTO_BYTES){setProblem('사진은 3MB 이하로 올려주세요.');return;}
  setProblem('');setPhoto({url:URL.createObjectURL(file),file});setChosen('photo');
 }
 const character=characters.find(c=>c.id===(chosen==='photo'?current.id:chosen))!;
 const trimmed=name.replace(/\s+/g,' ').trim();
 return <dialog ref={ref} className="modal character-modal" aria-labelledby="character-title" onCancel={onClose}>
 <div className="modal-heading"><div><span className="mini-label">MY PROFILE · NICKNAME & IMAGE</span><h2 id="character-title">내 프로필</h2></div><button className="icon-button" aria-label="프로필 편집 닫기" onClick={onClose}><X size={21}/></button></div>
 <form onSubmit={async e=>{e.preventDefault();if(!trimmed){setProblem('닉네임을 적어주세요.');return;}
  const choice:ProfileChoice=chosen==='photo'?{name:trimmed,...(photo?.file?{photo:photo.file}:{})}:{name:trimmed,avatar:chosen};
  if(await onSave(choice))onClose();}}>
 <div className="character-body">
 <div className={'character-preview'+(chosen==='photo'?' photo':'')} style={{'--character-color':character.color} as CSSProperties}><span className="character-preview-word" aria-hidden="true">MAKER</span><img src={chosen==='photo'&&photo?photo.url:character.image} alt={chosen==='photo'?'내 사진 미리보기':character.name+' 캐릭터 미리보기'}/><div><span>YOUR NEXT CHAPTER</span><h3>{trimmed||'닉네임'}</h3><p>{chosen==='photo'?'내 사진':character.name} · 당신의 생각에, 당신만의 색을.</p></div></div>
 <div>
 <label className="profile-name"><span>닉네임</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={20} required autoComplete="nickname" placeholder="1~20자"/><small>{trimmed.length}/20 · 다른 사람과 같은 닉네임은 쓸 수 없어요.</small></label>
 <p className="character-description">사진을 올리거나 캐릭터를 골라주세요. 프로필·팀 라인업·대화에 함께 적용돼요.</p>
 <div className="profile-upload"><button type="button" className="secondary-button" onClick={()=>fileRef.current?.click()}><ImagePlus size={15}/>내 사진 올리기</button><small>PNG·JPG·WebP, 3MB 이하</small><input ref={fileRef} type="file" accept={photoTypes.join(',')} className="profile-file" aria-label="내 사진 파일" onChange={e=>{pick(e.target.files?.[0]);e.target.value='';}}/></div>
 <fieldset className="character-grid"><legend className="sr-only">프로필 이미지</legend>
 {photo&&<label className={'character-option photo '+(chosen==='photo'?'chosen':'')}><input type="radio" name="character" value="photo" checked={chosen==='photo'} onChange={()=>setChosen('photo')} aria-label="내 사진"/><img src={photo.url} alt=""/>{chosen==='photo'&&<span className="character-selected"><Check size={12}/></span>}<strong>내 사진</strong></label>}
 {characters.map((c,i)=><label className={'character-option '+(chosen===c.id?'chosen':'')} key={c.id} style={{'--character-color':c.color} as CSSProperties}><input type="radio" name="character" value={c.id} checked={chosen===c.id} onChange={()=>setChosen(c.id)} aria-label={c.name}/><img src={c.thumbnail} alt="" loading="lazy"/><span className="character-option-number">{String(i+1).padStart(2,'0')}</span>{chosen===c.id&&<span className="character-selected"><Check size={12}/></span>}<strong>{c.name}</strong></label>)}
 </fieldset></div>
 </div>
 {(problem||error)&&<p className="form-error" role="alert">{problem||error}</p>}
 <div className="modal-footer"><span>언제든 다시 바꿀 수 있어요.</span><button className="primary-button" type="submit" disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>}프로필 저장</button></div>
 </form></dialog>;
}
