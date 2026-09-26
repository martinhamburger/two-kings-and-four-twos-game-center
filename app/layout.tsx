import type { Metadata } from "next";
import "./globals.css";
import "./table-light.css";
import "./lobby.css";
import "./avatar.css";
import {SiteNavigation} from "@/components/site-navigation";
import {ClubProvider} from "@/components/club-provider";
export const metadata: Metadata = {title:"娱乐中心 · 好友游戏室",description:"开个房间，和朋友来一局斗地主、麻将或 4–10 人德州扑克。",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><SiteNavigation><ClubProvider>{children}</ClubProvider></SiteNavigation></body></html>}
