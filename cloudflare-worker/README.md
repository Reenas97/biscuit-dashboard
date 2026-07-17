# Agendador do Telegram

Worker gratuito responsável por:

- verificar projetos pausados a cada 2 minutos;
- enviar o cronograma diário às 8h no horário de São Paulo;
- consultar os dados existentes no Firestore;
- evitar mensagens duplicadas.

## Segredos necessários

- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_USER_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Os valores devem ser cadastrados como secrets do Cloudflare e nunca enviados ao Git.

## Testes locais

```sh
npm install
npm run check
npm run dev
```

Com o servidor local ativo, os agendamentos podem ser simulados:

```text
http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/2+*+*+*+*
http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+11+*+*+*
```
