"use client";
import {createPortal} from 'react-dom';
import {useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX,ChevronDown,Music2,Mic2,MousePointerClick,Play} from 'lucide-react';
import {Button} from './ui/button';
import {Popover,PopoverContent,PopoverTrigger} from './ui/popover';
import {Switch} from './ui/switch';
import {TableAudio,type AudioStatus} from '@/lib/audio/player';
import {DEFAULT_SOUND,SOUND_KEY,TRACKS,soundPreferences,type SoundPreferences} from '@/lib/audio/preferences';
import {actionWindow,collectSounds,type SoundFrame} from '@/lib/audio/events';
import {EMOTE_SOUND_EVENT,getEmote,type EmoteSoundEvent} from '@/lib/emotes';
import {useEmotePreferences} from './emote-preferences';

export function TableSound({room,userId,seconds,controlsTarget}:{room:SoundFrame|null;userId:string;seconds:number;controlsTarget?:HTMLElement|null}){
 const {prefs:emotePrefs,update:updateEmotes}=useEmotePreferences(userId);
 const [prefs,setPrefs]=useState<SoundPreferences>({...DEFAULT_SOUND}),[saved,setSaved]=useState(false),[open,setOpen]=useState(false),[status,setStatus]=useState<AudioStatus>({unlocked:false,music:'未开启',voice:'设备普通话',lastSpeech:''});
 const audio=useRef<TableAudio|null>(null),previous=useRef<SoundFrame|null>(null),warning=useRef(''),settings=useRef(prefs),currentRoom=useRef(room);settings.current=prefs;currentRoom.current=room;
 const inRoom=!!room&&room.game.phase!=='closed';
 useEffect(()=>{try{const raw=localStorage.getItem(SOUND_KEY);if(raw){setPrefs(soundPreferences(JSON.parse(raw)));setSaved(true);}}catch{}const player=new TableAudio(setStatus);audio.current=player;
  const select=(e:Event)=>{if((e.target as HTMLElement).closest?.('.hand-card,button.mj-tile'))player.effect('select');};document.addEventListener('pointerdown',select);const visibility=()=>{previous.current=null;};document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('pointerdown',select);document.removeEventListener('visibilitychange',visibility);player.dispose();audio.current=null;};
 },[]);
 useEffect(()=>{audio.current?.configureEmotes(emotePrefs.sound);},[emotePrefs.sound]);
 useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent<EmoteSoundEvent>).detail;if(detail?.code!==currentRoom.current?.code)return;const emote=getEmote(detail.emoteId);if(emote?.enabled)audio.current?.playEmote(emote.audio,detail.expires);};window.addEventListener(EMOTE_SOUND_EVENT,receive);return()=>window.removeEventListener(EMOTE_SOUND_EVENT,receive)},[]);
 useEffect(()=>{audio.current?.configure(prefs,inRoom);if(saved)try{localStorage.setItem(SOUND_KEY,JSON.stringify(prefs));}catch{}},[prefs,saved,inRoom]);
 useEffect(()=>{if(!saved||!prefs.enabled||status.unlocked||!inRoom)return;const unlock=(e:Event)=>{if(e.type==='keydown'&&!['Enter',' '].includes((e as KeyboardEvent).key))return;void audio.current?.unlock();};document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};},[saved,prefs.enabled,status.unlocked,inRoom]);
 useEffect(()=>{if(!room){previous.current=null;return;}if(previous.current&&(previous.current.code!==room.code||previous.current.game.round!==room.game.round))audio.current?.resetQueue();const cues=collectSounds(previous.current,room,userId);previous.current=room;if(!document.hidden)audio.current?.play(cues);},[room,userId]);
 useEffect(()=>{if(!room)return;const id=actionWindow(room.game,userId);if(id&&seconds>0&&seconds<=5&&warning.current!==id){warning.current=id;audio.current?.effect('tick');}},[room,seconds,userId]);
 async function enable(){const next={...settings.current,enabled:true};setPrefs(next);setSaved(true);audio.current?.configure(next,!!currentRoom.current&&currentRoom.current.game.phase!=='closed');await audio.current?.unlock();}
 function change(patch:Partial<SoundPreferences>){const next={...settings.current,...patch};setPrefs(next);setSaved(true);audio.current?.configure(next,inRoom);}
 const running=status.unlocked&&prefs.enabled,track=TRACKS.find(t=>t.id===prefs.track)!;
 const controls=<div className="sound-control"><Button variant="ghost" className={`sound-launch ${inRoom&&!running?'is-invite':''}`} aria-label={running?'声音设置':'开启声音'} onClick={()=>{if(!running)void enable();else setOpen(true)}}>{running?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{running?'声音':'开启声音'}</span></Button><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="sound-more" aria-label="展开声音设置"><ChevronDown size={14}/></Button></PopoverTrigger><PopoverContent align="end" className="sound-panel"><div className="sound-panel-title"><div><b>牌桌声音</b><span>{running?'轻一点，刚刚好':'由你决定何时开声'}</span></div><Button size="sm" variant="outline" onClick={()=>running?change({enabled:false}):void enable()}>{running?'全部静音':'开启声音'}</Button></div>
 <div className="sound-track"><Music2 size={20}/><div><b>{track.label}</b><span>{track.detail} · {status.music}</span></div></div>
 <label className="sound-track-select">背景音乐<select aria-label="背景音乐曲目" value={prefs.track} onChange={e=>change({track:e.target.value})}>{TRACKS.map(t=><option key={t.id} value={t.id}>{t.label} · {t.title}</option>)}</select></label>
 {([{key:'music',volume:'musicVolume',label:'背景音乐',Icon:Music2},{key:'voice',volume:'voiceVolume',label:'普通话播报',Icon:Mic2},{key:'effects',volume:'effectsVolume',label:'操作音效',Icon:MousePointerClick}] as const).map(({key,volume,label,Icon})=><div className="sound-channel" key={key}><div><label htmlFor={'sound-'+key}><Icon size={16}/>{label}</label><Switch id={'sound-'+key} checked={prefs[key]} onCheckedChange={checked=>change({[key]:checked})} aria-label={label}/></div><div className="sound-volume"><input type="range" aria-label={label+'音量'} min="0" max="100" value={prefs[volume]} onChange={e=>change({[volume]:Number(e.target.value)})}/><output>{prefs[volume]}%</output></div></div>)}
 <div className="sound-channel"><div><label htmlFor="sound-emotes">表情声音</label><Switch id="sound-emotes" checked={emotePrefs.sound} onCheckedChange={sound=>updateEmotes({sound})}/></div></div>
 <Button variant="outline" className="sound-test" onClick={()=>{void enable();audio.current?.preview();}}><Play size={15}/>试播语音与音效</Button><p className="sound-voice-status">{status.voice}</p>{status.lastSpeech&&<p className="sound-last">最近播报：{status.lastSpeech}</p>}
 <details className="sound-credits"><summary>音乐来源与许可</summary><p>{TRACKS.map(t=><span key={t.id}><a href={t.source} target="_blank" rel="noreferrer">{t.title}</a><br/></span>)}Kevin MacLeod · incompetech.com<br/><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · 音频已压缩，曲目未改编。<br/>播报使用设备语音合成；操作音效为本站合成。</p></details>
 </PopoverContent></Popover></div>;
 return controlsTarget===undefined?controls:controlsTarget?createPortal(controls,controlsTarget):null;
}
