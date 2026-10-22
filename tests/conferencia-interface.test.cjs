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
  'conf-trab-observacao':{value:'Obs'},'conf-btn-concluir':{disabled:false},
  'conf-count-disponivel':{textContent:'1'},'conf-count-verificacao':{textContent:'2'},
  'conf-count-meus':{textContent:'2'},'conf-count-concluidos':{textContent:'0'},
  'conf-count-meus-concluidos':{textContent:'Você concluiu hoje: 0'}
 };
 let success,failure,calls=0,rendered=0,errors=0;
 const run={withSuccessHandler(cb){success=cb;return this;},withFailureHandler(cb){failure=cb;return this;},concluirProtocoloConferencia(){calls++;}};
 const c=vm.createContext({document:{getElementById:id=>elements[id]||null},bootstrap:{Modal:{getInstance:()=>null}},
  sessaoToken:'token',google:{script:{run}},confirm:()=>true,alert(){},setTimeout(){},usuarioLogado:{rg:'1'},
  conferenciaFilaCache:[{protocolo:'P1'}],conferenciaFilaSequencia:4,conferenciaFilaUltimaAplicada:4,
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
 assert.equal(f.c.conferenciaFilaUltimaAplicada,5);
 assert.equal(f.c.conferenciaFilaCache.length,0);assert.equal(f.rendered(),1);
});
test('falha: libera botão e permite nova tentativa sem alterar a fila local',()=>{
 const f=fixture();f.c.concluirProtocoloConferenciaAtual();f.failure();
 assert.equal(f.elements['conf-btn-concluir'].disabled,false);assert.equal(f.errors(),1);
 assert.equal(f.c.conferenciaFilaCache.length,1);
 f.c.concluirProtocoloConferenciaAtual();assert.equal(f.calls(),2);
});
