/**
 * AddImageDialog Component
 *
 * Dialog for adding an image to Prezi canvas
 */

"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image, Loader2 } from "lucide-react";

interface AddImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string) => void;
}

/**
 * AddImageDialog component
 */
export function AddImageDialog({
  open,
  onOpenChange,
  onConfirm,
}: AddImageDialogProps) {
  const [imageUrl, setImageUrl] = useState("https://images.unsplash.com/photo-1557683316-973673baf926?w=800");

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageUrl.trim()) {
      return;
    }

    onConfirm(imageUrl.trim());
    onOpenChange(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setImageUrl("https://images.unsplash.com/photo-1557683316-973673baf926?w=800");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Add Image
          </DialogTitle>
          <DialogDescription>
            Enter the URL of the image you want to add to your Prezi
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image-url">
                Image URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="image-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Preview */}
            {imageUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="rounded-lg border overflow-hidden bg-muted">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3EInvalid URL%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
              </div>
            )}

            {/* Suggested URLs */}
            <div className="space-y-2">
              <Label className="text-xs">Suggested Images</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  "https://images.unsplash.com/photo-1557683316-973673baf926?w=800",
                  "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=800",
                  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
                ].map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setImageUrl(url)}
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted-foreground/10 transition-colors"
                  >
                    Sample {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!imageUrl.trim()}>
              <Image className="mr-2 h-4 w-4" />
              Add Image
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
