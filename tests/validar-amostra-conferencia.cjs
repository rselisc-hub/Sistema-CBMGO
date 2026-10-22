// Integração local: usa colagem real e JSONs privados fora do repositório.
// Compara invariantes de negócio, não exige histórico idêntico após otimização deliberada.
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const {performance}=require('node:perf_hooks'),{isDeepStrictEqual}=require('node:util');
if(process.argv.length<5){console.error('Uso: node tests/validar-amostra-conferencia.cjs <abas.json> <entrada-esperada.json> <colagem.txt> [resultado.json]');process.exit(2);}
const source=fs.readFileSync('tests/benchmark-vistorias.cjs','utf8'),mp=path.resolve('tests/amostra-adapter.cjs'),m=new Module(mp);m.filename=mp;m.paths=module.paths;
m._compile(source.slice(0,source.indexOf('const scenarios='))+'\nmodule.exports={create,data,inputs,current,baseline};',mp);
const {create,data,inputs,current,baseline}=m.exports;
const raw=fs.readFileSync(process.argv[4],'utf8'),html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const a=html.indexOf('    function extrairRegistrosConferenciaTexto('),b=html.indexOf('    function adicionarProtocolosConferencia()',a),p=vm.createContext({});vm.runInContext(html.slice(a,b),p);
const parsed=JSON.parse(JSON.stringify(p.extrairRegistrosConferenciaTexto(raw)));
if(!isDeepStrictEqual(parsed,inputs))throw new Error('A colagem não corresponde à entrada esperada independente.');
const times={original:{first:[],repeat:[]},optimized:{first:[],repeat:[]}};
let outcome,allBusinessEqual=true,expectedFields=true;
let differenceColumns={};
function setup(code){const f=create(code);f.context.exigirAtribuicaoConferencia_=()=>({rg:'OPERADOR_TESTE',nome:'OPERADOR TESTE',perfil:'GESTOR'});f.context.dataHojeConferencia_=()=> '22/10/2026';return f;}
const fields=['protocolo','movimentacao','logradouro','bairro','cidade','razaoSocial','divisao','area'];
for(let rep=-2;rep<9;rep++){
 const old=setup(baseline),now=setup(current),out={};
 for(const [label,f,records] of rep%2===0?[['original',old,inputs],['optimized',now,parsed]]:[['optimized',now,parsed],['original',old,inputs]]){
  const historyBefore=f.sheets.HISTORICO_CONFERENCIA.cells.length;
  let t=performance.now();const first=f.context.salvarCapturasConferencia(records,'token');const firstMs=performance.now()-t;
  const firstCalls={...f.stats};const historyAfter=f.sheets.HISTORICO_CONFERENCIA.cells.length;
  const firstRows=structuredClone(f.sheets.CONFERENCIA_PROTOCOLOS.cells);
  t=performance.now();const repeat=f.context.salvarCapturasConferencia(records,'token');const repeatMs=performance.now()-t;
  const repeatCalls=Object.fromEntries(Object.keys(f.stats).map(k=>[k,f.stats[k]-firstCalls[k]]));
  if(rep>=0){times[label].first.push(firstMs);times[label].repeat.push(repeatMs);}
  out[label]={first,repeat,firstCalls,repeatCalls,historyAddedFirst:historyAfter-historyBefore,historyAddedRepeat:f.sheets.HISTORICO_CONFERENCIA.cells.length-historyAfter,firstRows};
 }
 const oldRows=out.original.firstRows,nowRows=out.optimized.firstRows;
 // ATUALIZADO_EM passa a refletir alteração real; última captura continua na coluna própria.
 const businessEqual=oldRows.length===nowRows.length&&oldRows.every((r,i)=>r.every((v,j)=>j===17||String(v??'')===String(nowRows[i][j]??'')));
 differenceColumns={};oldRows.forEach((r,i)=>r.forEach((v,j)=>{if(j!==17&&String(v??'')!==String(nowRows[i]?.[j]??''))differenceColumns[j+1]=(differenceColumns[j+1]||0)+1;}));
 allBusinessEqual=allBusinessEqual&&businessEqual;
 const map=new Map(nowRows.slice(1).map(r=>[r[0],r]));
 expectedFields=expectedFields&&inputs.every(x=>fields.every((key,i)=>String(map.get(x.protocolo)?.[i]??'')===x[key]));
 delete out.original.firstRows;delete out.optimized.firstRows;outcome=out;
}
function stats(v){v.sort((a,b)=>a-b);return {medianMs:+v[4].toFixed(3),minMs:+v[0].toFixed(3),maxMs:+v[8].toFixed(3)};}
const result={scope:'local, sem Google, autorização real ou concorrência',parser:{records:parsed.length,allFieldsCorrect:true},warmups:2,repetitions:9,businessFieldsEqualExceptLastUpdate:allBusinessEqual,allCapturedFieldsPreserved:expectedFields,differenceColumns,outcome,timings:{original:{first:stats(times.original.first),repeat:stats(times.original.repeat)},optimized:{first:stats(times.optimized.first),repeat:stats(times.optimized.repeat)}}};
const total=inputs.length;
if(!allBusinessEqual||!expectedFields||outcome.optimized.repeat.semAlteracao!==total||outcome.optimized.historyAddedRepeat!==1)process.exitCode=1;
console.log(JSON.stringify(result));
if(process.argv[5])fs.writeFileSync(process.argv[5],JSON.stringify(result,null,2),{mode:0o600});
