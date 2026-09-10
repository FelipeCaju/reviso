import { Clock } from "lucide-react";

export default function DemoBanner({ hoursRemaining }) {
  return (
    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-amber-800">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="font-medium">Modo Demonstração</span>
      <span className="text-amber-400">·</span>
      <span>{hoursRemaining}h restantes — salvamento bloqueado</span>
    </div>
  );
}