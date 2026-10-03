export const FEEDBACK_DAILY_LIMIT=5;
export const FEEDBACK_TEXT_LIMIT=200;
export const feedbackLength=(text:string)=>Array.from(text).length;
export function feedbackDay(now=Date.now()){return new Date(now+8*60*60*1000).toISOString().slice(0,10);}
export function feedbackText(value:unknown){
 if(typeof value!=='string')throw Error('请填写反馈内容');
 const text=value.trim();
 if(!text)throw Error('请填写反馈内容');
 if(feedbackLength(text)>FEEDBACK_TEXT_LIMIT)throw Error('每次反馈最多 200 字');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text))throw Error('反馈含有无效字符');
 return text;
}
