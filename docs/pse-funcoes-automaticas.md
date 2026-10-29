# Funções automáticas na escala PSE

Regra confirmada em 29/10/2026: a composição é independente por data e turno. O Atendimento da manhã não cobre a tarde.

- Mantém os vistoriadores em Vistoriador.
- Entre os demais escalados, define um Atendente e os restantes como Conferencista.
- Fabrício e Luciene são sempre Atendentes, mesmo se a inscrição tiver outra função. Juntos, ambos ficam no Atendimento e os demais não vistoriadores ficam na Conferência.
- Sem essas duas pessoas, conserva o primeiro Atendente já definido. Se não houver, usa o primeiro não vistoriador na ordem de lançamento.
- Se o atendente for removido, escolhe um substituto entre os não vistoriadores que permanecerem no mesmo dia/turno.
- Sem não vistoriadores disponíveis, não inventa um militar nem converte um vistoriador comum em atendente. É necessário incluir uma pessoa elegível naquele turno.

A exceção reconhece FABRICIO/FABRÍCIO e LUCIENE como palavras completas no nome gravado, incluindo nomes com posto ou sobrenomes; não usa aproximação de nomes. Não foi confirmado nenhum militar real como Motorista: os exemplos dessa função eram registros fictícios dos testes. Conforme a regra original, todas as funções diferentes de Vistoriador entram na divisão Atendimento/Conferência, ressalvadas as duas exceções.

## Aplicação e armazenamento

Aplicação no servidor ao lançar selecionados, lançar escala extra e remover escalado. O cálculo reutiliza a leitura do CONTROLE_ESCALAS no lançamento em lote e na remoção; trabalha em memória e agrupa as alterações antigas em no máximo duas gravações de função. Continua usando as travas já existentes.

Atualiza somente a coluna E/Função dos grupos envolvidos na operação e grava os novos registros com a função final. Não acrescenta colunas nem faz migração em massa das escalas antigas ao instalar ou consultar. Serviço financeiro, horários, RG, nomes e regras de duplicidade permanecem separados da função. Escalas antigas de outros dias/turnos não são recalculadas por um novo lançamento.

A Escala PSE e a visualização SEI/PDF passam a priorizar a função efetivamente gravada no controle sobre a preferência original do Forms. A Lista de Voluntários não é reescrita; os inscritos podem mostrar a função inicial até o lançamento.

Operações de planilha não são transações. As travas impedem concorrência entre estes lançamentos, mas uma indisponibilidade entre gravações ainda exige conferir e repetir a operação. O lote reprocessa seus grupos mesmo quando os protocolos de identificação já estão escalados, preservando a proteção contra duplicação.

## Verificação

257 testes locais, incluindo nove casos da nova regra: separação por data/turno, cobertura própria da tarde, exceções juntas, lançamento incremental, conservação de campos, repetição, remoção e coerência das consultas. No Chromium, seis cenários de escala do Gestor, seis de PDF/AC-4 e cinco da consulta PSE pelo Atendimento. Serviços Google simulados; sem acesso à implantação ou à planilha em produção.

A versão inclui também a ampliação da lista Gerenciar / Remover Militares Escalados para até 420 pixels, limitada a 60% da altura da tela, e a grade interna dos gestores oculta. Layout verificado em larguras de 1440 e 390 pixels.

Instalar os dois arquivos WebApp.gs e Index.html e publicar uma nova versão do Apps Script.
