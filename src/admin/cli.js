import 'dotenv/config'; import { readJson, writeJson } from '../lib/storage.js'; import { makePublicCatalog } from '../sync/catalog.js';
const [cmd, id, value] = process.argv.slice(2); const state = await readJson('state.json');
if (!state) { console.error('Execute npm run sync primeiro.'); process.exit(1); }
const save = async () => { await writeJson('state.json', state); await writeJson('catalog.json', makePublicCatalog(state,{whatsappNumber:process.env.WHATSAPP_NUMBER,siteUrl:process.env.SITE_URL}),{publicRead:true}); };
const product = id ? state.products.find(p => p.supplierId === id) : null;
if (cmd === 'list' || !cmd) {
  const filter = id || 'draft'; console.table(state.products.filter(p => filter === 'all' || p.visibility === filter).map(p => ({id:p.supplierId,status:p.visibility,preco:p.salePrice||'-',nome:p.name.slice(0,75)})));
} else if (!product) { console.error(`Produto ${id} não encontrado.`); process.exit(1);
} else if (cmd === 'price') { const price=value === 'clear' ? null : Number(String(value).replace(',','.')); if (price !== null && !(price>0)) throw new Error('Preço inválido'); product.salePrice=price; await save(); console.log(price === null ? 'Preço removido.' : 'Preço atualizado.');
} else if (cmd === 'publish') { if (!(Number(product.salePrice)>0)) throw new Error('Defina o preço antes de publicar.'); product.visibility='published'; await save(); console.log('Produto publicado.');
} else if (cmd === 'draft' || cmd === 'hide') { product.visibility='draft'; await save(); console.log('Produto movido para rascunho.');
} else if (cmd === 'images') { product.customImages=String(value||'').split(',').map(x=>x.trim()).filter(Boolean); await save(); console.log('Imagens próprias atualizadas.');
} else console.log('Uso: npm run admin -- list [draft|published|all] | price ID 149.90|clear | publish ID | draft ID | images ID URL1,URL2');
