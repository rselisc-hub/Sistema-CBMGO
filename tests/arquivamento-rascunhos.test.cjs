const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Module=require('node:module');
const path=require('node:path');
const source=fs.readFileSync('tests/roteiro-performance.test.cjs','utf8');
const mod=new Module(path.resolve('tests/fixture-arquivo.cjs'));mod.filename=path.resolve('tests/fixture-arquivo.cjs');mod.paths=module.paths;
mod._compile(source.slice(0,source.indexOf('function row('))+'\nmodule.exports={fixture,current};',mod.filename);
const {fixture,current}=mod.exports;
const now=new Date('2026-10-22T15:00:00Z');
const plain=x=>JSON.parse(JSON.stringify(x));
function row(p='P1',status='RASCUNHO',date='01/10/2026',saved='01/10/2026 12:00:00') {const r=Array(24).fill('');r[0]=date;r[1]=p;r[8]='ST TESTE';r[9]=123.45;r[19]=saved;r[20]=status;return r;}
function env(rows=[]) {
 const f=fixture(current,{RASCUNHO_ROTEIRO:[Array.from({length:23},(_,i)=>'COL'+i),...rows],RASCUNHOS_ARQUIVADOS:[]});
 Object.assign(f.context,{Date});
 f.context.Utilities.formatDate=(d,tz,fmt)=>{
  const x=new Date(d.getTime()-3*3600000),p=v=>String(v).padStart(2,'0');
  const date=p(x.getUTCDate())+'/'+p(x.getUTCMonth()+1)+'/'+x.getUTCFullYear();
  return fmt==='yyyy-MM-dd'?x.toISOString().slice(0,10):fmt==='dd/MM/yyyy'?date:date+' '+p(x.getUTCHours())+':'+p(x.getUTCMinutes())+(fmt.endsWith(':ss')?':'+p(x.getUTCSeconds()):'');
 };
 f.context.Utilities.parseDate=s=>{const m=s.match(/^(\d+)\/(\d+)\/(\d+)(?: (\d+):(\d+)(?::(\d+))?)?$/);return new Date(Date.UTC(+m[3],+m[2]-1,+m[1],+(m[4]||0)+3,+(m[5]||0),+(m[6]||0)));};
 let uuid=0;f.context.Utilities.getUuid=()=>`id-${++uuid}`;
 for(const sheet of Object.values(f.sheets)) {
  let cols=24,maxRows=1000;
  sheet.getMaxColumns=()=>cols;sheet.insertColumnsAfter=(n,count)=>{cols+=count;};
  sheet.getMaxRows=()=>maxRows;sheet.insertRowsAfter=(n,count)=>{maxRows+=count;};
  sheet.deleteRows=(start,count)=>sheet.cells.splice(start-1,count);
 }
 const props={RASCUNHO_ORIGEM_ID:'source',RASCUNHO_ARQUIVO_ID:'archive',RASCUNHO_ARQUIVAMENTO_ATIVO:'SIM'};
 f.context.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k],setProperty(k,v){props[k]=v;}})};
 const ss={getId:()=> 'source',getSheetByName:n=>f.sheets[n]};
 const dest={getId:()=> 'archive',getSheetByName:n=>f.sheets[n],getUrl:()=> 'https://example.test/archive'};
 f.context.SpreadsheetApp.getActiveSpreadsheet=()=>ss;
 f.context.SpreadsheetApp.openById=id=>id==='source'?ss:dest;
 f.bases={origem:f.sheets.RASCUNHO_ROTEIRO,destino:f.sheets.RASCUNHOS_ARQUIVADOS,origemId:'source'};
 f.props=props;f.move=()=>f.context.moverLoteRascunhosArquivo_(f.bases,now,50);
 return f;
}
test('retenção: 15 dias de inatividade; preserva lançados, hoje, futuro, recentes e datas inválidas',()=>{
 const f=env();const rows=[row(),row('P2','REMOVIDO'),row('P3','LANÇADO'),row('P4','RASCUNHO','22/10/2026'),row('P5','RASCUNHO','23/10/2026'),row('P6','RASCUNHO','01/10/2026','08/10/2026 12:00:00'),row('P7','RASCUNHO','31/02/2026'),row('P8','RASCUNHO','01/10/2026','inválida'),row('P9','RASCUNHO','01/10/2026','07/10/2026 12:00:00')];
 const plan=f.context.planejarArquivamentoRascunhos_(rows,now);
 assert.deepEqual(plain(plan.indices),[0,1,8]);assert.equal(plan.datasInvalidas,2);
 assert.equal(f.context.dataRascunhoArquivo_('2026-10-01').toISOString(),'2026-10-01T03:00:00.000Z');
});
test('copia e verifica todos os campos antes de excluir; preserva LANÇADO e restaura uma única vez',()=>{
 const f=env([row(),row('P2','LANÇADO'),row('P3','REMOVIDO')]);
 assert.equal(f.move().arquivados,2);
 assert.equal(f.bases.origem.cells[1][1],'P2');assert.equal(f.bases.destino.cells.length,3);
 assert.equal(f.bases.destino.cells[1][8],'ST TESTE');assert.equal(f.bases.destino.cells[1][9],123.45);
 const id=f.bases.destino.cells[1][23];assert.equal(f.context.restaurarRascunhoArquivado(id,'token').restaurado,true);
 assert.equal(f.context.restaurarRascunhoArquivado(id,'token').jaRestaurado,true);
 assert.equal(f.bases.origem.cells.length,3);assert.equal(f.bases.origem.cells[2][20],'RASCUNHO');
 const list=f.context.listarRascunhosArquivados('2026-10-01','token');assert.equal(list.itens.length,2);assert.ok(list.itens.find(x=>x.id===id).restauradoEm);
});
test('falha na verificação da cópia não exclui a origem e nova tentativa não duplica arquivo',()=>{
 const f=env([row()]);const flush=f.context.SpreadsheetApp.flush;
 f.context.SpreadsheetApp.flush=()=>{throw new Error('falha simulada');};
 assert.throws(f.move,/falha simulada/);assert.equal(f.bases.origem.cells.length,2);assert.equal(f.bases.destino.cells.length,2);
 f.context.SpreadsheetApp.flush=flush;assert.equal(f.move().arquivados,1);assert.equal(f.bases.destino.cells.length,2);
});
test('cópia divergente e mudança concorrente preservam o rascunho',()=>{
 const f=env([row()]);f.context.SpreadsheetApp.flush=()=>{f.bases.destino.cells[1][9]=999;};
 assert.throws(f.move,/verificar/);assert.equal(f.bases.origem.cells.length,2);
 const g=env([row()]);g.context.SpreadsheetApp.flush=()=>{g.bases.origem.cells[1][12]='editado durante cópia';};
 assert.throws(g.move,/mudaram/);assert.equal(g.bases.origem.cells.length,2);assert.equal(g.bases.origem.cells[1][12],'editado durante cópia');
});
test('limita o lote a 50 e preserva IDs duplicados',()=>{
 const f=env(Array.from({length:55},(_,i)=>row('P'+i)));assert.equal(f.move().arquivados,50);assert.equal(f.bases.origem.cells.length,6);
 const a=row('A'),b=row('B');a[23]=b[23]='duplicado';const g=env([a,b]);assert.equal(g.move().arquivados,0);assert.equal(g.bases.origem.cells.length,3);
});
test('recuperação bloqueia duplicata ativa e acesso não autorizado',()=>{
 const f=env([row()]);f.move();const id=f.bases.destino.cells[1][23];f.bases.origem.cells.push(row('P1','RASCUNHO','2026-10-01'));
 assert.throws(()=>f.context.restaurarRascunhoArquivado(id,'token'),/Já existe/);
 f.context.exigirPerfil_=()=>{throw new Error('Sem permissão');};
 assert.throws(()=>f.context.listarRascunhosArquivados('2026-10-01','token'),/Sem permissão/);
 assert.throws(()=>f.context.restaurarRascunhoArquivado(id,'token'),/Sem permissão/);
});
test('novo arquivamento após recuperação cria outro ID e preserva o histórico',()=>{
 const f=env([row()]);f.move();const id=f.bases.destino.cells[1][23];f.context.restaurarRascunhoArquivado(id,'token');f.bases.origem.cells[1][19]='01/10/2026 12:00:00';f.move();
 assert.equal(f.bases.destino.cells.length,3);assert.notEqual(f.bases.destino.cells[2][23],id);assert.ok(f.bases.destino.cells[1][28]);
});
test('instalação repetida mantém um único gatilho; desativação preserva dados',()=>{
 const f=env([row()]);let triggers=[];let handler;
 const chain={timeBased(){return this;},everyDays(){return this;},atHour(){return this;},inTimezone(){return this;},create(){triggers.push({getHandlerFunction:()=>handler});}};
 f.context.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:h=>{handler=h;return chain;},deleteTrigger:t=>{triggers=triggers.filter(x=>x!==t);}};
 f.context.instalarArquivamentoRascunhos_();f.context.instalarArquivamentoRascunhos_();assert.equal(triggers.length,1);
 f.context.desativarArquivamentoRascunhos_();assert.equal(triggers.length,0);assert.equal(f.context.executarArquivamentoRascunhos_().ativo,false);assert.equal(f.bases.origem.cells.length,2);
});
test('interface concentra arquivo no controle do Gestor e preserva a lista de Roteiros',()=>{
 const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
 assert.match(html,/id="gestor-controle-dados"/);assert.doesNotMatch(html,/id="btn-arquivo-rascunhos"/);
 assert.match(html,/restaurarRascunhoArquivado\(item.id,sessaoToken\)/);
 const recuperar=html.slice(html.indexOf('    function recuperarRascunhoArquivadoTela('),html.indexOf('    function carregarRascunhosRoteiro('));
 assert.doesNotMatch(recuperar,/carregarRascunhosRoteiro\(/);
});
