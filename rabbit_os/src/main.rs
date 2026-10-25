#![no_std]
#![no_main]

use core::panic::PanicInfo;
use rabbit_os::drivers::vga::{print_string, Color};

#[no_mangle] 
pub extern "C" fn _start() -> ! {
    // 1. Welcome Screen
    draw_welcome_screen();
    
    // 2. Installation Screen
    draw_installation_screen();
    
    // 3. WiFi Setup
    draw_wifi_setup();
    
    // 4. Local AI Setup
    draw_ai_setup();

    // 5. Update Check Screen (Zeka pokazuje update-ove)
    draw_update_screen();

    // 6. Final Farewell Transition
    run_farewell_transition();

    // 7. Main Desktop with "Liquid" Dock
    draw_main_desktop();

    loop {}
}

fn draw_welcome_screen() {
    print_string("      (\\ /)", Color::White, 5, 5);
    print_string("     ( . .) ", Color::White, 6, 5);
    print_string("    c(/   \\)c", Color::White, 7, 5);
    print_string("     \\  ^  /", Color::White, 8, 5);
    print_string("      || ||  ", Color::White, 9, 5);

    print_string("   ________________________", Color::LightGray, 4, 30);
    print_string("  /                        \\", Color::LightGray, 5, 30);
    print_string(" |  Hello! / Zdravo!       |", Color::LightCyan, 6, 30);
    print_string(" |  Hola! / Bonjour!       |", Color::LightCyan, 7, 30);
    print_string(" |  Konnichiwa! / Ciao!    |", Color::LightCyan, 8, 30);
    print_string("  \\________________________/", Color::LightGray, 9, 30);

    print_string("          [carrot] <3", Color::Red, 13, 32); 
    print_string("Welcome to Rabbit OS!", Color::LightGreen, 18, 20);
}

fn draw_installation_screen() {
    print_string("      (\\ /)", Color::White, 3, 5);
    print_string("     ( . .) ", Color::White, 4, 5);
    print_string("    c(/ [CD] \\)c", Color::LightGray, 5, 5);
    print_string("     \\  ^  /", Color::White, 6, 5);
    print_string("      || ||  ", Color::White, 7, 5);

    print_string("  --- Rabbit OS Installation ---", Color::Yellow, 3, 30);
    print_string("  [1] Install Rabbit OS (Full Disk)", Color::White, 5, 30);
    print_string("  [2] Delete Everything (Format)", Color::Red, 6, 30);
    print_string("  [3] Boot as Dual OS (Parallel)", Color::LightCyan, 7, 30);
    print_string("  [4] Boot from USB (Live)", Color::LightGreen, 8, 30);
}

fn draw_wifi_setup() {
    print_string("      (\\ /)", Color::White, 5, 5);
    print_string("     ( . .) ", Color::White, 6, 5);
    print_string("    c(/ [((( )] \\)c", Color::LightCyan, 7, 5);
    print_string("     \\  ^  /", Color::White, 8, 5);
    print_string("      || ||  ", Color::White, 9, 5);

    print_string("  --- WiFi Connection ---", Color::Yellow, 3, 30);
    print_string("  Password: ********", Color::White, 9, 30);
    print_string("  [carrot] Connect", Color::Red, 11, 32);
}

fn draw_ai_setup() {
    print_string("      (\\ /)", Color::White, 5, 5);
    print_string("     ( . .) ", Color::White, 6, 5);
    print_string("    c(/ [AI] \\)c", Color::LightMagenta, 7, 5);
    print_string("     \\  ^  /", Color::White, 8, 5);
    print_string("      || ||  ", Color::White, 9, 5);

    print_string("  --- Local AI Setup (Ollama) ---", Color::Yellow, 3, 30);
    print_string("  [1] 2GB | [2] 8GB | [3] 16GB", Color::LightGray, 7, 32);
    print_string("  [carrot_red] YES | [carrot_green] NO", Color::Red, 10, 32);
}

fn draw_update_screen() {
    // Zeka pokazuje na listu sa update-ovima
    print_string("      (\\ /)", Color::White, 5, 5);
    print_string("     ( . .)  --> [ UPDATES ]", Color::White, 6, 5);
    print_string("    c(/   \\)c  - Kernel v1.0.1", Color::LightCyan, 7, 5);
    print_string("     \\  ^  /   - Rabbit UI v0.2", Color::LightCyan, 8, 5);
    print_string("      || ||    - AI Model Fix", Color::LightCyan, 9, 5);

    print_string("  Everything is up to date!", Color::LightGreen, 12, 30);
    print_string("  [carrot] Next", Color::Red, 14, 32);
}

fn run_farewell_transition() {
    // Zeka maše rukom
    print_string("      (\\ /)", Color::White, 10, 35);
    print_string("     ( . .) /", Color::White, 11, 35);
    print_string("    c(/   \\)c", Color::White, 12, 35);
    print_string("     \\  ^  /", Color::White, 13, 35);
    print_string("      || ||  ", Color::White, 14, 35);

    print_string("    See you on the Desktop!", Color::Yellow, 16, 30);
}

fn draw_main_desktop() {
    // Pozadina (Čista, bez donje linije)
    print_string("________________________________________________________________________________", Color::LightGray, 0, 0);
    
    // Gornji levi ugao: Notifikacije
    print_string("[ Notification: Rabbit OS is updated! ]", Color::White, 1, 2);
    
    // Gornji desni ugao: Oblak bar
    // START dugme je sakriveno ovde i vidi se tek kad se raširi
    print_string("[ Cloud Bar: WiFi BT Vol ]", Color::LightGray, 0, 60);

    // --- GLAVNE APLIKACIJE (Lebde na desktopu) ---
    print_string("      [ Rabbit Files ]", Color::White, 5, 20);
    print_string("      [ App Store ]", Color::White, 6, 20);
    print_string("      [ Rabbit Config ]", Color::White, 7, 20);

    // Primer providne kutije ispod aplikacija
    print_string("   _______  ", Color::LightGray, 10, 25);
    print_string("  | . . . | ", Color::White, 11, 25);
    print_string("  |_______| ", Color::LightGray, 12, 25);
    print_string("    My Docs  ", Color::White, 13, 25);

    // --- LIQUID DOCK (Jedini element na dnu) ---
    print_string("                ( (  [FC]  [AS]  ) [CA] )", Color::LightBlue, 22, 30);
}

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}
