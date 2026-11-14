# Xtreme Sniper — Painel Comercial (etapa 1)

## O que já foi implementado

- Interface mobile/desktop neon, robô SVG animado, arcos e iluminação.
- Card CALL/PUT sobreposto ao robô durante o ciclo da entrada.
- Ativo monitorado, relógio da próxima vela, expiração, placar e histórico.
- Configurações locais (ativo, expiração preferida, som).
- Renderizador de candles OHLC **somente quando recebidos do feed real**.
- Endpoint serverless read-only com token mantido no servidor e bloqueio de feed vencido ou não verificado.
- Modelo SQL separado para usuários, assinaturas, sinais, resultados e configurações com RLS.

**Nenhum candle, sinal, WIN/LOSS ou porcentagem é simulado.** Sem uma fonte autenticada, o painel permanece em "AGUARDANDO FONTE" e exibe traços no placar.

## Como pré-visualizar

A pasta `sinais` pode ser servida como raiz de um site estático. Use um servidor local:

```bash
cd sinais
python -m http.server 8080
```

Abra `http://localhost:8080`. Sem backend a rota `/api/public-state` não existe e a tela mostra offline, como esperado.

Para publicação Vercel, use essa pasta como `rootDirectory`; a função `api/public-state.js` recebe as variáveis de ambiente abaixo. **Não ativar a fonte em implantação pública sem implementar autenticação e verificação de licença.**

## Contrato da integração real

A fonte é um **backend autorizado**, que lê e valida a Bullex PRACTICE/DEMO. Nunca salvar e-mail, senha ou sessão da corretora no navegador.

`GET XTREME_FEED_URL` com cabeçalho `Authorization: Bearer <XTREME_FEED_TOKEN>`:

```json
{
  "source": "BULLEX_PRACTICE",
  "verified": true,
  "feed_ts": 1794618000,
  "current_asset": "ATIVO_CONFIRMADO_PELA_FONTE",
  "assets": ["ATIVO_CONFIRMADO_PELA_FONTE"],
  "candles": [
    {"time": 1794617940, "open": 100.0, "high": 100.2, "low": 99.8, "close": 100.1, "closed": true}
  ],
  "signal": null,
  "history": []
}
```

Os números acima são **exemplo de formato para desenvolvedores**, não cotação nem sinal de corretora. A chave `verified` precisa ser produzida por um adaptador auditado que realmente confira o fornecedor, a conta DEMO, a ordem das velas, o tempo e a integridade — declarar `verified: true` sozinho não comprova isso.

Sinais, quando houver:
```json
{
 "id":"id-unico-do-sinal",
 "asset":"ATIVO_CONFIRMADO_PELA_FONTE",
 "direction":"CALL",
 "status":"scheduled",
 "entry_at":1794618000,
 "expires_at":1794618060
}
```

Resultados do histórico:
```json
{"id":"id-unico","asset":"ATIVO_CONFIRMADO_PELA_FONTE","direction":"CALL",
 "entry_at":1794618000,"expires_at":1794618060,"result":"WIN"}
```

Exemplos de dados do contrato não devem ser mostrados ao usuário como operações reais.

## Variáveis no servidor

- `XTREME_FEED_URL` — HTTPS do backend confiável.
- `XTREME_FEED_TOKEN` — token privado do backend, nunca no JavaScript cliente.

Sem as duas variáveis, `GET /api/public-state` devolve HTTP 503. A API exige informações recentes e não fabrica informações ao falhar.

## Pendente antes de vender

1. Confirmar autorização/termos e acesso de leitura à API da Bullex; identificar o backend **ativo e aprovado**.
2. Auditoria dos candles e relógio M1/M5, incluindo OTC, atrasos, expiração e duplicidades.
3. Conectar o adaptador ao endpoint somente após testes reais de candles na PRACTICE.
4. Criar **novo** projeto Supabase dedicado; revisar `supabase-schema.sql` antes de aplicar; migrar preferências locais para tabela por usuário.
5. Implementar login de compradores e verificação de assinatura **no endpoint** antes de expor dados reais. O SQL é preparação, não autenticação em funcionamento.
6. Testar sinais e resultados em ambiente DEMO por período suficiente; não prometer resultados.
7. Revisar questões legais e regulatórias e termos da corretora antes do lançamento.

## Segurança operacional

- Não reutilizar o projeto antigo explicitamente desativado pelo proprietário.
- Não tocar nos dados dos projetos Supabase ConCiliar+ e Mesa Trader.
- Não aceitar senha padrão universal para clientes. Recuperação e alteração individual de senha.
- Nunca afirmar que dados são live se estiverem vencidos, inconsistentes ou ausentes.
- Este painel **não envia ordens**, não faz operação real e não acessa credenciais de compradores.

## Estrutura

- `index.html` — tela.
- `style.css` — identidade e animação.
- `app.js` — estado visual e leitura do feed.
- `api/public-state.js` — proxy no servidor, sem segredo no frontend.
- `supabase-schema.sql` — esquema futuro para nova base Supabase.
