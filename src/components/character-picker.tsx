'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Check,LoaderCircle,X} from 'lucide-react';
import {characters,type CharacterId} from '@/lib/characters';
export function CharacterPicker({open,current,busy,error,onClose,onSave}:{open:boolean;current:CharacterId;busy:boolean;error:string;onClose:()=>void;onSave:(id:CharacterId)=>Promise<boolean>}) {
 const ref=useRef<HTMLDialogElement>(null);
 const [chosen,setChosen]=useState<CharacterId>(current);
 useEffect(()=>{if(open){setChosen(current);if(!ref.current?.open)ref.current?.showModal();}else ref.current?.close();},[open,current]);
 const character=characters.find(c=>c.id===chosen)!;
 return <dialog ref={ref} className="modal character-modal" aria-labelledby="character-title" onCancel={onClose}>
 <div className="modal-heading"><div><span className="mini-label">CHOOSE YOUR MAKER · 16 CHARACTERS</span><h2 id="character-title">나를 표현하는 캐릭터</h2></div><button className="icon-button" aria-label="캐릭터 선택 닫기" onClick={onClose}><X size={21}/></button></div>
 <form onSubmit={async e=>{e.preventDefault();if(await onSave(chosen))onClose();}}>
 <div className="character-body">
 <div className="character-preview" style={{'--character-color':character.color} as CSSProperties}><span className="character-preview-word" aria-hidden="true">MAKER</span><img src={character.image} alt={character.name+' 캐릭터 미리보기'}/><div><span>YOUR NEXT CHAPTER</span><h3>{character.name}</h3><p>당신의 생각에, 당신만의 색을.</p></div></div>
 <div><p className="character-description">마음에 드는 캐릭터를 골라주세요.<br/>프로필·팀 라인업·대화에 함께 적용돼요.</p><fieldset className="character-grid"><legend className="sr-only">캐릭터 16종</legend>{characters.map((c,i)=><label className={'character-option '+(chosen===c.id?'chosen':'')} key={c.id} style={{'--character-color':c.color} as CSSProperties}><input type="radio" name="character" value={c.id} checked={chosen===c.id} onChange={()=>setChosen(c.id)} aria-label={c.name}/><img src={c.thumbnail} alt="" loading="lazy"/><span className="character-option-number">{String(i+1).padStart(2,'0')}</span>{chosen===c.id&&<span className="character-selected"><Check size={12}/></span>}<strong>{c.name}</strong></label>)}</fieldset></div>
 </div>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="modal-footer"><span>언제든 다시 바꿀 수 있어요.</span><button className="primary-button" type="submit" disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>}이 캐릭터로 저장</button></div>
 </form></dialog>;
}
