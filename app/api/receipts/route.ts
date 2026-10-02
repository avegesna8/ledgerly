import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowed=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);

export async function POST(request:Request){
  const form=await request.formData();const file=form.get("receipt");
  if(!(file instanceof File))return NextResponse.json({error:"Choose a receipt image or PDF."},{status:400});
  if(!allowed.has(file.type))return NextResponse.json({error:"Use a JPG, PNG, WebP, or PDF receipt."},{status:415});
  if(file.size>20*1024*1024)return NextResponse.json({error:"Receipt files must be 20 MB or smaller."},{status:413});
  const user=await prisma.user.findUnique({where:{email:"alex@ledgerly.local"}});if(!user)return NextResponse.json({error:"Local user not found."},{status:404});
  const requestedTransactionId=String(form.get("transactionId")??"").trim();let transactionId:string|null=null;
  if(requestedTransactionId){const transaction=await prisma.transaction.findFirst({where:{id:requestedTransactionId,userId:user.id,receipt:null}});if(!transaction)return NextResponse.json({error:"That transaction is unavailable or already has a receipt."},{status:409});transactionId=transaction.id;}
  const bytes=Buffer.from(await file.arrayBuffer());const checksum=createHash("sha256").update(bytes).digest("hex");
  const duplicate=await prisma.receipt.findUnique({where:{userId_checksum:{userId:user.id,checksum}}});
  if(duplicate)return NextResponse.json({error:"This receipt has already been uploaded.",receiptId:duplicate.id},{status:409});
  const extension=path.extname(file.name).toLowerCase()||({"image/jpeg":".jpg","image/png":".png","image/webp":".webp","application/pdf":".pdf"}[file.type]??"");
  const storageKey=`${user.id}/${randomUUID()}${extension}`;const root=path.join(process.cwd(),"storage","receipts");const destination=path.join(root,storageKey);
  await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes,{flag:"wx"});
  const receipt=await prisma.receipt.create({data:{userId:user.id,originalUrl:`/api/receipts/file/${storageKey}`,storageKey,originalFilename:file.name,mimeType:file.type,source:"UPLOAD",checksum,transactionId,status:transactionId?"POTENTIAL_MATCH":"UNMATCHED",matchConfidence:transactionId?1:null}});
  return NextResponse.json({id:receipt.id,status:receipt.status},{status:201});
}
