"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full bg-primary transition-all",
          value === undefined && "animate-indeterminate"
        )}
        style={value !== undefined ? { width: `${value}%` } : undefined}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }
