# Indicadores de DOCs, função na escala extra e confirmação de cópia

Entrega de 04/11/2026. Atualizar WebApp.gs e Index.html juntos, salvar e publicar nova versão no Apps Script. Não há migração de dados ou nova aba de banco de dados.

## Indicadores — Gestor > Indicadores > DOCs para Despacho

- Recebidos pela data CADASTRADO_EM.
- Concluídos e arquivados pela data e tipo da última entrada em estado final comprovada no HISTORICO_DOCS_DESPACHO. Só documentos atualmente finalizados entram nessa produção; documentos reabertos voltam à fila. Edição ou arquivamento após conclusão não cria um segundo despacho. Não se usa ATUALIZADO_EM como data de despacho.
- Documentos são contados por ID; protocolos distintos são a união dos protocolos recebidos/finalizados no período. Vários documentos do mesmo protocolo não viram vários protocolos distintos.
- Tempo médio em dias corridos entre cadastro e finalização, incluindo arquivados, apenas para datas válidas e em ordem. Média ponderada pelos documentos com tempo conhecido, não média de médias. Ausência de informação aparece como traço e não vira zero no gráfico de tempo.
- A fila atual é apresentada separadamente, fora do filtro de período: abertos, aguardando resposta (incluídos nos abertos), concluídos e arquivados. Faixas 0–8, 9–17 e 18+ dias usam DATA_DOCUMENTO como na fila operacional. Sem data válida aparece separadamente.
- Agrupamentos por dia, mês, tipo de documento, origem e responsável; situação e prazo atuais possuem medidas próprias. Responsável é o usuário do histórico, nunca o preenchedor. Sem identificação: Não informado.
- Filtros de origem e responsável. Gráficos de barras/linha e comparação Recebidos × concluídos (barras), interação por clique/teclado e exportação SVG. Comparação em barras permanece assim mesmo se o formato geral estiver em Linha.
- Uma leitura de DOCS_DESPACHO e uma do histórico por consulta, agregadas em memória. Não consulta outras áreas. Troca de medida, gráfico e detalhamento usa o resultado local. Filtros/períodos já consultados são reutilizados na sessão; Consultar / Atualizar força nova leitura. Sem criação de planilhas na consulta.
- Finalizações sem histórico ou cadastros sem data não recebem datas inventadas; avisos informam incompletude. As estatísticas históricas dependem desses registros já existentes.

## Escala extra

Campo Função com Vistoriador, Atendimento e Conferência. Valor enviado junto ao lançamento; servidor normaliza e valida as funções. Mantida a regra automática por dia/turno: Fabrício/Luciene no Atendimento, um atendente entre os não vistoriadores quando não houver exclusivos, demais na Conferência. Portanto a seleção é a função inicial e pode ser ajustada pela regra; a mensagem de sucesso mostra a função efetivamente gravada e informa o ajuste. Não adiciona Motorista como opção, pois não é função independente na regra atual. Proteções contra duplicidade/clique duplo preservadas.

## Copiar protocolo em DOCs

Mensagem pequena junto ao protocolo, após confirmação da cópia, desaparecendo em 2,2 segundos. Se a API de clipboard falhar, tenta a cópia compatível; retorno falso ou exceção mostra falha, sem falso sucesso. Usa dataset escapado, sem inserir o protocolo como código JavaScript. Sem chamada ao servidor.

## Validação

302 testes locais passaram. 37 cenários Chromium relacionados passaram (7 novos integrados, 11 indicadores, 8 DOCs/rascunho/conferente, 7 escalas e 4 salvamento DOCs). O lote de 1.800 documentos e históricos confirmou duas leituras e zero escritas. Serviços Google simulados; não mede latência real do Apps Script nem valida a produção.
