# Matchwear FC — catálogo sincronizado

Catálogo estático responsivo com pedidos pelo WhatsApp e sincronizador independente. O fornecedor é lido somente por páginas públicas, com baixa frequência. O estado editorial privado (`state.json`) e o catálogo público (`catalog.json`) são separados: preço do fornecedor e URL de origem nunca entram no JSON servido ao cliente.

## Funcionalidades adaptadas da Mimo Presentes

O repositório público `luismfrk/mimos-presentes` foi inspecionado antes da adaptação. A Matchwear reaproveita os conceitos funcionais de busca, categorias, ordenação, detalhe do produto, favoritos persistidos no navegador, sacola persistida com quantidades, contadores na navegação, estados vazios e finalização pelo WhatsApp. A implementação foi feita separadamente neste projeto e adaptada para camisas: a seleção obrigatória é o tamanho, a sacola guarda produto+tamanho, estoque esgotado bloqueia o pedido e a mensagem inclui os links da Matchwear.

O backend Supabase da Mimo não foi copiado. A Matchwear mantém o armazenamento S3/R2 e a API administrativa autenticada porque eles compartilham estado com o sincronizador do fornecedor. Também foram adicionados pela Matchwear: estoque por variante, estados disponível/esgotado/não confirmado, coleta protegida, rascunhos automáticos, preservação de ajustes manuais, painel de sincronização e worker horário.

## O que foi validado no fornecedor

Em 10/11/2026, a página pública da Nuvemshop expunha `LS.product.id` e `LS.variants` no HTML. Em um produto com vários tamanhos da listagem atual foram confirmados ID do produto, IDs das variantes, nome, imagens, URL, tamanhos, campo booleano `available` e estoque numérico por tamanho. O sincronizador classifica uma variante como:

- `available`: `available=true` e estoque maior que zero;
- `sold_out`: `available=false` ou estoque igual a zero;
- `unknown`: os campos públicos não permitem confirmar. Na vitrine isso vira “Consultar pelo WhatsApp”.

A categoria nem sempre aparece de forma estruturada no produto. Quando o breadcrumb não a informa, ela é inferida conservadoramente pelo nome (Feminina, Infantil, Seleções, Retrô ou Camisas de futebol). Essa é a principal informação não confirmada de forma uniforme. A disponibilidade reflete a página no momento da coleta; não é reserva de estoque.

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
copy .env.example .env
npm run verify:live
npm run sync
npm run admin -- list draft
npm run admin -- price ID_DO_PRODUTO 149.90
npm run admin -- publish ID_DO_PRODUTO
npm run dev
```

Para remover um preço, use `npm run admin -- price ID_DO_PRODUTO clear`.

Abra `http://localhost:4173`. Configure `WHATSAPP_NUMBER` no `.env` em formato internacional, somente números (por exemplo `5511999999999`). `SITE_URL` deve ser a URL pública final. Para usar fotos próprias:

```bash
npm run admin -- images ID_DO_PRODUTO https://cdn.exemplo/foto1.jpg,https://cdn.exemplo/foto2.jpg
```

Os comandos editoriais preservam preço, visibilidade, nome/categoria manuais e imagens próprias nas sincronizações seguintes. O painel web protegido fica em `/admin/`. Configure `ADMIN_PASSWORD` e `ADMIN_TOKEN_SECRET` no `.env`; localmente a API usa o mesmo servidor de `npm run dev`. Em produção, defina `ADMIN_API_URL` no Static Site com a URL do serviço `matchwear-fc-admin-api` e `ADMIN_ALLOWED_ORIGIN` nesse serviço com a URL exata do catálogo.

## Segurança da sincronização

Produtos novos entram como rascunho e sem preço. Uma coleta vazia, com mais de 10% de erros ou com queda superior a 30% contra a última coleta válida é rejeitada. Nesse caso `catalog.json` não é regravado e a última publicação continua no ar. `sync-report.json` e `state.sync.lastError` registram falhas; `lastSuccessfulAt` registra o último sucesso. Itens ausentes nunca são automaticamente removidos ou marcados como esgotados.

## Produção no Render + R2/S3

1. Crie um bucket S3 ou Cloudflare R2. Habilite leitura pública apenas para `matchwear/catalog.json` (ou publique-o por domínio/CDN); `state.json` e `sync-report.json` devem continuar privados.
2. Suba o repositório e crie o Blueprint a partir de `render.yaml`. Ele cria um Static Site e um Background Worker separado.
3. No worker, preencha `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `WHATSAPP_NUMBER` e `SITE_URL`. Para AWS, use a região em `S3_REGION`; no R2 use `auto`.
4. No Static Site, defina `CATALOG_URL` com a URL pública completa de `matchwear/catalog.json` e faça o primeiro deploy.
5. O worker sincroniza imediatamente e depois a cada `SYNC_INTERVAL_MINUTES` (60 por padrão). Para sincronização manual, rode `npm run sync` com as mesmas variáveis S3 no seu computador ou use um Render Shell/one-off job.
6. Para editar preços/publicação em produção, use os comandos `npm run admin -- ...` localmente com `STORAGE_MODE=s3` e as credenciais do bucket.

O bucket/CDN deve permitir CORS `GET` a partir do domínio do Static Site. Alterações no catálogo ficam disponíveis sem redeploy, respeitando o cache de 60 segundos.

## Neon Postgres

O estado privado da sincronização, o catálogo publicado e o último relatório podem ser compartilhados pelo Neon. A aplicação usa a URL com pool (`DATABASE_URL`) no worker e na API e reserva a URL direta (`DATABASE_URL_UNPOOLED`) para migrações.

```bash
neon deploy
npm run db:migrate
npm run db:seed
npm run db:verify
```

`db:seed` importa os arquivos existentes de `data/` apenas quando o documento ainda não existe no Neon. Novas sincronizações e alterações feitas no painel gravam no Postgres quando `STORAGE_MODE=postgres` ou quando `DATABASE_URL` está configurada sem um modo explícito.

No Render, configure `DATABASE_URL` no worker e no serviço `matchwear-fc-admin-api`, mantenha `STORAGE_MODE=postgres` e use como `CATALOG_URL` do Static Site a URL pública da API seguida de `/api/catalog`. Execute `npm run db:migrate` uma vez antes de iniciar os serviços. `DATABASE_URL_UNPOOLED` é necessária apenas onde as migrações são executadas e nunca deve ser exposta na vitrine.

### Sincronização agendada no GitHub

O workflow `.github/workflows/sync-catalog.yml` executa a coleta no minuto 17 de cada hora e também pode ser iniciado manualmente em **Actions → Sincronizar catálogo → Run workflow**. No repositório do GitHub, crie o secret `DATABASE_URL` em **Settings → Secrets and variables → Actions → New repository secret**, usando a URL do Neon com connection pooling. O workflow preserva o número do WhatsApp e a URL pública já gravados no catálogo quando essas variáveis não forem fornecidas.

## Verificações

`npm test` cobre idempotência, atualização isolada de estoque, preservação de preço/visibilidade, rejeição de coleta falha e ausência de dados do fornecedor no JSON público. `npm run verify:live` refaz a leitura do produto real. O layout usa breakpoints para celular, tamanhos esgotados ficam desabilitados e a mensagem do WhatsApp contém produto, tamanho e link da Matchwear FC.
