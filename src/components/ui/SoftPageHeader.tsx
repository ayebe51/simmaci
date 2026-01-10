import React from 'react'
import { Card } from './card'

export interface SoftPageHeaderAction {
  label: string
  onClick: () => void
  variant?: 'purple' | 'cream' | 'blue' | 'mint' | 'pink'
  icon?: React.ReactNode
}

export interface SoftPageHeaderProps {
  title: string
  description?: string
  actions?: SoftPageHeaderAction[]
  children?: React.ReactNode
}

// Simple flat variant styles - no 3D effects
const variantStyles = {
  purple: 'bg-pastel-purple hover:bg-pastel-lavender text-gray-700',
  cream: 'bg-pastel-cream hover:bg-pastel-peach text-gray-700',
  blue: 'bg-pastel-blue hover:bg-blue-200 text-gray-700',
  mint: 'bg-pastel-mint hover:bg-green-200 text-gray-700',
  pink: 'bg-pastel-pink hover:bg-pink-200 text-gray-700',
}

// Simple icon container
const iconBgStyles = {
  purple: 'bg-pastel-lavender',
  cream: 'bg-pastel-peach',
  blue: 'bg-blue-200',
  mint: 'bg-green-200',
  pink: 'bg-pink-200',
}

export default function SoftPageHeader({
  title,
  description,
  actions = [],
  children
}: SoftPageHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title Section - Clean, minimal */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-800 tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-gray-500">
            {description}
          </p>
        )}
      </div>

      {/* Actions Section - Flat pastel cards */}
      {children ? (
        children
      ) : actions.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {actions.map((action, index) => {
            const variant = action.variant || 'blue'
            
            return (
              <Card
                key={index}
                className={`group cursor-pointer border-0 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${variantStyles[variant]}`}
                onClick={action.onClick}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  {action.icon && (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBgStyles[variant]}`}>
                      {action.icon}
                    </div>
                  )}
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
