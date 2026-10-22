// Benchmark local com dados fornecidos por caminhos explícitos; não usa credenciais.
// Não mede serviços Google, renderização, geração de planilhas nem espera real por locks.
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const {isDeepStrictEqual}=require('node:util');
if(process.argv.length<4) {
 console.error('Uso: node tests/benchmark-vistorias.cjs <abas-operacionais.json> <entrada-estruturada.json> [resultado.json]');
 process.exit(2);
}
const testSource=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8');
const modulePath=path.resolve('tests/benchmark-adapter.cjs');
const adapter=new Module(modulePath);adapter.filename=modulePath;adapter.paths=module.paths;
adapter._compile(testSource.slice(0,testSource.indexOf('function row('))+'\nmodule.exports={fixture,current,baseline};',modulePath);
const {fixture,current,baseline}=adapter.exports;
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const inputs=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function create(code){
 const f=fixture(code,data);vm.runInContext(code,f.context);
 const props={};Object.assign(f.context,{
  exigirPerfil_:()=>({rg:'TESTE',nome:'OPERADOR TESTE'}),
  dataHoraSaoPauloTexto_:()=> '22/10/2026 12:00',
  PropertiesService:{getScriptProperties:()=>({setProperty:(k,v)=>props[k]=v,getProperty:k=>props[k],deleteProperty:k=>delete props[k]})},
  gerarPlanilhaDiariaVistoriadores_:()=>{}
 });return f;
}
const plain=x=>JSON.parse(JSON.stringify(x));
const quantile=(v,p)=>[...v].sort((a,b)=>a-b)[Math.ceil(v.length*p)-1];
const durations=v=>({medianMs:+quantile(v,.5).toFixed(3),minMs:+Math.min(...v).toFixed(3),maxMs:+Math.max(...v).toFixed(3)});
const scenarios=[
 ['consulta_historico',(f,items)=>f.context.obterHistoricoPorProtocoloRoteiro_(items.map(x=>x.protocolo))],
 ['analisar_e_salvar',(f,items)=>f.context.analisarESalvarDadosSiapiRoteiro(items,'2026-10-22','token')],
 ['distribuir',(f,items)=>f.context.lancarDistribuicaoRoteiroSiapi(items.map(x=>({...x,dataRoteiro:'22/10/2026',rg1:'TESTE-1',militar1:'VISTORIADOR TESTE',regiao:'CENTRO',periodo:'MATUTINO',tipoServico:x.servico})),'token')]
];
const result={scope:'execução local com adaptador Sheets em memória; tempos não são Google',warmups:2,repetitions:9,inputRecords:inputs.length,withInspector:inputs.filter(x=>x.vistoriadoPorSiapi).length,withoutInspector:inputs.filter(x=>!x.vistoriadoPorSiapi).length,scenarios:[]};
for(const count of [...new Set([Math.min(20,inputs.length),inputs.length])]) {
 for(const [name,run] of scenarios){
  const samples={original:[],optimized:[]};let stats={};let equivalent=true;
  for(let rep=-2;rep<9;rep++){
   const a=create(baseline),b=create(current),outputs={};
   const order=rep%2===0?[['original',a],['optimized',b]]:[['optimized',b],['original',a]];
   for(const [label,f] of order){
    const start=performance.now();outputs[label]=run(f,inputs.slice(0,count));const elapsed=performance.now()-start;
    if(rep>=0)samples[label].push(elapsed);
   }
   const sameResult=isDeepStrictEqual(plain(outputs.original),plain(outputs.optimized));
   const sameCells=Object.keys(data).every(n=>isDeepStrictEqual(a.sheets[n].cells,b.sheets[n].cells)&&isDeepStrictEqual(a.sheets[n].notes,b.sheets[n].notes));
   if(!sameResult||!sameCells)equivalent=false;
   stats={original:a.stats,optimized:b.stats};
  }
  const r={name,count,equivalent,original:{...durations(samples.original),calls:stats.original},optimized:{...durations(samples.optimized),calls:stats.optimized}};
  result.scenarios.push(r);console.log(JSON.stringify(r));
 }
}
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2),{mode:0o600});
if(result.scenarios.some(r=>!r.equivalent))process.exitCode=1;
