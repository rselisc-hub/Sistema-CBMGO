// Entradas privadas por argumento; saída contém somente métricas agregadas.
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{performance}=require('node:perf_hooks'),{isDeepStrictEqual}=require('node:util');
if(process.argv.length<5){console.error('Uso: node tests/benchmark-conferencia.cjs <abas.json> <registros-estruturados.json> <colagem.txt> [resultado.json]');process.exit(2);}
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8'),mp=path.resolve('tests/conferencia-adapter.cjs'),m=new Module(mp);m.filename=mp;m.paths=module.paths;
m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture,current,baseline};',mp);
const {fixture,current,baseline}=m.exports,data=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),inputs=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),raw=fs.readFileSync(process.argv[4],'utf8');
const plain=x=>JSON.parse(JSON.stringify(x)),fields=['protocolo','movimentacao','logradouro','bairro','cidade','razaoSocial','divisao','area'];
function create(code){const f=fixture(code,data);vm.runInContext(code,f.context);const session={rg:'OPERADOR_TESTE',nome:'OPERADOR TESTE',perfil:'GESTOR'};Object.assign(f.context,{exigirPerfil_:()=>session,exigirAtribuicaoConferencia_:()=>session,dataHoraSaoPauloTexto_:()=> '22/10/2026 12:00',dataHojeConferencia_:()=> '22/10/2026'});return f;}
function parse(html,text){const a=html.indexOf('    function extrairRegistrosConferenciaTexto('),b=html.indexOf('    function adicionarProtocolosConferencia()',a);const c=vm.createContext({});vm.runInContext(html.slice(a,b),c);return plain(c.extrairRegistrosConferenciaTexto(text));}
const file='Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html',oldHtml=execFileSync('git',['show','7f5300f0f89b31286fc4e08e91db5d2ab082b609:'+file],{encoding:'utf8'}),newHtml=fs.readFileSync(file,'utf8');
const parser={};for(const [label,html] of [['original',oldHtml],['optimized',newHtml]]){const r=parse(html,raw);parser[label]={recognized:r.length,allFieldsCorrect:inputs.filter((e,i)=>fields.every(k=>(r[i]?.[k]??'')===e[k])).length,emptyMovement:r.filter(x=>!x.movimentacao).length};}
const base=new Map(data.CONFERENCIA_PROTOCOLOS.slice(1).map(r=>[String(r[0]).trim(),r]));let existing=0,unchanged=0,changed=0,concluded=0,concludedChanged=0,allCapturedFieldsUnchanged=0;
const ctx=create(current).context;
for(const x of inputs){const r=base.get(x.protocolo);if(!r)continue;existing++;if(fields.every((k,i)=>String(r[i]??'').trim()===String(x[k]??'').trim()))allCapturedFieldsUnchanged++;const before=ctx.objetoConferenciaDaLinha_(r);const next=ctx.extrairDataHoraMovimentacaoConferencia_(x.movimentacao)||x.movimentacao;const differs=ctx.movimentoConferenciaMudou_(before.dataHoraUltimaMovimentacao||before.movimentacao,next);if(differs)changed++;else unchanged++;if(before.estadoInterno==='CONCLUÍDO'){concluded++;if(differs)concludedChanged++;}}
const result={scope:'simulação local de Sheets; sem navegador/serviços Google ou concorrência real',inputCount:inputs.length,baseRecords:data.CONFERENCIA_PROTOCOLOS.length-1,historyRecords:data.HISTORICO_CONFERENCIA.length-1,matching:{existing,new:inputs.length-existing,movementUnchanged:unchanged,movementChanged:changed,concluded,concludedWithChangedMovement:concludedChanged,allCapturedFieldsUnchanged},parser,warmups:2,repetitions:9,benchmarks:[]};
function equivalent(a,b,ra,rb,name){
 if(name==='importar_755_estruturados') {
  // Importação passou a distinguir alterações de recapturas e a resumir sua auditoria.
  const ar=a.sheets.CONFERENCIA_PROTOCOLOS.cells,br=b.sheets.CONFERENCIA_PROTOCOLOS.cells;
  const rowsEqual=ar.length===br.length&&ar.every((r,i)=>r.every((v,j)=>j===17||String(v??'')===String(br[i]?.[j]??'')));
  const receipts=b.sheets.HISTORICO_CONFERENCIA.cells.slice(data.HISTORICO_CONFERENCIA.length).filter(r=>r[3]==='IMPORTAÇÃO SIAPI');
  return rowsEqual&&ra.novos===rb.novos&&ra.atualizados===rb.atualizados+rb.semAlteracao&&ra.totalProcessados===rb.totalProcessados&&receipts.length===1;
 }
 return isDeepStrictEqual(plain(ra),plain(rb))&&Object.keys(data).every(n=>isDeepStrictEqual(a.sheets[n].cells,b.sheets[n].cells));
}
function measure(name,run){const times={original:[],optimized:[]};let ok=true,calls,summary;
 for(let rep=-2;rep<9;rep++){const a=create(baseline),b=create(current),out={};for(const [label,f] of rep%2===0?[['original',a],['optimized',b]]:[['optimized',b],['original',a]]){const t=performance.now();out[label]=run(f);const d=performance.now()-t;if(rep>=0)times[label].push(d);}ok=ok&&equivalent(a,b,out.original,out.optimized,name);calls={original:a.stats,optimized:b.stats};summary=out.optimized;}
 const stats=v=>{v.sort((a,b)=>a-b);return {medianMs:+v[4].toFixed(3),minMs:+v[0].toFixed(3),maxMs:+v[8].toFixed(3)};};const r={name,equivalent:ok,original:stats(times.original),optimized:stats(times.optimized),calls,summary};result.benchmarks.push(r);console.log(JSON.stringify(r));}
measure('importar_755_estruturados',f=>f.context.salvarCapturasConferencia(inputs,'token'));
measure('consultar_fila_base',f=>{const r=f.context.listarFilaConferencia('token');return {count:r.itens.length,resumo:r.resumo};});
// Importação repetida não é incluída na medição da fila, para separar os custos.
const repeated={};for(const [label,code] of [['original',baseline],['optimized',current]]){const f=create(code);const first=f.context.salvarCapturasConferencia(inputs,'token');const history1=f.sheets.HISTORICO_CONFERENCIA.cells.length;const second=f.context.salvarCapturasConferencia(inputs,'token');repeated[label]={first,second,historyAddedOnSecondImport:f.sheets.HISTORICO_CONFERENCIA.cells.length-history1};}result.reimport=repeated;
// Teste de conclusão com responsável real do registro, sem expor sua identificação.
const active=data.CONFERENCIA_PROTOCOLOS.slice(1).find(r=>String(r[9]).trim()==='EM VERIFICAÇÃO'&&r[10]);
if(active)measure('concluir_protocolo_em_verificacao',f=>{f.context.exigirPerfil_=()=>({rg:String(active[10]).trim(),nome:'OPERADOR TESTE',perfil:'CONFERENCIA'});const r=f.context.concluirProtocoloConferencia(active[0],'APROVADO','TESTE LOCAL','token');return {sucesso:r.sucesso,estado:r.item.estadoInterno,permaneceNaFila:r.permaneceNaFila};});
// Atribuição/assunção/liberação usam registros fictícios na cópia local.
const synthetic='999999991/26';
measure('atribuir_assumir_liberar_concluir',f=>{const sh=f.sheets.CONFERENCIA_PROTOCOLOS;const row=Array(27).fill('');row[0]=synthetic;row[6]='A-2';row[9]='CADASTRADO';sh.cells.push(row);
 const atrib=f.context.atribuirProtocolosConferencia([synthetic],'token');
 const assume=f.context.assumirProtocoloConferencia(synthetic,'token');
 const libera=f.context.liberarProtocoloConferencia(synthetic,'token');
 const reassume=f.context.assumirProtocoloConferencia(synthetic,'token');
 const finish=f.context.concluirProtocoloConferencia(synthetic,'APROVADO','TESTE','token');
 return {atribuicao:atrib,assumir:assume,liberar:libera,reassumir:reassume,finalState:finish.item.estadoInterno};});
// Verificações independentes da mera igualdade entre versões.
const semantic={};
for(const [label,code] of [['original',baseline],['optimized',current]]) {
 const f=create(code);f.context.salvarCapturasConferencia(inputs,'token');
 const rows=new Map(f.sheets.CONFERENCIA_PROTOCOLOS.cells.slice(1).map(r=>[String(r[0]).trim(),r]));
 let correctFields=0,preservedStates=0,correctMovementFlags=0;
 for(const x of inputs) {
  const row=rows.get(x.protocolo);
  if(row&&fields.every((key,i)=>String(row[i]??'').trim()===String(x[key]??'').trim()))correctFields++;
  const previous=base.get(x.protocolo);if(!previous)continue;
  const before=f.context.objetoConferenciaDaLinha_(previous);
  const differs=f.context.movimentoConferenciaMudou_(before.dataHoraUltimaMovimentacao||before.movimentacao,f.context.extrairDataHoraMovimentacaoConferencia_(x.movimentacao)||x.movimentacao);
  if(row[9]===previous[9])preservedStates++;
  const flag=before.estadoInterno==='CONCLUÍDO'&&differs?'SIM':(before.novaMovimentacaoAposConclusao||'NÃO');
  if(row[24]===flag)correctMovementFlags++;
 }
 semantic[label]={correctFields,preservedStates,correctMovementFlags,historyAdded:f.sheets.HISTORICO_CONFERENCIA.cells.length-data.HISTORICO_CONFERENCIA.length};
 if(correctFields!==inputs.length||preservedStates!==existing||correctMovementFlags!==existing)process.exitCode=1;
}
result.semantic=semantic;
console.log(JSON.stringify({matching:result.matching,parser:result.parser,reimport:result.reimport,semantic}));
if(process.argv[5])fs.writeFileSync(process.argv[5],JSON.stringify(result,null,2),{mode:0o600});
if(result.benchmarks.some(r=>!r.equivalent))process.exitCode=1;
