import MyPlugin from "main";
import { Setting, DropdownComponent } from "obsidian";

interface ColorPalette {
  name: string;
  startColor: string;
  endColor: string;
}

const colorPalettes: ColorPalette[] = [
  { name: "By Design", startColor: "#009FFF", endColor: "#ec2F4B" },
  { name: "Wiretap", startColor: "#8A2387", endColor: "#F27121" },
  { name: "Summer Dog", startColor: "#a8ff78", endColor: "#78ffd6" },
];

export class ColorPaletteSelection extends Setting {
  private plugin: MyPlugin;
  private selectedPaletteText: HTMLElement;

  constructor(containerEl: HTMLElement, plugin: MyPlugin) {
    super(containerEl);
    this.plugin = plugin;

    this.setName("Similarity Score Color Palette")
      .setDesc("Choose a color palette for the similarity score squares");

    // Add a text element to display the selected palette
    this.selectedPaletteText = this.controlEl.createEl("div", {
      cls: "color-palette-selected",
    });
    this.selectedPaletteText.style.marginBottom = "10px";
    this.selectedPaletteText.style.fontWeight = "bold";

    const gridContainer = this.controlEl.createEl("div", {
      cls: "color-palette-grid",
    });

    gridContainer.style.display = "grid";
    gridContainer.style.gridTemplateColumns = "repeat(3, 1fr)";
    gridContainer.style.gap = "10px";

    colorPalettes.forEach((palette) => {
      const card = gridContainer.createEl("div", { cls: "color-palette-card" });
      card.style.border = "1px solid var(--background-modifier-border)";
      card.style.borderRadius = "4px";
      card.style.padding = "10px";
      card.style.cursor = "pointer";

      const gradient = card.createEl("div", { cls: "color-palette-gradient" });
      gradient.style.height = "30px";
      gradient.style.background = `linear-gradient(to right, ${palette.startColor}, ${palette.endColor})`;
      gradient.style.borderRadius = "2px";

      const title = card.createEl("div", { cls: "color-palette-title" });
      title.textContent = palette.name;
      title.style.marginTop = "5px";
      title.style.textAlign = "center";

      card.addEventListener("click", async () => {
        // Update the plugin settings
        this.plugin.settings.similarityGradient.startColor = palette.startColor;
        this.plugin.settings.similarityGradient.endColor = palette.endColor;
        this.plugin.settings.similarityGradient.name = palette.name;
        
        // Save the updated settings
        await this.plugin.saveSettings();
        
        // Update the UI to reflect the new selection
        this.updateSelection(palette.name);
      });
    });

    // Initialize the selection
    this.updateSelection(this.getSelectedPaletteName());
  }

  private getSelectedPaletteName(): string {
    const selectedPalette = colorPalettes.find(
      (p) =>
        p.startColor === this.plugin.settings.similarityGradient.startColor &&
        p.endColor === this.plugin.settings.similarityGradient.endColor
    );
    return selectedPalette ? selectedPalette.name : "Custom";
  }

  private updateSelection(selectedName: string) {
    // Update the selected palette text
    this.selectedPaletteText.textContent = `Selected: ${selectedName}`;

    const cards = this.controlEl.querySelectorAll(".color-palette-card");
    cards.forEach((card) => {
      const title = card.querySelector(".color-palette-title");
      if (title && title.textContent === selectedName) {
        (card as HTMLElement).style.boxShadow = "0 0 0 2px var(--interactive-accent)";
      } else {
        (card as HTMLElement).style.boxShadow = "none";
      }
    });
  }
}
