import React from "react";
import Logo from "@/components/Logo";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <Logo className="w-20 h-20" />
            <p className="text-sm font-semibold text-muted-foreground mt-2 tracking-wide">Gestão Mecânica</p>
          </div>
          {title && <h1 className="text-xl font-bold text-center text-foreground mb-1">{title}</h1>}
          {subtitle && <p className="text-sm text-center text-muted-foreground mb-6">{subtitle}</p>}
          {children}
          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6 pt-6 border-t border-border">
              {footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}