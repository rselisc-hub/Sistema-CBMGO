const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const gs=fs.readFileSync('WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs','utf8'),html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8'),m=new Module(path.resolve('tests/consulta-fixture.cjs'));m.filename=path.resolve('tests/consulta-fixture.cjs');m.paths=module.paths;m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture};',m.filename);const {fixture}=m.exports;
function row(p,date,mov='',desp='EXIGÊNCIA'){const r=Array(15).fill('');r[0]=p;r[1]=desp;r[8]=mov;r[14]=date;return r;}
function env(rows=[]){const f=fixture(gs,{CREDENCIAMENTO_PROCESSOS:[Array(15).fill('CAB'),...rows]});f.context.garantirEstruturaCredenciamentoProcessos_=()=>f.sheets.CREDENCIAMENTO_PROCESSOS;return f;}
test('consulta ordena atualizações por dia/mês/ano e horário completo, sem modificar a base',()=>{
 const f=env([row('P1','30/09/2026 23:59:59','30/09/2026'),row('P3','23/10/2026 09:00:00','23/10/2026'),row('P2','23/10/2026 16:20:00','22/10/2026'),row('P4','01/10/2026 12:00:00','01/10/2026')]);const before=structuredClone(f.sheets.CREDENCIAMENTO_PROCESSOS.cells);
 assert.deepEqual(Array.from(f.context.consultarCredenciamento({},'token').itens,x=>x.protocolo),['P2','P3','P4','P1']);assert.deepEqual(f.sheets.CREDENCIAMENTO_PROCESSOS.cells,before);assert.equal(f.stats.write,0);
});
test('consulta usa datas alternativas nos registros antigos e desempata pelo protocolo',()=>{
 const a=row('10/26','','22/10/2026'),b=row('2/26','','22/10/2026'),c=row('P0','inválida');c[13]='23/10/2026 11:00:00';
 const f=env([a,b,c,row('SEM DATA','')]);assert.deepEqual(Array.from(f.context.consultarCredenciamento({},'token').itens,x=>x.protocolo),['P0','2/26','10/26','SEM DATA']);
});
test('datas impossíveis não interferem na ordenação e filtro de despacho permanece',()=>{
 const f=env([row('P1','23/10/2026 10:00:00','','APROVADO'),row('P2','22/10/2026 10:00:00')]);const parse=f.context.timestampAtualizacaoCredenciamento_;
 for(const value of ['31/02/2026','23/10/2026 25:00:00','2026-13-01','texto',''])assert.equal(parse(value),0);
 assert.ok(parse('2026-10-23 12:05:30')>parse('23/10/2026 12:05:29'));
 assert.deepEqual(Array.from(f.context.consultarCredenciamento({despacho:'EXIGÊNCIA'},'token').itens,x=>x.protocolo),['P2']);
});
test('exigência mantém o texto sem fundo amarelo e mostra a atualização usada na consulta',()=>{
 const tbody={innerHTML:''},c=vm.createContext({document:{getElementById:()=>tbody},escaparHtmlRoteiro:x=>String(x??'')});const a=html.indexOf('    function renderizarConsultaCredenciamento('),b=html.indexOf('    function abrirAvisoCredenciamento(',a);vm.runInContext(html.slice(a,b),c);
 c.renderizarConsultaCredenciamento([{protocolo:'10001/26',despacho:'EXIGÊNCIA',atualizadoEm:'23/10/2026 12:30:10'}]);assert.match(tbody.innerHTML,/EXIGÊNCIA/);assert.match(tbody.innerHTML,/23\/10\/2026 12:30:10/);assert.doesNotMatch(tbody.innerHTML,/cred-row-exigencia/);assert.doesNotMatch(html,/\.cred-row-exigencia/);
 c.renderizarConsultaCredenciamento([]);assert.match(tbody.innerHTML,/colspan="12"/);
});
