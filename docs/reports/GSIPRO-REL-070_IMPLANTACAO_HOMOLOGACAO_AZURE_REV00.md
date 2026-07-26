# GSIPRO-REL-070 — Implantação de Homologação Azure — REV00

## Identificação

- Data: 19/07/2026
- Ambiente: Homologação
- Região: Brazil South
- Assinatura: `G-SIPRO-HOMOLOGACAO`
- ID da assinatura: `27207f47-0f35-4869-83dd-0e2ed7d8137f`
- Grupo de recursos: `rg-gsipro-hml-brazilsouth`
- Responsável da assinatura: Gutemberg Pontes

## Resultado

O incremento I5 homologado foi implantado no Azure e está disponível em:

`https://ca-gsipro-hml-aahbrant.thankfulpond-8424c61a.brazilsouth.azurecontainerapps.io`

O App Service inicialmente avaliado não pôde ser criado porque a assinatura nova recebeu cota Microsoft.Web igual a zero em Brazil South. A arquitetura de homologação foi ajustada para Azure Container Apps no plano de consumo, disponível na mesma região e compatível com escala mínima zero.

## Recursos implantados

| Recurso | Nome | Configuração principal |
|---|---|---|
| Resource Group | `rg-gsipro-hml-brazilsouth` | Brazil South |
| Container App | `ca-gsipro-hml-aahbrant` | 0,5 vCPU, 1 GiB, 0–1 réplica |
| Container Apps Environment | `cae-gsipro-hml-brazilsouth` | Consumo e logs centralizados |
| Container Registry | `acrgsiprohml27207f` | Basic, autenticação por identidade gerenciada |
| PostgreSQL Flexible Server | `psql-gsipro-hml-27207f` | PostgreSQL 18, Burstable B1ms, 32 GB, backup 7 dias |
| Key Vault | `kv-gsipro-hml-27207f` | RBAC, retenção 90 dias |
| Storage Account | `stgsiprohml27207f` | Standard LRS, HTTPS e TLS 1.2 |
| Azure Files | `documents` | 20 GB, montado em `/mnt/gsipro-documents` |
| Log Analytics | `log-gsipro-hml-brazilsouth` | Retenção 30 dias |

## Segurança e identidade

- O Container App possui identidade gerenciada atribuída pelo sistema.
- A identidade recebeu somente as funções `AcrPull` e `Key Vault Secrets User` nos respectivos escopos.
- Segredos de banco, Entra, sessão e OpenAI não estão no manifesto, na imagem ou no Git.
- O callback HTTPS foi acrescentado ao aplicativo Entra existente sem remover os callbacks locais.
- A imagem executada está fixada pelo digest `sha256:9ed7bf48c78d35f8f10e7dcf2e8b231574ac848c178b83fdce9d375b2b003b3d`.
- O acesso temporário do IP local ao PostgreSQL, usado para migração, foi removido após a execução.

## Banco e dados

- Banco `gsipro` criado no PostgreSQL Flexible Server.
- 59 migrations Prisma aplicadas com sucesso.
- A proteção do `prisma.config.ts` continua negando bancos não autorizados.
- Operações de migração Azure exigem simultaneamente a autorização explícita e a correspondência exata do hostname configurado.
- O diretório de documentos usa Azure Files persistente; não depende do disco efêmero do contêiner.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| TypeScript | Aprovado |
| Validação Prisma | Aprovado |
| Build Next.js standalone | Aprovado |
| Build ACR `cq6` | Aprovado |
| `/api/health` | HTTP 200, `status: ok` |
| `/api/readiness` | HTTP 200, `status: ready`, banco disponível |
| `/api/auth/signin` | HTTP 200 |
| Callback Microsoft Entra ID | HTTPS correto para o domínio Azure |
| Container App | `Running` |
| Montagem Azure Files | Configurada em `/mnt/gsipro-documents` |

## Controle de custos

- Orçamento mensal: R$ 1.000,00.
- Alerta configurado em 80%.
- Container App com mínimo de zero réplicas e máximo de uma réplica.
- PostgreSQL no menor SKU Burstable disponível.
- Container Registry no SKU Basic.
- Alta disponibilidade do PostgreSQL desativada em homologação.

## Conclusão

A implantação de homologação do G-SIPRO está tecnicamente concluída e disponível para teste funcional autenticado. Esta homologação não constitui autorização de produção. Promoção para produção permanece condicionada a domínio definitivo, política de backup/restauração testada, operação/suporte e aprovação formal do ambiente produtivo.

## Nota de recuperação

Este relatório foi produzido em 19/07/2026 mas nunca havia sido salvo no controle de versão — sobrevivia apenas como cópia dentro de uma pasta de build local (`019_DESENVOLVIMENTO/gsipro/.next/standalone/docs/`), que foi removida durante a reorganização do repositório. Recuperado e commitado em 25/07/2026 para não se perder.
