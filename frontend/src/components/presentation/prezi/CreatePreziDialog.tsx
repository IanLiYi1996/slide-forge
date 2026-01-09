/**
 * CreatePreziDialog Component
 *
 * Dialog for creating a new Prezi presentation with:
 * - Title input
 * - Theme selector
 * - Description (optional)
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Presentation } from "lucide-react";

interface CreatePreziDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { title: string; description?: string }) => Promise<void>;
}

/**
 * CreatePreziDialog component
 */
export function CreatePreziDialog({
  open,
  onOpenChange,
  onConfirm,
}: CreatePreziDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      await onConfirm({
        title: title.trim(),
        description: description.trim() || undefined,
      });

      // Reset form
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error("Create Prezi error:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setTitle("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Presentation className="h-4 w-4 text-white" />
            </div>
            Create New Prezi
          </DialogTitle>
          <DialogDescription>
            Create a new Prezi-style presentation with zoom and pan navigation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Presentation Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Q4 Business Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
                autoFocus
                required
              />
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-xs text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Brief description of your presentation..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
              <p className="text-blue-900 dark:text-blue-100">
                <strong>💡 Tip:</strong> Prezi presentations use an infinite canvas with zoom paths. Perfect for non-linear storytelling!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !title.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Presentation className="mr-2 h-4 w-4" />
                  Create Prezi
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
