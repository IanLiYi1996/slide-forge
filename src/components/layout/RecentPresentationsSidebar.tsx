"use client";

import { fetchPresentations } from "@/app/_actions/presentation/fetchPresentations";
import { deletePresentation } from "@/app/_actions/presentation/presentationActions";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Clock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export function RecentPresentationsSidebar() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["presentations-recent"],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetchPresentations(pageParam);
      return response;
    },
    initialPageParam: 0,
    getNextPageParam: () => 0,
  });

  const presentations = data?.pages?.[0]?.items?.slice(0, 5) || [];

  // Handle delete
  const handleDeleteClick = (e: React.MouseEvent, presentationId: string, title: string) => {
    e.stopPropagation(); // Prevent navigation
    setDeletingId(presentationId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);

    try {
      const result = await deletePresentation(deletingId);

      if (!result.success) {
        toast({
          title: "Delete Failed",
          description: result.message || "Failed to delete presentation",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Deleted",
        description: "Presentation deleted successfully",
      });

      // Refresh the list
      await queryClient.invalidateQueries({ queryKey: ["presentations-recent"] });
    } catch (error) {
      console.error("Error deleting presentation:", error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <Separator className="mb-4" />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
            Recent
          </p>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (presentations.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <Separator className="mb-4" />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
          Recent
        </p>

        {presentations.map((presentation) => (
          <div
            key={presentation.id}
            className="relative group"
          >
            <button
              onClick={() => router.push(`/presentation/${presentation.id}`)}
              className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {presentation.thumbnailUrl ? (
                    <img
                      src={presentation.thumbnailUrl}
                      alt=""
                      className="w-12 h-9 object-cover rounded border"
                    />
                  ) : (
                    <div className="w-12 h-9 rounded border bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {presentation.title}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(presentation.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Delete Button - appears on hover */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleDeleteClick(e, presentation.id, presentation.title)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Presentation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this presentation? This action cannot be undone.
              All slides and generated images will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
