//! App Store Driver for Rabbit OS
//! Ovaj modul upravlja instalacijom i konverzijom aplikacija u .rab format.

pub enum AppSource {
    AppStore,
    ExternalBrowser,
}

pub struct App {
    pub name: &'static str,
    pub original_format: &'static str,
}

pub struct AppStore {
    pub available_apps: Vec<App>,
}

impl AppStore {
    pub fn new() -> Self {
        AppStore {
            available_apps: vec![
                App { name: "Spotify", original_format: ".exe" },
                App { name: "OBS", original_//_format: ".appimage" },
                App { name: "Discord", original_format: ".exe" },
                App { name: "Epic Games", original_format: ".exe" },
                App { name: "Steam", original_format: ".exe" },
                App { name: "Instagram", original_format: ".appimage" },
                App { name: "Bambu Lab", original_format: ".exe" },
                App { name: "Creality Slicer", original_format: ".exe" },
                App { name: "Brave Browser", original_format: ".exe" },
                App { name: "Firefox", original_format: ".appimage" },
                // Art Craft Suite
                App { name: "PhotoCraft", original_format: ".appimage" },
                App { name: "FilmCraft", original_format: ".appimage" },
                App { name: "EffectCraft", original_format: ".appimage" },
                // Pro Tools
                App { name: "Blender", original_format: ".exe" },
                App { name: "VS Code", original_format: ".exe" },
                // Office Hub
                App { name: "Carrot Maker Home", original_format: ".rab" },
            ],
        }
    }

    // Glavna logika za instalaciju koju si opisao
    pub fn install_app(&self, app_name: &str, source: AppSource, has_local_ai: bool) -> &'static str {
        match source {
            AppSource::AppStore => {
                "Installing from App Store... Success! (.rab format applied)"
            },
            AppSource::ExternalBrowser => {
                if !has_local_ai {
                    return "Error: Local AI required to scan and convert external files!";
                }

                // Provera da li aplikacija već postoji u App Store-u
                if self.available_apps.iter().any(|a| a.name == app_name) {
                    "Aha! This app is in the App Store. Please enter password to install... Success!"
                } else {
                    "Local AI is scanning file... Converting .exe/.appimage to .rab... Success! No viruses found."
                }
            }
        }
    }
}
