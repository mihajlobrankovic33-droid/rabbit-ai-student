//! VGA Tekstualni Drajver za Rabbit OS
//! Ovaj modul omogućava pisanje teksta direktno u VGA memoriju.

use core::ops::IndexMut;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Color {
    Black = 0,
    Blue = 1,
    Green = 2,
    Cyan = 3,
    Red = 4,
    Magenta = 5,
    Brown = 6,
    LightGray = 7,
    DarkGray = 8,
    LightBlue = 9,
    LightGreen = 10,
    LightCyan = 11,
    LightRed = 12,
    LightMagenta = 13,
    LightBrown = 14,
    White = 15,
}

#[repr(C)]
pub struct ScreenChar {
    pub character: u8,
    pub color: Color,
}

pub struct VGAWriter {
    buffer: &'static mut [ScreenChar],
}

impl VGAWriter {
    pub fn new() -> Self {
        let address = 0xb8000 as *mut ScreenChar;
        // VGA ekran je obično 80x25 karaktera
        let buffer = unsafe { core::slice::from_raw_parts_mut(address, 80 * 25) };
        VGAWriter { buffer }
    }

    pub fn clear_screen(&mut self) {
        for char in self.buffer.iter_mut() {
            char.character = b' ';
            char.color = Color::Black;
        }
    }

    pub fn print_string(&mut self, s: &str, color: Color, row: usize, col: usize) {
        let mut current_col = col;
        let mut current_row = row;

        for byte in s.bytes() {
            if current_col >= 80 {
                current_col = 0;
                current_row += 1;
            }
            if current_row >= 25 { break; }

            let index = current_row * 80 + current_col;
            self.buffer[index].character = byte;
            self.buffer[index].color = color;
            current_col += 1;
        }
    }

    pub fn print_hello(&mut self) {
        self.clear_screen();
        self.print_string("Rabbit OS Kernel is now running!", Color::LightCyan, 0, 0);
    }
}

// Globalna funkcija za lakši pristup iz kernela
pub fn print_string(s: &str, color: Color, row: usize, col: usize) {
    let mut writer = VGAWriter::new();
    writer.print_string(s, color, row, col);
}
