import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'premium';
  hoverable?: boolean;
  active?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'glass',
  hoverable = false,
  active = false,
  className = '',
  children,
  ...props
}) => {
  const getClasses = () => {
    const classes = [];
    
    if (variant === 'glass') {
      classes.push('glass-panel');
      if (hoverable) {
        classes.push('glass-panel-hover');
      }
    } else if (variant === 'premium') {
      classes.push('premium-card');
      if (active) {
        classes.push('premium-card-active');
      }
    }
    
    return classes.join(' ');
  };

  return (
    <div
      className={`${getClasses()} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
