const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8'),gs=fs.readFileSync('WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs','utf8');
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8'),m=new Module(path.resolve('tests/entradas-fixture.cjs'));m.filename=path.resolve('tests/entradas-fixture.cjs');m.paths=module.paths;m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture};',m.filename);const {fixture}=m.exports;
const c=vm.createContext({});const a=html.indexOf('    function normalizarCabecalhoCredenciamento('),b=html.indexOf('    var credenciamentoClipboard=',a);vm.runInContext(html.slice(a,b),c);
const sei='PROTOCOLO Nº:\t900002/26\tNº CBMGO: 000000000001\tSERVIÇO: ANÁLISE DE PROJETO\nRAZÃO SOCIAL: EMPRESA FICTÍCIA LTDA\tOBM RESPONSÁVEL: 16º BBM - MINEIROS\nENDEREÇO: AVENIDA DE TESTE, QD: G, LT: 01\tCNPJ/CPF: 00000000000191\nMUNICÍPIO: MINEIROS\tÁREA: 1.582,91 m²\nRESPONSÁVEL TÉCNICO: TÉCNICO FICTÍCIO CREA/CAU: 0000000000XX-GO';
const siapi='Protocolo\tEnvio\tServiço\tRazão Social\tLogradouro\tBairro\tCidade/UF\n900001/26\t22/10/2026 20:33:39\tCREDENCIAMENTO DE EMPRESAS DE FORMAÇÃO\tEMPRESA DE TESTE LTDA\tRUA C148\tJARDIM AMÉRICA\tGOIÂNIA/GO';
const parse=(text,origin)=>c.extrairEntradaCredenciamento(text,origin,'');
function env(){const f=fixture(gs,{CREDENCIAMENTO_PROCESSOS:[Array(15).fill('')],HISTORICO_CREDENCIAMENTO:[Array(13).fill('')],CREDENCIAMENTO_COMPLEMENTOS:[]});
 Object.values(f.sheets).forEach(s=>{s.getMaxRows=()=>1000;s.insertRowsAfter=()=>{};const lista=s.getRangeList.bind(s);s.getRangeList=(...args)=>Object.assign(lista(...args),{setNumberFormat(){return this;}});});
 return f;}
test('SIAPI lê as sete colunas próprias do Credenciamento e separa cidade/UF',()=>{
 const x=parse(siapi,'SIAPI')[0];assert.equal(x.protocolo,'900001/26');assert.equal(x.dataEnvio,'22/10/2026 20:33:39');assert.equal(x.razaoSocial,'EMPRESA DE TESTE LTDA');assert.equal(x.cidade,'GOIÂNIA');assert.equal(x.estado,'GO');assert.equal(x.bairro,'JARDIM AMÉRICA');assert.equal(x.endereco,'RUA C148');
});
test('SIAPI aceita data e hora em linhas separadas e campos tabulados vazios',()=>{
 const raw='900001/26\t22/10/2026\n20:33:39\tSERVIÇO\tRAZÃO\t\t\tGOIÂNIA/GO';const x=parse(raw,'SIAPI')[0];assert.equal(x.dataEnvio,'22/10/2026 20:33:39');assert.equal(x.endereco,'');assert.equal(x.bairro,'');assert.equal(x.razaoSocial,'RAZÃO');
});
test('SEI identifica os rótulos do cabeçalho em duas colunas sem inventar número SEI ou UF',()=>{
 const x=parse(sei,'SEI')[0];assert.equal(x.protocolo,'900002/26');assert.equal(x.numeroCbmgo,'000000000001');assert.equal(x.cnpjCpf,'00000000000191');assert.equal(x.area,'1.582,91 m²');assert.equal(x.cidade,'MINEIROS');assert.equal(x.estado,'');assert.equal(x.numeroSei,undefined);assert.match(x.responsavelTecnico,/CREA\/CAU/);assert.equal(x.obmResponsavel,'16º BBM - MINEIROS');
});
test('múltiplos cabeçalhos SEI não misturam campos de protocolos diferentes',()=>{
 const all=parse(sei+'\n\n'+sei.replace('900002/26','900004/26').replace('MUNICÍPIO: MINEIROS','MUNICÍPIO: GOIÂNIA'),'SEI');assert.equal(all.length,2);assert.equal(all[0].cidade,'MINEIROS');assert.equal(all[1].cidade,'GOIÂNIA');
});
test('conteúdo incompleto é recusado antes de gravar',()=>{
 assert.throws(()=>parse('PROTOCOLO Nº: 900002/26\nMUNICÍPIO: MINEIROS','SEI'),/incompleto/);assert.throws(()=>parse('900001/26\tDATA\tSERVIÇO','SIAPI'),/7 colunas/);
 const f=env();assert.throws(()=>f.context.prepararEntradaCredenciamento([{protocolo:'INVALIDO'}],'SEI','token'),/inválido/);assert.equal(f.stats.write,0);
});
test('protocolo repetido no lote é recusado; servidor valida origem',()=>{
 const f=env(),r=parse(sei,'SEI');assert.throws(()=>f.context.prepararEntradaCredenciamento([r[0],r[0]],'SEI','token'),/repetido/);assert.throws(()=>f.context.prepararEntradaCredenciamento(r,'OUTRO','token'),/Origem/);assert.equal(f.stats.write,0);
});
test('fluxo SEI: importar, análise, salvar número manual sem concluir, concluir e consultar',()=>{
 const f=env(),ctx=f.context;const prep=ctx.prepararEntradaCredenciamento(parse(sei,'SEI'),'SEI','token');ctx.salvarAlimentacaoCredenciamento(prep.itens,'token');
 assert.equal(ctx.listarFilaCredenciamento('token').itens[0].origem,'SEI');assert.equal(ctx.consultarCredenciamento({},'token').itens.length,0);
 const numero='202600001234567';const saved=ctx.salvarNumeroSeiCredenciamento('900002/26',numero,'token');assert.equal(saved.item.numeroSei,numero);assert.equal(saved.item.estadoInterno,'AGUARDANDO');assert.equal(ctx.consultarCredenciamento({},'token').itens.length,0);
 const before=f.sheets.HISTORICO_CREDENCIAMENTO.cells.length;ctx.salvarNumeroSeiCredenciamento('900002/26',numero,'token');assert.equal(f.sheets.HISTORICO_CREDENCIAMENTO.cells.length,before);
 ctx.registrarMovimentacaoCredenciamento({protocolo:'900002/26',despacho:'APROVADO',numeroSei:numero},'token');assert.equal(ctx.listarFilaCredenciamento('token').itens.length,0);
 const x=ctx.consultarCredenciamento({},'token').itens[0];assert.equal(x.numeroSei,numero);assert.equal(x.origem,'SEI');assert.equal(x.cnpjCpf,'00000000000191');assert.equal(x.despacho,'APROVADO');
 assert.equal(f.sheets.CREDENCIAMENTO_PROCESSOS.cells[1].length,15);assert.equal(f.sheets.HISTORICO_CREDENCIAMENTO.cells.at(-1).length,13);
});
test('importação SIAPI usa Análise e os dados de endereço permanecem após concluir',()=>{
 const f=env(),ctx=f.context;ctx.salvarAlimentacaoCredenciamento(ctx.prepararEntradaCredenciamento(parse(siapi,'SIAPI'),'SIAPI','token').itens,'token');const x=ctx.listarFilaCredenciamento('token').itens[0];assert.equal(x.estado,'GO');assert.equal(x.dataEnvio,'22/10/2026 20:33:39');ctx.registrarMovimentacaoCredenciamento({protocolo:x.protocolo,despacho:'EXIGÊNCIA'},'token');assert.equal(ctx.consultarCredenciamento({},'token').itens[0].endereco,'RUA C148');
});
test('reimportar por outra origem mantém uma linha, número SEI e dados complementares',()=>{
 const f=env(),ctx=f.context,r=parse(sei,'SEI');ctx.salvarAlimentacaoCredenciamento(ctx.prepararEntradaCredenciamento(r,'SEI','token').itens,'token');ctx.salvarNumeroSeiCredenciamento('900002/26','202600000000001','token');
 const novo=parse(siapi.replace('900001/26','900002/26'),'SIAPI');ctx.salvarAlimentacaoCredenciamento(ctx.prepararEntradaCredenciamento(novo,'SIAPI','token').itens,'token');assert.equal(f.sheets.CREDENCIAMENTO_PROCESSOS.cells.length,2);const x=ctx.listarFilaCredenciamento('token').itens[0];assert.equal(x.numeroSei,'202600000000001');assert.equal(x.origem,'SEI / SIAPI');assert.equal(x.numeroCbmgo,'000000000001');
});
test('número SEI inválido é recusado antes de alterar base ou histórico',()=>{
 const f=env();const before=JSON.stringify(Object.values(f.sheets).map(s=>s.cells));assert.throws(()=>f.context.salvarNumeroSeiCredenciamento('900002/26','ABC','token'),/válido/);assert.equal(JSON.stringify(Object.values(f.sheets).map(s=>s.cells)),before);
});
test('tela mantém três abas, dois quadros de entrada e retira importação histórica',()=>{
 assert.match(html,/Alimentação via SIAPI/);assert.match(html,/Alimentação via SEI/);assert.match(html,/id="cred-modal-numero-sei"/);assert.doesNotMatch(html,/id="cred-historico-colado"/);
 for(const pane of ['alimentacao','analise','consulta'])assert.match(html,new RegExp('id="cred-pane-'+pane+'"'));
});
test('lote de 27 protocolos mantém dados e identidade em uma única linha por protocolo',()=>{
 const f=env(),ctx=f.context,regs=Array.from({length:27},(_,i)=>parse(siapi.replace('900001/26',String(160000+i)+'/26'),'SIAPI')[0]);
 const prep=ctx.prepararEntradaCredenciamento(regs,'SIAPI','token');ctx.salvarAlimentacaoCredenciamento(prep.itens,'token');assert.equal(ctx.listarFilaCredenciamento('token').itens.length,27);ctx.salvarAlimentacaoCredenciamento(prep.itens,'token');assert.equal(f.sheets.CREDENCIAMENTO_PROCESSOS.cells.length,28);assert.equal(f.sheets.CREDENCIAMENTO_COMPLEMENTOS.cells.length,28);
});
test('erro no fim do lote ou cabeçalho complementar incompatível não grava os protocolos',()=>{
 const f=env(),ctx=f.context,prep=ctx.prepararEntradaCredenciamento(parse(siapi,'SIAPI'),'SIAPI','token').itens;
 assert.throws(()=>ctx.salvarAlimentacaoCredenciamento(prep.concat([{protocolo:'900003/26',entradaCredenciamento:true,origem:'SEI',numeroSei:'INVÁLIDO'}]),'token'),/válido/);assert.equal(f.sheets.CREDENCIAMENTO_PROCESSOS.cells.length,1);
 f.sheets.CREDENCIAMENTO_COMPLEMENTOS.cells.push(['COLUNA DE OUTRA ESTRUTURA']);assert.throws(()=>ctx.salvarAlimentacaoCredenciamento(prep,'token'),/incompatível/);assert.equal(f.sheets.CREDENCIAMENTO_PROCESSOS.cells.length,1);
});
test('histórico legado permanece consultável sem complementos',()=>{
 const f=env(),r=Array(15).fill('');r[0]='10000/23';r[1]='APROVADO';r[11]='ANALISADO';f.sheets.CREDENCIAMENTO_PROCESSOS.cells.push(r);const hist=structuredClone(f.sheets.HISTORICO_CREDENCIAMENTO.cells);
 assert.equal(f.context.consultarCredenciamento({},'token').itens[0].protocolo,'10000/23');assert.deepEqual(f.sheets.HISTORICO_CREDENCIAMENTO.cells,hist);
});
test('endpoints de entrada e número SEI validam perfil antes de acessar dados',()=>{
 const f=env();vm.runInContext(gs,f.context);f.context.obterSessaoAcesso_=()=>({rg:'2',perfil:'ATENDIMENTO'});
 assert.throws(()=>f.context.prepararEntradaCredenciamento(parse(sei,'SEI'),'SEI','token'),/permissão/);assert.throws(()=>f.context.salvarNumeroSeiCredenciamento('900002/26','202600000000000','token'),/permissão/);assert.equal(f.stats.write,0);
});
