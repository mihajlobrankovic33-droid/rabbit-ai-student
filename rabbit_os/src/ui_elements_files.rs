fn draw_file_explorer(current_path: &str) {
    // Zaglavlje prozora
    print_string("   ________________________________________", Color::LightGray, 5, 20);
    print_string("  | Rabbit Files > {}          [X] |", Color::White, 6, 20, current_path);
    print_string("  |----------------------------------|", Color::LightGray, 7, 20);

    if current_path == "/" {
        // PRVI NIVO: Drajvovi
        print_string("  [ SSD (Carrot C) ]  <-- Click", Color::LightCyan, 8, 25);
        print_string("  [ HDD (Carrot D) ]", Color::LightCyan, 9, 25);
    } else if current_path == "Carrot C" {
        // DRUGI NIVO: Standardni folderi
        print_string("  [ Downloads ]", Color::Brown, 8, 25);
        print_//- u l_os
        print_string("  [ Documents ]", Color::Brown, 9, 25);
        print_string("  [ Pictures ]", Color::Brown, 10, 25);
        print_string("  [ Games ]", Color::Brown, 11, 25);
        
        // Opcija za pravljenje novog
        print_string("  (+) Create New Folder/Box", Color::LightGreen, 13, 25);
    } else {
        // TREĆI NIVO: Fajlovi unutar foldera
        print_string("  - file1.rab", Color::White, 8, 25);
        print_string("  - image.jpg", Color::White, 9, 25);
        print_string("  [ < BACK ]", Color::Yellow, 11, 25);
    }

    print_string("  |__________________________________|", Color::LightGray, 15, 20);
}
