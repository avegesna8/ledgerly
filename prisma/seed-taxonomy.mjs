import { PrismaClient } from "@prisma/client";
import { categoryTaxonomy } from "./category-taxonomy.mjs";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "alex@ledgerly.local" } });
  let created = 0;
  const activeSystemIds = [];
  async function seedNode(node, parentId = null) {
    const definition=typeof node === "string" ? { name:node,children:[] } : node;
    let category=await prisma.category.findFirst({ where:{ userId:user.id,parentId,name:definition.name } });
    if (!category) { category=await prisma.category.create({ data:{ userId:user.id,parentId,name:definition.name,isSystem:true,isActive:true } }); created++; }
    else await prisma.category.update({ where:{ id:category.id },data:{ isSystem:true,isActive:true } });
    activeSystemIds.push(category.id);
    for (const child of definition.children??[]) await seedNode(child,category.id);
  }
  for (const node of categoryTaxonomy) await seedNode(node);
  const deactivated=await prisma.category.updateMany({ where:{ userId:user.id,isSystem:true,id:{ notIn:activeSystemIds } },data:{ isActive:false } });
  console.log(`Taxonomy ready: ${created} categories created, ${deactivated.count} superseded categories deactivated.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
