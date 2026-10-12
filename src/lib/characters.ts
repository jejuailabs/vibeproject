import urls from './character-assets.json';
export const characterIds = ["maker-violet","maker-coral","maker-mint","maker-blue","maker-amber","maker-rose","maker-cyan","maker-lime","maker-pearl","maker-teal","maker-ruby","maker-indigo","maker-peach","maker-emerald","maker-gold","maker-graphite"] as const;
export type CharacterId = typeof characterIds[number];
const details = [
  {
    "id": "maker-violet",
    "name": "바이올렛",
    "color": "#9b65ed"
  },
  {
    "id": "maker-coral",
    "name": "코랄",
    "color": "#f07756"
  },
  {
    "id": "maker-mint",
    "name": "민트",
    "color": "#93c9b0"
  },
  {
    "id": "maker-blue",
    "name": "블루",
    "color": "#658bef"
  },
  {
    "id": "maker-amber",
    "name": "앰버",
    "color": "#dea546"
  },
  {
    "id": "maker-rose",
    "name": "로즈",
    "color": "#d996b5"
  },
  {
    "id": "maker-cyan",
    "name": "시안",
    "color": "#64caed"
  },
  {
    "id": "maker-lime",
    "name": "라임",
    "color": "#b5d869"
  },
  {
    "id": "maker-pearl",
    "name": "펄",
    "color": "#d9d4c6"
  },
  {
    "id": "maker-teal",
    "name": "틸",
    "color": "#52b5a6"
  },
  {
    "id": "maker-ruby",
    "name": "루비",
    "color": "#c1587b"
  },
  {
    "id": "maker-indigo",
    "name": "인디고",
    "color": "#8877d4"
  },
  {
    "id": "maker-peach",
    "name": "피치",
    "color": "#f4ad89"
  },
  {
    "id": "maker-emerald",
    "name": "에메랄드",
    "color": "#63ae86"
  },
  {
    "id": "maker-gold",
    "name": "골드",
    "color": "#d2b16a"
  },
  {
    "id": "maker-graphite",
    "name": "그라파이트",
    "color": "#aaa5c3"
  }
] as const;
export const characters = details.map(item=>({...item,...urls[item.id]}));
export function isCharacterId(value:string):value is CharacterId { return (characterIds as readonly string[]).includes(value); }
export function characterFor(member?:{id:string;avatar?:string}) {
 if(member?.avatar && isCharacterId(member.avatar)) return characters.find(c=>c.id===member.avatar)!;
 const sample:Record<string,number>={min:0,jun:1,seo:2,ha:3};
 const seed=member && Object.hasOwn(sample,member.id)?sample[member.id]:Array.from(member?.id||'maker').reduce((n,c)=>n+c.charCodeAt(0),0)%characters.length;
 return characters[seed];
}
