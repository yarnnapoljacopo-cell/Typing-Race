// @refresh reset
/** Local design fixture: real room UI and hook, simulated participants and transport.
 * This HTML entry is intentionally excluded from the production Vite build. */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { GuestProvider } from "../src/lib/guestContext";
import { DarkModeProvider } from "../src/lib/darkModeContext";
import { SkinProvider } from "../src/lib/skinContext";
import { VillainModeProvider } from "../src/lib/villainModeContext";
import { Toaster } from "../src/components/ui/toaster";
import Room from "../src/pages/Room";
import type { RoomState } from "../src/hooks/useSprintRoom";
import "../src/index.css";

const modes = ["regular", "open", "goal", "boss", "kart", "gladiator"] as const;
const query = new URLSearchParams(location.search);
const selected = modes.find(m => m === query.get("mode")) ?? "regular";
query.set("code", `STUDIO-${selected.toUpperCase()}`);
query.set("name", "Alex");
query.set("isCreator", "true");
history.replaceState(null, "", `${location.pathname}?${query}`);
const bossGoal = [2500, 5000, 10000, 20000].includes(Number(query.get("bossGoal"))) ? Number(query.get("bossGoal")) : 2500;
let state: RoomState = { code: query.get("code")!, status:"waiting", durationMinutes:25, countdownDelayMinutes:0, mode:selected, wordGoal:selected === "goal" ? 500 : null, bossWordGoal:selected === "boss" ? bossGoal : null, bossTotalWords:0, deathModeWpm:null, gladiatorDeathGap:selected === "gladiator" ? 400 : null, timeLeft:1500, countdownTimeLeft:null, creatorXp:0, hostCarSkin:null, hostRoadSkin:null, starActiveIds:[], participants:[
  { id:"alex", name:"Alex", wordCount:0, wpm:0, isCreator:true, role:"writer" },
  { id:"morgan", name:"Morgan", wordCount:0, wpm:0, isCreator:false, role:"writer" },
  ...(selected === "gladiator" ? [] : [{ id:"jules", name:"Jules", wordCount:0, wpm:0, isCreator:false, role:"writer" as const }]),
] };
let activeSocket: PreviewSocket | null = null;
let items = ["mushroom", "red_shell", "star"];
const nativeFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
    // No real account data or persistent server mutations in the fixture.
    const body = url.pathname.includes("/writing") ? (init?.method === "PUT" ? { ok:true } : null) : url.pathname.includes("bets") ? { totalPot:0, bettorCount:0, myBet:null, status:"open" } : {};
    return new Response(JSON.stringify(body), { status:200, headers:{ "Content-Type":"application/json" } });
  }
  return nativeFetch(input, init);
}) as typeof fetch;
class PreviewSocket {
  static OPEN = 1; readyState=0;
  onopen: (()=>void) | null=null;
  onmessage: ((event:{data:string})=>void) | null=null;
  onclose: ((event:{code:number})=>void) | null=null;
  onerror: (()=>void) | null=null;
  constructor() { activeSocket=this; queueMicrotask(()=>{ this.readyState=1; this.onopen?.(); }); }
  emit(data:unknown) { this.onmessage?.({data:JSON.stringify(data)}); }
  publish() { this.emit({type:"room_state",room:state}); }
  duel() { const mine=state.participants[0].wordCount, other=state.participants[1].wordCount; this.emit({type:"gladiator_state",myHp:Math.max(300,1000-Math.max(0,other-mine)*2),opponentHp:Math.max(300,1000-Math.max(0,mine-other)*2),myWordCount:mine,opponentWordCount:other,gap:Math.abs(mine-other),iAhead:mine>=other,deathGap:400,myBuffs:mine>50?["momentum"]:[],opponentBuffs:[]}); }
  send(raw:string) { const data=JSON.parse(raw);
    if(data.type==="join_room") { this.emit({type:"joined",participantId:"alex",room:state,kartItems:state.status==="running"?items:[],restoredWordCount:0}); if(selected==="gladiator") this.duel(); }
    if(data.type==="ping") this.emit({type:"pong"});
    if(data.type==="start_sprint") { state={...state,status:"running",timeLeft:1500}; this.publish(); if(selected==="kart") this.emit({type:"kart_inventory",items}); if(selected==="gladiator") this.duel(); }
    if(data.type==="text_update" && state.status==="running") { state={...state,participants:state.participants.map(p=>p.id==="alex"?{...p,wordCount:data.netWordCount,wpm:42}:p)}; state.bossTotalWords=state.participants.reduce((n,p)=>n+p.wordCount,0); this.publish(); if(selected==="gladiator") this.duel(); }
    if(data.type==="restart_sprint") { items=["mushroom","red_shell","star"]; state={...state,status:"waiting",durationMinutes:data.durationMinutes,timeLeft:data.durationMinutes*60,bossTotalWords:0,starActiveIds:[],participants:state.participants.map(p=>({...p,wordCount:0,kartCarOffset:0}))}; this.publish(); }
    if(data.type==="end_sprint") { state={...state,status:"finished"}; this.emit({type:"sprint_ended",results:[...state.participants].sort((a,b)=>b.wordCount-a.wordCount)}); if(selected==="gladiator") this.emit({type:"gladiator_execution",outcome:state.participants[0].wordCount===state.participants[1].wordCount?"draw":state.participants[0].wordCount>state.participants[1].wordCount?"victory":"defeat",myHp:Math.max(300,1000-Math.max(0,state.participants[1].wordCount-state.participants[0].wordCount)*2),opponentHp:Math.max(300,1000-Math.max(0,state.participants[0].wordCount-state.participants[1].wordCount)*2),myWordCount:state.participants[0].wordCount,opponentWordCount:state.participants[1].wordCount,stats:{closestGap:0,maxGap:20,leadChanges:1,timeInDangerMs:0,endedByExecution:false,totalHpHealed:{}}}); }
    if(data.type==="use_item") { items=items.filter((item,index)=>index!==items.indexOf(data.item)); const targetId=data.item==="red_shell"?"morgan":"alex"; const effect=data.item==="star"?"star":data.item==="red_shell"?"blur_counter":"car_add"; this.emit({type:"item_used",item:data.item,sourceId:"alex",sourceName:"Alex",targetId,targetName:targetId==="alex"?"Alex":"Morgan",effect,amount:200,duration:data.item==="red_shell"?20000:30000}); this.emit({type:"kart_inventory",items}); if(data.item==="star"){state={...state,starActiveIds:["alex"]};this.emit({type:"item_effect_start",effect:"star",duration:30000});}else if(data.item==="mushroom") state={...state,participants:state.participants.map(p=>p.id===targetId?{...p,kartCarOffset:(p.kartCarOffset??0)+200}:p)}; this.publish(); }
  }
  close(code=1000){this.readyState=3;this.onclose?.({code});}
}
window.WebSocket=PreviewSocket as unknown as typeof WebSocket;
setInterval(()=>{if(state.status!=="running")return;state={...state,timeLeft:Math.max(0,(state.timeLeft??1500)-1)};activeSocket?.publish();},1000);
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function simulateEvent() {
  if (!activeSocket || state.status !== "running") return;
  if(selected === "kart") activeSocket.emit({type:"item_effect_start",effect:"blur_counter",duration:5000,sourceName:"Morgan"});
  else {
    state={...state,participants:state.participants.map(p=>p.id==="morgan"?{...p,wordCount:p.wordCount+(selected==="boss"?bossGoal/4:100)}:p)};
    state.bossTotalWords=state.participants.reduce((sum,p)=>sum+p.wordCount,0);
    activeSocket.publish();
    if(selected==="gladiator") activeSocket.duel();
    if(selected==="boss" && state.bossTotalWords >= bossGoal) activeSocket.send(JSON.stringify({type:"end_sprint"}));
  }
}
function Preview(){const [dark,setDark]=useState(document.documentElement.classList.contains("dark"));return <>
  <div className="preview-controls"><span><strong>Room preview</strong> · Simulated participants</span><label>Mode <select aria-label="Preview mode" value={selected} onChange={e=>{location.href=`?mode=${e.target.value}`;}}>{modes.map(mode=><option key={mode} value={mode}>{mode[0].toUpperCase()+mode.slice(1)}</option>)}</select></label><button onClick={()=>{document.documentElement.classList.toggle("dark");setDark(!dark);}}>{dark?"Light":"Dark"}</button><a href="/portal">Back to app</a></div>
  {["boss","gladiator","kart"].includes(selected) && <div className="preview-events">{selected==="boss" && <label>Boss <select aria-label="Preview boss" value={bossGoal} onChange={e=>{location.href=`?mode=boss&bossGoal=${e.target.value}`;}}>{[2500,5000,10000,20000].map((goal,index)=><option key={goal} value={goal}>{["Shadow Imp","Dark Wraith","Void Tyrant","Eldritch Horror"][index]}</option>)}</select></label>}<button onClick={simulateEvent}>{selected==="kart"?"Simulate shell hit":selected==="boss"?"Simulate team damage":"Simulate opponent writing"}</button><span>Start the sprint first · preview only</span></div>}
  <Room/><Toaster/>
  <style>{`.preview-events{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:8px 16px;font-size:11px;background:hsl(var(--muted))}.preview-events select,.preview-events button{padding:6px;border:1px solid hsl(var(--border));border-radius:5px;background:hsl(var(--card))}.preview-events span{color:hsl(var(--muted-foreground))}.preview-controls{height:44px;display:flex;align-items:center;gap:16px;padding:0 24px;background:hsl(var(--foreground));color:hsl(var(--background));font:11px var(--font-sans)}.preview-controls>span{margin-right:auto}.preview-controls label{display:flex;align-items:center;gap:7px}.preview-controls select{background:hsl(var(--background));color:hsl(var(--foreground));border-radius:4px;padding:4px}.preview-controls a{text-decoration:underline}.studio-room{height:calc(100dvh - 44px)}@media(max-width:600px){.preview-controls{padding:0 10px;gap:9px}.preview-controls>span{font-size:0}.preview-controls strong{font-size:10px}.studio-room{height:auto}}`}</style>
</>;}
createRoot(document.getElementById("root")!).render(<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PK}><QueryClientProvider client={client}><GuestProvider><DarkModeProvider><SkinProvider><VillainModeProvider><TooltipProvider><Preview/></TooltipProvider></VillainModeProvider></SkinProvider></DarkModeProvider></GuestProvider></QueryClientProvider></ClerkProvider>);
