[BITS 16]
; Rabbit OS Bootloader
; Ovaj kod se učitava u sektor 0 diska

section .boot
global _start

_start:
    mov ax, 0
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00

    ; Ovde bi išao kod za prebacivanje u Protected Mode (32-bit) 
    ; i Long Mode (64-bit) kako bismo mogli da pokrenemo Rust kernel.
    
    ; Za potrebe početka, ispisujemo "Loading Rabbit OS..." direktno preko BIOS-a
    mov si, msg_loading
    call print_string

    ; Skok na Rust kernel (u realnom scenariju ovde učitavamo kernel sa diska u memoriju)
    jmp 0x1000:0000 

print_string:
    lodsb
    or al, al
    jz .done
    mov ah, 0x0E
    int 0x10
    jmp print_string
.done:
    ret

msg_loading db 'Loading Rabbit OS...', 0

times 510-($-$$) db 0
dw 0xAA55 ; Boot signature
