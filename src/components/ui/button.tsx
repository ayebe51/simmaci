import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm font-semibold tracking-wide border border-transparent",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm font-semibold border border-transparent",
        outline:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 font-medium shadow-xs",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/80 font-medium",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 font-medium",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm font-semibold border border-transparent",
        warning:
          "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm font-semibold border border-transparent",
        link:
          "text-emerald-700 underline-offset-4 hover:underline font-medium p-0 h-auto",
        // Soft Pastel Semantic Fallbacks
        mint: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 font-semibold",
        cream: "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60 font-semibold",
        blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60 font-semibold",
        purple: "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60 font-semibold",
        orange: "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200/60 font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm rounded-xl",
        sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
        lg: "h-12 px-6 text-base rounded-xl gap-2.5",
        icon: "h-10 w-10 rounded-xl p-0",
        "icon-sm": "h-8 w-8 rounded-lg p-0",
        "icon-lg": "h-12 w-12 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled || isLoading}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
