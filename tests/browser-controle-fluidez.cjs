// Navegador real, HTML completo; ponte Apps Script simulada, sem acesso a dados Google.
// Requer Playwright e Chromium. CBMGO_BOOTSTRAP_JS/CSS apontam para Bootstrap 5.3.0 local.
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const js=fs.readFileSync(process.env.CBMGO_BOOTSTRAP_JS||'/tmp/cbmgo-bootstrap.js','utf8');
const css=fs.readFileSync(process.env.CBMGO_BOOTSTRAP_CSS||'/tmp/cbmgo-bootstrap.css','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CBMGO_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 let diagnosticPage;
 const results=[];results.push=(...items)=>{console.error('OK: '+items[0]);return Array.prototype.push.apply(results,items);};
 try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});page.setDefaultTimeout(10000);diagnosticPage=page;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',route=>{const u=route.request().url();
  if(u==='http://cbmgo.local/')return route.fulfill({contentType:'text/html',body:html});
  if(u.includes('bootstrap.bundle.min.js'))return route.fulfill({contentType:'application/javascript',body:js});
  if(u.includes('bootstrap.min.css'))return route.fulfill({contentType:'text/css',body:css});
  return route.abort();
 });
 await page.addInitScript(()=>{
  const state=window.rpcTest={calls:[],pending:[],ativo:true,hold:new Set(['concluirProtocoloConferencia','listarRascunhosArquivados']),finish(method,value,error){
   const i=this.pending.findIndex(x=>x.method===method);if(i<0)throw Error('Chamada não localizada: '+method);
   const p=this.pending.splice(i,1)[0];if(error)p.failure(new Error(error));else p.success(value);
  }};
  const control=()=>({ativo:state.ativo,configurado:true,arquivoUrl:'https://docs.google.com/spreadsheets/d/FICTICIO/edit'});
  const builder=()=>{let success=()=>{},failure=()=>{};let proxy;proxy=new Proxy({}, {get(t,name){
   if(name==='withSuccessHandler')return cb=>{success=cb;return proxy;};
   if(name==='withFailureHandler')return cb=>{failure=cb;return proxy;};
   return (...args)=>{state.calls.push({method:name,args});if(state.hold.has(name)){state.pending.push({method:name,success,failure,args});return;}
    let out={itens:[]};
    if(name==='inicializarControleDadosGestor')out=control();
    if(name==='obterControleDadosGestor')out={controle:control(),resumo:{elegiveis:12,datasInvalidasPreservadas:1}};
    if(name==='gerenciarArquivoRascunhosGestor'){if(args[0]==='pausar')state.ativo=false;if(args[0]==='ativar')state.ativo=true;out={controle:control(),resultado:{arquivados:5}};}
    if(name==='restaurarRascunhoArquivado')out={restaurado:true};
    queueMicrotask(()=>success(out));
   };
  }});return proxy;};
  window.google={script:{get run(){return builder();}}};
 });
 await page.goto('http://cbmgo.local/',{waitUntil:'load'});
 assert.equal(await page.locator('#login-screen').isVisible(),true);assert.deepEqual(errors,[]);results.push('login inicial sem erro JavaScript');
 await page.evaluate(()=>{sessaoToken='TESTE';usuarioLogado={rg:'1',nome:'GESTOR FICTÍCIO',perfil:'GESTOR',permissoes:{gestor:true,conferencia:true,vistorias:true}};aplicarUsuarioLogado();abrirModuloGestor();});
 await page.getByRole('button',{name:'Controle de dados',exact:false}).click();
 await page.waitForFunction(()=>document.getElementById('controle-dados-status').textContent.includes('Elegíveis agora: 12'));
 assert.equal(await page.locator('#gestor-controle-dados').isVisible(),true);assert.equal(await page.locator('#btn-arquivo-rascunhos').count(),0);results.push('Gestor abre Controle de dados; recuperação removida de Roteiros');
 await page.getByRole('button',{name:'Pausar arquivamento',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('controle-dados-status').textContent.includes('pausado'));
 await page.getByRole('button',{name:'Ativar arquivamento diário',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('controle-dados-status').textContent.includes('ativo'));
 results.push('pausa e ativação pelo painel');
 await page.locator('#arquivo-rascunhos-data').fill('2026-10-01');await page.getByRole('button',{name:'Consultar',exact:true}).click();
 await page.evaluate(()=>rpcTest.finish('listarRascunhosArquivados',{configurado:true,total:1,itens:[{id:'id-1',protocolo:'10001/26',status:'RASCUNHO',arquivadoEm:'20/10/2026',restauradoEm:''}]}));
 assert.match(await page.locator('#arquivo-rascunhos-tbody').innerText(),/10001\/26/);
 await page.getByRole('button',{name:'Recuperar',exact:true}).click();
 await page.evaluate(()=>rpcTest.finish('listarRascunhosArquivados',{configurado:true,total:1,itens:[{id:'id-1',protocolo:'10001/26',status:'RASCUNHO',arquivadoEm:'20/10/2026',restauradoEm:'22/10/2026'}]}));
 assert.match(await page.locator('#arquivo-rascunhos-tbody').innerText(),/Recuperado/);results.push('consulta por data e recuperação no Gestor');
 // Two queries finish in reverse order: newer date must prevail.
 await page.locator('#arquivo-rascunhos-data').fill('2026-10-02');await page.getByRole('button',{name:'Consultar',exact:true}).click();
 await page.locator('#arquivo-rascunhos-data').fill('2026-10-03');await page.getByRole('button',{name:'Consultar',exact:true}).click();
 await page.evaluate(()=>{const a=rpcTest.pending.shift(),b=rpcTest.pending.shift();b.success({configurado:true,total:0,itens:[]});a.success({configurado:true,total:99,itens:[]});});
 assert.match(await page.locator('#arquivo-rascunhos-status').innerText(),/03\/10\/2026 — 0/);results.push('consulta antiga não substitui a data mais recente');
 await page.evaluate(()=>{usuarioLogado={rg:'2',perfil:'CONFERENCIA',permissoes:{conferencia:true}};aplicarUsuarioLogado();abrirControleDadosGestor();});
 assert.equal(await page.locator('#gestor-controle-dados').isVisible(),false);results.push('Conferência não abre Controle de dados');
 await page.evaluate(()=>{usuarioLogado={rg:'1',perfil:'CONFERENCIA',permissoes:{conferencia:true}};esconderTelasPrincipais();document.getElementById('conferencia-screen').style.display='block';mostrarPaneConferencia('conf-pane-fila');conferenciaFilaCache=[{protocolo:'10001/26',estadoInterno:'EM VERIFICAÇÃO',rgConferente:'1',divisao:'A-2'}];renderizarFilaConferencia();abrirTrabalhoConferencia(0);document.getElementById('conf-trab-status').value='APROVADO';document.getElementById('conf-trab-observacao').value='Anotação de teste';concluirProtocoloConferenciaAtual();});
 assert.match(await page.locator('#conf-gravacao-status').innerText(),/Salvando/);
 assert.equal(await page.evaluate(()=>conferenciaFilaCache.length),0);
 await page.evaluate(()=>rpcTest.finish('concluirProtocoloConferencia',{sucesso:true,item:{protocolo:'10001/26'},permaneceNaFila:false}));
 assert.match(await page.locator('#conf-gravacao-status').innerText(),/salvo na planilha/);results.push('conclusão responde antes da ponte e confirma somente após gravar');
 await page.evaluate(()=>{conferenciaFilaCache=[{protocolo:'10002/26',estadoInterno:'EM VERIFICAÇÃO',rgConferente:'1',divisao:'A-2'}];abrirTrabalhoConferencia(0);document.getElementById('conf-trab-status').value='EXIGÊNCIA';document.getElementById('conf-trab-observacao').value='Texto conservado';concluirProtocoloConferenciaAtual();rpcTest.finish('concluirProtocoloConferencia',null,'Falha simulada');});
 assert.equal(await page.evaluate(()=>conferenciaFilaCache[0].protocolo),'10002/26');
 assert.match(await page.locator('#conf-gravacao-status').innerText(),/não confirmada/);
 await page.getByRole('button',{name:'Reabrir anotação',exact:true}).click();
 assert.equal(await page.locator('#conf-trab-observacao').inputValue(),'Texto conservado');results.push('falha repõe protocolo e reabre anotação sem perda');
 // Full DOM render checks: filtered actions keep original cache indices.
 const docs=await page.evaluate(()=>{docsOrigemTela='gestor';docsCache=Array.from({length:800},(_,i)=>({protocolo:String(10000+i)+'/26',tipoDocumento:'TESTE',status:'PENDENTE',faixaPrazo:'NO PRAZO',diasDocumento:1}));document.getElementById('docs-pesquisa-protocolo').value='10799';const t=performance.now();renderizarDocsDespacho();return {ms:performance.now()-t,action:document.querySelector('#docs-tbody button[onclick^="editarDocGestao"]').getAttribute('onclick'),rows:document.querySelectorAll('#docs-tbody tr').length};});
 assert.equal(docs.action,'editarDocGestao(799)');assert.equal(docs.rows,1);results.push('documentos: filtro conserva índice de edição entre 800 itens');
 const away=await page.evaluate(()=>{afastamentosPodeEditar=true;afastamentosCache=Array.from({length:800},(_,i)=>({id:String(i),militar:'MILITAR '+i,dataInicial:'01/10/2026',dataFinal:'31/10/2026',motivo:'FÉRIAS'}));document.getElementById('afast-mes').value='2026-10';document.getElementById('afast-filtro').value='MILITAR 799';renderizarTabelaAfastamentos();return document.querySelector('#afast-tbody button').getAttribute('onclick');});
 assert.equal(away,'editarAfastamentoTela(799)');results.push('afastamentos: filtro conserva índice após ordenação');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({navegador:'Chromium local',ponteGoogle:'simulada',casos:results.length,resultados:results},null,2));
 } catch(e){if(diagnosticPage)console.error(await diagnosticPage.evaluate(()=>({modal:document.getElementById('modal-conferencia-trabalho').className,transition:bootstrap.Modal.getInstance(document.getElementById('modal-conferencia-trabalho'))._isTransitioning,shown:bootstrap.Modal.getInstance(document.getElementById('modal-conferencia-trabalho'))._isShown,pending:conferenciaConclusaoEmAndamento,status:document.getElementById('conf-gravacao-status').textContent,calls:rpcTest.calls.map(x=>x.method)})));throw e;} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
