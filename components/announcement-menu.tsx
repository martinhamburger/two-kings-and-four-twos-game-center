"use client";
import {Megaphone} from 'lucide-react';
import {useClub} from './club-provider';
import {Button} from './ui/button';
import {Popover,PopoverContent,PopoverTrigger} from './ui/popover';

export function AnnouncementMenu(){
 const {lobby,loadLobby}=useClub();
 const announcement=lobby?.config.announcement.trim();
 return <Popover onOpenChange={open=>{if(open)void loadLobby(true).catch(()=>{});}}><PopoverTrigger asChild><Button size="sm" variant="ghost" className="club-announcement-link"><Megaphone size={19}/><span>公告</span></Button></PopoverTrigger><PopoverContent align="end" sideOffset={10} className="club-announcement-popover" aria-label="公告内容"><h2><Megaphone size={21}/>公告</h2><p>{announcement||'无公告'}</p></PopoverContent></Popover>;
}
