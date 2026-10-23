const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const file = 'WebApp_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.gs';
const current = fs.readFileSync(file, 'utf8');
const baseline = execFileSync('git', ['show', '7f5300f0f89b31286fc4e08e91db5d2ab082b609:' + file], {encoding:'utf8'});
const plain = x => JSON.parse(JSON.stringify(x));
function fixture(code, data) {
  const stats = {read:0, search:0, write:0};
  const sheets = {};
  for (const [name, rows] of Object.entries(data)) {
    const cells = structuredClone(rows);
    const sheet = {
      cells, notes:{}, getLastRow:()=>cells.length, getLastColumn:()=>Math.max(1,...cells.map(r=>r.length)),
      setFrozenRows(){return this;}, autoResizeColumns(){return this;},
      appendRow(values){stats.write++;cells.push(Array.from(values));return this;},
      getRange(row, col, count=1, width=1) {
        if (typeof row === 'string') {
          const m = row.match(/^([A-Z]+)([0-9]+)$/);
          col = [...m[1]].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0);row=Number(m[2]);
        }
        const range = {
          getRow:()=>row,
          getA1Notation:()=>{let n=col,a='';while(n){n--;a=String.fromCharCode(65+n%26)+a;n=Math.floor(n/26);}return a+row;},
          setFontWeight(){return this;}, setBackground(){return this;},setFontColor(){return this;},setHorizontalAlignment(){return this;},
          getValue(){return this.getValues()[0][0];},
          setNotes(values) {sheet.notes[row]=structuredClone(values);return this;},
          getValues() {stats.read++;return Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>cells[row+i-1]?.[col+j-1] ?? ''));},
          getDisplayValues() {return this.getValues().map(r=>r.map(String));},
          getDisplayValue() {return this.getDisplayValues()[0][0];},
          setValues(values) {stats.write++; values.forEach((r,i)=>r.forEach((v,j)=>{cells[row+i-1]??=[];cells[row+i-1][col+j-1]=v;}));return this;},
          setValue(v) {return this.setValues([[v]]);},
          clearContent() {return this.setValues(Array.from({length:count},()=>Array(width).fill('')));},
          createTextFinder(text) {
            let entire=true;return {matchEntireCell(v){entire=v;return this;},findAll(){stats.search++;return Array.from({length:count},(_,i)=>row+i).filter(r=>entire?String(cells[r-1]?.[col-1]??'').toUpperCase()===String(text).toUpperCase():String(cells[r-1]?.[col-1]??'').toUpperCase().includes(String(text).toUpperCase())).map(r=>({getRow:()=>r}));}};
          }
        };return range;
      },
      getRangeList(addresses) {return {setValue(v){stats.write++;addresses.forEach(a=>{const m=a.match(/^([A-Z]+)([0-9]+)$/);const col=[...m[1]].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0);cells[Number(m[2])-1][col-1]=v;});}};}
    };sheets[name]=sheet;
  }
  const context = vm.createContext({console,SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null}),flush(){}},LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true;},releaseLock(){}}),getDocumentLock:()=>({waitLock(){},tryLock(){return true;},releaseLock(){}})},Utilities:{formatDate:()=> '22/10/2026',DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algo,value)=>Array.from(require('node:crypto').createHash(algo).update(value).digest()),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url')}});
  vm.runInContext(code,context);
  Object.assign(context,{
    exigirPerfil_:()=>({rg:'1',nome:'TESTE'}),
    garantirEstruturaRascunhoRoteiro_:()=>sheets.RASCUNHO_ROTEIRO,
    criarDataSegura:v=>v?new Date(2026,9,22):null,
    formatarDataTexto:()=> '22/10/2026',dataHoraSaoPauloTexto_:()=> '22/10/2026 12:00',
    chaveDataRoteiro_:v=>String(v),gerarPlanilhaDiariaVistoriadores_:()=>{},
    andamentoMaisDe20DiasNaCopia_:()=>false
  });
  return {context,sheets,stats};
}
function row(width, fields) {const r=Array(width).fill('');for(const [i,v] of Object.entries(fields))r[Number(i)]=v;return r;}
test('lote: mesmos resultados de busca, incluindo caixa, duplicatas e correspondência exata',()=>{
  const data={T:[['PROTOCOLO'],['abc'],['ABC'],['XYZ'],[' ABC '],['ABC1']]};
  const old=fixture(baseline,data),now=fixture(current,data);
  const args=['abc','XYZ','ausente','abc',''];
  assert.deepEqual(plain(now.context.localizarLinhasProtocolosRoteiro_(now.sheets.T,1,args)),plain(old.context.localizarLinhasProtocolosRoteiro_(old.sheets.T,1,args)));
  assert.equal(now.stats.search,0);assert.equal(now.stats.read,1);
});
test('leituras agrupadas: linhas esparsas, ordem, limite e abas ausentes',()=>{
  const f=fixture(current,{T:Array.from({length:1200},(_,i)=>[String(i+1),'valor'])});
  assert.deepEqual(plain(f.context.localizarLinhasProtocolosRoteiro_(null,1,['A'])),{});
  const map={A:[2,3,500,501,1100],B:[3]};
  const rows=f.context.lerLinhasProtocolosRoteiro_(f.sheets.T,map,2);
  assert.deepEqual(Object.keys(rows),['2','3','500','501','1100']);
  assert.equal(rows[1100][0],'1100');assert.equal(f.stats.read,3);
  assert.deepEqual(plain(f.context.lerLinhasProtocolosRoteiro_(null,{},26)),{});
});
test('histórico de 100 protocolos: resultado idêntico com menos chamadas remotas',()=>{
  const protocols=Array.from({length:100},(_,i)=>'P'+i);
  const data={HISTORICO_VISTORIAS:[[],...protocols.map(p=>row(17,{2:p,6:'A',8:'B',12:'DISTRIBUÍDO'}))],ROTEIRO_VISTORIAS:[[],...protocols.map(p=>row(26,{1:p,3:'C',5:'D',10:'DISTRIBUÍDO'}))]};
  const old=fixture(baseline,data),now=fixture(current,data);
  assert.deepEqual(plain(now.context.obterHistoricoPorProtocoloRoteiro_(protocols)),plain(old.context.obterHistoricoPorProtocoloRoteiro_(protocols)));
  assert.ok(now.stats.read+now.stats.search < old.stats.read+old.stats.search);
  console.log('Histórico (100 protocolos), leituras/buscas:',old.stats, '=>',now.stats);
});
test('rascunhos: mantém bloqueio de distribuídos, ativos, reativação e avisos de outra data',()=>{
 const data={ROTEIRO_VISTORIAS:[[],row(26,{0:'22/10/2026',1:'P1',10:'DISTRIBUÍDO'}),row(26,{0:'21/10/2026',1:'P4',10:'DISTRIBUÍDO'})],RASCUNHO_ROTEIRO:[[],row(23,{0:'22/10/2026',1:'P2',12:'manter',20:'RASCUNHO'}),row(23,{0:'22/10/2026',1:'P3',12:'preservada',13:'URGENTE',20:'REMOVIDO'})]};
 const items=['P1','P2','P3','P4','P4'].map(protocolo=>({protocolo}));
 const old=fixture(baseline,data),now=fixture(current,data);
 assert.deepEqual(plain(now.context.salvarRascunhosRoteiro(items,'22/10/2026','token')),plain(old.context.salvarRascunhosRoteiro(items,'22/10/2026','token')));
 // Retomar um rascunho agora renova deliberadamente o prazo de retenção.
 old.sheets.RASCUNHO_ROTEIRO.cells[1][19]='22/10/2026 12:00';
 assert.deepEqual(now.sheets.RASCUNHO_ROTEIRO.cells,old.sheets.RASCUNHO_ROTEIRO.cells);
});
test('finalização: só altera rascunhos da data e protocolos selecionados',()=>{
 const data={RASCUNHO_ROTEIRO:[[],row(23,{0:'22/10/2026',1:'P1',20:'RASCUNHO'}),row(23,{0:'21/10/2026',1:'P1',20:'RASCUNHO'}),row(23,{0:'22/10/2026',1:'P2',20:'REMOVIDO'}),row(23,{0:'22/10/2026',1:'P3',20:'RASCUNHO'})]};
 const old=fixture(baseline,data),now=fixture(current,data);
 const items=['P1','P2'].map(protocolo=>({protocolo,dataRoteiro:'22/10/2026'}));
 old.context.finalizarRascunhosRoteiroRapido_(items);now.context.finalizarRascunhosRoteiroRapido_(items);
 assert.deepEqual(now.sheets.RASCUNHO_ROTEIRO.cells,old.sheets.RASCUNHO_ROTEIRO.cells);
});
test('edição SIAPI: mesmo lançamento e pendência, preservando campos não editados',()=>{
 const data={ROTEIRO_VISTORIAS:[[],row(26,{0:'22/10/2026',1:'P1',2:'RG',10:'DISTRIBUÍDO',20:'PERÍODO 2',21:'ID1',22:'ORIGEM'}),row(26,{0:'22/10/2026',1:'P1',10:'CANCELADO'})],PENDENCIAS_VISTORIAS:[[],row(22,{0:'ID1',4:'REDISTRIBUÍDA',14:'AUDITORIA'})]};
 const old=fixture(baseline,data),now=fixture(current,data);
 const args={protocolo:'P1',dataRoteiro:'22/10/2026',servico:'Novo',bairro:'Bairro',razaoSocial:'Empresa',divisao:'D',area:'100',ultimoAndamento:'Andamento',dataAndamento:'20/10/2026',vistoriadoPorSiapi:'Militar'};
 assert.deepEqual(plain(now.context.editarDadosSiapiVistoriaDia(args,'token')),plain(old.context.editarDadosSiapiVistoriaDia(args,'token')));
 for(const name of Object.keys(data))assert.deepEqual(now.sheets[name].cells,old.sheets[name].cells);
 assert.equal(old.stats.write,17);assert.equal(now.stats.write,4);
 console.log('Edição SIAPI, gravações:',old.stats.write,'=>',now.stats.write);
});
test('distribuição: preserva deduplicação, histórico, notas e finalização dos rascunhos',()=>{
 const data={ROTEIRO_VISTORIAS:[[],row(26,{0:'22/10/2026',1:'P1',10:'DISTRIBUÍDO'}),row(26,{0:'22/10/2026',1:'P2',10:'CANCELADO'})],HISTORICO_VISTORIAS:[[]],RASCUNHO_ROTEIRO:[[],...['P1','P2','P3'].map(p=>row(23,{0:'22/10/2026',1:p,20:'RASCUNHO'}))]};
 const old=fixture(baseline,data),now=fixture(current,data);
 for(const f of [old,now])Object.assign(f.context,{
   garantirAbasEssenciaisRoteiroRapido_:()=>({roteiro:f.sheets.ROTEIRO_VISTORIAS,hist:f.sheets.HISTORICO_VISTORIAS}),
   mapaAfastamentosPorDataRoteiro_:()=>({}),normalizarRegiaoOficial_:v=>v||'',
   atualizarStatusOrigemRoteiroRapido_:()=>{},marcarSincronizacaoRoteiroPendente_:()=>{}
 });
 const items=['P1','P2','P3','P3'].map(protocolo=>({protocolo,dataRoteiro:'22/10/2026',rg1:'1',militar1:'MILITAR',observacao:'Preservar'}));
 assert.deepEqual(plain(now.context.lancarDistribuicaoRoteiroSiapi(items,'token')),plain(old.context.lancarDistribuicaoRoteiroSiapi(items,'token')));
 for(const name of Object.keys(data)) {
   assert.deepEqual(now.sheets[name].cells,old.sheets[name].cells);
   assert.deepEqual(now.sheets[name].notes,old.sheets[name].notes);
 }
});
const schemas = [
 ['garantirEstruturaConferenciaProtocolos_','CONFERENCIA_PROTOCOLOS'],
 ['garantirEstruturaHistoricoConferencia_','HISTORICO_CONFERENCIA'],
 ['garantirEstruturaCredenciamentoProcessos_','CREDENCIAMENTO_PROCESSOS'],
 ['garantirEstruturaHistoricoCredenciamento_','HISTORICO_CREDENCIAMENTO'],
 ['garantirEstruturaAtendimentos_','ATENDIMENTOS'],
 ['garantirEstruturaAfastamentos_','AFASTAMENTOS'],
 ['garantirEstruturaDocsDespacho_','DOCS_DESPACHO'],
 ['garantirConfigPSE_','CONFIG'],
 ['garantirConfigFinanceiroMensal_','CONFIG_FINANCEIRO_MENSAL']
];
for (const [fn,sheet] of schemas)test('estrutura compatível e sem regravação desnecessária: '+sheet,()=>{
 const old=fixture(baseline,{[sheet]:[]}),now=fixture(current,{[sheet]:[]});
 old.context[fn]();now.context[fn]();
 if(sheet==='DOCS_DESPACHO')old.sheets[sheet].cells[0].push('EVENTO_TEMPORARIO','OFICIAL_DESPACHO');
 assert.deepEqual(now.sheets[sheet].cells,old.sheets[sheet].cells);
 const writes=now.stats.write;const reads=now.stats.read;
 now.context[fn]();
 assert.equal(now.stats.write,writes);assert.equal(now.stats.read-reads,1);
});
test('cabeçalho: completa lacunas sem substituir colunas existentes e sem tocar dados',()=>{
 const f=fixture(current,{T:[['RG','','Personalizado'],['1','NOME','DADO']]});
 f.context.prepararCabecalhoLeve_(f.sheets.T,['RG','NOME','PERFIL'],{});
 assert.deepEqual(f.sheets.T.cells,[['RG','NOME','Personalizado'],['1','NOME','DADO']]);
});
function conferenceData() {
 const f=fixture(baseline,{CONFERENCIA_PROTOCOLOS:[],HISTORICO_CONFERENCIA:[]});
 f.context.garantirEstruturaConferenciaProtocolos_();f.context.garantirEstruturaHistoricoConferencia_();
 return Object.fromEntries(Object.entries(f.sheets).map(([n,s])=>[n,structuredClone(s.cells)]));
}
for(const [divisao,status,final] of [['A','APROVADO','CONCLUÍDO'],['F-7','EXIGÊNCIA','DISPONÍVEL'],['F-7','APROVADO','CONCLUÍDO']])test('conclusão conferência preserva transição e auditoria: '+divisao+'/'+status,()=>{
 const data=conferenceData();data.CONFERENCIA_PROTOCOLOS.push(row(27,{0:'P1',6:divisao,9:'EM VERIFICAÇÃO',10:'1',11:'TESTE',15:'ANTES',19:'3'}));
 const old=fixture(baseline,data),now=fixture(current,data);
 const a=old.context.concluirProtocoloConferencia('P1',status,'Observação','token');
 const b=now.context.concluirProtocoloConferencia('P1',status,'Observação','token');
 assert.deepEqual(plain(b),plain(a));assert.equal(b.item.estadoInterno,final);
 for(const n of Object.keys(data))assert.deepEqual(now.sheets[n].cells,old.sheets[n].cells);
 assert.ok(now.stats.read<old.stats.read);
 console.log('Conclusão '+divisao+'/'+status+', leituras:',old.stats.read,'=>',now.stats.read);
});
test('conferência: rejeita conclusão de outro conferente sem escrita',()=>{
 const data=conferenceData();data.CONFERENCIA_PROTOCOLOS.push(row(27,{0:'P1',9:'EM VERIFICAÇÃO',10:'OUTRO'}));
 const f=fixture(current,data);
 assert.throws(()=>f.context.concluirProtocoloConferencia('P1','APROVADO','','token'),/Somente o conferente/);
 assert.equal(f.stats.write,0);
});
test('fila: mesmos contadores e registros com eventos de hoje lidos em bloco',()=>{
 const data=conferenceData();data.CONFERENCIA_PROTOCOLOS.push(row(27,{0:'P1',9:'DISPONÍVEL'}));
 data.HISTORICO_CONFERENCIA.push(...Array.from({length:100},(_,i)=>row(12,{0:'22/10/2026 12:00',3:i%3?'CONCLUÍDO':'LIBERADO',4:i%2?'1':'OUTRO'})));
 const old=fixture(baseline,data),now=fixture(current,data);
 assert.deepEqual(plain(now.context.listarFilaConferencia('token')),plain(old.context.listarFilaConferencia('token')));
 assert.ok(now.stats.read<old.stats.read);
 console.log('Fila com 100 eventos hoje, leituras:',old.stats.read,'=>',now.stats.read);
});
test('credenciamento: lote misto com protocolo repetido mantém resultados e dados',()=>{
 const data={CREDENCIAMENTO_PROCESSOS:[]};
 const seed=fixture(baseline,data);seed.context.garantirEstruturaCredenciamentoProcessos_();
 seed.sheets.CREDENCIAMENTO_PROCESSOS.cells.push(row(15,{0:'P0',1:'APROVADO',2:'TIPO',5:'ORIGINAL'}));
 data.CREDENCIAMENTO_PROCESSOS=seed.sheets.CREDENCIAMENTO_PROCESSOS.cells;
 const old=fixture(baseline,data),now=fixture(current,data);
 const items=[{protocolo:'P0',cidade:'GOIÂNIA'},...Array.from({length:50},(_,i)=>({protocolo:'P'+(i+1),razaoSocial:'EMPRESA'+i})),{protocolo:'P1',cidade:'NOVA'}];
 assert.deepEqual(plain(now.context.salvarAlimentacaoCredenciamento(items,'token')),plain(old.context.salvarAlimentacaoCredenciamento(items,'token')));
 assert.deepEqual(now.sheets.CREDENCIAMENTO_PROCESSOS.cells,old.sheets.CREDENCIAMENTO_PROCESSOS.cells);
 assert.ok(now.stats.write<old.stats.write);
 console.log('Credenciamento, gravações:',old.stats.write,'=>',now.stats.write);
});
test('financeiro/PSE: configuração mantém valores e representação das datas',()=>{
 const data={CONFIG:[[],['01/09/2026','30/09/2026','','','',90000,10,20,30,40,50,'',30,40,33,45]]};
 const old=fixture(baseline,data),now=fixture(current,data);
 assert.deepEqual(plain(now.context.obterConfiguracaoPeriodo()),plain(old.context.obterConfiguracaoPeriodo()));
 assert.equal(now.stats.read,2);
});
test('inscrições: mesmos registros, ordem e filtros com uma gravação',()=>{
 const data={'Lista de Voluntários':[['DATA','EMAIL','DIA','SEMANA','TURNO']]};
 const old=fixture(baseline,data),now=fixture(current,data);
 for(const f of [old,now])f.context.obterDadosUsuario=()=>({email:'teste@example.com'});
 const items=Array.from({length:30},(_,i)=>({data:String(i),diaSemana:'Quinta',turno:i%3?'Matutino':'Nenhum'}));
 assert.equal(now.context.salvarInscricoesVoluntario_(items),old.context.salvarInscricoesVoluntario_(items));
 assert.deepEqual(now.sheets['Lista de Voluntários'].cells,old.sheets['Lista de Voluntários'].cells);
 assert.equal(now.stats.write,1);
});
test('escala: lote mantém bloqueios, horários, campos e persistência antes de sincronizar',()=>{
 const data={CONTROLE_ESCALAS:[[],row(13,{0:'22/10/2026',1:'1',2:'EXISTENTE',6:'ESCALADO'})]};
 const old=fixture(baseline,data),now=fixture(current,data);
 for(const f of [old,now])Object.assign(f.context,{
   sincronizarEscalaPSE:()=>{assert.ok(f.sheets.CONTROLE_ESCALAS.cells.length>2);},
   salvarUltimosOSEI_:()=>{},recalcularRankingGeral:()=>{}
 });
 const items=[{rg:'1',nome:'EXISTENTE',dataServico:'22/10/2026'},...Array.from({length:20},(_,i)=>({rg:String(i+2),nome:'MILITAR'+i,dataServico:'22/10/2026',turno:'Vespertino'}))];
 assert.equal(now.context.lancarVoluntariosSelecionadosWeb_(items),old.context.lancarVoluntariosSelecionadosWeb_(items));
 assert.deepEqual(now.sheets.CONTROLE_ESCALAS.cells,old.sheets.CONTROLE_ESCALAS.cells);
 assert.equal(now.stats.write,1);
});
test('histórico credenciamento: importação mista mantém última movimentação e deduplicação',()=>{
 const seed=fixture(baseline,{CREDENCIAMENTO_PROCESSOS:[],HISTORICO_CREDENCIAMENTO:[]});
 seed.context.garantirEstruturaCredenciamentoProcessos_();seed.context.garantirEstruturaHistoricoCredenciamento_();
 seed.sheets.CREDENCIAMENTO_PROCESSOS.cells.push(row(15,{0:'P0',2:'TIPO',5:'EMPRESA'}));
 const data=Object.fromEntries(Object.entries(seed.sheets).map(([n,s])=>[n,s.cells]));
 const text=[...Array.from({length:30},(_,i)=>['APROVADO','P'+i,'TIPO','','','GOIÂNIA','EMPRESA','','MILITAR','22/10/2026','OUT'].join('\t'))].join('\n');
 const old=fixture(baseline,data),now=fixture(current,data);
 assert.deepEqual(plain(now.context.importarHistoricoCredenciamento(text,'token',false)),plain(old.context.importarHistoricoCredenciamento(text,'token',false)));
 for(const name of Object.keys(data))assert.deepEqual(now.sheets[name].cells,old.sheets[name].cells);
 const firstWrite=now.stats.write;
 assert.deepEqual(plain(now.context.importarHistoricoCredenciamento(text,'token',false)),plain(old.context.importarHistoricoCredenciamento(text,'token',false)));
 for(const name of Object.keys(data))assert.deepEqual(now.sheets[name].cells,old.sheets[name].cells);
 assert.ok(now.stats.write-firstWrite<30);
});
test('acessos: migra apenas troca de senha vazia e não regrava senhas já configuradas',()=>{
 const headers=['RG','NOME','PIN','PERFIL','ATIVO','PIN_HASH','TROCAR_SENHA','PODE_ATRIBUIR_CONFERENCIA'];
 const data={ACESSOS:[headers,['1','NOME','','GESTOR','SIM','HASH','',''],['2','OUTRO','','CONFERENCIA','SIM','HASH2','NÃO','']]};
 const old=fixture(baseline,data),now=fixture(current,data);
 old.context.garantirEstruturaAcessos_();now.context.garantirEstruturaAcessos_();
 assert.deepEqual(now.sheets.ACESSOS.cells,old.sheets.ACESSOS.cells);
 const writes=now.stats.write;now.context.garantirEstruturaAcessos_();assert.equal(now.stats.write,writes);
});
test('pessoal: consulta não regrava nome e graduação sem alterações',()=>{
 const data={FUNCOES_PESSOAL:[['RG','NOME','GRADUAÇÃO','FUNÇÕES','ATUALIZADO_EM','ATUALIZADO_POR'],['1','TESTE','CAP','VISTORIADOR','','']]};
 const old=fixture(baseline,data),now=fixture(current,data);
 for(const f of [old,now])Object.assign(f.context,{obterMilitaresCadastroPessoal_:()=>[{rg:'1',nome:'TESTE',graduacao:'CAP'}],obterGestoresPorRg_:()=>({})});
 old.context.garantirEstruturaFuncoesPessoal_();now.context.garantirEstruturaFuncoesPessoal_();
 assert.deepEqual(now.sheets.FUNCOES_PESSOAL.cells,old.sheets.FUNCOES_PESSOAL.cells);
 assert.equal(now.stats.write,0);
});
test('período e financeiro: gravações em bloco preservam células adjacentes',()=>{
 const data={CONFIG:[Array(16).fill('CAB'),Array(16).fill('PRESERVAR')]};
 const old=fixture(baseline,data),now=fixture(current,data);
 assert.equal(now.context.salvarConfiguracaoPeriodo_('2026-10-01','2026-10-31'),old.context.salvarConfiguracaoPeriodo_('2026-10-01','2026-10-31'));
 const args=['90.000,00','1.000,00','2.000,00','3.000,00','4.000,00','5.000,00'];
 assert.equal(now.context.salvarConfiguracaoFinanceira_(...args),old.context.salvarConfiguracaoFinanceira_(...args));
 assert.deepEqual(now.sheets.CONFIG.cells,old.sheets.CONFIG.cells);
 assert.equal(now.stats.write,2);assert.equal(old.stats.write,8);
});
test('pendências e solicitações: mesmas estruturas, sem reescrita ao consultar novamente',()=>{
 const data={PENDENCIAS_VISTORIAS:[],SOLICITACOES_VISTORIA:[]};
 const old=fixture(baseline,data),now=fixture(current,data);
 old.context.garantirEstruturaPendenciasRoteiro_();now.context.garantirEstruturaPendenciasRoteiro_();
 for(const n of Object.keys(data))assert.deepEqual(now.sheets[n].cells,old.sheets[n].cells);
 const writes=now.stats.write;now.context.garantirEstruturaPendenciasRoteiro_();assert.equal(now.stats.write,writes);
});
