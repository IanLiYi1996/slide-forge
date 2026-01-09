/**
 * KeyboardShortcuts Component
 *
 * Displays keyboard shortcuts and usage guide for Prezi editor.
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  heading: string;
  muted: string;
}

interface KeyboardShortcutsProps {
  themeColors?: ThemeColors;
}

/**
 * KeyboardShortcuts component
 */
const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ themeColors }) => {
  const [open, setOpen] = useState(false);

  const shortcuts = [
    {
      category: "Tools",
      items: [
        { keys: ["V"], description: "Select tool" },
        { keys: ["H"], description: "Pan tool" },
        { keys: ["T"], description: "Text tool" },
        { keys: ["I"], description: "Image tool" },
        { keys: ["C"], description: "HTML tool" },
      ],
    },
    {
      category: "Editing",
      items: [
        { keys: ["Ctrl", "S"], description: "Save presentation" },
        { keys: ["Ctrl", "Z"], description: "Undo" },
        { keys: ["Ctrl", "Y"], description: "Redo" },
        { keys: ["Delete"], description: "Delete selected elements" },
        { keys: ["Backspace"], description: "Delete selected elements" },
        { keys: ["Ctrl", "Click"], description: "Multi-select elements" },
      ],
    },
    {
      category: "Camera",
      items: [
        { keys: ["Scroll"], description: "Zoom in/out" },
        { keys: ["Right Click", "Drag"], description: "Pan canvas" },
        { keys: ["0"], description: "Reset view" },
        { keys: ["+"], description: "Zoom in" },
        { keys: ["-"], description: "Zoom out" },
      ],
    },
    {
      category: "Presentation",
      items: [
        { keys: ["F5"], description: "Enter present mode" },
        { keys: ["P"], description: "Toggle present mode" },
        { keys: ["ESC"], description: "Exit present mode" },
        { keys: ["Space"], description: "Play/Pause path" },
        { keys: ["←"], description: "Previous keyframe" },
        { keys: ["→"], description: "Next keyframe" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          title="Keyboard shortcuts"
          className="h-9 w-9 p-0 hover:opacity-80"
          style={{
            backgroundColor: "transparent",
            color: themeColors?.text || "#1f2937",
            border: `1px solid ${adjustColorOpacity(themeColors?.muted || "#6b7280", 0.3)}`,
          }}
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick reference for Prezi editor shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 md:grid-cols-2">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="mb-3 text-sm font-semibold">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-prezi-ui-fg">{item.description}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="rounded border border-prezi-ui-muted/30 bg-prezi-ui-muted/10 px-2 py-1 text-xs font-mono text-prezi-ui-fg">
                            {key}
                          </kbd>
                          {keyIndex < item.keys.length - 1 && (
                            <span className="text-prezi-ui-muted">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-prezi-ui-primary/10 p-4">
          <h4 className="mb-2 text-sm font-semibold text-prezi-ui-primary">
            Quick Start Guide
          </h4>
          <ol className="space-y-1 text-xs text-prezi-ui-fg">
            <li>1. Add elements in Edit mode (text, images)</li>
            <li>2. Switch to Path mode and capture camera views as keyframes</li>
            <li>3. Click "Present (F5)" button or press F5 for full-screen presentation</li>
            <li>4. Press ESC to exit present mode</li>
            <li>5. Export as PDF, HTML, or Video in Export mode</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Helper function to adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
  let r = 0, g = 0, b = 0;

  if (color.startsWith("#")) {
    const hex = color.substring(1);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0], 16);
      g = parseInt(hex[1]! + hex[1], 16);
      b = parseInt(hex[2]! + hex[2], 16);
    }
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default KeyboardShortcuts;
