import { useApp } from "@/store/appStore";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { LangPicker } from "@/components/LangPicker";
import { VersionTag } from "@/components/About";
import { tt } from "@/i18n";
import "@/styles/onboarding.css";

// Primeira execução: só pede a pasta onde os projetos ficam.
export function Onboarding() {
  const chooseProjectsFolder = useApp((s) => s.chooseProjectsFolder);

  return (
    <div className="onb">
      <div className="onb-theme">
        <LangPicker />
        <ThemeToggle />
      </div>

      <div className="onb-card">
        <div className="onb-logo">
          <Logo size={30} />
        </div>
        {/* três folhas: roteiro, quadrinhos e livro */}
        <div className="onb-sheets" aria-hidden="true">
          <span className="onb-sheet s1">
            <i style={{ width: "70%" }} />
            <i style={{ width: "40%", marginLeft: "35%" }} />
            <i style={{ width: "50%", marginLeft: "22%" }} />
            <i style={{ width: "80%" }} />
          </span>
          <span className="onb-sheet s2">
            <b />
            <b />
            <b className="wide" />
          </span>
          <span className="onb-sheet s3">
            <i style={{ width: "40%", margin: "4px auto 8px" }} />
            <i />
            <i />
            <i />
            <i style={{ width: "60%" }} />
          </span>
        </div>

        <h1>{tt("Comece a criar")}</h1>
        <p className="onb-sub">{tt("Escolha uma pasta para guardar seus projetos. Cada projeto vira uma pasta com arquivos que são seus.")}</p>

        <button className="btn btn-primary onb-cta" onClick={() => void chooseProjectsFolder()}>
          <Icon name="folderOpen" size={17} />
          {tt("Escolher pasta dos projetos")}
        </button>

        <div className="onb-tip">
          <Icon name="cloud" size={16} />
          <span>
            {tt("Para abrir em outro computador, escolha uma pasta sincronizada pelo Google Drive, OneDrive, iCloud ou Dropbox.")}
          </span>
        </div>
      </div>
      <div className="onb-ver">
        <VersionTag />
      </div>
    </div>
  );
}
