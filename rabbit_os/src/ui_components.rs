//! UI Components for Rabbit OS Desktop
//! Definiše elemente kao što su Liquid Dock, Notification Area i Control Center.

use rabbit_os::drivers::vga::Color;

pub struct DesktopSettings {
    pub dock_circle_color: Color,
    pub notifications_enabled: bool,
    pub brightness: u8,
    pub volume: u8,
}

pub struct ControlCenter {
    pub is_expanded: bool,
    pub wifi_enabled: bool,
    pub bluetooth_enabled: bool,
}

impl ControlCenter {
    pub fn draw_cloud_bar(&self, vga: &mut dyn VgaInterface) {
        // Gornji desni ugao - Oblak bar
        vga.print_string("[ Cloud Bar: WiFi BT Vol ]", Color::LightGray, 0, 60);
    }

    pub fn draw_expanded_panel(&self, vga: &mut dyn VgaInterface) {
        // Kada povučeš bar, on se razvuče ulevo
        vga.print_string(" < Brightness: ||||--- > [ WiFi ] [ BT ] [ Sound ]", Color::LightCyan, 1, 20);
        
        // Zeka Chat boks koji se produži nadole
        vga.print_string(" ________________________", Color::LightGray, 3, 20);
        vga.print_string("| Rabbit AI:- Hello!     |", Color::White, 4, 20);
        vga.print_string("| 'Play Spotify'...     |", Color::LightGreen, 5, 20);
        vga.print_string("|________________________|", Color::LightGray, 6, 20);
    }
}

pub trait VgaInterface {
    fn print_string(&mut self, s: &str, color: Color, row: usize, col: usize);
}
