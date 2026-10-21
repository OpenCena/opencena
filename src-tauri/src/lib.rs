// OpenCena (app instalado). A interface é o mesmo app web (pasta dist/);
// aqui só ligamos os plugins que ela usa:
//   fs      ler e gravar os arquivos do projeto
//   dialog  escolher a pasta dos projetos
//   opener  abrir o PDF no leitor do sistema (para imprimir)
//   updater atualização automática (baixa a versão nova do GitHub, assinada)
//   process reiniciar o app depois de atualizar
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o OpenCena");
}
