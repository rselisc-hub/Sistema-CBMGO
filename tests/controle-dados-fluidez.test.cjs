const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path'),{execFileSync}=require('node:child_process');
const gs='WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs';
const current=fs.readFileSync(gs,'utf8'),previous=execFileSync('git',['show','a815433:'+gs],{encoding:'utf8'});
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8');
const m=new Module(path.resolve('tests/controle-fixture.cjs'));m.filename=path.resolve('tests/controle-fixture.cjs');m.paths=module.paths;m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture};',m.filename);
const {fixture}=m.exports,plain=x=>JSON.parse(JSON.stringify(x));
function row(width,fields){const r=Array(width).fill('');Object.entries(fields).forEach(([i,v])=>r[+i]=v);return r;}
function conf(code,rows){const f=fixture(code,{CONFERENCIA_PROTOCOLOS:[Array(27).fill('CAB'),...rows],HISTORICO_CONFERENCIA:[Array(12).fill('CAB')]});
 f.context.garantirEstruturaConferenciaProtocolos_=()=>f.sheets.CONFERENCIA_PROTOCOLOS;f.context.garantirEstruturaHistoricoConferencia_=()=>f.sheets.HISTORICO_CONFERENCIA;
 f.context.exigirPerfil_=()=>({rg:'1',nome:'TESTE',perfil:'CONFERENCIA'});return f;}
for(const count of [5,27,800])test('assumir '+count+' protocolos: mesmos campos e histórico, seis gravações por lote',()=>{
 const rows=Array.from({length:count},(_,i)=>row(27,{0:String(10000+i)+'/26',6:'A-2',7:123.45,9:'DISPONÍVEL',19:'1',20:'manter observação'}));
 const a=conf(previous,rows),b=conf(current,rows),protocols=rows.map(r=>r[0]);
 const old=a.context.assumirProtocolosSelecionadosConferencia(protocols,'token'),out=b.context.assumirProtocolosSelecionadosConferencia(protocols,'token');
 const {itens,...summary}=plain(out);assert.deepEqual(summary,plain(old));assert.equal(itens.length,count);
 assert.deepEqual(b.sheets.CONFERENCIA_PROTOCOLOS.cells,a.sheets.CONFERENCIA_PROTOCOLOS.cells);
 assert.deepEqual(b.sheets.HISTORICO_CONFERENCIA.cells,a.sheets.HISTORICO_CONFERENCIA.cells);
 assert.equal(a.stats.write,count*6);assert.equal(b.stats.write,6);
 console.log('Assumir '+count+': gravações '+a.stats.write+' → '+b.stats.write);
});
test('lote mantém conflitos, duplicatas, vazios e responsabilidade de outro conferente',()=>{
 const rows=[row(27,{0:'P1',9:'DISPONÍVEL'}),row(27,{0:'P2',9:'EM VERIFICAÇÃO',10:'2',11:'OUTRO'}),row(27,{0:'P3',9:'CONCLUÍDO'})];
 const f=conf(current,rows);const before=structuredClone(f.sheets.CONFERENCIA_PROTOCOLOS.cells);
 const out=f.context.assumirProtocolosSelecionadosConferencia(['P1','P1','','P2','P3','AUSENTE'],'token');
 assert.equal(out.assumidos,1);assert.equal(out.conflitos.length,3);
 assert.deepEqual(f.sheets.CONFERENCIA_PROTOCOLOS.cells.slice(2),before.slice(2));
 assert.equal(f.sheets.HISTORICO_CONFERENCIA.cells.length,2);
 assert.equal(f.context.assumirProtocolosSelecionadosConferencia(['P1'],'token').assumidos,0);
 assert.equal(f.sheets.HISTORICO_CONFERENCIA.cells.length,2);
});
test('consulta de atribuição/fila inclui os sinalizadores e a hora das colunas 24 a 27',()=>{
 const f=conf(current,[row(27,{0:'P1',9:'CONCLUÍDO',24:'SIM',26:'21/10/2026 10:00:00'}),row(27,{0:'P2',9:'DISPONÍVEL',23:'SIM',26:'20/10/2026 11:00:00'})]);
 f.context.exigirAtribuicaoConferencia_=()=>({rg:'1'});
 assert.equal(f.context.listarAtribuicaoConferencia({},'token').itens[0].protocolo,'P1');
 const x=f.context.listarFilaConferencia('token').itens[0];assert.equal(x.mesmaDataImportacao,'SIM');assert.equal(x.dataHoraUltimaMovimentacao,'20/10/2026 11:00:00');
 assert.equal(f.context.consultarProtocolosConferencia({atualizacao:'NOVA_MOVIMENTACAO'},'token').itens[0].protocolo,'P1');
});
test('busca individual preserva última ocorrência e normalização sem ler toda a tabela larga',()=>{
 const rows=[row(27,{0:' P1 ',9:'DISPONÍVEL',20:'primeiro'}),...Array.from({length:800},(_,i)=>row(27,{0:'P'+(i+2),9:'DISPONÍVEL'})),row(27,{0:'P1',9:'DISPONÍVEL',20:'último'})];
 const a=conf(previous,rows),b=conf(current,rows);
 assert.deepEqual(plain(b.context.assumirProtocoloConferencia('P1','token')),plain(a.context.assumirProtocoloConferencia('P1','token')));
 assert.deepEqual(b.sheets.CONFERENCIA_PROTOCOLOS.cells,a.sheets.CONFERENCIA_PROTOCOLOS.cells);assert.equal(b.stats.write,4);assert.equal(a.stats.write,6);
});
test('histórico consulta apenas as linhas correspondentes sem mudar ordem ou conteúdo',()=>{
 const rows=Array.from({length:1000},(_,i)=>row(12,{0:'22/10/2026',1:i%101?'OUTRO':' P1 ',3:'EVENTO',10:'detalhe '+i}));
 function run(code){const f=fixture(code,{HISTORICO_CONFERENCIA:[Array(12).fill('CAB'),...rows]});f.context.garantirEstruturaHistoricoConferencia_=()=>f.sheets.HISTORICO_CONFERENCIA;let cells=0;
 const sheet=f.sheets.HISTORICO_CONFERENCIA,get=sheet.getRange.bind(sheet);sheet.getRange=(r,c,n=1,w=1)=>{const range=get(r,c,n,w),read=range.getValues.bind(range);range.getValues=()=>{cells+=n*w;return read();};return range;};
 return {out:f.context.obterHistoricoConferencia('P1','token'),cells:()=>cells};}
 const a=run(previous),b=run(current);assert.deepEqual(plain(b.out),plain(a.out));assert.ok(b.cells()<a.cells()/5);
 console.log('Histórico (1.000 eventos): células lidas '+a.cells()+' → '+b.cells());
});
test('indicadores mantêm contagens com leitura restrita aos campos utilizados',()=>{
 const data={ACESSOS:[['ATIVO'],['SIM']],PENDENCIAS_VISTORIAS:[[],row(22,{4:'PENDENTE'}),row(22,{4:'FECHADO'})],SOLICITACOES_VISTORIA:[[],row(12,{9:'PENDENTE'})],CONFERENCIA_PROTOCOLOS:[[],row(27,{9:'DISPONÍVEL'}),row(27,{9:'EM VERIFICAÇÃO'})],DOCS_DESPACHO:[[],row(23,{2:'PENDENTE',3:'ISENÇÃO DE TAXA'}),row(23,{2:'CONCLUÍDO',3:'OUTRO'})],TACS:[[],row(12,{8:'VIGENTE'})]};
 function run(code){const f=fixture(code,data);Object.assign(f.context,{garantirEstruturaAcessos_:()=>f.sheets.ACESSOS,obterMapaCabecalhosAcessos_:()=>({ATIVO:0}),estaAtivoAcesso_:v=>v==='SIM',obterMapaFuncoesPessoal_:()=>({1:{funcoes:['VISTORIADOR']}}),obterAfastamentosVistoriadoresNaData_:()=>[],garantirEstruturaDocsDespacho_:()=>f.sheets.DOCS_DESPACHO,garantirEstruturaTacs_:()=>f.sheets.TACS});return f.context.obterIndicadoresGestor('token');}
 assert.deepEqual(plain(run(current)),plain(run(previous)));
});
// Reuse the archive service simulator without registering its test cases.
const arch=fs.readFileSync('tests/arquivamento-rascunhos.test.cjs','utf8'),am=new Module(path.resolve('tests/control-archive-fixture.cjs'));am.filename=path.resolve('tests/control-archive-fixture.cjs');am.paths=module.paths;am._compile(arch.slice(0,arch.indexOf("test('retenção"))+'\nmodule.exports={env};',am.filename);const {env}=am.exports;
test('apenas Gestor consulta, recupera, configura ou executa; autenticação precede qualquer efeito',()=>{
 const f=env();vm.runInContext(current,f.context);f.context.obterSessaoAcesso_=()=>({rg:'2',perfil:'CONFERENCIA'});
 for(const fn of [()=>f.context.inicializarControleDadosGestor('token'),()=>f.context.obterControleDadosGestor('token'),()=>f.context.gerenciarArquivoRascunhosGestor('executar','token'),()=>f.context.listarRascunhosArquivados('2026-10-01','token'),()=>f.context.restaurarRascunhoArquivado('id-1','token')])assert.throws(fn,/permissão/);
 assert.equal(f.bases.origem.cells.length,1);assert.equal(f.bases.destino.cells.length,0);
});
test('inicialização automática ocorre uma vez e respeita arquivamento pausado',()=>{
 const f=env();delete f.props.RASCUNHO_ARQUIVAMENTO_ATIVO;let installs=0;
 f.context.instalarArquivamentoRascunhos_=automatic=>{assert.equal(automatic,true);installs++;f.props.RASCUNHO_ARQUIVAMENTO_ATIVO='SIM';};
 assert.equal(f.context.inicializarControleDadosGestor('token').ativo,true);f.context.inicializarControleDadosGestor('token');assert.equal(installs,1);
 f.props.RASCUNHO_ARQUIVAMENTO_ATIVO='NÃO';assert.equal(f.context.inicializarControleDadosGestor('token').ativo,false);assert.equal(installs,1);
});
test('controle permite somente ações previstas, conserva pausa e devolve resumo atualizado',()=>{
 const f=env();let calls=[];f.context.instalarArquivamentoRascunhos_=()=>{calls.push('ativar');f.props.RASCUNHO_ARQUIVAMENTO_ATIVO='SIM';};f.context.ScriptApp={getProjectTriggers:()=>[]};
 const paused=f.context.gerenciarArquivoRascunhosGestor('pausar','token');assert.equal(paused.controle.ativo,false);assert.deepEqual(calls,[]);
 const active=f.context.gerenciarArquivoRascunhosGestor('ativar','token');assert.equal(active.controle.ativo,true);assert.deepEqual(calls,['ativar']);
 assert.throws(()=>f.context.gerenciarArquivoRascunhosGestor('apagar tudo','token'),/inválida/);
});
test('histórico de documentos mantém eventos, normalização de IDs e ordem de datas',()=>{
 const data={H:[Array(10).fill('CAB'),row(10,{0:'1',1:' DOC1 ',2:'22/10/2026 11:00:00',3:'NOVO',7:'primeiro'}),...Array.from({length:800},()=>row(10,{1:'DOC2'})),row(10,{0:'2',1:'DOC1',2:'22/10/2026 12:00:00',3:'NOVO',7:'último'})]};
 function run(code){const f=fixture(code,data);f.context.garantirHistoricoDocsDespacho_=()=>f.sheets.H;return f.context.obterHistoricoDocDespacho(' DOC1 ','token');}
 const a=run(previous),b=run(current);assert.deepEqual(plain(b),plain(a));assert.equal(b.eventos[0].detalhes,'último');
});
test('resumo de credenciamento mantém contagens e autoria com histórico antigo volumoso',()=>{
 const data={P:[[],row(15,{1:'APROVADO',11:'AGUARDANDO'}),row(15,{1:'EXIGÊNCIA'})],H:[[],...Array.from({length:800},()=>row(13,{0:'01/09/2026',2:'MOVIMENTACAO'})),row(13,{0:'22/10/2026 10:00:00',2:'MOVIMENTACAO',8:'1'}),row(13,{0:'22/10/2026 11:00:00',2:'MOVIMENTACAO_HISTORICA',9:'TESTE'}),row(13,{0:'22/10/2026',2:'IMPORTACAO',8:'1'})]};
 function run(code){const f=fixture(code,data);f.context.garantirEstruturaCredenciamentoProcessos_=()=>f.sheets.P;f.context.garantirEstruturaHistoricoCredenciamento_=()=>f.sheets.H;return f.context.obterResumoCredenciamento('token');}
 const a=run(previous),b=run(current);a.resumo.exigencia=1;assert.deepEqual(plain(b),plain(a));assert.equal(b.resumo.exigencia,1);assert.equal(b.resumo.analisadosHoje,2);assert.equal(b.resumo.meusHoje,2);
});
test('resumo de Atendimento usa apenas data e usuário, mantendo as contagens',()=>{
 const now=new Date(),old=new Date(now.getTime()-86400000),data={A:[[],[now.toISOString(),'1','demais campos'],[now.toISOString(),'2'],[old.toISOString(),'1'],['inválida','1']]};
 function run(code){const f=fixture(code,data);f.context.garantirEstruturaAtendimentos_=()=>f.sheets.A;return f.context.obterResumoAtendimentoHoje('token');}
 assert.deepEqual(plain(run(current)),plain(run(previous)));assert.equal(run(current).totalHoje,2);
});
