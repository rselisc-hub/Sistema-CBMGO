const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path'),{execFileSync}=require('node:child_process');
const reference='75e660d';
const htmlFile='Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html',gsFile='WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs';
const oldHtml=execFileSync('git',['show',reference+':'+htmlFile],{encoding:'utf8'}),html=fs.readFileSync(htmlFile,'utf8');
const oldGs=execFileSync('git',['show',reference+':'+gsFile],{encoding:'utf8'}),gs=fs.readFileSync(gsFile,'utf8');
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8'),mp=path.resolve('tests/fila-adapter.cjs'),m=new Module(mp);m.filename=mp;m.paths=module.paths;m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture};',mp);const {fixture}=m.exports;
const plain=x=>JSON.parse(JSON.stringify(x));
class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-10-22T12:00:00Z']));}}
const items=Array.from({length:800},(_,i)=>({protocolo:String(990000+i)+'/26',estadoInterno:i%3?'DISPONÍVEL':'EM VERIFICAÇÃO',rgConferente:i%2?'1':'2',divisao:i%7?'A-2':'F-7',dataHoraUltimaMovimentacao:i%11?String(i%28+1).padStart(2,'0')+'/'+String(i%12+1).padStart(2,'0')+'/2026 10:00:00':'',atribuidoEm:'22/10/2026 10:00:00'}));
function frontend(code){const tb={innerHTML:''};const c=vm.createContext({Date:FixedDate,usuarioLogado:{rg:'1'},conferenciaFilaCache:structuredClone(items),conferenciaFiltroFila:'TODOS',document:{getElementById:()=>tb},obterItensFiltradosFilaConferencia:()=>c.conferenciaFilaCache.filter((_,i)=>i%2),escaparHtmlRoteiro:x=>String(x??''),escaparJsConferencia:x=>String(x??''),sinalizacaoConferenciaHtml:()=>''});
 const a=code.indexOf('    function dataConferenciaParaTimestamp_('),b=code.indexOf('    function alternarTodosDisponiveisConferencia',a);vm.runInContext(code.slice(a,b),c);
 let calls=0;const date=c.chaveDataFilaConferencia_;c.chaveDataFilaConferencia_=(...args)=>{calls++;return date(...args);};return {c,tb,calls:()=>calls};}
test('ordenação de 800 protocolos mantém prioridade F-7, responsáveis, datas e desempates',()=>{
 const old=frontend(oldHtml),now=frontend(html);const input=structuredClone(items);const a=old.c.ordenarFilaConferenciaFrontend(input),b=now.c.ordenarFilaConferenciaFrontend(input);
 assert.deepEqual(plain(b),plain(a));assert.deepEqual(input,items);assert.equal(now.calls(),800);assert.ok(old.calls()>800);
});
test('renderização da fila filtrada mantém HTML e índices corretos para assumir e continuar',()=>{
 const old=frontend(oldHtml),now=frontend(html);old.c.renderizarFilaConferencia();now.c.renderizarFilaConferencia();assert.equal(now.tb.innerHTML,old.tb.innerHTML);
});
test('servidor preserva registros, ordem e contadores com uma chave de data por item',()=>{
 const data={CONFERENCIA_PROTOCOLOS:[Array(27).fill('CAB'),...items.map((x,i)=>{const r=Array(27).fill('');r[0]=x.protocolo;r[1]=x.dataHoraUltimaMovimentacao;r[6]=x.divisao;r[9]=i%5?x.estadoInterno:'CONCLUÍDO';r[10]=x.rgConferente;r[14]=x.atribuidoEm;r[21]=x.dataHoraUltimaMovimentacao.slice(0,10);return r;})],HISTORICO_CONFERENCIA:[Array(12).fill('CAB')]};
 function run(code){const f=fixture(code,data);f.context.Date=FixedDate;let count=0;const date=f.context.chaveDataFilaConferenciaServidor_;f.context.chaveDataFilaConferenciaServidor_=(...args)=>{count++;return date(...args);};const out=f.context.listarFilaConferencia('token');return {out,count};}
 const a=run(oldGs),b=run(gs);assert.deepEqual(plain(b.out),plain(a.out));assert.equal(b.count,b.out.itens.length);assert.ok(a.count>b.count);
});
for(const [screen,allowed,expected] of [['fila',false,'fila'],['atribuicao',true,'atribuicao'],['atribuicao',false,'fila'],['consulta',true,'consulta']])test('abertura direta, sem preparação remota: '+screen+'/'+allowed,()=>{
 let opened;const elements={};const c=vm.createContext({usuarioLogado:{permissoes:{conferencia:true,conferenciaAtribuir:allowed}},conferenciaTelaAtual:screen,document:{getElementById:id=>elements[id]??=( {style:{}} )},esconderTelasPrincipais(){},registrarTelaAtual(){},popularStatusConferencia(){},iniciarAtualizacaoAutomaticaConferencia(){},abrirTelaAtribuicaoConferencia(){opened='atribuicao';},abrirTelaFilaConferencia(){opened='fila';},abrirTelaConsultaConferencia(){opened='consulta';},alert(){throw new Error('Acesso inesperadamente negado');}});
 const a=html.indexOf('    function abrirModuloConferencia('),b=html.indexOf('    function marcarNavConferencia(',a);vm.runInContext(html.slice(a,b),c);c.abrirModuloConferencia();assert.equal(opened,expected);assert.equal(elements['conf-nav-atribuicao'].style.display,allowed?'inline-block':'none');
});
