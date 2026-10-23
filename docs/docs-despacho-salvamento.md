DOCs para Despacho — salvamento e consulta

O botão Salvar DOC bloqueia novos cliques durante o envio. Cada cadastro recebe uma chave de envio; a repetição do mesmo envio retorna o documento já gravado. Documentos diferentes podem compartilhar protocolo, tipo, empresa e data quando cadastrados como novos envios. Não há exclusão automática de duplicados antigos.

A gravação usa ScriptLock para coordenar usuários e um identificador determinístico para documento e evento de cadastro. Se houver falha entre a gravação do documento e do histórico, repetir o envio completa o histórico. A coluna 26 ASSINATURA_CADASTRO é adicionada automaticamente em DOCS_DESPACHO; as 25 anteriores e os dados existentes são preservados. O armazenamento permanece na mesma planilha. Versões antigas sem chave mantêm a regra anterior de comparação por tipo/protocolo/data/empresa, agora sob bloqueio.

A tela só limpa os campos após resposta de sucesso. Se a resposta falhar, conserva os campos e a chave para repetir com segurança na mesma página. Se os dados forem alterados após uma falha, avisa que será outro cadastro. A chave fica na memória da página: fechar/recarregar ou trocar de dispositivo exige consultar a lista antes de recadastrar. Não há sincronização direta com SIAPI.

O registro confirmado aparece localmente sem aguardar uma segunda leitura completa. A atualização posterior da lista mantém o conteúdo visível; respostas antigas não substituem a confirmação recente. O cadastro atual procura apenas o identificador na coluna de IDs, sem baixar toda a tabela para verificar duplicidade. A listagem calcula pesos históricos e datas de ordenação uma vez por registro, preservando os critérios anteriores.

Validação: 128 testes Node e 29 cenários no Chromium local, incluindo clique duplo, resposta perdida após gravação, falhas parciais, tentativa concorrente, múltiplos documentos no mesmo projeto, compatibilidade e comparação da listagem anterior. Serviços Google simulados; isso não mede a latência real da implantação. Atualizar WebApp.gs e Index.html juntos e publicar nova versão. Nenhum dado real do usuário integra os testes.
