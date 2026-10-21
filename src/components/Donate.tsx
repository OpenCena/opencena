import { Icon } from "@/components/Icon";
import { ModalOverlay } from "@/components/ModalOverlay";
import { DONATION_URL } from "@/config/donation";
import { openLink } from "@/storage/dir";
import { tt } from "@/i18n";

// Caixa discreta e tracejada na sidebar, que abre o modal de doação.
export function DonateBox({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
        border: "1px dashed var(--border-strong)",
        background: "transparent",
        color: "var(--text-muted)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 10px",
        fontSize: 12.5,
        cursor: "pointer",
      }}
      title={tt("Apoie a plataforma")}
    >
      <Icon name="heart" size={14} />
      {tt("Apoie a plataforma")}
    </button>
  );
}

export function DonateModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose} title={tt("Apoie a plataforma")} width={420}>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 0 }}>
        {tt("O OpenCena é gratuito e de código aberto. Se ele ajuda no seu trabalho, uma doação de qualquer valor ajuda a manter o projeto: tempo de desenvolvimento, certificados para os instaladores e o site.")}
      </p>
      {DONATION_URL ? (
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => void openLink(DONATION_URL)}>
          <Icon name="heart" size={15} />
          {tt("Fazer uma doação")}
        </button>
      ) : (
        <p className="faint" style={{ fontSize: 12.5 }}>
          {tt("As doações ainda não estão abertas.")}
        </p>
      )}
      <p className="faint" style={{ fontSize: 11.5, margin: "12px 0 0", textAlign: "center" }}>
        {tt("Pagamento seguro pelo Stripe, com Pix ou cartão.")}
      </p>
    </ModalOverlay>
  );
}
