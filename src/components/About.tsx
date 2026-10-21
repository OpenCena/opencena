import { useState } from "react";
import gpl from "../../LICENSE?raw";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { openLink } from "@/storage/dir";
import { ModalOverlay } from "@/components/ModalOverlay";
import { UpdateCheck } from "@/components/Updater";
import { tt } from "@/i18n";

export const APP_VERSION = __APP_VERSION__;
/** Fase do projeto: aparece ao lado do logo e na tela Sobre. */
export const APP_CHANNEL = "beta";
export const REPO_URL = "https://github.com/OpenCena/opencena";
export const FORUM_URL = "https://opencena.discourse.group";
// Eu queria ser uma nuvem
// Programas e fontes de terceiros que vão dentro do app, com a licença de cada um.
const TERCEIROS: { nome: string; licenca: string; uso: string }[] = [
  { nome: tt("React e React DOM"), licenca: "MIT", uso: tt("interface") },
  { nome: "TipTap / ProseMirror", licenca: "MIT", uso: tt("editor de texto") },
  { nome: "Zustand", licenca: "MIT", uso: tt("estado do app") },
  { nome: "jsPDF", licenca: "MIT", uso: tt("geração de PDF") },
  { nome: "html2canvas, fflate", licenca: "MIT", uso: tt("usados pelo jsPDF") },
  { nome: "DOMPurify", licenca: "MPL-2.0 / Apache-2.0", uso: tt("usado pelo jsPDF") },
  { nome: "idb-keyval", licenca: "Apache-2.0", uso: tt("preferências no navegador") },
  { nome: "Tauri", licenca: "MIT / Apache-2.0", uso: tt("app instalado") },
  {
    nome: "Inter, Courier Prime, EB Garamond, Libre Baskerville, Crimson Text, Literata, Lora",
    licenca: "SIL Open Font License 1.1",
    uso: tt("fontes"),
  },
];

/** Versão do app, discreta, para rodapés e o menu lateral. */
export function VersionTag({ onClick }: { onClick?: () => void }) {
  const texto = `v${APP_VERSION}${APP_CHANNEL === "beta" ? ` ${tt("beta")}` : ""}`;
  return onClick ? (
    <button className="ver-tag" onClick={onClick} title={tt("Sobre e licença")}>
      {texto}
    </button>
  ) : (
    <span className="ver-tag">{texto}</span>
  );
}

/** Sobre o OpenCena: versão, licença GPL-3.0 e créditos de terceiros. */
export function AboutContent() {
  const [completa, setCompleta] = useState(false);
  return (
    <div className="about">
      <div className="about-head">
        <Logo size={30} />
        <span className="about-ver">
          {tt("versão")} {APP_VERSION} {APP_CHANNEL}
        </span>
      </div>
      <p className="about-lead">
        {tt("Editor livre e offline para roteiro audiovisual, roteiro de quadrinhos e livros. Seus projetos ficam em pastas no seu computador, em arquivos abertos.")}
      </p>

      {APP_CHANNEL === "beta" && (
        <p className="about-beta">
          {tt("Esta é uma versão beta: já dá para escrever de verdade, mas ainda pode ter erros. Faça cópias da sua pasta de projetos de vez em quando e conte o que encontrar no fórum ou no repositório.")}
        </p>
      )}
      <div className="about-actions">
        <button className="btn" onClick={() => void openLink(FORUM_URL)}>
          <Icon name="external" size={13} />
          {tt("Abrir o fórum")}
        </button>
      </div>

      <div className="about-sec">{tt("Atualizações")}</div>
      <UpdateCheck />

      <div className="about-sec">{tt("Licença")}</div>
      <p className="about-p">
        {tt("O OpenCena é software livre, distribuído sob a GNU General Public License, versão 3 ou posterior (GPL-3.0-or-later).")}
      </p>
      <ul className="about-list">
        <li>{tt("Você pode usar o programa para qualquer finalidade, inclusive comercial.")}</li>
        <li>{tt("Pode estudar e modificar o código-fonte.")}</li>
        <li>{tt("Pode redistribuir cópias, com ou sem modificações.")}</li>
        <li>
          {tt("Quem distribuir o programa (original ou modificado) precisa manter a mesma licença e oferecer o código-fonte correspondente.")}
        </li>
        <li>{tt("O programa é oferecido sem garantia de qualquer tipo.")}</li>
      </ul>
      <p className="about-p">
        <b>{tt("O que você escreve é seu.")}</b> {tt("A licença vale para o programa, não para as obras criadas com ele: roteiros, livros e quadrinhos feitos no OpenCena pertencem a quem os escreveu, sem nenhuma restrição da GPL.")}
      </p>
      <div className="about-actions">
        <button className="btn" onClick={() => setCompleta((v) => !v)}>
          <Icon name="fileText" size={14} />
          {completa ? tt("Ocultar texto da licença") : tt("Ler a licença completa")}
        </button>
        <button className="btn btn-ghost" onClick={() => void openLink("https://www.gnu.org/licenses/gpl-3.0.html")}>
          <Icon name="external" size={14} />
          {tt("gnu.org")}
        </button>
        {REPO_URL && (
          <button className="btn btn-ghost" onClick={() => void openLink(REPO_URL)}>
            <Icon name="external" size={14} />
            {tt("Código-fonte")}
          </button>
        )}
      </div>
      {completa && <pre className="about-license">{gpl}</pre>}

      <div className="about-sec">{tt("Componentes de terceiros")}</div>
      <table className="about-table">
        <tbody>
          {TERCEIROS.map((t) => (
            <tr key={t.nome}>
              <td>{t.nome}</td>
              <td className="muted">{t.uso}</td>
              <td className="about-lic">{t.licenca}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose} title={tt("Sobre e licença")} width={560}>
      <AboutContent />
    </ModalOverlay>
  );
}
