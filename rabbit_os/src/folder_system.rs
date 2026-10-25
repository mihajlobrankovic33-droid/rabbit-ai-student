pub enum FolderStyle {
    Orange,
    Custom(Color),
    TransparentBox,
}

pub struct File {
    pub name: &'static str,
    pub size: &'static str,
}

pub struct Folder {
    pub name: &'static str,
    pub style: FolderStyle,
    pub files: Vec<File>,
    pub subfolders: Vec<Folder>,
}

impl Folder {
    pub fn new(name: &'static str, style: FolderStyle) -> Self {
        Folder {
            name,
            style,
            files: Vec::new(),
            subfolders: Vec::new(),
        }
    }

    pub fn add_file(&mut self, name: &'static str, size: &'static str) {
        self.files.push(File { name, size });
    }

    pub fn add_folder(&mut self, folder: Folder) {
        self.subfolders.push(folder);
    }
}
