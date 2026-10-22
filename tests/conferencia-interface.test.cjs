const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const start=html.indexOf('    var conferenciaConclusaoEmAndamento = false;');
const end=html.indexOf('    function carregarConsultaConferencia()',start);
function fixture() {
 const elements={
  'conf-trab-protocolo':{value:'P1'},'conf-trab-status':{value:'APROVADO'},
  'conf-trab-observacao':{value:'Obs'},'conf-gravacao-status':{style:{},textContent:''},'conf-gravacao-recuperar':{style:{}},'conf-btn-concluir':{disabled:false},
  'conf-count-disponivel':{textContent:'1'},'conf-count-verificacao':{textContent:'2'},
  'conf-count-meus':{textContent:'2'},'conf-count-concluidos':{textContent:'0'},
  'conf-count-meus-concluidos':{textContent:'Você concluiu hoje: 0'}
 };
 let success,failure,calls=0,rendered=0,errors=0;
 const run={withSuccessHandler(cb){success=cb;return this;},withFailureHandler(cb){failure=cb;return this;},concluirProtocoloConferencia(){calls++;}};
 const c=vm.createContext({document:{getElementById:id=>elements[id]||null},bootstrap:{Modal:{getInstance:()=>null}},
  window:{addEventListener(){}},sessaoToken:'token',google:{script:{run}},confirm:()=>true,alert(){},setTimeout(){},usuarioLogado:{rg:'1'},
  conferenciaFilaCache:[{protocolo:'P1',estadoInterno:'EM VERIFICAÇÃO',rgConferente:'1'}],conferenciaFilaSequencia:4,conferenciaFilaUltimaAplicada:4,conferenciaFilaAtualizacaoPendente:false,
  renderizarFilaConferencia(){rendered++;},capturarErroServidor(){errors++;},carregarFilaConferencia(){}
 });
 vm.runInContext(html.slice(start,end),c);
 return {c,elements,success:v=>success(v),failure:()=>failure(new Error('Falha')),calls:()=>calls,rendered:()=>rendered,errors:()=>errors};
}
test('conclusão: impede clique duplicado e invalida respostas da fila anteriores à gravação',()=>{
 const f=fixture();f.c.concluirProtocoloConferenciaAtual();f.c.concluirProtocoloConferenciaAtual();
 assert.equal(f.calls(),1);assert.equal(f.elements['conf-btn-concluir'].disabled,true);
 f.success({item:{protocolo:'P1'},permaneceNaFila:false});
 assert.equal(f.elements['conf-btn-concluir'].disabled,false);
 assert.equal(f.c.conferenciaConclusaoEmAndamento,false);
 assert.equal(f.c.conferenciaFilaUltimaAplicada,6);
 assert.equal(f.c.conferenciaFilaCache.length,0);assert.equal(f.rendered(),2);
});
test('falha: libera botão e permite nova tentativa sem alterar a fila local',()=>{
 const f=fixture();f.c.concluirProtocoloConferenciaAtual();
 assert.equal(f.c.conferenciaFilaCache.length,0);assert.match(f.elements['conf-gravacao-status'].textContent,/Salvando/);
 f.failure();
 assert.equal(f.elements['conf-btn-concluir'].disabled,false);assert.equal(f.errors(),1);
 assert.equal(f.c.conferenciaFilaCache.length,1);
 f.c.concluirProtocoloConferenciaAtual();assert.equal(f.calls(),2);
});

test('resposta imediata não contabiliza como salvo antes da confirmação',()=>{
 const f=fixture();f.c.concluirProtocoloConferenciaAtual();
 assert.equal(f.c.conferenciaFilaCache.length,0);
 assert.equal(f.elements['conf-count-concluidos'].textContent,'0');
 assert.match(f.elements['conf-gravacao-status'].textContent,/Salvando/);
 f.success({item:{protocolo:'P1'},permaneceNaFila:false});
 assert.match(f.elements['conf-gravacao-status'].textContent,/salvo na planilha/);
 assert.equal(f.elements['conf-count-concluidos'].textContent,1);
});
test('falha conserva anotação e não duplica protocolo nem apaga alteração de outro item',()=>{
 const f=fixture();f.c.concluirProtocoloConferenciaAtual();
 f.c.conferenciaFilaCache.push({protocolo:'P2',observacao:'mudou enquanto salvava'});
 f.failure();
 assert.equal(f.c.conferenciaFilaCache.filter(x=>x.protocolo==='P1').length,1);
 assert.equal(f.c.conferenciaFilaCache.find(x=>x.protocolo==='P2').observacao,'mudou enquanto salvava');
 assert.equal(f.c.conferenciaConclusaoNaoConfirmada.observacao,'Obs');
 assert.equal(f.c.conferenciaConclusaoNaoConfirmada.status,'APROVADO');
 assert.match(f.elements['conf-gravacao-status'].textContent,/não confirmada/);
});
test('F-7 volta à fila apenas com o estado confirmado pelo servidor',()=>{
 const f=fixture();f.c.conferenciaFilaCache[0].divisao='F-7';f.c.concluirProtocoloConferenciaAtual();
 assert.equal(f.c.conferenciaFilaCache.length,0);
 f.success({item:{protocolo:'P1',estadoInterno:'DISPONÍVEL',divisao:'F-7'},permaneceNaFila:true});
 assert.equal(f.c.conferenciaFilaCache[0].estadoInterno,'DISPONÍVEL');
 assert.equal(f.elements['conf-count-disponivel'].textContent,2);
});
test('fila solicitada antes da conclusão não repõe protocolo enquanto está salvando',()=>{
 const f=fixture();f.elements['conf-fila-tbody']={innerHTML:''};
 Object.assign(f.c,{conferenciaFilaCarregando:false});
 const a=html.indexOf('    function carregarFilaConferencia('),b=html.indexOf('    function escaparJsConferencia(',a);
 vm.runInContext(html.slice(a,b),f.c);
 f.c.google.script.run.listarFilaConferencia=()=>{};
 f.c.carregarFilaConferencia(true);
 const before=f.success;
 // Save the actual callback separately: starting a mutation installs a new one.
 let oldSuccess;
 f.c.google.script.run.withSuccessHandler=function(cb){oldSuccess=cb;return this;};
 f.c.conferenciaFilaCarregando=false;f.c.carregarFilaConferencia(true);const stale=oldSuccess;
 f.c.concluirProtocoloConferenciaAtual();
 stale({itens:[{protocolo:'P1'}],resumo:{}});
 assert.equal(f.c.conferenciaFilaCache.length,0);assert.equal(f.c.conferenciaConclusaoEmAndamento,true);
});
test('não recarrega toda a fila a cada conclusão quando não há consulta pendente',()=>{
 const f=fixture();let reads=0;f.c.carregarFilaConferencia=()=>reads++;
 f.c.concluirProtocoloConferenciaAtual();f.success({item:{protocolo:'P1'},permaneceNaFila:false});
 assert.equal(reads,0);
});
test('assumir/liberar usa confirmação do servidor e atualiza contadores sem reler fila inteira',()=>{
 const f=fixture();const a=html.indexOf('    function aplicarItensConfirmadosFilaConferencia('),b=html.indexOf('    function assumirSelecionadosConferencia()',a);
 vm.runInContext(html.slice(a,b),f.c);
 f.c.conferenciaFilaCache=[{protocolo:'P1',estadoInterno:'DISPONÍVEL'},{protocolo:'P2',estadoInterno:'EM VERIFICAÇÃO',rgConferente:'2'}];
 f.c.aplicarItensConfirmadosFilaConferencia([{protocolo:'P1',estadoInterno:'EM VERIFICAÇÃO',rgConferente:'1'}]);
 assert.equal(f.elements['conf-count-disponivel'].textContent,0);assert.equal(f.elements['conf-count-verificacao'].textContent,2);assert.equal(f.elements['conf-count-meus'].textContent,1);
 f.c.aplicarItensConfirmadosFilaConferencia([{protocolo:'P1',estadoInterno:'DISPONÍVEL',rgConferente:''}]);
 assert.equal(f.elements['conf-count-disponivel'].textContent,1);assert.equal(f.elements['conf-count-meus'].textContent,0);
 assert.equal(f.c.conferenciaFilaCache.length,2);assert.equal(f.c.conferenciaFilaCache[1].rgConferente,'2');
});
