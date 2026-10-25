//! Keyboard Driver for Rabbit OS
//! Ovaj drajver omogućava komunikaciju sa tastaturom preko I/O portova.

pub struct Keyboard {
    // Ovde bi išao buffer za tastere
}

impl Keyboard {
    pub fn new() -> Self {
        Keyboard {}
    }

    // Funkcija koja čita jedan skancode sa porta 0x60
    pub fn read_scancode(&self) -> u8 {
        unsafe {
            // x86 I/O port za tastaturu je 0x60
            // Koristimo inline assembly za inb instrukciju
            core::arch::asm!("in al, 0x60", out("al") _);
            // U pravom sistemu ovde bi vratili vrednost iz AL registra
            0 // Placeholder za sada
        }
    }

    // Proverava da li je pritisnut Enter taster
    pub fn is_enter_pressed(&self) -> bool {
        // Scancode za Enter je obično 0x1C
        self.read_scancode() == 0x1C
    }
}
