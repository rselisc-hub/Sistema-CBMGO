# Datas sem zero na fila de Conferência — 05/11/2026

A ordenação no servidor e no navegador agora aceita dia/mês com um ou dois dígitos: 5/11/2026 e 05/11/2026 representam a mesma data. O formato ISO também aceita mês/dia sem zero. A regra de prioridade por F-7 e estado operacional, assim como os agrupamentos de meses, permanece igual. Não altera valores ou formatos da planilha.

O caso relatado ocorre porque a cópia enviada contém formatos d/m/yyyy e dd/mm/yyyy. O parser anterior exigia dois dígitos e enviava datas como 5/11/2026 ao grupo de datas não reconhecidas, após março.

339 testes locais passaram, incluindo equivalência dos formatos e ordenação, em 05/11, de outubro, 3/11, 5/11 e março. Os cenários de reabertura da Conferência (5) também foram verificados no Chromium com Google simulado. Não houve alteração do banco de produção.

Atualizar WebApp.gs e Index.html juntos e publicar nova versão. Reabrir o sistema para carregar o HTML atualizado e atualizar a fila.

## Apresentação padronizada

As datas da Conferência agora são apresentadas com DD/MM/AAAA, incluindo atribuição, fila, Consulta Geral, detalhes do trabalho e data/hora do histórico. Hora com um dígito também recebe zero, preservando minutos/segundos. A transformação é apenas visual: não modifica os itens do cache, assinaturas de reabertura, valores na planilha ou comparações de movimentação no servidor.

340 testes locais passaram, incluindo equivalência visual de formatos brasileiros/ISO, preservação de protocolo/textos vazios e manutenção de datas já padronizadas. Os 13 cenários Chromium relacionados (reabertura e DOCs/rascunhos/conferente) passaram com Google simulado. Nesta entrega somente Index.html mudou; WebApp.gs do pacote é o da versão 08a4349. Atualizar Index.html, publicar nova versão e reabrir o sistema.
