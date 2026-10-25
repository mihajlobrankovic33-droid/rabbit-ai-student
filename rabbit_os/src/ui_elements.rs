fn draw_app_store() {
    print_string("      (\\ /)", Color::White, 5, 5);
    print_string("     ( . .) ", Color::White, 6, 5);
    print_string("    c(/ [S] \\)c", Color::LightYellow, 7, 5); // Zeka drži Store ikonu
    print_string("     \\  ^  /", Color::White, 8, 5);
    print_string("      || ||  ", Color::White, 9, 5);

    print_string("  --- Rabbit App Store ---", Color::Yellow, 3, 30);
    print_string("  [Spotify] [OBS] [Discord] [Epic]", Color::White, 5, 30);
    print_string("  [Steam] [Insta] [Bambu] [Creality]", Color::White, 6, 30);
    print_string("  [Brave] [Firefox]", Color::White, 7, 30);
    
    print_string("  Select app and press [carrot] to install", Color::LightGray, 9, 30);
}

fn draw_conversion_screen(app_name: &str, is_external: bool) {
    print_string("      (\\ /)", Color::White, 5, 5);
    print_string("     (O.O) ", Color::White, 6, 5); // Zeka sa naočarima skenira
    print_string("    c(/ [S] \\)c", Color::LightCyan, 7, 5); 
    print_string("     \\  ^  /", Color::White, 8, 5);
    print_string("      || ||  ", Color::White, 9, 5);

    if is_external {
        print_string("  Local AI is analyzing external file...", Color::Yellow, 4, 30);
        print_string("  Converting .exe to .rab format...", Color::LightCyan, 5, 30);
        print_string("  [Scanning for viruses... 0%... 50%... 100%]", Color::LightGreen, 6, 30);
    } else {
        print_string("  Installing from App Store...", Color::LightGreen, 4, 30);
        print_//- a la Rabbit OS
        print_string("  Converting to .rab... Done!", Color::White, 5, 30);
    }
}
