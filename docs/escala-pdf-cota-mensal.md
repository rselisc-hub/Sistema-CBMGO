# Controle de escala: PDF e cota mensal AC-4

## Problemas identificados no código

- O PDF criava um Google Docs temporário, convertia pelo Drive e depois excluía o arquivo. Uma falha de permissão, criação ou conversão impedia a entrega. A interface não indicava progresso nem bloqueava envios repetidos. Sem acesso à implantação, não foi possível identificar qual dessas etapas falhou no ambiente do usuário.
- A configuração mensal salvava a primeira ocorrência do mês, enquanto a leitura escolhia a última. Havendo duplicatas antigas, o valor recém-salvo não aparecia no relatório.
- A busca para salvar comparava valores exibidos, enquanto a leitura usava os valores brutos. Um mês convertido em data na planilha podia não ser reconhecido.
- A consulta do período de inscrições também preenchia campos financeiros com a configuração geral, podendo substituir na tela os valores do mês selecionado.
- O sucesso de salvar disparava duas consultas financeiras. Não havia bloqueio de clique duplo nem proteção da troca de mês durante a edição.

## Alterações

PDF: conversão de HTML em PDF em memória, sem criar documentos no Drive. Mantém os dados obtidos pela visualização SEI: período, agrupamento por data/turno, ordem, posto, RG, nome, função e horário. Layout A4 horizontal, cabeçalho de tabela repetido e dados escapados. Valida datas e período vazio; acesso continua exclusivo do Gestor. Não altera a escala. A interface mostra processamento e erros, valida a assinatura do PDF recebido e entrega um download com nome do período.

AC-4: leitura e gravação reconhecem o mesmo mês, inclusive formatos legados em data e texto. Ambas usam a última ocorrência; linhas anteriores não são apagadas. A gravação protege a chave como texto, valida valores brasileiros, aceita zero e usa trava com nova verificação de perfil. Os campos recebem somente o relatório financeiro mensal. A edição fixa o mês até salvar/cancelar; falha preserva os valores para repetição. Após confirmar, uma única consulta atualiza cota total, suplementações, executado e saldo. Consultas antigas não substituem a seleção atual.

Os cálculos de horas, tarifas e lançamentos existentes não foram alterados. A cota e as suplementações continuam em CONFIG_FINANCEIRO_MENSAL, sem novas colunas. Meses sem configuração mantêm a regra anterior de usar os valores gerais como base.

## Verificação e limites

- 248 testes automatizados locais passaram, incluindo seis novos casos de PDF e configuração mensal.
- 28 cenários no Chromium: seis novos de PDF/AC-4, cinco de escalas do Gestor, sete de Vistoriador e dez de Controle de dados/fluxos relacionados. Serviços Google simulados.
- Os cenários novos verificam atualização mensal, isolamento entre meses, valor zero, falha e repetição, bloqueio de cliques, período inválido e download pelo navegador.
- A conversão real do Google, suas cotas e permissões, e os registros da planilha em produção não puderam ser testados neste ambiente. Nenhuma publicação no Apps Script foi realizada.

Instalação: substituir WebApp.gs e Index.html pelos arquivos correspondentes do ZIP, salvar e publicar uma nova versão. Em seguida, conferir um PDF de período conhecido e salvar/consultar a cota de um mês no projeto de teste antes de usar em produção.
