'use client';

import { ChapterTree } from '@/types/bid';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  FileText,
  CheckCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChapterSidebarProps {
  chapters: ChapterTree[];
  selectedId?: number;
  expandedIds: Set<number>;
  onSelect: (chapter: ChapterTree) => void;
  onToggleExpand: (id: number) => void;
  onCreateChapter: (parentId?: number) => void;
  onDeleteChapter: (id: number) => void;
}

export function ChapterSidebar({
  chapters,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onCreateChapter,
  onDeleteChapter,
}: ChapterSidebarProps) {
  
  const renderChapter = (chapter: ChapterTree) => {
    const isExpanded = expandedIds.has(chapter.id);
    const isSelected = selectedId === chapter.id;
    const hasChildren = chapter.children && chapter.children.length > 0;

    return (
      <div key={chapter.id} className="space-y-1">
        <div
          className={cn(
            "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
            isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"
          )}
          onClick={() => onSelect(chapter)}
        >
          <div 
            className="w-4 h-4 flex items-center justify-center"
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation();
                onToggleExpand(chapter.id);
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : null}
          </div>
          
          {chapter.isCompleted ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground" />
          )}
          
          <span className="flex-1 text-sm truncate">
            {chapter.serialNumber && <span className="mr-1 opacity-70">{chapter.serialNumber}</span>}
            {chapter.title}
          </span>

          <div className="hidden group-hover:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChapter(chapter.id);
              }}
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChapter(chapter.id);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="pl-4 border-l ml-4 space-y-1 mt-1">
            {chapter.children.map(renderChapter)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4" />
          章节目录
        </h3>
        <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => onCreateChapter()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {chapters.map(renderChapter)}
        </div>
      </ScrollArea>
    </div>
  );
}
