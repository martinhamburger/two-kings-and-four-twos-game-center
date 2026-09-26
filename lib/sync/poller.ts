export type PollTask=(signal:AbortSignal,current:()=>boolean)=>Promise<void>;
type Timer=ReturnType<typeof setTimeout>;
type Options={task:PollTask;interval:()=>number;onError:(error:unknown)=>void;now?:()=>number;setTimer?:(fn:()=>void,ms:number)=>Timer;clearTimer?:(timer:Timer)=>void};
/** A single request lane. Cancellation also invalidates responses from non-abortable transports. */
export function createSerialPoller(options:Options){
 const now=options.now??Date.now,setTimer=options.setTimer??setTimeout,clearTimer=options.clearTimer??clearTimeout;
 let paused=true,stopped=false,running=false,epoch=0,failed=0,due:number|null=null;
 let timer:Timer|undefined,controller:AbortController|undefined;
 function clear(){if(timer!==undefined)clearTimer(timer);timer=undefined;}
 function arm(){
  clear();if(stopped||paused||running||due===null)return;
  timer=setTimer(()=>{timer=undefined;void run();},Math.max(0,due-now()));
 }
 async function run(){
  if(stopped||paused||running)return;
  running=true;due=null;const ticket=epoch,started=now(),request=new AbortController();controller=request;
  const current=()=>!stopped&&!paused&&epoch===ticket;
  const timeout=setTimer(()=>request.abort(new Error('同步请求超时')),12000);
  try{await options.task(request.signal,current);if(current())failed=0;}
  catch(error){if(current()){failed++;options.onError(error);}}
  finally{
   clearTimer(timeout);running=false;if(controller===request)controller=undefined;
   if(current()&&due===null)due=now()+(failed?Math.min(1000*2**failed,15000):Math.max(100,options.interval()-(now()-started)));
   arm();
  }
 }
 return {
  pause(){paused=true;epoch++;clear();controller?.abort();},
  resume(immediate=false){if(stopped)return;paused=false;due=now()+(immediate?0:options.interval());arm();},
  refresh(){if(stopped)return;epoch++;failed=0;controller?.abort();due=now();arm();},
  stop(){stopped=true;paused=true;epoch++;clear();controller?.abort();},
 };
}
export const roomPollInterval=(phase?:string)=>['waiting','finished','closed'].includes(phase??'')?3000:1000;
