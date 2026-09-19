# ⚔️ RPG Soundboard - Mobile App

[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)](https://www.android.com/)
[![Docker](https://img.shields.io/badge/Environment-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)

Um aplicativo mobile moderno e intuitivo desenvolvido para mestres e jogadores de RPG de mesa (TTRPG). O aplicativo permite importar arquivos de áudio locais, organizá-los por cenas/perfis temáticos (como Taverna, Batalha, Masmorra), mixar múltiplos sons simultâneos em loop e controlar o volume de cada trilha de forma independente durante a narrativa.

---

## 🌟 Principais Funcionalidades

- 🎭 **Cenas & Perfis Dinâmicos**: Crie abas personalizadas para cada ambiente da aventura (ex: *Taverna do Javali*, *Combate com Dragão*, *Floresta Sombria*). Alterne entre as cenas com um único toque.
- 🔁 **Mixagem Simultânea em Loop**: Toque múltiplos áudios ao mesmo tempo. Você pode rodar uma música de fundo suave e sobrepor efeitos como chuva, trovões ou murmúrios de taverna.
- 🎚️ **Controle de Volume Individual**: Cada áudio possui botões dedicados de aumento/redução e uma barra visual dourada com porcentagem exata (0% a 100%).
- 💾 **Persistência Completa de Dados & Arquivos**:
  - Os perfis, nomes das trilhas e volumes personalizados ficam salvos no armazenamento local (`AsyncStorage`).
  - Os arquivos de áudio selecionados são copiados para o diretório permanente do aplicativo (`FileSystem`), garantindo que não sumam caso você limpe a pasta de downloads do celular.
- ⏹ **Botão de Emergência ("Silenciar Tudo")**: Quando reviravoltas repentinas acontecerem na história, um botão no cabeçalho permite pausar todas as faixas ativas instantaneamente.
- 🎨 **Interface Dark Fantasy**: Visual escuro minimalista (`#131317`) com destaques em roxo místico (`#5C3C92`) e dourado (`#E5A93D`), projetado para não cansar a vista durante sessões noturnas.

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Finalidade |
| :--- | :--- |
| **React Native (v0.86)** | Framework mobile multiplataforma |
| **Expo SDK (v57)** | Ecossistema de desenvolvimento e APIs nativas |
| **expo-audio** | Módulo moderno e otimizado para reprodução de áudio e loop |
| **expo-document-picker** | Seleção de arquivos de áudio nativos do aparelho |
| **expo-file-system** | Gerenciamento e cópia definitiva de arquivos para o sandbox do app |
| **@react-native-async-storage/async-storage** | Armazenamento persistente de estado (cenas, volumes e metadados) |
| **Docker & Docker Compose** | Ambiente conteinerizado e padronizado sem necessidade de Node.js no host |
| **EAS Build** | Serviço de compilação na nuvem para geração do arquivo `.apk` standalone |

---

## 📂 Estrutura do Projeto

```text
rpg-soundboard/
├── assets/                  # Ícones, tela de splash e imagens adaptativas
├── App.js                   # Código principal da aplicação (Interface, Áudio e Cenas)
├── app.json                 # Metadados e configurações nativas do Expo / Android
├── eas.json                 # Perfis de compilação para gerar o APK nativo
├── docker-compose.yml       # Orquestração do ambiente conteinerizado
├── package.json             # Dependências e scripts do projeto
└── README.md                # Documentação do projeto
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Docker](https://www.docker.com/) instalado no seu computador/WSL.
- Aplicativo **Expo Go** instalado no seu celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) ou [iOS](https://apps.apple.com/app/expo-go/id982107779)).

### 1. Clonar o Repositório
```bash
git clone https://github.com/Tomiatti/rpg-soundboard.git
cd rpg-soundboard
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto informando o seu token de acesso da Expo (necessário para o modo túnel):
```env
EXPO_TOKEN=seu_token_expo_aqui
```
*(Você pode obter seu token gratuitamente em [expo.dev](https://expo.dev) > Account Settings > Access Tokens).*

### 3. Iniciar o Ambiente com Docker
```bash
docker compose run --service-ports expo
```

Assim que o Metro Bundler inicializar, um **QR Code** será exibido no terminal:
- No Android: Abra o app **Expo Go** e escaneie o código.
- No iOS: Aponte a câmera nativa para o QR Code e toque no link do Expo Go.

---

## 📦 Como Compilar o APK Standalone (Instalação Direta)

O projeto já está pré-configurado com o **EAS Build** para compilar arquivos `.apk` prontos para instalação direta em qualquer dispositivo Android (sem depender do Expo Go ou de loja):

```bash
docker run --rm -it -v "$(pwd):/app" -w /app -e EXPO_TOKEN=seu_token_expo node:20 sh -c \
  "apt-get update && apt-get install -y git && \
   git config --global protocol.file.allow always && \
   git config --global --add safe.directory '*' && \
   npx eas-cli build --platform android --profile preview"
```

Ao término da compilação na nuvem da Expo (cerca de 5 a 8 minutos), o terminal fornecerá um link e um QR Code para baixar o arquivo `.apk` diretamente para o seu aparelho.

---

## 👤 Autor

Desenvolvido por **Gabriel Tomiatti**  
- GitHub: [@Tomiatti](https://github.com/Tomiatti)
