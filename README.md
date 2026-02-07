# Zotero Citation for LaTeX

A Visual Studio Code extension that brings Zotero's powerful citation management directly into your LaTeX workflow. Insert citations from your Zotero library with a simple command, and let the extension handle BibTeX file management automatically.

![Demo](images/demo.png)

## ✨ Features

### 🎯 Smart Citation Insertion
- **Code Completion**: Type `\zoteroCite` and get IntelliSense suggestions
- **Automatic Trigger**: Complete the command to instantly open Zotero's native picker
- **Multiple Citations**: Select one or multiple references at once
- **Smart Appending**: Automatically detects if you're inside an existing `\cite{}` and appends keys instead of creating nested commands


### 📚 BibTeX Management
- **Auto-Fetch**: Retrieves BibTeX entries directly from Zotero via Better BibTeX
- **Duplicate Detection**: Checks existing entries to avoid duplicates in your `.bib` file
- **Clean Entries**: Automatically removes unwanted fields (annotation, file, etc.) from BibTeX entries
- **Configurable Cleaning**: Customize which fields to remove via settings

### 🎛️ Status Bar Integration
- **Connection Monitor**: Real-time Zotero connection status indicator
  - ✓ when connected
  - ✗ when disconnected
  - Auto-checks every 10 seconds
- **Quick .bib Selection**: Click to select your target bibliography file
  - Shows current file name
  - One-click file switching
  - Option to save as default

![Status Bar](images/status-bar.png)

### 🔧 Smart Features
- **Inside `\cite{}` Detection**: Type `\zoteroCite` inside an existing `\cite{key1}` and it will append new keys: `\cite{key1,key2,key3}`
- **Workspace Integration**: Supports workspace-relative paths for `.bib` files
- **Error Handling**: Clear, user-friendly error messages in Chinese and English

## 📋 Requirements

- **[Zotero](https://www.zotero.org/)** desktop application (must be running)
- **[Better BibTeX](https://retorque.re/zotero-better-bibtex/)** plugin for Zotero
  - Provides JSON-RPC API for citation export
  - Generates clean, consistent citation keys

## 🚀 Installation

1. Install the extension from VS Code Marketplace (or install `.vsix` manually)
2. Install and start Zotero desktop application
3. Install Better BibTeX plugin in Zotero:
   - Download from [Better BibTeX releases](https://github.com/retorquere/zotero-better-bibtex/releases)
   - In Zotero: Tools → Add-ons → Install Add-on From File
4. Open your LaTeX project in VS Code

## 📖 Usage

### Basic Citation Insertion

1. Open a `.tex` file in VS Code
2. Type `\zoteroCite` where you want to insert a citation
   - Use autocomplete (Ctrl+Space) for suggestions
3. The Zotero picker opens automatically
4. Select one or more references from your library
5. Choose your `.bib` file (first time only, or click status bar to change)
6. Done! The extension:
   - Fetches BibTeX entries from Zotero
   - Appends new entries to your `.bib` file (skips duplicates)
   - Replaces `\zoteroCite` with `\cite{key1,key2,...}`

![Basic Usage](images/basic-usage.gif)



### Adding to Existing Citations

If you want to add more references to an existing `\cite{}`:

```latex
% Before
\cite{smith2020}

% Type \zoteroCite inside the braces
\cite{smith2020\zoteroCite}

% After selecting new references
\cite{smith2020,jones2021,brown2022}
```

### Status Bar Features

**Zotero Connection Status** (right side of status bar):
- Click to manually refresh connection
- Shows tooltip with connection details

**BibTeX File Selector** (right side of status bar):
- Shows current `.bib` file name
- Click to select a different file
- Option to save selection as workspace default

## ⚙️ Extension Settings

Configure the extension via VS Code settings (`Ctrl+,`):

| Setting | Description | Default |
|---------|-------------|---------|
| `zotero-cite.defaultBibFile` | Default .bib file path (absolute or workspace-relative) | `null` |
| `zotero-cite.autoAppend` | Automatically append BibTeX entries to .bib file | `true` |
| `zotero-cite.removeFields` | BibTeX fields to remove from entries | `["annotation", "file", "abstract"]` |

### Example Configuration

```json
{
  "zotero-cite.defaultBibFile": "references.bib",
  "zotero-cite.autoAppend": true,
  "zotero-cite.removeFields": [
    "annotation",
    "file",
    "abstract",
    "keywords"
  ]
}
```

## 🎯 Commands

Access via Command Palette (`Ctrl+Shift+P`):

- `Zotero Cite: Trigger Manually` - Manually trigger citation picker
- `Zotero Cite: Select BibTeX File` - Choose target .bib file
- `Zotero Cite: Check Connection` - Test Zotero connection

## 🐛 Troubleshooting

### Zotero Not Connected
- Ensure Zotero desktop application is running
- Check that Better BibTeX plugin is installed and enabled
- Try clicking the Zotero status indicator to refresh connection

### Picker Already Running Error
- Close any open Zotero picker windows in other applications
- The extension prevents concurrent picker usage to avoid conflicts

### Citations Not Inserting
- Check the Output panel (View → Output → "Zotero Cite") for detailed logs
- Verify your `.bib` file is writable
- Ensure you have selected a valid `.bib` file

## 🔄 How It Works

1. **Trigger Detection**: Monitors text changes for `\zoteroCite` command
2. **Connection Check**: Verifies Zotero is running via Better BibTeX JSON-RPC API
3. **Picker Invocation**: Opens Zotero's native CAYW (Cite As You Write) picker
4. **BibTeX Export**: Fetches entries using Better BibTeX export format
5. **Entry Cleaning**: Removes unwanted fields based on configuration
6. **Duplicate Check**: Parses existing `.bib` file to avoid duplicates
7. **File Update**: Appends new entries to `.bib` file
8. **Citation Insertion**: Replaces trigger with `\cite{keys}` or appends to existing citation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📝 Release Notes

### 0.1.0 (Initial Release)

- ✅ Basic citation insertion with `\zoteroCite` trigger
- ✅ Zotero picker integration via Better BibTeX
- ✅ Automatic BibTeX file management
- ✅ Duplicate detection
- ✅ Status bar indicators for connection and .bib file
- ✅ Smart citation appending (detects existing `\cite{}`)
- ✅ Configurable BibTeX field cleaning
- ✅ Code completion for `\zoteroCite` command

## 📄 License

MIT License - see LICENSE file for details

---

**Enjoy seamless Zotero integration in VS Code!** 🎉

If you find this extension helpful, please consider leaving a review on the marketplace.
