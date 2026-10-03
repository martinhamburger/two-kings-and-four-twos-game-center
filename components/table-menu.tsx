"use client";
import {useState,type ReactNode} from 'react';
import {ArrowLeft,Copy,Menu} from 'lucide-react';
import {Sheet,SheetTrigger,SheetContent,SheetTitle,SheetDescription,SheetClose} from './ui/sheet';
import {Button} from './ui/button';
import {Switch} from './ui/switch';
import {RoomCodeCopy} from './room-code-copy';
import {useEmotePreferences} from './emote-preferences';

/** Match the Mahjong drawer while preserving each game's actions and permissions. */
export function TableMenu({title,code,subtitle,userId,onBack,onInvite,inviteHint,sound,children}:{title:string;code:string;subtitle:string;userId:string;onBack:()=>void;onInvite?:()=>void;inviteHint?:string;sound:(target:HTMLElement|null)=>ReactNode;children:ReactNode}){
 const [open,setOpen]=useState(false),[target,setTarget]=useState<HTMLDivElement|null>(null),{prefs,update}=useEmotePreferences(userId);
 return <>{sound(target)}<Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><button type="button" className="table-menu-toggle" aria-label="牌桌菜单"><Menu size={23}/><span>菜单</span></button></SheetTrigger><SheetContent side="left" className="table-menu-drawer" showCloseButton={false}><div className="table-menu-panel"><header><SheetTitle>{title}</SheetTitle><SheetDescription>牌桌菜单</SheetDescription><SheetClose className="table-menu-close" aria-label="收起牌桌菜单"><ArrowLeft size={20}/></SheetClose><span>房间 {code}<RoomCodeCopy code={code} compact/></span><small>{subtitle}</small></header><Button variant="ghost" onClick={()=>{setOpen(false);onBack()}}><ArrowLeft size={17}/>返回大厅（保留座位）</Button>{onInvite&&<Button variant="ghost" onClick={onInvite}><Copy size={17}/>邀请朋友</Button>}{inviteHint&&<p role="status">{inviteHint}</p>}<div ref={setTarget}/><div className="table-menu-settings"><label><span>牌桌动画与特效</span><Switch aria-label="牌桌动画与特效" checked={prefs.effects} onCheckedChange={effects=>update({effects})}/></label><label><span>其他玩家的动态表情</span><Switch aria-label="其他玩家的动态表情" checked={prefs.animateOthers} onCheckedChange={animateOthers=>update({animateOthers})}/></label></div>{children}</div></SheetContent></Sheet></>;
}
