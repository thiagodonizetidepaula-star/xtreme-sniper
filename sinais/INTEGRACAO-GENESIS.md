# Integração do Genesis IA (serviço informado em 13/11/2026)
Origem fornecida pelo proprietário: https://bulex-breakout-connect.onrender.com/

## O que foi possível verificar externamente
A página inicial pública exibe:
- Título "GENESIS IA — Bot de opções binárias · próxima vela M1";
- "M1 · CONTA PRÁTICA" e "Candles fechados da corretora";
- Botões ligar / pausar / desligar, login com chave privada, conexão à Bulex com conta prática;
- Estratégia "Scalper M1", histórico "WIN TESTE DIRECIONAL" / "LOSS TESTE DIRECIONAL";
- Texto explícito no próprio site: "sinais de estudo" e "Não envia ordens";
- Estado inicial "Bulex desconectada" para visitante sem login.

**Limite da verificação:** página pública HTML não prova que candles M1 realmente chegam do servidor Bullex, nem que estão atualizados ou representam o feed exato do ativo. Uma sessão autenticada e código fonte do serviço são necessários.

## Três restrições da integração
1. Não aceitar o nome de um endpoint ou a frase "tempo real" como evidência suficiente de fonte real; validar pelo servidor: ID do ativo, timestamps da corretora, fechamentos, sequenciamento sem buracos, atraso, perda de sessão e origem.
2. Testes direcionais devem ser rotulados como "WIN TESTE" e "LOSS TESTE"; não apresentar como operação executada nem lucro de conta.
3. Não criar sessões com email/senha no frontend da interface comercial e não mover credenciais da corretora para navegador/cliente. Broker sessão e tokens somente no backend isolado.

## Contrato esperado do adaptador do Genesis
- Endpoint interno autenticado e somente leitura; jamais expor no browser para qualquer visitante.
- Resposta padronizada com `source=BULLEX_PRACTICE`, feed_ts, lista de ativos reais, candles OHLC e status de validação.
- Cada sinal: id único, asset, direction CALL|PUT, strategy, entry_at, expires_at e status.
- Resultados: tipo `DIRECTIONAL_TEST` ou `BROKER_TRADE`, preços de referência, fonte e identificador quando aplicável.
- O gateway deve rejeitar os resultados se houver atraso, falta de confirmação ou credenciais expiradas.

## Prerequisitos para implementar
1. Identificar no Render o repositório, startCommand e deploy do serviço informado.
2. Ler o servidor em operação / métodos e formatos de leitura do mercado, sem reiniciar, alterar variáveis ou chamar endpoints com efeito colateral.
3. Adicionar o endpoint de leitura limitada com autenticação servidor-servidor ao serviço do Genesis em branch de desenvolvimento, após confirmar que o código acessado é o correto.
4. Integrar o frontend Xtreme em desenvolvimento, testar com candles da conta prática e entradas na próxima vela.
5. Adicionar login, assinatura individual e logs no banco dedicado, validar em homologação e somente depois publicar.

A nova interface pode ser testada visualmente sem backend. Sem candles reais, nenhum sinal é fabricado.
