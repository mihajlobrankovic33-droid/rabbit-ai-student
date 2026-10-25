//! Rabbit OS Core Library
//! Ovde definišemo module za drajvere i memoriju

pub mod drivers {
    pub mod vga;
    pub mod keyboard;
    pub mod app_store;
    pub mod terminal;
    pub mod config;
    pub mod context_menu;
}

pub mod memory {
    // Ovde će kasnije ići paging i heap
}

pub mod arch {
    // Ovde će ići specifičnosti za x86_64
}
