"use client";
import {PlayerAvatar} from './player-avatar';
import type {ReactNode} from 'react';
import {ArrowRight,Info,Users} from 'lucide-react';
import {useClub,HistoryEntry} from './club-provider';
import {FriendsPanel} from './friends-panel';
import {Button} from './ui/button';
import {Input} from './ui/input';
type Game='landlord'|'mahjong'|'holdem';
const copy={
 landlord:{number:'01',name:'斗地主',subtitle:'三人成局，默契加倍。',tags:['3 人好友桌','经典 / 装备赛制'],footer:'叫分 · 配合 · 出牌'},
 mahjong:{number:'02',name:'麻将',subtitle:'四个人，按自己的规矩玩。',tags:['4 人好友桌','136 张 · 无花牌'],footer:'吃 · 碰 · 杠 · 胡'},
 holdem:{number:'03',name:'德州扑克',subtitle:'一份好牌，一桌朋友。',tags:['4–10 人好友桌','无限注 · 独立筹码'],footer:'跟注 · 加注 · 摊牌'},
};
export function GameLobby({game,actions,art,code,onCode,onJoin,busy}:{game:Game;actions:ReactNode;art:ReactNode;code:string;onCode:(value:string)=>void;onJoin:()=>void;busy:boolean}){
 const {user,lobby}=useClub(),c=copy[game];if(!user)return null;
 return <main className={`game-lobby lobby-${game}`}><section className="game-lobby-main"><header className="game-lobby-heading"><span>好 友 游 戏 室 / {c.number}</span><h1>今天，和谁一桌？</h1><p>开一桌新的，或者加入朋友的房间。</p></header>
 {lobby?.config.announcement&&<div className="game-lobby-notice"><Info size={17}/><span>{lobby.config.announcement}</span></div>}
 <section className="lobby-feature"><div className="lobby-feature-copy"><span className="lobby-feature-kicker">{c.number} / 好友牌桌</span><h2>{c.name}</h2><p>{c.subtitle}</p><div className="lobby-feature-tags"><span><Users size={15}/>{c.tags[0]}</span><span>{c.tags[1]}</span></div><div className="lobby-feature-actions">{actions}</div></div><div className={`lobby-feature-art art-${game}`} aria-hidden="true">{art}</div><footer><span>{c.footer}</span><span>输赢是过程，开心是正事。</span></footer></section>
 <section className="lobby-join"><div><h3>朋友已经开桌了？</h3><p>输入 6 位房间号，马上入座。</p></div><form onSubmit={e=>{e.preventDefault();onJoin()}}><Input aria-label="6 位房间号" placeholder="6 位房间号" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>onCode(e.target.value.replace(/\D/g,''))} required/><Button type="submit" disabled={busy||code.length!==6}>加入房间<ArrowRight size={17}/></Button></form></section>
 </section><aside className="game-lobby-aside"><section className="lobby-profile"><PlayerAvatar className="lobby-profile-avatar" name={user.name} userId={user.id}/><div><h3>{user.name}</h3><p>今天也来一场好牌</p></div></section><HistoryEntry game={game}/><FriendsPanel/><p className="lobby-aside-note">好友在线状态会定期更新。</p></aside></main>;
}
