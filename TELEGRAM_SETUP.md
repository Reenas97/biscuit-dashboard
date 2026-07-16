# Integração do Telegram

A rotina envia diariamente, às 8h no horário de São Paulo:

- tarefas pendentes do dia;
- projetos com prazo nos próximos sete dias;
- indisponibilidades cadastradas para o dia.

Ela também pode ser executada manualmente na aba **Actions** do GitHub.

## Configurações necessárias

Crie estes quatro segredos em **GitHub > Settings > Secrets and variables > Actions**:

- `TELEGRAM_BOT_TOKEN`: token criado pelo BotFather;
- `TELEGRAM_CHAT_ID`: identificador da conversa com o bot;
- `FIREBASE_USER_ID`: identificador do usuário do Reena Biscuit;
- `FIREBASE_SERVICE_ACCOUNT`: conteúdo completo da credencial JSON do Firebase.

Nunca coloque o token do Telegram ou a credencial do Firebase em arquivos do projeto.
