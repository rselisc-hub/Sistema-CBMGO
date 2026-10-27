const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const gs=fs.readFileSync('WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs','utf8'),html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8'),m=new Module(path.resolve('tests/tres-fixture.cjs'));m.filename=path.resolve('tests/tres-fixture.cjs');m.paths=module.paths;m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture};',m.filename);const {fixture}=m.exports;
const plain=x=>JSON.parse(JSON.stringify(x));function row(w,fields){const r=Array(w).fill('');for(const [k,v]of Object.entries(fields))r[+k]=v;return r;}
function docs(){const f=fixture(gs,{DOCS_DESPACHO:[],HISTORICO_DOCS_DESPACHO:[]});let id=0;f.context.Utilities.getUuid=()=>String(++id);f.context.Session={getScriptTimeZone:()=> 'America/Sao_Paulo'};return f;}
test('DOC de evento temporário mantém tipo e sinalização em listagem e edição',()=>{
 const f=docs(),ctx=f.context;ctx.cadastrarDocDespacho({tipoDocumento:'ANEXO F',protocolo:'900001/26',dataDocumento:'2026-10-22',razaoSocial:'EMPRESA FICTÍCIA',eventoTemporario:true},'token');
 let r=ctx.listarDocsDespacho({status:'TODOS'},'token').registros[0];assert.equal(r.eventoTemporario,true);assert.equal(r.tipoDocumento,'ANEXO F');assert.equal(f.sheets.DOCS_DESPACHO.cells[0][23],'EVENTO_TEMPORARIO');
 ctx.editarDadosDocDespachoGestao({id:r.id,tipoDocumento:r.tipoDocumento,protocolo:r.protocolo,dataDocumento:'2026-10-22',razaoSocial:r.razaoSocial},'token');assert.equal(ctx.listarDocsDespacho({status:'TODOS'},'token').registros[0].eventoTemporario,true);
 ctx.editarDadosDocDespachoGestao({id:r.id,tipoDocumento:r.tipoDocumento,protocolo:r.protocolo,dataDocumento:'2026-10-22',razaoSocial:r.razaoSocial,eventoTemporario:false},'token');assert.equal(ctx.listarDocsDespacho({status:'TODOS'},'token').registros[0].eventoTemporario,false);
});
test('DOC anterior com 23 colunas permanece legível e sem rosa por padrão',()=>{
 const f=docs();f.sheets.DOCS_DESPACHO.cells.push(Array(23).fill(''),row(23,{0:'D1',2:'PENDENTE',3:'ANEXO F',4:'900001/26',7:'22/10/2026',10:'FICTÍCIA'}));const r=f.context.listarDocsDespacho({status:'TODOS'},'token').registros[0];assert.equal(r.eventoTemporario,false);assert.equal(r.protocolo,'900001/26');assert.equal(f.sheets.DOCS_DESPACHO.cells[1].length,23);
});
test('rascunho persiste as três prioridades e observações e não altera lançados ou removidos',()=>{
 const values=['ATRASADA','PEDIDO CEL','EVENTO TEMPORÁRIO'];const f=fixture(gs,{RASCUNHO_ROTEIRO:[[],...values.map((p,i)=>row(23,{0:'22/10/2026',1:'P'+i,13:'NORMAL',20:'RASCUNHO'})),row(23,{0:'22/10/2026',1:'LAN',13:'NORMAL',20:'LANÇADO'}),row(23,{0:'22/10/2026',1:'REM',13:'NORMAL',20:'REMOVIDO'})]});
 const before=structuredClone(f.sheets.RASCUNHO_ROTEIRO.cells.slice(4));const result=f.context.atualizarPreferenciasRascunhosRoteiro(values.map((p,i)=>({protocolo:'P'+i,dataRoteiro:'2026-10-22',prioridade:p,observacao:'nota '+i})).concat([{protocolo:'LAN',dataRoteiro:'2026-10-22',prioridade:'ATRASADA'},{protocolo:'REM',dataRoteiro:'2026-10-22',prioridade:'ATRASADA'}]),'token');assert.equal(result.atualizados,3);assert.equal(result.ignorados.length,2);
 values.forEach((p,i)=>{assert.equal(f.sheets.RASCUNHO_ROTEIRO.cells[i+1][13],p);assert.equal(f.sheets.RASCUNHO_ROTEIRO.cells[i+1][12],'nota '+i);});assert.deepEqual(f.sheets.RASCUNHO_ROTEIRO.cells.slice(4),before);
});
test('cor explícita rosa ou laranja não se transforma em vermelho ao adicionar observação',()=>{
 const f=fixture(gs,{}),c=vm.createContext({});const a=html.indexOf('    function estiloProtocoloRoteiro('),b=html.indexOf('    function opRegioesRoteiro(',a);vm.runInContext(html.slice(a,b),c);
 for(const [prioridade,cor]of [['ATRASADA','#FF6B6B'],['PEDIDO CEL','#F4B183'],['EVENTO TEMPORÁRIO','#F062B0']]){assert.match(c.estiloProtocoloRoteiro({prioridade,observacao:'nota'}),new RegExp(cor));assert.equal(f.context.corPrioridadePlanilhaRoteiro_(prioridade,true),cor);}
});
test('preferência inválida no final do lote impede todas as gravações',()=>{
 const f=fixture(gs,{RASCUNHO_ROTEIRO:[[],row(23,{0:'22/10/2026',1:'P1',13:'NORMAL',20:'RASCUNHO'})]});assert.throws(()=>f.context.atualizarPreferenciasRascunhosRoteiro([{protocolo:'P1',dataRoteiro:'2026-10-22',prioridade:'ATRASADA'},{protocolo:'P2',dataRoteiro:'2026-10-22',prioridade:'COR INVÁLIDA'}],'token'),/inválida/);assert.equal(f.stats.write,0);
});
test('último conferente usa última conclusão, mesmo se F-7 foi liberado ou assumido por outro',()=>{
 const f=fixture(gs,{CONFERENCIA_PROTOCOLOS:[[],row(27,{0:'P1',6:'F-7',9:'EM VERIFICAÇÃO',10:'3',11:'ATUAL',16:'22/10/2026 12:00:00'}),row(27,{0:'P2',9:'CONCLUÍDO',10:'1',11:'ANA',16:'22/10/2026'})],HISTORICO_CONFERENCIA:[[],row(12,{0:'21/10/2026 10:00:00',1:'P1',3:'CONCLUÍDO',4:'1',5:'ANA'}),row(12,{0:'22/10/2026 12:00:00',1:'P1',3:'CONCLUÍDO',4:'2',5:'JOÃO'}),row(12,{0:'22/10/2026 13:00:00',1:'P1',3:'ASSUMIDO',4:'3',5:'ATUAL'})]});
 let r=f.context.consultarProtocolosConferencia({ultimoConferente:'joao'},'token');assert.equal(r.itens.length,1);assert.equal(r.itens[0].protocolo,'P1');assert.equal(r.itens[0].ultimoConferente,'JOÃO');assert.deepEqual(plain(r.conferentes),['ANA','JOÃO']);r=f.context.consultarProtocolosConferencia({ultimoConferente:'1'},'token');assert.equal(r.itens[0].protocolo,'P2');assert.equal(f.context.consultarProtocolosConferencia({ultimoConferente:'ATUAL'},'token').itens.length,0);
});
function browserQueue(){const elements={'rot-data-roteiro':{value:'2026-10-22'},'rot-rascunho-gravacao-status':{},'rot-rascunho-repetir':{style:{}}};const calls=[];let success,failure;const run={withSuccessHandler(cb){success=cb;return this;},withFailureHandler(cb){failure=cb;return this;},atualizarPreferenciasRascunhosRoteiro(items){calls.push(plain(items));}};
 const c=vm.createContext({document:{getElementById:id=>elements[id]||null},dadosSiapiRoteiro:[{protocolo:'P1'}],google:{script:{run}},sessaoToken:'t',setTimeout(){},clearTimeout(){},estiloProtocoloRoteiro:()=>''});const a=html.indexOf('    var preferenciasRascunhoPendentes='),b=html.indexOf('    function ehCadastroManualRoteiro(',a);vm.runInContext(html.slice(a,b),c);return {c,calls,elements,success:r=>success(r),failure:()=>failure(new Error('falha'))};}
test('salvamento serializado não apaga alteração feita enquanto uma gravação está em voo',()=>{
 const f=browserQueue();f.c.atualizarCampoManualRoteiro(0,'prioridade','ATRASADA');f.c.gravarPreferenciasRascunhoPendentes();f.c.atualizarCampoManualRoteiro(0,'prioridade','EVENTO TEMPORÁRIO');f.c.gravarPreferenciasRascunhoPendentes();assert.equal(f.calls.length,1);f.success({ignorados:[]});assert.equal(f.calls.length,2);assert.equal(f.calls[1][0].prioridade,'EVENTO TEMPORÁRIO');f.success({ignorados:[]});assert.equal(Object.keys(f.c.preferenciasRascunhoPendentes).length,0);
});
test('falha ao salvar conserva escolhas e permite repetir o mesmo lote',()=>{
 const f=browserQueue();f.c.atualizarCampoManualRoteiro(0,'prioridade','PEDIDO CEL');f.c.gravarPreferenciasRascunhoPendentes();f.failure();assert.equal(Object.keys(f.c.preferenciasRascunhoPendentes).length,1);assert.equal(f.elements['rot-rascunho-repetir'].style.display,'inline-block');f.c.gravarPreferenciasRascunhoPendentes();assert.equal(f.calls.length,2);assert.equal(f.calls[1][0].prioridade,'PEDIDO CEL');f.success({ignorados:[]});assert.equal(Object.keys(f.c.preferenciasRascunhoPendentes).length,0);
});
test('prioridade permanece ao adicionar outro SIAPI e encerra o rascunho normalmente ao distribuir',()=>{
 const f=fixture(gs,{RASCUNHO_ROTEIRO:[[],row(23,{0:'22/10/2026',1:'P1',13:'NORMAL',20:'RASCUNHO'})],ROTEIRO_VISTORIAS:[[]],HISTORICO_VISTORIAS:[[]]});const c=f.context;
 Object.assign(c,{garantirAbasEssenciaisRoteiroRapido_:()=>({roteiro:f.sheets.ROTEIRO_VISTORIAS,hist:f.sheets.HISTORICO_VISTORIAS}),mapaAfastamentosPorDataRoteiro_:()=>({}),normalizarRegiaoOficial_:v=>v||'',atualizarStatusOrigemRoteiroRapido_:()=>{},marcarSincronizacaoRoteiroPendente_:()=>{}});
 c.atualizarPreferenciasRascunhosRoteiro([{protocolo:'P1',dataRoteiro:'2026-10-22',prioridade:'EVENTO TEMPORÁRIO',observacao:'manter'}],'token');
 c.salvarRascunhosRoteiro([{protocolo:'P2'}],'2026-10-22','token');let lista=c.obterRascunhosRoteiro('2026-10-22','token').itens;assert.equal(lista.find(x=>x.protocolo==='P1').prioridade,'EVENTO TEMPORÁRIO');assert.equal(lista.find(x=>x.protocolo==='P1').observacao,'manter');
 c.lancarDistribuicaoRoteiroSiapi([{protocolo:'P1',dataRoteiro:'2026-10-22',prioridade:'EVENTO TEMPORÁRIO',observacao:'manter',rg1:'1',militar1:'TESTE'}],'token');
 assert.equal(f.sheets.RASCUNHO_ROTEIRO.cells[1][20],'LANÇADO');assert.equal(f.sheets.ROTEIRO_VISTORIAS.cells[1][12],'EVENTO TEMPORÁRIO');
 const late=c.atualizarPreferenciasRascunhosRoteiro([{protocolo:'P1',dataRoteiro:'2026-10-22',prioridade:'ATRASADA',observacao:'atrasada'}],'token');assert.equal(late.atualizados,0);assert.equal(f.sheets.RASCUNHO_ROTEIRO.cells[1][13],'EVENTO TEMPORÁRIO');assert.equal(c.obterRascunhosRoteiro('2026-10-22','token').itens.some(x=>x.protocolo==='P1'),false);
});
test('oficial do despacho é distinto do usuário que registra e fica visível em abertos e concluídos',()=>{
 const f=docs(),c=f.context;c.exigirPerfil_=()=>({rg:'9',nome:'OPERADOR FICTÍCIO',perfil:'GESTOR'});
 c.cadastrarDocDespacho({tipoDocumento:'ANEXO F',protocolo:'900001/26',dataDocumento:'2026-10-22',razaoSocial:'EMPRESA FICTÍCIA',oficialDespacho:'TEN EXEMPLO',eventoTemporario:true},'token');
 let r=c.listarDocsDespacho({status:'TODOS'},'token').registros[0];assert.match(f.sheets.HISTORICO_DOCS_DESPACHO.cells.at(-1)[7],/Oficial que despachou: TEN EXEMPLO/);assert.equal(r.oficialDespacho,'TEN EXEMPLO');assert.equal(r.preenchidoPor,'OPERADOR FICTÍCIO');
 c.atualizarDocDespachoGestao({id:r.id,andamento:'CONCLUÍDO',oficialDespacho:'CAP EXEMPLO',respostaOficiais:'Despachado'},'token');
 r=c.listarDocsDespacho({status:'CONCLUIDOS'},'token').registros[0];assert.equal(r.oficialDespacho,'OPERADOR FICTÍCIO');assert.equal(r.responsavelGestao,'OPERADOR FICTÍCIO');assert.equal(r.eventoTemporario,true);assert.match(f.sheets.HISTORICO_DOCS_DESPACHO.cells.at(-1)[7],/Oficial que despachou: OPERADOR FICTÍCIO/);assert.match(f.sheets.HISTORICO_DOCS_DESPACHO.cells.at(-1)[7],/Oficial anterior: TEN EXEMPLO/);
 c.atualizarDocDespachoGestao({id:r.id,andamento:'AGUARDANDO RESPOSTA',justificativa:'Atualizar andamento sem substituir o oficial'},'token');assert.equal(c.listarDocsDespacho({status:'ABERTOS'},'token').registros[0].oficialDespacho,'OPERADOR FICTÍCIO');
});
test('DOCs antigos não recebem oficial presumido e edição cadastral preserva oficial preenchido',()=>{
 const f=docs(),c=f.context;c.cadastrarDocDespacho({tipoDocumento:'ANEXO F',protocolo:'900001/26',dataDocumento:'2026-10-22',razaoSocial:'EMPRESA FICTÍCIA'},'token');let r=c.listarDocsDespacho({status:'TODOS'},'token').registros[0];assert.equal(r.oficialDespacho,'');
 c.atualizarDocDespachoGestao({id:r.id,andamento:'EM ANÁLISE',oficialDespacho:'CAP EXEMPLO'},'token');c.editarDadosDocDespachoGestao({id:r.id,tipoDocumento:r.tipoDocumento,protocolo:r.protocolo,dataDocumento:'2026-10-22',razaoSocial:r.razaoSocial,eventoTemporario:true},'token');r=c.listarDocsDespacho({status:'TODOS'},'token').registros[0];assert.equal(r.oficialDespacho,'');assert.equal(r.eventoTemporario,true);assert.equal(f.sheets.DOCS_DESPACHO.cells[0][24],'OFICIAL_DESPACHO');
});

test('data do despacho usa finalização auditada e ordena sem usar edição posterior',()=>{
 const f=docs(),c=f.context;
 for(const n of [1,2])c.cadastrarDocDespacho({tipoDocumento:'ANEXO F',protocolo:'90000'+n+'/26',dataDocumento:'2026-10-22',razaoSocial:'FICTÍCIA'},'token');
 const a=f.sheets.DOCS_DESPACHO.cells[1],b=f.sheets.DOCS_DESPACHO.cells[2];
 a[2]=b[2]='CONCLUÍDO';a[20]='27/10/2026 15:00:00';b[20]='26/10/2026 11:00:00';
 f.sheets.HISTORICO_DOCS_DESPACHO.cells.push(row(10,{1:a[0],2:'25/10/2026 10:00:00',4:'PENDENTE',5:'CONCLUÍDO',9:'ANA TESTE'}),row(10,{1:b[0],2:'26/10/2026 11:00:00',4:'PENDENTE',5:'CONCLUÍDO'}),row(10,{1:a[0],2:'27/10/2026 15:00:00',4:'CONCLUÍDO',5:'CONCLUÍDO'}));
 for(const situacao of ['CONCLUIDOS','TODOS']){const r=c.listarDocsDespacho({situacao},'token').registros;assert.equal(r[0].id,b[0]);assert.equal(r[1].dataDespacho,'25/10/2026 10:00:00');assert.equal(r[1].despachadoPor,'ANA TESTE');}
});
