//! Config Driver for Rabbit OS
//! Upravljanje izgledom sistema preko terminala i config menija.

pub struct DesktopConfig {
    pub wallpaper: &'static str,
    pub theme_color: Color,
}

impl DesktopConfig {
    pub fn new() -> Self {
        DesktopConfig {
            wallpaper: "Default_Rabbit_Green",
            theme_color: Color::LightGreen,
        }
    }

    // Logika za menjanje pozadine preko terminala
    pub fn change_wallpaper(&mut self, new_wallpaper: &str) -> &'static str {
        self.wallpaper = new_wallpaper;
        "Zeka is changing the wallpaper... Done! Your desktop now looks amazing!"
    }

    pub fn change_theme(&mut self, new_color: Color) -> &'static str {
        self.theme_color = new_color;
        "Theme updated! Rabbit OS is now feeling a bit different."
    }
}
