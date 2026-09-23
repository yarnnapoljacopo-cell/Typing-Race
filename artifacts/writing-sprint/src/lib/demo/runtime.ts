import { DEMO_NAME, DEMO_USER_ID, exitDemoSession, isDemoSession } from "../demoSession";
import type { RoomState } from "@/hooks/useSprintRoom";
import { createDemoEconomy, seedEconomy } from "./economy";

// v3 isolates this corrected store from older, still-open preview tabs whose
// previous runtime rewrites the entire v1 value on every background save.
// v2 was an unreleased preview migration; recover the original v1 data instead.
const KEY = "ws.localDemo.data.v3";
const LEGACY_KEY = "ws.localDemo.data.v1";
const stamp = () => new Date().toISOString();
function mergeChanges(current: any, baseline: any, latest: any): any {
  if (JSON.stringify(current) === JSON.stringify(baseline)) return latest === undefined ? current : latest;
  if (current && baseline && typeof current === "object" && !Array.isArray(current) && !Array.isArray(baseline)) {
    const result = {...latest};
    for (const key of new Set([...Object.keys(current), ...Object.keys(baseline)])) result[key] = mergeChanges(current[key], baseline[key], latest?.[key]);
    return result;
  }
  return current;
}
function seed() {
  return {
    profile: { writerName:DEMO_NAME, xp:225000, xpDecayed:0, inDecay:false, daysUntilDecay:null, decayRatePerDay:0, nameplate:"default", profileBio:"Trying out Writing Sprint.", profileBanner:"default", profileAccent:"blue", showOnLeaderboard:true },
    ...seedEconomy(), coins:5000, chests:{mortal:3,iron:2,crystal:1,inferno:1,immortal:1} as Record<string,number>,
    equippedCarSkin:"bluebird", equippedRoadSkin:"mushroom", wishlist:null as null | {listing_id:number;pinned_at:string},
    sprints:Array.from({length:7},(_,i)=>({id:i+1,roomCode:`DEMO-${i+1}`,participantName:DEMO_NAME,wordCount:400+i*137,wpm:30+i*3,roomMode:["regular","goal","boss","kart"][i%4],wordGoal:null,updatedAt:new Date(Date.now()-i*86400000).toISOString(),durationMinutes:25})),
    folio:{projects:[{id:"demo-project",name:"Demo notebook",open:true,docs:[{id:"demo-chapter",name:"A fresh page",content:"<p>This is your demo notebook. Try writing, organising chapters, and saving your work here.</p>",status:"draft",updatedAt:Date.now()}]}]},
    deadline:0, starUntil:0, notes:null as unknown, room:null as RoomState|null, drafts:{} as Record<string,string>, claimed:false, awardedXpRooms:[] as string[],
  };
}
export type DemoData = ReturnType<typeof seed>;
export function createDemoApi(storage: Pick<Storage,"getItem"|"setItem">, random = Math.random) {
  const current=storage.getItem(KEY);
  const saved=current && Object.keys(JSON.parse(current)).length ? current : storage.getItem(LEGACY_KEY);
  const previous = saved ? JSON.parse(saved) : null;
  const data:DemoData=previous?{...seed(),...previous}:seed();
  // Add the restored catalog once, preserving saved writing, wallet, and purchases.
  if (previous && previous.catalogVersion !== 2) {
    const restored = seedEconomy();
    data.inventory = [...(previous.inventory ?? []), ...restored.inventory];
    data.knownRecipes = restored.knownRecipes;
    data.catalogVersion = 2;
    // Listing 3 used to be a placeholder Crystal Chest.
    if (data.wishlist?.listing_id === 3) data.wishlist.listing_id = 4;
  }
  let baseline = saved ? JSON.parse(saved) : {};
  const save=()=>{
    const latest = storage.getItem(KEY);
    const latestData = latest ? JSON.parse(latest) : null;
    const merged = mergeChanges(data, baseline, latestData && Object.keys(latestData).length ? latestData : baseline);
    storage.setItem(KEY, JSON.stringify(merged));
    Object.assign(data, merged);
    baseline = JSON.parse(JSON.stringify(data));
  };
  const refresh=()=>{
    const latest=storage.getItem(KEY);
    if (latest) { Object.assign(data, JSON.parse(latest)); baseline=JSON.parse(latest); }
  };
  save();
  const economy = createDemoEconomy(data, save, random);
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
  const unsupported=()=>reply({error:"This action needs a live account. The local demo supports writing, rooms, skins, shop purchases, chests, quests, and browsing your stats."},409);
  const skins=(keys:string[])=>keys.map(key=>({key,name:key[0].toUpperCase()+key.slice(1),rarity:"common",unlocked:true}));
  async function handle(path:string,method:string,body:any,search:URLSearchParams):Promise<Response> {
    refresh();
    const economyResponse = economy.handle(path, method, body);
    if (economyResponse) return economyResponse;
    if(path==="/user/profile" || path==="/user/preferences") {
      if(method!=="GET") {data.profile={...data.profile,...body};save();}
      return reply(data.profile);
    }
    if(path.startsWith("/users/by-name/")) return reply({...data.profile,name:data.profile.writerName,totalWords:data.sprints.reduce((n,s)=>n+s.wordCount,0),highestWordCount:1222,sprintCount:data.sprints.length});
    if(path==="/coins") return reply({balance:data.coins,dailyEarned:0,dailyCap:10000});
    if(path==="/user/xp" && method==="POST") {
      const sprint = data.sprints.find(sprint => sprint.roomCode === body.roomCode);
      if (!sprint || data.awardedXpRooms.includes(`${sprint.roomCode}:${sprint.id}`)) return reply({xp:data.profile.xp,xpGained:0});
      const xpGained = economy.grantSprintXp(sprint.wordCount);
      data.awardedXpRooms.push(`${sprint.roomCode}:${sprint.id}`); save(); return reply({xp:data.profile.xp,xpGained});
    }
    if(path==="/user/sprints") return reply(data.sprints);
    if(/^\/user\/sprints\/\d+\/text$/.test(path)) { const sprint=data.sprints.find(s=>s.id===Number(path.split("/")[3])); return reply({text:sprint?data.drafts[`/rooms/${sprint.roomCode}/writing/${encodeURIComponent(data.profile.writerName)}`]??"Sample writing from a demo sprint.":""}); }
    if(/^\/user\/sprints\/\d+$/.test(path) && method==="DELETE") {data.sprints=data.sprints.filter(s=>s.id!==Number(path.split("/").pop()));save();return reply({ok:true});}
    if(path==="/user/streak") return reply({month:search.get("month"),currentStreak:7,longestStreak:12,lastStreakDay:stamp().slice(0,10),days:data.sprints.filter(s=>s.updatedAt.startsWith(search.get("month")??"")).map(s=>({day:s.updatedAt.slice(0,10),wordsWritten:s.wordCount,sprintsCompleted:1}))});
    if(path==="/folio") {if(method==="PUT"){data.folio=body.state;save();}return reply({state:data.folio});}
    if(path==="/novel-notes") {if(method==="PUT"||method==="POST"){data.notes=body;save();}return reply(data.notes??{});}
    if(path==="/user/files" && method==="POST") {
      const name=body.participantName??data.profile.writerName;
      data.drafts[`/rooms/${body.roomCode}/writing/${encodeURIComponent(name)}`]=body.text??"";
      let project=data.folio.projects.find(p=>p.id==="demo-saved-sprints");
      if(!project){project={id:"demo-saved-sprints",name:"Saved sprints",open:true,docs:[]};data.folio.projects.push(project);}
      const id=`demo-sprint-${body.roomCode}`;
      const doc={id,name:body.roomCode,content:body.text??"",status:"draft",updatedAt:Date.now()};
      const existing=project.docs.findIndex(d=>d.id===id);
      if(existing<0)project.docs.push(doc);else project.docs[existing]=doc;
      save();return reply({ok:true});
    }
    if(path==="/skins") return reply({cars:skins(["bluebird","firebolt","jade","shadow","crimson","royal","gilded","void","arctic","sakura","thunder","cyber","celestial","inferno"]),roads:skins(["mushroom","ghost","volcano"]),equippedCarSkin:data.equippedCarSkin,equippedRoadSkin:data.equippedRoadSkin});
    if(path==="/skins/equip") {if(body.type==="car") data.equippedCarSkin=body.key;else data.equippedRoadSkin=body.key;save();return reply({ok:true});}
    if(path==="/user/quests")return reply({quests:[{id:"demo-quest",scope:"daily",title:"Try your first reward",description:"Claim a sample reward to explore quests.",target:1,progress:1,isCompleted:true,isClaimed:data.claimed,reward:{kind:"coins",amount:100},rewardLabel:"100 coins",resetsAt:new Date(Date.now()+86400000).toISOString()}]});
    if(path==="/user/quests/demo-quest/claim") {if(data.claimed)return reply({error:"Already claimed"},409);data.claimed=true;data.coins+=100;save();return reply({ok:true,reward:{kind:"coins",amount:100}});}
    if(path==="/friends")return reply({friends:[{id:1,writerName:"Morgan (demo)",xp:8400}],pendingReceived:[],pendingSent:[]});
    if(path==="/users/search")return reply([]);
    if(path==="/guilds/me")return reply({guild:null});
    if(path==="/guilds/me/invites")return reply([]);
    if(path==="/guilds/me/active-sprint")return reply({sprint:null});
    if(path.startsWith("/rankings/"))return reply([{writerName:data.profile.writerName,xp:data.profile.xp},{writerName:"Morgan (demo)",xp:212000}]);
    if(path==="/co-writing/rooms")return method==="GET"?reply([]):unsupported();
    if(path==="/user/discord")return method==="GET"?reply({enabled:false,webhookUrl:null}):unsupported();
    if(path==="/rooms" && method==="POST") {
      const minutes=Number(body.durationMinutes??25);
      data.room={code:`DEMO-${Date.now().toString(36).toUpperCase()}`,mode:body.mode??"regular",status:"waiting",durationMinutes:minutes,timeLeft:minutes*60,countdownDelayMinutes:0,countdownTimeLeft:null,wordGoal:body.wordGoal??null,bossWordGoal:body.bossWordGoal??null,bossTotalWords:0,deathModeWpm:null,gladiatorDeathGap:body.gladiatorDeathGap??400,creatorXp:data.profile.xp,hostCarSkin:data.equippedCarSkin,hostRoadSkin:data.equippedRoadSkin,starActiveIds:[],participants:[{id:DEMO_USER_ID,name:data.profile.writerName,wordCount:0,wpm:0,isCreator:true,role:"writer"},{id:"demo-morgan",name:"Morgan (demo)",wordCount:0,wpm:0,isCreator:false,role:"writer"}]};save();return reply(data.room,201);
    }
    if(path==="/rooms")return reply(data.room?[{...data.room,participantCount:2,creatorName:data.profile.writerName,isPrivate:false}]:[]);
    if(/^\/rooms\/[^/]+\/writing/.test(path)) {if(method==="PUT"){data.drafts[`${path}/${encodeURIComponent(body.participantName)}`]=body.text??"";save();return reply({ok:true});}return reply(data.drafts[path]===undefined?null:{text:data.drafts[path]});}
    if(/^\/rooms\/[^/]+\/bets$/.test(path))return reply({totalPot:0,bettorCount:0,myBet:null,status:"closed"});
    if(/^\/rooms\/[^/]+$/.test(path))return data.room?.code===path.split("/").pop()?reply(data.room):reply({error:"Create a local demo room from the portal first."},404);
    if(path==="/log/client-error")return reply({ok:true});
    return unsupported();
  }
  return {handle,get data(){return data;},save,refresh};
}

export function installDemo() {
  if(!isDemoSession())return;
  const api=createDemoApi(localStorage);
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const request=input instanceof Request?input:null;
    const url=new URL(request?request.url:String(input),location.href);
    const prefix=`${import.meta.env.BASE_URL.replace(/\/$/,"")}/api`;
    if(url.origin!==location.origin || !url.pathname.startsWith(`${prefix}/`))return nativeFetch(input,init);
    const method=(init?.method??request?.method??"GET").toUpperCase();
    try {
      const raw=init?.body??(request&&method!=="GET"?await request.clone().text():null);
      const body=typeof raw==="string"&&raw?JSON.parse(raw):{};
      return await api.handle(url.pathname.slice(prefix.length),method,body,url.searchParams);
    } catch {return new Response(JSON.stringify({error:"Could not save demo data on this device."}),{status:500,headers:{"Content-Type":"application/json"}});}
  };
  installRoomSocket(api);
  const banner=document.createElement("aside");
  banner.setAttribute("aria-label","Local demo session");
  banner.style.cssText="position:fixed;bottom:12px;left:12px;z-index:90;max-width:calc(100vw - 24px);padding:9px 12px;border:1px solid #c3cfe3;border-radius:10px;background:#f4f7ff;color:#33476c;box-shadow:0 2px 12px #17244515;font:12px system-ui;display:flex;align-items:center;gap:12px";
  const label=document.createElement("span");label.textContent="Demo account · sample data · saved on this device";
  const exit=document.createElement("button");exit.textContent="Exit demo";exit.onclick=exitDemoSession;exit.style.cssText="text-decoration:underline;white-space:nowrap;min-height:28px";
  banner.append(label,exit);document.body.append(banner);
}

function installRoomSocket(api:ReturnType<typeof createDemoApi>) {
  const NativeSocket=window.WebSocket;
  class DemoSocket {
    readyState=0;onopen:((event:Event)=>void)|null=null;onmessage:((event:MessageEvent)=>void)|null=null;onclose:((event:CloseEvent)=>void)|null=null;onerror:((event:Event)=>void)|null=null;
    timer:ReturnType<typeof setInterval>|null=null;items=["mushroom","red_shell","star"];roomCode="";
    constructor(){queueMicrotask(()=>{this.readyState=1;this.onopen?.(new Event("open"));});}
    emit(data:unknown){this.onmessage?.(new MessageEvent("message",{data:JSON.stringify(data)}));}
    publish(){this.emit({type:"room_state",room:api.data.room});}
    duel(){const r=api.data.room!;const a=r.participants[0],b=r.participants[1];this.emit({type:"gladiator_state",myHp:1000,opponentHp:Math.max(0,1000-a.wordCount),myWordCount:a.wordCount,opponentWordCount:b.wordCount,gap:Math.abs(a.wordCount-b.wordCount),iAhead:a.wordCount>=b.wordCount,deathGap:r.gladiatorDeathGap,myBuffs:[],opponentBuffs:[]});}
    resume(){
      if(this.timer)clearInterval(this.timer);
      if(!api.data.deadline){api.data.deadline=Date.now()+(api.data.room?.timeLeft??0)*1000;api.save();}
      this.timer=setInterval(()=>{
        api.refresh();
        const r=api.data.room!;
        if(!r || r.code!==this.roomCode || r.status!=="running"){if(this.timer)clearInterval(this.timer);this.timer=null;return;}
        r.timeLeft=Math.max(0,Math.ceil((api.data.deadline-Date.now())/1000));
        if(api.data.starUntil<=Date.now())r.starActiveIds=[];
        if(!r.timeLeft)this.end();else {this.publish();api.save();}
      },1000);
    }
    end(){const r=api.data.room!;if(r.status!=="running")return;
      const me=r.participants[0];
      const elapsed=Math.max(1,(r.durationMinutes*60-(r.timeLeft??0))/60);
      me.wpm=Math.round(me.wordCount/elapsed);
      api.data.sprints.unshift({id:Date.now(),roomCode:r.code,participantName:me.name,wordCount:me.wordCount,wpm:me.wpm,roomMode:r.mode,wordGoal:null,updatedAt:stamp(),durationMinutes:r.durationMinutes});
      r.status="finished";r.timeLeft=0;if(this.timer)clearInterval(this.timer);this.timer=null;this.emit({type:"sprint_ended",results:r.participants});if(r.mode==="gladiator")this.emit({type:"gladiator_execution",outcome:r.participants[0].wordCount?"victory":"draw",myHp:1000,opponentHp:Math.max(0,1000-r.participants[0].wordCount),myWordCount:r.participants[0].wordCount,opponentWordCount:0,stats:{closestGap:0,maxGap:r.participants[0].wordCount,leadChanges:0,timeInDangerMs:0,endedByExecution:false,totalHpHealed:{}}});api.save();}
    send(raw:string){api.refresh();const msg=JSON.parse(raw),r=api.data.room;
      if(msg.type==="ping"){this.emit({type:"pong"});return;}
      if(!r){this.emit({type:"error",message:"Create a demo room first."});return;}
      if(msg.type==="join_room"){if(msg.code!==r.code){this.emit({type:"error",message:"This demo room is no longer active. Open the current room from the portal."});return;}this.roomCode=r.code;}
      else if(this.roomCode!==r.code){this.emit({type:"error",message:"A different demo room is now active."});return;}
      if(msg.type==="join_room"){this.emit({type:"joined",participantId:DEMO_USER_ID,room:r,kartItems:r.status==="running"?this.items:[],restoredWordCount:r.participants[0].wordCount});if(r.mode==="gladiator")this.duel();if(r.status==="running")this.resume();}
      if(msg.type==="start_sprint"&&r.status==="waiting"){r.status="running";api.data.deadline=Date.now()+r.durationMinutes*60000;api.save();this.publish();if(r.mode==="kart")this.emit({type:"kart_inventory",items:this.items});this.resume();}
      if(msg.type==="text_update"&&r.status==="running"){r.participants[0].wordCount=Math.max(0,Number(msg.netWordCount)||0);r.bossTotalWords=r.participants[0].wordCount;api.save();this.publish();if(r.mode==="gladiator")this.duel();if(r.mode==="boss"&&r.bossTotalWords>=(r.bossWordGoal??Infinity))this.end();}
      if(msg.type==="end_sprint")this.end();
      if(msg.type==="restart_sprint"){if(this.timer)clearInterval(this.timer);api.data.deadline=0;api.data.starUntil=0;r.status="waiting";r.durationMinutes=msg.durationMinutes;r.timeLeft=msg.durationMinutes*60;r.bossTotalWords=0;r.starActiveIds=[];r.participants.forEach(p=>{p.wordCount=0;p.kartCarOffset=0;});this.items=["mushroom","red_shell","star"];this.publish();if(r.mode==="gladiator")this.duel();api.save();}
      if(msg.type==="use_item"&&r.status==="running"&&this.items.includes(msg.item)){this.items.splice(this.items.indexOf(msg.item),1);if(msg.item==="mushroom")r.participants[0].kartCarOffset=(r.participants[0].kartCarOffset??0)+200;if(msg.item==="star"){r.starActiveIds=[DEMO_USER_ID];api.data.starUntil=Date.now()+30000;this.emit({type:"item_effect_start",effect:"star",duration:30000});}api.save();this.emit({type:"kart_inventory",items:this.items});this.publish();}
    }
    close(){this.readyState=3;if(this.timer)clearInterval(this.timer);this.onclose?.(new CloseEvent("close",{code:1000}));}
  }
  window.WebSocket=new Proxy(NativeSocket,{construct(target,args){const url=new URL(String(args[0]),location.href);if(url.hostname===location.hostname&&url.pathname==="/ws")return new DemoSocket();return Reflect.construct(target,args);}});
}
