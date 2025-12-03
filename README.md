# Sistema C.A.O.S.

> **C**ontrole de **A**gentes e **O**corrências **S**obrenaturais.

Uma plataforma completa de gerenciamento de fichas e mesas virtuais (VTT) para o sistema de RPG de mesa **Ordem Paranormal**. O sistema foca na automação de regras e na imersão visual, permitindo que mestres e jogadores foquem na narrativa enquanto a aplicação cuida da matemática.

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Versão](https://img.shields.io/badge/Versão-3.4-blue)

## 📋 Funcionalidades

### Para Agentes (Jogadores)
- **Ficha Automatizada:** Cálculo automático de PV, PE, SAN, Defesa, Perícias e Carga baseado em Atributos, Classe, Origem e NEX.
- **Inventário Inteligente:** Gestão de itens com cálculo de peso e categoria. Suporte a modificações de armas e itens amaldiçoados.
- **Grimório de Rituais:** Biblioteca completa de rituais com filtros por Elemento e Círculo.
- **Progressão de Personagem:** Sistema de aumento de NEX que libera habilidades de classe e trilha automaticamente.
- **Rolagem de Dados:** (Em breve) Calculadora de dano dinâmica integrada aos cards de armas.

### Para a Ordem (Mestres)
- **Gestão de Mesas:** Criação de salas privadas com ID único para convite.
- **Tracker de Iniciativa:** Controle de combate em tempo real, sincronizado via Firebase.
- **Bestiário Integrado:** Fichas de criaturas e NPCs prontas para serem adicionadas ao combate.
- **Controle de Condições:** (Em breve) Aplicação de estados (Sangrando, Caído, etc.) diretamente no tracker.

## 🛠 Tecnologias Utilizadas

Este projeto foi desenvolvido com as seguintes tecnologias:

- **[React](https://reactjs.org/)** - Biblioteca para construção da interface.
- **[Vite](https://vitejs.dev/)** - Build tool rápida e leve.
- **[Firebase](https://firebase.google.com/)** - Backend as a Service (BaaS):
  - **Authentication:** Sistema de login (E-mail/Senha e Google).
  - **Firestore:** Banco de dados NoSQL em tempo real para sincronização das fichas e mesas.
- **CSS3 & CSS Variables** - Estilização temática responsiva (Temas: Ordem, Sangue, Morte, Conhecimento, Energia).


🤝 Contribuição
Contribuições são bem-vindas! Sinta-se à vontade para abrir uma issue ou enviar um pull request.