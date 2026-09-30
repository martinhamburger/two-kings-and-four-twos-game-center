type Versioned={code:string;revision:number};
/** Equal snapshots retain object identity; older reads can never roll back a confirmed action. */
export function newerRoom<T extends Versioned>(previous:T|null,next:T):T{
 return !previous||previous.code!==next.code||next.revision>previous.revision?next:previous;
}
