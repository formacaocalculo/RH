# Portal RH — Gestão de Recursos Humanos Multi-Empresa

Aplicação web para gestão de RH (colaboradores, assiduidade, férias) com suporte
para múltiplas empresas. Cada conta gere as suas próprias empresas; quem for
administrador tem acesso adicional a uma área de Administração com visão sobre
todas as empresas de todos os utilizadores.

## Como funciona o acesso

- **Qualquer pessoa** cria a sua própria conta (aba "Criar Conta" no ecrã de
  login) e fica imediatamente a poder criar e gerir as suas próprias empresas.
- **Administradores** (ver abaixo como atribuir) veem adicionalmente um botão
  "🛠️ Administração" que dá acesso a todas as empresas de todos os
  utilizadores, com a opção de "Entrar →" numa empresa para dar suporte —
  sem nunca precisar da password de mais ninguém.

## Estrutura de dados no Firestore

```
utilizadores/{uid}/empresas/{empresaId}
utilizadores/{uid}/empresas/{empresaId}/funcionarios/{id}
utilizadores/{uid}/empresas/{empresaId}/ausencias/{funcId}
utilizadores/{uid}/empresas/{empresaId}/processamentos/{AAAA-MM}
utilizadores/{uid}/empresas/{empresaId}/backups/{id}
utilizadores/{uid}/empresas/{empresaId}/configuracoes/empresa_base
utilizadores/{uid}/empresas/{empresaId}/alertas_dashboard/{id}

admins/{uid}             -> { email }  (atribuído manualmente, ver abaixo)
lixeiraEmpresas/{id}      -> backup de empresas inteiras eliminadas (só admins)
```

## Configuração inicial obrigatória

### 1. Regras de segurança do Firestore

O ficheiro `firestore.rules` na raiz deste projeto contém as regras corretas.
**Sem aplicar isto, qualquer pessoa autenticada poderia, em teoria, aceder aos
dados de qualquer outra empresa diretamente pela API do Firestore.**

1. Firebase Console → o teu projeto → Build → Firestore Database → separador "Regras"
2. Substitui todo o conteúdo pelo de `firestore.rules`
3. Publicar

### 2. Criar o primeiro administrador

Não é possível um administrador "criar-se a si próprio" pela aplicação — isto
é deliberado, por segurança (ver `firestore.rules`, a coleção `admins` nunca
aceita escrita pela app). Os passos são:

1. Cria normalmente uma conta na aplicação (aba "Criar Conta" no login)
2. Firebase Console → Authentication → Users → copia o **UID** dessa conta
3. Firebase Console → Firestore Database → separador "Dados"
4. Cria uma coleção chamada `admins` (se ainda não existir)
5. Cria um documento cujo **ID é exatamente esse UID**
6. Dentro do documento, adiciona um campo `email` (string) com o email da
   pessoa — é só informativo, não é usado pelas regras, mas ajuda a
   identificar quem é quem mais tarde
7. Na próxima vez que essa pessoa entrar na aplicação, vai ver o botão
   "🛠️ Administração"

Podes repetir isto para quantas pessoas precisares.

## Estrutura de ficheiros

```
index.html                          # ponto de entrada (SPA)
firestore.rules                     # regras de segurança — aplicar na consola Firebase
assets/css/shell.css                # paleta de cores e reset global
assets/js/app.js                    # inicialização Firebase + authReady
assets/js/router.js                 # router SPA com proteção de rotas
assets/js/firebase-config.js        # credenciais do projeto Firebase
assets/js/modules/
  tenant.js                         # motor multi-empresa (core)
  sidebar.js                        # sidebar dinâmica partilhada
  login.js                          # entrar / criar conta
  empresas.js                       # "Minhas Empresas" — criar/escolher/eliminar
  admin.js                          # área de administração (visão global)
  dashboard.js                      # painel principal
  funcionarios.js                   # listagem de colaboradores
  criar-funcionario.js              # criação de colaborador
  ficha-funcionario.js              # ficha/edição de colaborador
  assiduidade.js                    # faltas, férias, ausências
  processamento.js                  # cálculo mensal de vencimentos
  recibos.js                        # consulta e geração de recibo em PDF
  parametrizacao.js                 # configurações da empresa ativa
  lixeira.js                        # registos individuais eliminados (por empresa)
  colaborador-utils.js              # utilitários partilhados (horário, filhos, NIB...)
  seguranca-dados.js                # reautenticação + backup antes de eliminar
  ferias-utils.js                   # cálculo de feriados e direito a férias
```

## Notas de segurança

- Toda a eliminação de dados (colaboradores, ausências, empresas) exige
  reintroduzir a password da conta antes de prosseguir, e guarda uma cópia
  completa numa lixeira antes de remover, com opção de descarregar `.json`.
- A separação entre empresas é garantida tanto pela aplicação como pelas
  regras do Firestore — mesmo que a interface tivesse um erro, as regras
  impedem o acesso cruzado entre contas que não sejam administradoras.

## Processamento de Vencimentos — limitações importantes

- A **retenção de IRS não é calculada automaticamente**: defina a taxa de
  cada colaborador na sua ficha individual ("Taxa de Retenção IRS"),
  conforme a tabela de retenção em vigor para a categoria/escalão aplicável.
  As tabelas oficiais da AT são extensas e mudam anualmente — este sistema
  não as reproduz.
- A taxa de Segurança Social do trabalhador (11% por defeito) é configurável
  em Parametrização, para cobrir regimes especiais.
- O vencimento base é calculado proporcionalmente aos dias úteis do mês,
  descontando apenas ausências marcadas como "conta para assiduidade" (ver
  tabela legal em Assiduidade). O subsídio de refeição segue a mesma regra
  já usada no mapa de assiduidade (mínimo de horas/dia em faltas parciais).
- Os recibos gerados em PDF são um documento de apoio interno — não
  substituem declaração oficial para efeitos fiscais.
