//! Terminal Driver for Rabbit OS
//! Terminal ne koristi sudo, već 'install' ili jeziku prilagođene komande.

pub struct Terminal {
    pub current_language: &'static str,
}

impl Terminal {
    pub fn new(lang: &'static str) -> Self {
        Terminal { current_language: lang }
    }

    // Glavna funkcija za obradu komandi
    pub fn process_command(&self, command: &str) -> &'static str {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() { return ""; }

        let cmd = parts[0];
        
        // Logika za instalaciju: 'install', 'rab', ili 'instaliraj' (za srpski)
        if (cmd == "install" || cmd == "rab" || (self.current_//_language == "sr" && cmd == "instaliraj")) && parts.len() > 1 {
            let app_name = parts[1];
            return "Local AI is searching App Store... Found! Converting to .rab... Installed successfully!";
        }

        // Logika za menjanje pozadine i izgleda (rab change wallpaper / rab promeni izgled)
        if (cmd == "rab" || (self.current_language == "sr" && cmd == "promeni")) && parts.len() > 2 {
            if parts[1] == "change" || parts[1] == "promeni" {
                if parts[2] == "wallpaper" || parts[2] == "pozadina" {
                    return "Zeka is updating the wallpaper... Hop! Your desktop is now refreshed!";
                }
                if parts[2] == "izgled" || parts[2] == "theme" {
                    return "Applying new theme... Your Rabbit OS now looks stylish!";
                }
            }
        }

        if cmd == "help" || (self.current_language == "sr" && cmd == "pomoc") {
            return "Rabbit Terminal: Use 'install [app]' or 'rab change wallpaper'.";
        }

        "Unknown command. Try 'install [app]' or 'help'.";
    }
}
