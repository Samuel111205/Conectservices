# Política de cancelamentos, reembolsos e disputas

**Estado:** proposta operacional v0.1 — requer validação jurídica antes de ser publicada como termos vinculativos.

## Âmbito e estado actual

Esta proposta aplica-se às contratações de serviços entre cliente e prestador. A aplicação permite registar transferências, dinheiro, Multicaixa, carteira móvel ou outros meios, mas não cobra nem conserva fundos: o pagamento é combinado directamente entre as partes e a confirmação é registada na plataforma. Por isso, a Conect Services não deve prometer um reembolso automático nem afirmar que consegue bloquear ou devolver dinheiro que não recebeu.

As encomendas de produtos têm um fluxo separado. Esta política não substitui as condições de venda, entrega e devolução que cada empresa deve apresentar ao consumidor.

## Regras propostas

### Cancelamento

- Uma contratação pode ser cancelada pelo cliente ou pelo prestador enquanto estiver **Agendada** ou **Confirmada**, antes do início do serviço. A regra coincide com os estados e permissões actualmente implementados.
- O pedido de cancelamento deve indicar o motivo e quem o iniciou. A outra parte recebe uma notificação e pode acrescentar informação, mas não pode impedir o registo do pedido.
- Depois de o serviço começar, o cancelamento simples deixa de estar disponível. A parte pode abrir uma disputa para registar interrupção, incumprimento ou acordo de encerramento.
- Não se aplica uma multa automática por cancelamento tardio ou falta de comparência. Um custo directo, razoável e comprovável só pode ser considerado se tiver sido informado antes da contratação e aceite expressamente, sem reduzir direitos legais do consumidor.
- Se o prestador cancelar, não comparecer ou não puder executar o serviço, a proposta é devolver integralmente o montante pago por trabalho ainda não prestado, sem prejuízo da apreciação de danos adicionais pelos meios competentes.
- Se o cliente cancelar antes do início, a proposta é devolver integralmente o montante pago, excepto custos directos previamente divulgados e legalmente admissíveis que tenham sido efectivamente incorridos. A retenção de qualquer valor deve ser justificada e contestável.
- Se apenas uma parte do serviço tiver sido concluída, as partes devem discriminar o trabalho realizado e o valor correspondente. O saldo relativo ao trabalho não prestado deve ser devolvido; a plataforma não deve impor perda total do pagamento.

### Reembolso

- O reembolso segue, sempre que possível, o meio de pagamento original e deve corresponder ao valor decidido. Se esse meio não permitir a devolução, a alternativa é acordada com o pagador e registada no caso.
- A parte que recebeu o pagamento executa a devolução enquanto a plataforma não tiver pagamentos integrados. A aplicação regista o pedido, decisão, valor, referência, responsável e prova da devolução; não marca como reembolsado antes de existir confirmação.
- Só pode existir um pedido pendente por pagamento; pedidos parciais seguintes podem ser submetidos depois da decisão anterior. O total solicitado, aprovado e já confirmado não pode ultrapassar o pagamento confirmado.
- Meta operacional proposta: decidir casos simples até cinco dias úteis depois de recebida a informação necessária. O prazo efectivo de transferência depende do banco ou operador e deve ser comunicado sem prometer um prazo que a plataforma não controla.
- Um reembolso parcial deve indicar o cálculo, o trabalho prestado e quaisquer custos comprovados. A decisão deve poder ser contestada.

### Disputa

- Qualquer participante pode abrir uma disputa por serviço não prestado, atraso ou falta de comparência, divergência sobre âmbito/preço, execução defeituosa, interrupção ou reembolso não efectuado.
- A pessoa que abre o caso escolhe uma categoria e descreve os factos. A outra parte tem uma oportunidade equivalente para responder. Na primeira versão da API, as mensagens são texto sem anexos; não enviar dados de cartão, credenciais ou dados bancários completos.
- Meta operacional proposta: dar até três dias úteis para resposta e concluir a análise simples até cinco dias úteis depois do fim da recolha de informação. Casos complexos podem demorar mais; o estado e o motivo do atraso devem ficar visíveis. O silêncio não equivale a renúncia de direitos.
- Um moderador sem interesse no caso analisa os registos e comunica uma decisão fundamentada. A decisão interna facilita a resolução na plataforma e não impede o acesso às autoridades, tribunais ou outros meios legais disponíveis; não se impõe arbitragem.
- As partes podem resolver o caso por acordo em qualquer momento. O acordo deve indicar montante, responsável e prazo de execução, e só se considera concluído quando as obrigações forem cumpridas.

## Salvaguardas legais e de dados

A Lei n.º 15/03 de Defesa do Consumidor prevê, em determinadas contratações de fornecimento de bens ou serviços fora do estabelecimento por correspondência ou meio equivalente, desistência em sete dias úteis e devolução imediata e monetariamente actualizada dos valores pagos. Prevê ainda direitos por vícios aparentes, com prazos legais distintos conforme a natureza do serviço, e invalida cláusulas que retirem ao consumidor opções de reembolso previstas na lei ou criem desvantagem abusiva. A aplicação exacta destes artigos depende do contrato e dos factos; os prazos operacionais desta política não limitam direitos legais. Consulte os artigos 13.º, 15.º e 16.º da [Lei n.º 15/03, publicada pelo INACOM](https://inacom.gov.ao/wp-content/uploads/2025/06/lei_15_03_lei_de_defesa_do_consumidor-22_de_julho_de_2003-1.pdf).

- Os preços, âmbito, calendário e condições de pagamento devem ser claros e aceites antes do serviço; alterações são acordadas pelas partes.
- O acesso a disputas, comprovativos e dados bancários deve ser limitado a quem precisa de os tratar. Recolher apenas os elementos necessários, ocultar dados sensíveis nas interfaces e definir um prazo de retenção com base em obrigações legais e resolução de reclamações.
- Cada mudança de estado, decisão administrativa e confirmação de reembolso deve deixar um registo de auditoria imutável, com actor e data. Não guardar números completos de cartão, PIN, códigos de segurança ou credenciais bancárias.

## Estado da implementação

**Implementado:** endpoints e migrações do backend; interfaces Web e Mobile para abrir e acompanhar disputas, trocar mensagens, pedir reembolso, cancelar o pedido pendente e registar a confirmação do prestador; notificações na aplicação, por email e push para eventos de disputa/reembolso; limites de acesso por participante, histórico de auditoria e limite agregado ao valor pago.

**Ainda necessário:** anexos privados com validação de conteúdo e controlo de acesso; interface operacional para a equipa rever e decidir casos; validar juridicamente a política; automatizar prazos; integrar um operador de pagamentos antes de processar reembolsos na plataforma. O estado `PAID` indica confirmação do prestador e referência registada, não uma verificação independente pelo sistema.

Esta proposta descreve regras de produto para discussão e não constitui parecer jurídico.
