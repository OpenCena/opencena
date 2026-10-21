// Evita abrir uma janela de terminal junto no Windows (versão final).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    opencena_lib::run();
}
