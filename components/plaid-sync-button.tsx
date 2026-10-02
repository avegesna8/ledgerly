"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function PlaidSyncButton({ onComplete }: { onComplete:()=>void }) {
  const [syncing,setSyncing]=useState(false); const [message,setMessage]=useState("");
  async function sync(){setSyncing(true);setMessage("");const response=await fetch("/api/plaid/sync",{method:"POST"});const result=await response.json();setSyncing(false);if(!response.ok)return setMessage(result.error??"Sync failed.");setMessage(`${result.added} bank transactions · ${result.holdings ?? 0} holdings · ${result.accountsDiscovered ?? 0} new accounts`);onComplete();setTimeout(()=>setMessage(""),5000);}
  return <span className="plaid-button-wrap"><button className="button secondary" disabled={syncing} onClick={sync}><RefreshCw className={syncing?"spin":""} size={15}/>{syncing?"Syncing…":"Sync banks"}</button>{message&&<small className="sync-message">{message}</small>}</span>;
}
