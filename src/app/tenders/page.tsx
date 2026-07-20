import Link from "next/link";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { TenderForm } from "./tender-form";

export default async function TendersPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization,{permission:"tenders.read"}).allowed) return <main className="mx-auto max-w-4xl px-6 py-10"><Link className="font-bold text-brand" href="/">← Voltar</Link><section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-8"><h1 className="text-2xl font-bold">Acesso a editais aguardando provisionamento</h1></section></main>;
  const [tenders, opportunities] = await Promise.all([
    getDatabase().tender.findMany({include:{versions:{orderBy:{version:"desc"},take:1},lots:true},orderBy:{createdAt:"desc"}}),
    getDatabase().opportunity.findMany({select:{id:true,code:true},orderBy:{code:"asc"}}),
  ]);
  return <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10 lg:px-10"><div><Link className="text-sm font-bold text-brand" href="/">← Voltar ao início</Link><h1 className="mt-6 text-3xl font-bold">Editais</h1></div>
    {authorize(authorization,{permission:"tenders.create"}).allowed&&<TenderForm opportunities={opportunities}/>}<section className="rounded-2xl border border-border bg-surface p-6 shadow-sm"><h2 className="text-xl font-bold">Editais cadastrados</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-3">Código</th><th className="p-3">Número</th><th className="p-3">Modalidade</th><th className="p-3">Objeto</th><th className="p-3">Versão</th></tr></thead><tbody>{tenders.map((item)=><tr className="border-b border-border/70" key={item.id}><td className="p-3 font-bold text-brand"><Link href={`/tenders/${item.id}`}>{item.code}</Link></td><td className="p-3">{item.number}</td><td className="p-3">{item.modality}</td><td className="p-3">{item.subject}</td><td className="p-3">{item.versions[0]?.version??"—"}</td></tr>)}{tenders.length===0&&<tr><td className="p-8 text-center text-muted" colSpan={5}>Nenhum edital cadastrado.</td></tr>}</tbody></table></div></section>
  </main>;
}
