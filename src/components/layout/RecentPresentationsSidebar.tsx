"use client";

import { fetchPresentations } from "@/app/_actions/presentation/fetchPresentations";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FileText, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

export function RecentPresentationsSidebar() {
  const router = useRouter();

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
          <button
            key={presentation.id}
            onClick={() => router.push(`/presentation/${presentation.id}`)}
            className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
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
        ))}
      </div>
    </div>
  );
}
