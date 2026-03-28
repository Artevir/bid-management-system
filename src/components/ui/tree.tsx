'use client';

import * as React from 'react';
import * as TreePrimitive from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const Tree = TreePrimitive.Root;

const TreeItem = TreePrimitive.Collapsible;

const TreeItemTrigger = React.forwardRef<
  React.ElementRef<typeof TreePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TreePrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TreePrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
      className
    )}
    {...props}
  >
    {children}
  </TreePrimitive.Trigger>
));
TreeItemTrigger.displayName = TreePrimitive.Trigger.displayName;

const TreeItemContent = React.forwardRef<
  React.ElementRef<typeof TreePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TreePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <TreePrimitive.Content
    ref={ref}
    className={cn(
      'ml-4 space-y-1 border-l pl-2',
      className
    )}
    {...props}
  >
    {children}
  </TreePrimitive.Content>
));
TreeItemContent.displayName = TreePrimitive.Content.displayName;

export { Tree, TreeItem, TreeItemTrigger, TreeItemContent };
