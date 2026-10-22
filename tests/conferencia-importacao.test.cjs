const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const src=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8'),mp=path.resolve('tests/importacao-adapter.cjs'),m=new Module(mp);m.filename=mp;m.paths=module.paths;
m._compile(src.slice(0,src.indexOf('function row('))+'\nmodule.exports={fixture,current};',mp);
const {fixture,current}=m.exports;
const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const a=html.indexOf('    function extrairRegistrosConferenciaTexto('),b=html.indexOf('    function adicionarProtocolosConferencia()',a);
const parser=vm.createContext({});vm.runInContext(html.slice(a,b),parser);
const plain=x=>JSON.parse(JSON.stringify(x));
const fields=['protocolo','movimentacao','logradouro','bairro','cidade','razaoSocial','divisao','area'];
const one={protocolo:'990001/26',movimentacao:'21/10/2026 08:40:10',logradouro:'RUA TESTE',bairro:'BAIRRO TESTE',cidade:'GOIÂNIA',razaoSocial:'EMPRESA TESTE',divisao:'A-2',area:'100.25'};
const two={...one,protocolo:'990002/26',bairro:'',area:'1'};
const values=o=>fields.map(k=>o[k]);
function fresh(){const f=fixture(current,{CONFERENCIA_PROTOCOLOS:[],HISTORICO_CONFERENCIA:[]});f.context.exigirAtribuicaoConferencia_=()=>({rg:'1',nome:'OPERADOR TESTE'});f.context.dataHojeConferencia_=()=> '22/10/2026';f.context.garantirEstruturaConferenciaProtocolos_();f.context.garantirEstruturaHistoricoConferencia_();f.stats.write=0;return f;}
function seed(f,input,extra={}){const r=Array(27).fill('');values(input).forEach((v,i)=>r[i]=v);r[9]='CONCLUÍDO';r[10]='123';r[11]='RESPONSÁVEL';r[17]='ATUALIZAÇÃO ANTERIOR';r[18]='CAPTURA ANTERIOR';r[19]=4;r[21]='21/10/2026';r[22]='01/10/2026';r[23]='NÃO';r[24]='NÃO';r[26]='21/10/2026 08:40:10';for(const [k,v] of Object.entries(extra))r[Number(k)]=v;f.sheets.CONFERENCIA_PROTOCOLOS.cells.push(r);return r;}
test('colagem de três linhas reúne registros sem perder área ou células vazias',()=>{
 const raw=[one,two].map(x=>[x.protocolo,values(x).slice(1,7).join('\t')+'\t',x.area].join('\n')).join('\n\n');
 assert.deepEqual(plain(parser.extrairRegistrosConferenciaTexto(raw)),[one,two]);
});
test('colagem tabulada com cabeçalho preserva campos vazios e área vazia',()=>{
 const x={...two,area:''};const raw='PROTOCOLO\tMOVIMENTAÇÃO\tLOGRADOURO\tBAIRRO\tCIDADE\tRAZÃO SOCIAL\tDIVISÃO\tÁREA\r\n'+[one,x].map(x=>values(x).join('\t')).join('\r\n');
 assert.deepEqual(plain(parser.extrairRegistrosConferenciaTexto(raw)),[one,x]);
});
test('colagem vertical simples de oito campos permanece aceita',()=>assert.deepEqual(plain(parser.extrairRegistrosConferenciaTexto(values(one).join('\n'))),[one]));
test('colagem truncada ou com coluna excedente é recusada sem tentar adivinhar campos',()=>{
 assert.throws(()=>parser.extrairRegistrosConferenciaTexto(values(one).slice(0,7).join('\t')),/8 colunas/);
 assert.throws(()=>parser.extrairRegistrosConferenciaTexto(values(one).concat('EXTRA').join('\t')),/8 colunas/);
});
test('lote inválido no fim não grava sequer os registros válidos anteriores',()=>{
 const f=fresh(),before=structuredClone(f.sheets.CONFERENCIA_PROTOCOLOS.cells);
 const invalid={...two};delete invalid.area;
 assert.throws(()=>f.context.salvarCapturasConferencia([one,invalid],'token'),/campo area ausente/);
 assert.equal(f.stats.write,0);assert.deepEqual(f.sheets.CONFERENCIA_PROTOCOLOS.cells,before);
});
test('data impossível, hora inválida e área desalinhada são recusadas antes de gravar',()=>{
 for(const bad of [{movimentacao:'31/02/2026 08:00:00'},{movimentacao:'21/10/2026 25:00:00'},{movimentacao:''},{area:'F-7'}]){
  const f=fresh();assert.throws(()=>f.context.salvarCapturasConferencia([{...one,...bad}],'token'));assert.equal(f.stats.write,0);
 }
});
test('captura idêntica preserva estado, responsável, ciclo e data da última alteração',()=>{
 const f=fresh();seed(f,one);const r=f.context.salvarCapturasConferencia([one],'token');
 assert.equal(r.semAlteracao,1);assert.equal(r.atualizados,0);assert.equal(r.totalProcessados,1);
 const cells=f.sheets.CONFERENCIA_PROTOCOLOS.cells[1];assert.equal(cells[9],'CONCLUÍDO');assert.equal(cells[10],'123');assert.equal(cells[19],4);assert.equal(cells[17],'ATUALIZAÇÃO ANTERIOR');assert.equal(cells[18],'22/10/2026 12:00');
 const hist=f.sheets.HISTORICO_CONFERENCIA.cells;assert.equal(hist.length,2);assert.equal(hist[1][3],'IMPORTAÇÃO SIAPI');assert.equal(hist[1][4],'1');assert.equal(JSON.parse(hist[1][11]).semAlteracao,1);
});
test('mudança só de área é registrada sem simular nova movimentação de concluído',()=>{
 const f=fresh();seed(f,one);const r=f.context.salvarCapturasConferencia([{...one,area:'200'}],'token');
 assert.equal(r.atualizados,1);assert.equal(r.semAlteracao,0);assert.equal(f.sheets.CONFERENCIA_PROTOCOLOS.cells[1][7],'200');assert.equal(f.sheets.CONFERENCIA_PROTOCOLOS.cells[1][24],'NÃO');
 const hist=f.sheets.HISTORICO_CONFERENCIA.cells;assert.equal(hist.length,3);assert.equal(hist[1][3],'CAPTURA SIAPI');assert.match(hist[1][10],/Área/);
});
test('movimentação nova de concluído sinaliza reanálise sem mudar seu estado automaticamente',()=>{
 const f=fresh();seed(f,one);f.context.salvarCapturasConferencia([{...one,movimentacao:'22/10/2026 09:00:00'}],'token');
 const row=f.sheets.CONFERENCIA_PROTOCOLOS.cells[1];assert.equal(row[24],'SIM');assert.equal(row[9],'CONCLUÍDO');assert.equal(row[10],'123');assert.equal(row[25],one.movimentacao);
});
test('mesmo horário com descrição nova gera histórico, mas não nova movimentação',()=>{
 const f=fresh();seed(f,one);const r=f.context.salvarCapturasConferencia([{...one,movimentacao:one.movimentacao+' TEXTO NOVO'}],'token');assert.equal(r.atualizados,1);assert.equal(f.sheets.CONFERENCIA_PROTOCOLOS.cells[1][24],'NÃO');
});
test('lote misto: novos, alterados, idênticos e duplicados têm contadores separados',()=>{
 const f=fresh();seed(f,one);seed(f,two);const x={...one,protocolo:'990003/26'};
 const r=f.context.salvarCapturasConferencia([one,{...two,area:'2'},x,x],'token');
 assert.deepEqual(plain(r),{sucesso:true,novos:1,atualizados:1,semAlteracao:1,duplicados:1,totalProcessados:3});
 assert.equal(f.sheets.CONFERENCIA_PROTOCOLOS.cells.length,4);assert.equal(f.sheets.HISTORICO_CONFERENCIA.cells.length,4);
});
test('duplicatas com conteúdo conflitante recusam o lote inteiro',()=>{
 const f=fresh();assert.throws(()=>f.context.salvarCapturasConferencia([one,{...one,area:'2'}],'token'),/dados diferentes/);assert.equal(f.stats.write,0);
});
test('reimportação idêntica cria um recibo, sem eventos adicionais por protocolo',()=>{
 const f=fresh();f.context.salvarCapturasConferencia([one,two],'token');const count=f.sheets.HISTORICO_CONFERENCIA.cells.length;
 const r=f.context.salvarCapturasConferencia([one,two],'token');assert.equal(r.semAlteracao,2);assert.equal(r.atualizados,0);assert.equal(r.novos,0);assert.equal(f.sheets.HISTORICO_CONFERENCIA.cells.length-count,1);
});
test('recaptura no dia seguinte atualiza o marcador diário sem criar mudança operacional',()=>{
 const f=fresh();const x={...one,movimentacao:'22/10/2026 08:00:00'};seed(f,x,{21:'22/10/2026',23:'SIM',26:'22/10/2026 08:00:00'});
 f.context.dataHojeConferencia_=()=> '23/10/2026';f.context.dataHoraSaoPauloTexto_=()=> '23/10/2026 10:00';
 const r=f.context.salvarCapturasConferencia([x],'token');const row=f.sheets.CONFERENCIA_PROTOCOLOS.cells[1];assert.equal(r.semAlteracao,1);assert.equal(row[23],'NÃO');assert.equal(row[18],'23/10/2026 10:00');assert.equal(row[17],'ATUALIZAÇÃO ANTERIOR');
});
