# Credenciamento — entradas SIAPI e SEI

Mantidas as três telas: Alimentação, Análise e Consulta geral. A importação da planilha histórica foi retirada da interface. Os registros e históricos já importados são preservados.

## Alimentação

Dois quadros separados:

- SIAPI: Protocolo, Envio, Serviço, Razão social, Logradouro, Bairro, Cidade/UF, conforme a tabela de Conferência de Credenciamentos da primeira imagem enviada. O parser é próprio do Credenciamento e não altera a colagem de Vistorias. Prefere as células HTML quando disponíveis; também aceita texto tabulado e data/hora em linhas separadas. Cidade e UF são separadas. Colagens incompletas são recusadas antes de gravar.
- SEI: cabeçalho rotulado da segunda imagem. Reconhece Protocolo Nº, Nº CBMGO, Serviço, Razão social, Endereço, Município, OBM responsável, CNPJ/CPF, Responsável técnico/CREA e Área. Vários cabeçalhos podem ser colados juntos. A ausência da UF não é preenchida por suposição. O número CBMGO não é usado como número do processo SEI.

Ler e conferir exibe a prévia com origem, campos editáveis básicos e detalhes da origem. Adicionar à fila de análise salva e abre Análise. A prévia permanece disponível em caso de erro de gravação. O campo de texto da outra origem é preservado quando a prévia é limpa. O banco mantém uma linha principal por protocolo; se o mesmo protocolo vier das duas origens, a identificação passa a mostrar as duas e o número SEI existente é preservado. Reimportar continua enviando o protocolo à Análise, conforme o comportamento já existente.

## Número do processo SEI

Registros com origem SEI mostram Número do processo SEI na janela de Análise. É digitado manualmente e pode ser salvo antes de concluir, usando Salvar número SEI. A conclusão também salva o valor digitado. O valor é texto para preservar zeros e identificadores extensos; números com pontuação usual são aceitos. Salvar novamente o mesmo número não repete o evento histórico. Alterar o número gera PROCESSO_SEI_ATUALIZADO, que não conta como análise/produtividade.

O número é complementar: sua ausência não impede uma conclusão. Um valor preenchido inválido é recusado. A origem SIAPI não exibe esse campo, a menos que o protocolo também tenha origem SEI.

## Consulta geral

Os protocolos AGUARDANDO ficam na Análise. Após APROVADO ou EXIGÊNCIA, saem dessa fila e aparecem na Consulta geral, com origem e processo SEI. Registros históricos continuam consultáveis. A ordenação pela atualização completa e a ausência do fundo amarelo de exigência são mantidas.

Também foi corrigida a normalização de EXIGÊNCIA: a remoção de acentos fazia a validação antiga recusar esse despacho e o resumo não contá-lo corretamente. O texto armazenado permanece EXIGÊNCIA.

## Armazenamento

Não se deslocam colunas de CREDENCIAMENTO_PROCESSOS (15) ou HISTORICO_CREDENCIAMENTO (13). A aba CREDENCIAMENTO_COMPLEMENTOS é criada automaticamente na mesma planilha ao gravar as novas entradas, com 12 colunas: PROTOCOLO, ORIGEM, NUMERO_SEI, NUMERO_CBMGO, ENDERECO, BAIRRO, OBM_RESPONSAVEL, CNPJ_CPF, RESPONSAVEL_TECNICO, AREA, DATA_ENVIO e ATUALIZADO_EM. Identificadores são formatados como texto antes da gravação. Cabeçalhos incompatíveis ou protocolos duplicados na aba complementar são recusados para diagnóstico.

Escritas continuam usando ScriptLock e gravações em lotes. Não existe transação entre as abas: se um serviço Google falhar após uma escrita, a interface não anuncia sucesso; a cópia permanece disponível e a operação pode ser conferida/repetida pela chave de protocolo. As consultas não criam a nova aba. Não há sincronização HTTP com SIAPI/SEI: as entradas são por cópia e colagem.

## Validação

105 testes Node passaram, incluindo leitura dos dois formatos, campos vazios, data/hora, múltiplos cabeçalhos, lotes de 27 protocolos, validação antes de gravar, permissões, preservação de dados antigos, número SEI e passagem Análise → Consulta.

Sete cenários adicionais passaram no Chromium com o HTML e o backend reais, conectados a uma simulação em memória dos serviços Google. Os exemplos foram reproduzidos a partir das imagens, com nomes e identificadores fictícios. Foram testados cabeçalhos HTML com quebras internas e células vazias. Não houve acesso autenticado ao SIAPI/SEI, implantação ou alteração de planilhas reais no Google.

Atualização: substituir WebApp.gs e Index.html, salvar e publicar nova versão. A aba complementar é criada pelo programa; não exige montagem manual.
