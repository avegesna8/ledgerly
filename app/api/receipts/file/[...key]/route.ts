import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request:Request,context:{params:Promise<{key:string[]}>}){const {key}=await context.params;const storageKey=key.join("/");const receipt=await prisma.receipt.findFirst({where:{storageKey}});if(!receipt)return NextResponse.json({error:"Receipt not found."},{status:404});const root=path.resolve(process.cwd(),"storage","receipts");const target=path.resolve(root,storageKey);if(!target.startsWith(`${root}${path.sep}`))return NextResponse.json({error:"Invalid receipt path."},{status:400});try{const bytes=await readFile(target);return new NextResponse(bytes,{headers:{"Content-Type":receipt.mimeType,"Content-Disposition":`inline; filename="${receipt.originalFilename.replaceAll('"','')}"`,"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"Receipt file is unavailable."},{status:404});}}
