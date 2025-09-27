import { Notice, Plugin, Platform, Editor, MarkdownView,  } from "obsidian";
import { Jimp } from 'jimp'

export default class CopyImagePlugin extends Plugin {
	touchTime = 0;
  targetImage: HTMLImageElement | null = null;

	async onload() {

    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor, info)=>{
      if(!this.targetImage) return;
			menu.addItem((item) =>
				item
          .setTitle('Copy image to clipboard')
          .setIcon('image')
          .onClick(()=>this.handleMenuOption())
          .setDisabled(!this.targetImage)
			);
		}))

		if (Platform.isMobile) {
			this.registerDomEvent(
				document,
				"touchstart",
				this.handleTouchStart.bind(this)
			);

			this.registerDomEvent(
				document,
				"touchmove",
				this.handleTouchMove.bind(this)
			);
		} else {
			this.registerDomEvent(
				document,
				"contextmenu",
				this.handleContextMenu.bind(this),
        {capture: true}
			);
		}

		this.addCommand({
			id: 'copy-image',
			name: 'Copy image to clipboard',
			editorCallback: this.handleCommand.bind(this),
		});
	}

	onunload() {
	}

	private async handleCommand(editor: Editor, view: MarkdownView) {
		const line = editor.getLine(editor.getCursor().line)
		if (!line.includes('![[')) {
			new Notice("Not an image file or not supported...");
			return
		}
		let fileNane = line.replace(/.*!\[\[(.*?)\]\].*/, '$1');
		if (fileNane === '') {
			new Notice("Not an image file or not supported...");
			return
		}
		if (fileNane.includes('|')) {
			fileNane = fileNane.split('|')[0]
		}
		const ext = fileNane.split('.').pop()
		if (!ext) {
			new Notice("Not an image file or not supported...");
			return
		}
		if (!['bmp', 'gif', 'jpeg', 'jpg', 'png', 'tiff'].includes(ext)) {
			new Notice("Not an image file or not supported...");
			return
		}

		this.app.vault.getFiles().forEach(async file => {
			if (file.name === fileNane) {
				new Notice("Copying the image...");
				const url = this.app.vault.adapter.getResourcePath(file.path)
				const response = await fetch(url);
				const imageBlob = await response.blob();

				if (imageBlob.type === "image/png") {
					await this.copyPngToClipboard(imageBlob)
				} else {
					await this.copyNonPngToClipboard(imageBlob);
				}
			}
		})
	}

  
	private async handleMenuOption() {
    try {
      new Notice("Copying the image...");
      await this.trySetFocus();
      await this.waitForFocus();
      await this.copyImageToClipboard(undefined, this.targetImage || undefined);
    } catch (e) {
      new Notice(e.message);
    }
	}

	private async handleTouchStart(evt: TouchEvent) {
		if (this.isImage(evt)) {
			this.touchTime = new Date().getTime();

			setTimeout(async () => {
				if (this.touchTime !== 0) {
					new Notice("Copying the image...");
					await this.copyImageToClipboard(evt);
				}
			}, 1000);
		}
	}
	private async handleTouchMove(evt: TouchEvent) {
		if (this.isImage(evt)) {
			this.touchTime = 0;
		}
	}

	private async handleContextMenu(evt: MouseEvent) {
		if (this.isImage(evt)) {
			this.targetImage = evt.target as HTMLImageElement;
		} else if (this.targetImage) {
			this.targetImage = null;
		}
	}

	private async wait(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private isImage(evt: MouseEvent | TouchEvent) {
		return (
			evt.target instanceof HTMLImageElement &&
			evt.target.tagName === "IMG"
		);
	}

	private async trySetFocus() {
		if (!document.hasFocus()) {
			const obsidianWindow = window.open("obsidian://open", "_self");
			if (obsidianWindow) {
				obsidianWindow.focus();
			} else {
				throw new Error("Failed to focus Obsidian app.");
			}
		}
	}

	private async waitForFocus() {
		let timeElapsed = 0;

		while (!document.hasFocus() && timeElapsed < 2000) {
			await this.wait(50);
			timeElapsed += 50;
		}

		if (!document.hasFocus()) {
			throw new Error(
				"Cannot copy image to clipboard without Obsidian app focused."
			);
		}
	}

	private async copyImageToClipboard(evt?: MouseEvent | TouchEvent, targetImage?: HTMLImageElement) {
		const target = evt?.target as HTMLImageElement || targetImage;
    if(!target) return;
		const response = await fetch(target.src);
		const imageBlob = await response.blob();
		if (imageBlob.type === "image/png") {
			await this.copyPngToClipboard(imageBlob)
		} else {
			await this.copyNonPngToClipboard(imageBlob);
		}
	}

	private async copyPngToClipboard(imageBlob: Blob) {
		try {
			await navigator.clipboard
				.write([
					new ClipboardItem({
						[imageBlob.type]: imageBlob,
					}),
				])
			new Notice("Image copied to clipboard!");
		} catch (error) {
			new Notice("Failed to copy...");
		}
	}

	private async copyNonPngToClipboard(imageBlob: Blob) {
		const image = await Jimp.read(URL.createObjectURL(imageBlob))
		const buffer = await image.getBuffer("image/png")
		const blob = new Blob([buffer], { type: "image/png" })
		this.copyPngToClipboard(blob)
	}
}
