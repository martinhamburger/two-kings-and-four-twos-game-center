import {tileLabel,tileType} from '@/lib/mahjong/engine';
import {typeName} from '@/lib/mahjong/solver';
import {tileFaceSrc} from '@/lib/mahjong/art';
import '@/app/mahjong/tile-3d.css';

export type MahjongTilePresentation='ui'|'standing'|'flat';
export type MahjongTileSeat='south'|'east'|'north'|'west';

type MahjongTileProps={
 tile?:number;
 hidden?:boolean;
 small?:boolean;
 selected?:boolean;
 onClick?:()=>void;
 drawn?:boolean;
 wildcard?:number;
 represented?:boolean;
 highlightType?:number|null;
 presentation?:MahjongTilePresentation;
 seat?:MahjongTileSeat;
};

export function MahjongTile({tile,hidden=false,small=false,selected=false,onClick,drawn=false,wildcard=-1,represented=false,highlightType=null,presentation='ui',seat='south'}:MahjongTileProps){
 // Concealed tiles never resolve an identity, even when a caller has one.
 const type=!hidden&&tile!==undefined?tileType(tile):null;
 const wild=type!==null&&(represented||type===wildcard);
 const white=type===33&&wildcard>=0&&!represented;
 const matching=type!==null&&highlightType===type;
 const states=[hidden&&'is-back',small&&'is-small',selected&&'is-selected',drawn&&'is-drawn',wild&&'is-wild',white&&'is-white-as',matching&&'is-matching'].filter(Boolean).join(' ');
 const label=hidden?'牌背':type===null?'麻将牌':`${tileLabel(tile!)}${wild?'（赖子）':white?'，代 '+typeName(wildcard):''}`;
 const face=<>{type!==null&&<img className="mj-face" src={tileFaceSrc(type)} alt="" draggable={false}/>}{wild&&<em className="tile-mark">赖</em>}{white&&<em className="tile-white-as">{typeName(wildcard)}</em>}</>;

 if(presentation!=='ui'){
  const className=`mj-solid is-${presentation} ${states}`;
  const content=<span className="mj-solid-body" aria-hidden="true">
   <span className="mj-solid-face mj-solid-face--front"><span className="mj-solid-front-content">{face}</span></span>
   <span className="mj-solid-face mj-solid-face--back"/>
   <span className="mj-solid-face mj-solid-face--top"/>
   <span className="mj-solid-face mj-solid-face--bottom"/>
   <span className="mj-solid-face mj-solid-face--left"/>
   <span className="mj-solid-face mj-solid-face--right"/>
  </span>;
  return onClick?<button type="button" className={className} data-seat={seat} onClick={onClick} aria-label={label} aria-pressed={selected}>{content}</button>:<span className={className} data-seat={seat} aria-label={label}>{content}</span>;
 }

 const suit=type===null?'':`suit-${type>=27?type>=31?4:3:Math.floor(type/9)}`;
 const className=`mj-tile mj-tile--ui ${suit} ${states}`;
 const content=hidden?<img className="mj-face" src="/tiles/Back.svg" alt="" draggable={false}/>:face;
 return onClick?<button type="button" className={`${className} mj-tile-button`} onClick={onClick} aria-label={label} aria-pressed={selected}><span className="mj-tile-skin" aria-hidden="true">{content}</span><span className="mj-tile-hit" aria-hidden="true"/></button>:<span className={className} aria-label={label}>{content}</span>;
}
