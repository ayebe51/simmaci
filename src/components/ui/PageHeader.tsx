import React from 'react'

export interface PageHeaderAction {
  label: string | React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  icon?: React.ReactNode
}

export interface PageHeaderProps {
  title: string
  description?: string
  icon: React.ReactNode
  actions?: PageHeaderAction[]
  gradient?: string
  children?: React.ReactNode // For custom action layouts
}

const variantStyles = {
  primary: 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white',
  secondary: 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20',
  success: 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20',
  warning: 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20',
  danger: 'bg-gradient-to-br from-red-500 to-red-600 text-white',
}

const iconBgStyles = {
  primary: 'bg-white/20',
  secondary: 'bg- green-500/20',
  success: 'bg-green-500/20',
  warning: 'bg-yellow-500/20',
  danger: 'bg-red-500/20',
}

const iconColorStyles = {
  primary: 'text-white',
  secondary: 'text-green-300',
  success: 'text-green-300',
  warning: 'text-yellow-300',
  danger: 'text-red-300',
}

export default function PageHeader({
  title,
  description,
  icon,
  actions = [],
  gradient = 'from-blue-600 via-blue-700 to-indigo-800',
  children
}: PageHeaderProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-8 text-white shadow-2xl`}>
      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      
      <div className="relative">
        {/* Title Section */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-blue-100">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions Section */}
        {children ? (
          children
        ) : actions.length > 0 ? (
          <div className={`grid gap-3 ${actions.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : `grid-cols-2 sm:grid-cols-${Math.min(actions.length, 4)}`}`}>
            {actions.map((action, index) => {
              const variant = action.variant || 'secondary'
              const isCustomLabel = typeof action.label !== 'string'
              
              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`group relative overflow-hidden rounded-lg p-4 transition-all hover:scale-105 hover:shadow-lg ${variantStyles[variant]}`}
                >
                  {isCustomLabel ? (
                    action.label
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      {action.icon && (
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBgStyles[variant]}`}>
                          <div className={iconColorStyles[variant]}>
                            {action.icon}
                          </div>
                        </div>
                      )}
                      <span className="text-sm font-medium">{action.label}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
