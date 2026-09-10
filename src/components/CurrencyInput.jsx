import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

/* Input com máscara de moeda BRL (R$ 0,00).
   Aceita apenas dígitos; o valor interno é sempre um número.
   Respeita exclusão total (vira 0). Não trava no "0". */
export default function CurrencyInput({ value = 0, onValueChange, className, ...props }) {
  const [display, setDisplay] = useState("");

  const toMask = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    setDisplay(toMask(value));
  }, [value]);

  const handleChange = (e) => {
    let raw = e.target.value;
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      setDisplay("");
      onValueChange?.(0);
      return;
    }
    digits = digits.replace(/^0+(\d)/, "$1");
    const cents = parseInt(digits, 10);
    const num = cents / 100;
    setDisplay(toMask(num));
    onValueChange?.(num);
  };

  const handleBlur = () => {
    if (display === "") setDisplay(toMask(0));
  };

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
      <Input
        inputMode="numeric"
        className={`pl-9 ${className || ""}`}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    </div>
  );
}