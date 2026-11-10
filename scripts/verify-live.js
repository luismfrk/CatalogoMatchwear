import 'dotenv/config'; import { collectOne } from '../src/sync/supplier.js';
const url=process.argv[2]||'https://www.mantoesportivo.com/produtos/camisa-selecao-brasileira-i-26-27-torcedor-masculina-amarela-copa-do-mundo-pronta-entrega1/';
const p=await collectOne(url); console.log(JSON.stringify({supplierId:p.supplierId,name:p.name,category:p.category,imageCount:p.images.length,sourceUrl:p.sourceUrl,sizes:p.sizes},null,2));
