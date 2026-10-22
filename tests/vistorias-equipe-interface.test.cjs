const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
test('ação de alteração em lote pertence a Vistorias do Dia, com IDs únicos',()=>{
 const ids=['btn-vd-alterar-vistoriadores-lote','vd-selecionados-contador'];
 const ancestry=JSON.parse(execFileSync('python',['-c',`
import sys,json
from html.parser import HTMLParser
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.divs=[]; self.result={}
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='div': self.divs.append(attrs.get('id',''))
  if attrs.get('id') in ['btn-vd-alterar-vistoriadores-lote','vd-selecionados-contador']:
   self.result.setdefault(attrs['id'],[]).append(list(self.divs))
 def handle_endtag(self,tag):
  if tag=='div' and self.divs: self.divs.pop()
p=Parser();p.feed(sys.stdin.read());print(json.dumps(p.result))
`],{input:html,encoding:'utf8'}));
 for(const id of ids){assert.equal(ancestry[id].length,1);assert.ok(ancestry[id][0].includes('vistorias-dia-screen'));assert.ok(!ancestry[id][0].includes('vistorias-escala-pse-screen'));}
});
function fixture(){const elements={'vd-selecionados-contador':{},'btn-vd-alterar-vistoriadores-lote':{disabled:true}};
 const c=vm.createContext({window:{__vistoriasDiaItens:[{dataIso:'2026-10-22',protocolo:'990001/26',linhaRoteiro:2},{dataIso:'2026-10-22',protocolo:'990002/26',linhaRoteiro:3}]},document:{getElementById:id=>elements[id]},vistoriasDiaSelecionados:{}});
 const a=html.indexOf('    function chaveSelecaoVistoriaDia_('),b=html.indexOf('    function renderizarVistoriasDoDia(',a);vm.runInContext(html.slice(a,b),c);c.renderizarVistoriasDoDia=()=>{};return {c,elements};}
test('seleção habilita ação e retirada da seleção desabilita novamente',()=>{
 const {c,elements}=fixture();c.atualizarControlesSelecaoVistoriasDia_();assert.equal(elements['btn-vd-alterar-vistoriadores-lote'].disabled,true);
 c.alternarSelecaoVistoriaDia(0,true);c.alternarSelecaoVistoriaDia(1,true);assert.equal(elements['btn-vd-alterar-vistoriadores-lote'].disabled,false);assert.equal(elements['vd-selecionados-contador'].textContent,'2 selecionado(s)');
 c.alternarSelecaoVistoriaDia(0,false);c.alternarSelecaoVistoriaDia(1,false);assert.equal(elements['btn-vd-alterar-vistoriadores-lote'].disabled,true);
});
test('selecionar todos habilita alteração para o lote; desmarcar todos limpa seleção',()=>{
 const {c,elements}=fixture();c.alternarTodasVistoriasDia({checked:true});assert.equal(Object.keys(c.vistoriasDiaSelecionados).length,2);assert.equal(elements['btn-vd-alterar-vistoriadores-lote'].disabled,false);
 c.alternarTodasVistoriasDia({checked:false});assert.equal(Object.keys(c.vistoriasDiaSelecionados).length,0);assert.equal(elements['btn-vd-alterar-vistoriadores-lote'].disabled,true);
});
