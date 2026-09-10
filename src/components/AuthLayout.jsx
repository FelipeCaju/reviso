import React from "react";
import Logo from "@/components/Logo";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <Logo className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Revisô</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão Mecânica</p>
          {title && <p className="text-sm text-muted-foreground mt-3">{title}</p>}
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}