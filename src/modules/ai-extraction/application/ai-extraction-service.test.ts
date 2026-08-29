import{createHash}from"node:crypto";import{describe,expect,it,vi}from"vitest";import type{AuthorizationContext}from"@/core/authorization/policy";import{AiExtractionService,type AiExtractionContext,type AiExtractionRepository}from"./ai-extraction-service";import type{AiExtractionProvider}from"../domain/ai-extraction";
const context:AiExtractionContext={definition:{id:"11111111-1111-4111-8111-111111111111",promptTemplate:"Extraia",promptHash:"a".repeat(64),authorizedSources:[{documentType:"EDITAL",requiredPermission:"tenders.read"}],modelVersionId:"33333333-3333-4333-8333-333333333333",approval:true,isLatest:true},model:{id:"33333333-3333-4333-8333-333333333333",provider:"OPENAI",providerModelVersion:"gpt-test",serviceType:"OPENAI_RESPONSES",status:"ACTIVE"},source:{kind:"ARCHIVED",documentVersionId:"22222222-2222-4222-8222-222222222222",fileHash:"b".repeat(64),mimeType:"application/pdf",documentType:"EDITAL",title:"Edital teste"}};
const request={idempotencyKey:"one",definitionId:context.definition.id,documentVersionId:"22222222-2222-4222-8222-222222222222",requestedFields:["Objeto"]};
function repository(reused=true):AiExtractionRepository{return{context:vi.fn().mockResolvedValue(context),ephemeralContext:vi.fn().mockImplementation((_d:string,source:unknown)=>Promise.resolve({...context,source})),begin:vi.fn().mockImplementation((_r:unknown,inputHash:string)=>Promise.resolve({id:"44444444-4444-4444-8444-444444444444",status:reused?"SUCCEEDED":"RUNNING",inputHash,reused})),succeed:vi.fn().mockResolvedValue(undefined),fail:vi.fn().mockResolvedValue(undefined),get:vi.fn().mockResolvedValue({id:"44444444-4444-4444-8444-444444444444",status:"SUCCEEDED"})}}
const provider:AiExtractionProvider={execute:vi.fn()};const allowed:AuthorizationContext={actorId:"55555555-5555-4555-8555-555555555555",permissions:new Set(["ai.execute","tenders.read"])};
describe("AiExtractionService",()=>{it("returns the prior result for an idempotent replay without calling OpenAI",async()=>{const service=new AiExtractionService(repository(),provider);await expect(service.execute(request,allowed)).resolves.toMatchObject({status:"SUCCEEDED"});expect(provider.execute).not.toHaveBeenCalled()});it("allows a master user to access a governed source without individual permissions",async()=>{const service=new AiExtractionService(repository(),provider);await expect(service.execute(request,{actorId:allowed.actorId,permissions:new Set(),isMaster:true})).resolves.toMatchObject({status:"SUCCEEDED"})});it("blocks a user who cannot access the governed source",async()=>{const service=new AiExtractionService(repository(),provider);await expect(service.execute(request,{...allowed,permissions:new Set(["ai.execute"])})).rejects.toThrow("permissão exigida")})});

describe("fonte efêmera", () => {
  const fonte = {
    uri: "https://pncp.gov.br/pncp-api/v1/orgaos/07658917000127/compras/2025/114/arquivos/1",
    filename: "edital.pdf",
    mimeType: "application/pdf",
    documentType: "EDITAL",
    title: "Edital 14/2026",
  };
  const pedido = { idempotencyKey: "efemero", definitionId: context.definition.id, requestedFields: ["Objeto"], source: fonte };
  const bytes = Buffer.from("conteudo do edital");
  /** SHA-256 de "conteudo do edital", conferido fora do código sob teste. */
  const hashEsperado = createHash("sha256").update(bytes).digest("hex");

  const provedorQueResponde = (): AiExtractionProvider => ({
    execute: vi.fn().mockResolvedValue({
      providerResponseId: "resp-1",
      result: { content: [{ field: "Objeto", value: "Ponte" }], confidence: 0.8, limitations: [], evidence: [{ excerpt: "ponte", locator: "item 9.1" }] },
    }),
  });

  /**
   * O ponto que sustenta o rastro sem arquivo guardado: o hash sai dos BYTES.
   * Se viesse de quem chama, "o modelo leu este conteúdo" seria só palavra.
   */
  it("calcula o hash a partir dos bytes, não de quem chama", async () => {
    const repo = repository(false);
    const provedor = provedorQueResponde();
    await new AiExtractionService(repo, provedor).executeEphemeral(
      { ...pedido, source: { ...fonte, filename: "mentira.pdf" } }, bytes, allowed,
    );
    const contexto = vi.mocked(repo.ephemeralContext).mock.calls[0]?.[1];
    expect(contexto?.fileHash).toBe(hashEsperado);
    expect(contexto?.sizeBytes).toBe(bytes.byteLength);
    expect(vi.mocked(provedor.execute).mock.calls[0]?.[0].fileHash).toBe(hashEsperado);
  });

  it("recusa fonte vazia", async () => {
    await expect(new AiExtractionService(repository(false), provedorQueResponde())
      .executeEphemeral(pedido, Buffer.alloc(0), allowed)).rejects.toThrow(/vazia/i);
  });

  it("aplica os mesmos controles: tipo documental fora do caso de uso é recusado", async () => {
    await expect(new AiExtractionService(repository(false), provedorQueResponde())
      .executeEphemeral({ ...pedido, source: { ...fonte, documentType: "ATESTADO" } }, bytes, allowed))
      .rejects.toThrow(/não está autorizado/i);
  });

  it("aplica os mesmos controles: sem a permissão da fonte, recusa", async () => {
    await expect(new AiExtractionService(repository(false), provedorQueResponde())
      .executeEphemeral(pedido, bytes, { actorId: allowed.actorId, permissions: new Set(["ai.execute"]) }))
      .rejects.toThrow(/permissão/i);
  });

  /**
   * A trava que impede requisição forjada do lado do servidor: a rota pública
   * usa `execute`, cujo esquema não conhece `source`. Se um dia alguém ligar o
   * caminho efêmero na rota, este teste cai.
   */
  it("o caminho público não aceita endereço vindo de fora", async () => {
    await expect(new AiExtractionService(repository(false), provedorQueResponde())
      .execute(pedido, allowed)).rejects.toThrow();
  });

  it("a procedência entra na chave de entrada: mesmo arquivo, origens diferentes, execuções distintas", async () => {
    const repo = repository(false);
    const service = new AiExtractionService(repo, provedorQueResponde());
    await service.executeEphemeral(pedido, bytes, allowed);
    await service.executeEphemeral({ ...pedido, source: { ...fonte, uri: `${fonte.uri}?v=2` } }, bytes, allowed);
    const [primeiro, segundo] = vi.mocked(repo.begin).mock.calls.map((c) => c[1]);
    expect(primeiro).not.toBe(segundo);
  });
});
