# Pendências: área, atualização e cadastro de militar

## Área nos detalhes

As pendências mantêm sua área já gravada. Se estiver ausente, a consulta procura o protocolo nos dados já existentes do ROTEIRO_VISTORIAS, RASCUNHO_ROTEIRO e CONFERENCIA_PROTOCOLOS, nessa ordem. O roteiro já era lido para verificar redistribuições e é reutilizado. As duas outras bases são consultadas em lote, somente enquanto houver protocolos sem área.

Não inventa área para protocolos não cadastrados, nem grava os valores encontrados nas linhas originais. Marcadores de ausência como traço e N/A não são apresentados como metragem; zero explicitamente cadastrado é preservado. Os detalhes de Não realizada, Cadastro manual e Atendimento exibem o campo em m² quando disponível, incluindo a consulta somente leitura do Atendimento.

## Atualizar

Os dois botões da tela operacional chamam diretamente a consulta das pendências. Mostram andamento e desabilitam durante o envio; a resposta válida informa horário da atualização e quantidade. Respostas antigas são ignoradas por sequência/token, e falha mantém a grade anterior com mensagem. Não há cache de dados acrescentado no servidor. As ações de um modal aberto conferem novamente o ID/protocolo na lista para não operar sobre outro item após uma atualização.

A rotina anterior não mostrava progresso ou confirmação de leitura e permitia que uma resposta anterior sobrescrevesse a lista. O botão superior também dependia do despachante genérico de telas, sujeito à trava temporária de outra atualização. Não houve acesso aos registros de execução da implantação Google para diagnosticar um clique específico de produção.

## Cadastrar militar

Caminho: Pessoal → Acessos e Funções → Cadastrar militar. Exclusivo do Gestor, com validação também no servidor e novamente após adquirir a trava.

Campos obrigatórios: RG, nome completo, nome de guerra e posto/graduação. CPF e e-mail opcionais; o CPF é necessário para os dados oficiais do AC-4. A opção Disponível como vistoriador determina a entrada em FUNCOES_PESSOAL. O cadastro não cria ACESSOS, senha ou perfil de login; essa etapa continua no Cadastrar acesso existente.

Se Cadastro existe, completa a inclusão nele e em DADOS, pois as listas operacionais priorizam Cadastro e o AC-4 usa DADOS. Se somente DADOS existe, usa essa base, sem criar um Cadastro que ocultaria os demais militares. Cabeçalhos reconhecidos são respeitados, e eventuais campos padronizados faltantes são acrescentados no final. Cabeçalho de RG não reconhecido numa base já preenchida gera erro antes da gravação.

Preserva zeros à esquerda, campos existentes e colunas alheias. Registros existentes não são regravados em bloco, evitando substituir fórmulas pelos valores exibidos. RG conflitante e CPF vinculado a outro RG são recusados. Repetição com os mesmos dados completa eventual falha entre bases sem duplicar o militar. Planilhas não são uma transação: se a segunda gravação falhar, o formulário mantém os dados para repetir e completar. Não há inclusão automática em escala ou distribuição de protocolo.

Após confirmar, a lista de Pessoal é recarregada e as listas de militares em memória são invalidadas para a próxima consulta/abertura de Roteiro e Escala.

## Verificação

291 testes locais passaram, incluindo cadastro, duplicidade, acesso por perfil, preservação de dados, retomada depois de falha e área de fontes existentes. Mais 31 cenários Chromium relacionados: sete de Pendências/cadastro, nove de Pendências no Atendimento, oito de rascunhos/DOCs e sete de Vistoriador. Serviços Google simulados; nenhuma gravação ou publicação na planilha de produção.

Instalação: atualizar WebApp.gs e Index.html juntos, salvar e publicar uma nova versão.
