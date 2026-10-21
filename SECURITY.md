# Segurança

*English: please report vulnerabilities privately through GitHub's "Report a vulnerability" button (Security tab), not in public issues. You can also write to opencena.org@gmail.com.*

## Versões com correções

| Versão | Recebe correções de segurança |
|--------|-------------------------------|
| 0.9.x (beta) | Sim |
| Anteriores | Não |

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o botão **Report a vulnerability** na aba **Security** do repositório no GitHub, que cria um relato privado, ou escreva para **opencena.org@gmail.com**.

Inclua, se puder:

- o que acontece e qual o risco (por exemplo, um arquivo de projeto que executa código ao ser aberto);
- os passos ou um arquivo para reproduzir;
- a versão do OpenCena e o sistema (Windows, macOS, Linux ou navegador).

Respondemos assim que possível, combinamos um prazo para a correção e damos o crédito a quem relatou, se a pessoa quiser.

## O que conta como vulnerabilidade

O OpenCena não tem servidor nem conta, então os riscos estão principalmente em:

- abrir ou importar arquivos (projetos, `.docx`, `.fountain`, imagens) preparados para causar dano;
- o app instalado acessar arquivos fora da pasta escolhida;
- a atualização automática aceitar um pacote que não foi assinado pelo projeto.
