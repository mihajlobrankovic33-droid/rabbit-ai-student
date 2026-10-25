//! Right-Click Menu for Rabbit OS
//! Ovaj modul upravlja kontekstnim menijem za foldere i kutije.

use rabbit_os::drivers::vga::Color;

pub struct ContextMenu {
    pub x: usize,
    pub y: usize,
    pub target_name: &'static str,
}

impl ContextMenu {
    pub fn draw(&self, vga: &mut dyn VgaInterface) {
        // Crtanje malog oblaka/menija na poziciji gde je korisnik kliknuo
        vga.print_string("  __________  ", Color::LightGray, self.y, self.x);
        vga.print_string(" | Delete    | ", Color::Red, self.y + 1, self.x);
        vga.print_string(" | Move to   | ", Color::White, self.y + 2, self.x);
        vga.print_string(" | Copy      | ", Color::White, self.y + 3, self.x);
        vga.print_string(" | Paste     | ", Color::White, self.y + 4, self.x);
        vga.print_string(" | Add to Desktop | ", Color::LightCyan, self.y + 5, self.x);
        vga.print_string(" | Add to Zeka    | ", Color::LightMagenta, self.y + 6, self.x);
        vga.print_string(" | Zeka Scan      | ", Color::Yellow, self.y + 7, self.x);
        vga.print_string(" |____________| ", Color::LightGray, self.y + 8, self.x);
    }
}
