// Diagnóstico independente: falhas são reportadas e preservam exit status 1.
// Usa somente dados fictícios; não lê a planilha enviada nem dados pessoais.
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('Index_APLICACAO_CREDENCIAMENTO_V94_PRODUTIVIDADE.html','utf8');
const campos=['protocolo','servico','bairro','dataAndamento','ultimoAndamento','razaoSocial','divisao','vistoriadoPorSiapi','area'];
const expected=[
 {protocolo:'9900001/26',servico:'FUNCIONAMENTO',bairro:'BAIRRO TESTE',dataAndamento:'13/10/2026 08:28:01',ultimoAndamento:'SOLICITOU RETORNO PARA INSPEÇÃO PELO PORTAL',razaoSocial:'EMPRESA A',divisao:'E-1',vistoriadoPorSiapi:'VISTORIADOR TESTE',area:'2066.83'},
 {protocolo:'9900002/26',servico:'FISCALIZAÇÃO',bairro:'BAIRRO TESTE',dataAndamento:'18/03/2024 15:16:12',ultimoAndamento:'FISCALIZAÇÃO CADASTRADA',razaoSocial:'EMPRESA B',divisao:'N-3',vistoriadoPorSiapi:'',area:'1'}
];
const headers=['PROTOCOLO','SERVIÇO','BAIRRO','DATA DO ANDAMENTO','ÚLTIMO ANDAMENTO','RAZÃO SOCIAL','DIVISÃO','VISTORIADO POR','ÁREA'];
const rows=[headers,...expected.map(r=>campos.map(k=>r[k]))].map(r=>({querySelectorAll:()=>r.map(v=>({innerText:v,textContent:v}))}));
const c=vm.createContext({console,registrosSiapiColados:[],DOMParser:class{parseFromString(){return {querySelectorAll:()=>rows};}}});
let a=html.indexOf('    function normCab('),b=html.indexOf('    function extrairRegistroSiapiDoClipboard',a);
vm.runInContext(html.slice(a,b),c);
a=html.indexOf('    function extrairRegistrosSiapiRobusto(');b=html.indexOf('    function sincronizarCamposEditaveisRoteiro_',a);vm.runInContext(html.slice(a,b),c);
a=html.indexOf('      var mapaRegs = {};',html.indexOf('    function processarTextoSiapi()'));b=html.indexOf('      if (!regs.length)',a);
vm.runInContext('function mesclar(regsTexto){'+html.slice(a,b)+'return regs;}',c);
const tabs=expected.map(r=>campos.map(k=>r[k]).join('\t')).join('\n');
const lines=expected.map(r=>campos.map(k=>r[k]).filter(Boolean).join('\n')).join('\n\n');
c.capturarColagemSiapi({clipboardData:{getData:()=>'<table>simulada</table>'}});
const checks=[
 ['Tabela HTML simulada preserva campo vazio',c.registrosSiapiColados],
 ['Texto por linhas preserva todos os campos',c.extrairRegistrosSiapiRobusto(lines)],
 ['Texto tabulado preserva célula vazia e área',c.extrairRegistrosSiapiRobusto(tabs)],
 ['Mescla HTML/texto preserva campo vazio',c.mesclar(c.extrairRegistrosSiapiRobusto(tabs))]
];
let failed=0;
for(const [name,regs] of checks){
 const ok=regs.length===expected.length && expected.every((e,i)=>campos.every(k=>String(regs[i]?.[k]??'')===e[k]));
 console.log((ok?'PASS: ':'FAIL: ')+name);
 if(!ok)failed++;
}
console.log(JSON.stringify({checks:checks.length,passed:checks.length-failed,failed,scope:'adaptador local, sem navegador ou serviços Google'}));
process.exitCode=failed?1:0;
