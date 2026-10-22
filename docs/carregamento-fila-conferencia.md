# Carregamento da fila de Conferência

Esta revisão preserva Vistorias, os dados armazenados, as permissões de servidor e a prioridade/ordenação das filas. Não acrescenta cache persistente nem modifica os controles de captura/histórico.

- A abertura usa as permissões entregues pelo login ou validarSessaoAcesso e chama diretamente a consulta da aba selecionada. Cada consulta continua validando token/perfil e garantindo suas estruturas. O endpoint prepararModuloConferencia permanece disponível para compatibilidade, mas a abertura deixa de esperar por ele para começar a consulta. Os menus usam a mesma sessão já autenticada; não há autorização baseada somente no navegador.
- Ordenação da fila: a prioridade e a chave de data são calculadas uma vez por registro no servidor e no cliente. As regras e desempates continuam os mesmos.
- Objetos de apresentação só são construídos para estados operacionais que entrarão na fila.
- A renderização cria um índice local dos protocolos em uma passada, preservando o primeiro índice em caso de duplicata, em vez de percorrer toda a fila a cada linha. Os botões continuam apontando para os índices da lista original.

## Evidência

Comparação com o commit 75e660d, antes desta revisão: nove medições, dois aquecimentos e alternância das versões. A amostra contém 933 registros de base, 4.090 eventos e 579 itens na fila. Retorno, contadores, ordem e HTML gerado foram equivalentes.

| Etapa local | Antes, mediana ms | Depois, mediana ms |
|---|---:|---:|
| Consulta e montagem no servidor simulado | 52.372 | 16.642 |
| Geração do HTML da fila em adaptador mínimo | 20.388 | 7.821 |

A chave de data era calculada 6.374 vezes no servidor e 2.222 vezes no cliente; passou a 579 vezes em cada um. Os tempos excluem rede e execução Google. O adaptador cliente gera strings de HTML; não mede layout, pintura ou interação em um navegador real. A eliminação da chamada preliminar reduz uma ida ao servidor na abertura, mas sua economia de latência não foi cronometrada no Google.

Foram acrescentados sete testes com 800 registros sintéticos, comparação de ordenação/HTML e abertura direta de fila, atribuição e consulta, incluindo ocultação do menu de atribuição quando não autorizado. Os 57 testes passaram e a sintaxe dos dois arquivos foi verificada.

## Instalação

Substituir o conteúdo de WebApp.gs e de Index.html pelo pacote atualizado, salvar e publicar uma nova versão da implantação. A parte de Vistorias permanece com o mesmo comportamento.

Continuam pendentes as validações no Google de concorrência, latência e área de transferência real, além das melhorias previamente discutidas e ainda não implementadas, como arquivamento e sincronização de Vistorias após lançamento.
