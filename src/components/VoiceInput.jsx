import { useRef, useState, useCallback } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Web Speech API (pt-BR). Fala -> texto. Nunca impede a digitação normal.
// Estados: idle | listening | processing | error
export default function VoiceInput({ onTranscript, className = "" }) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const finalRef = useRef("");

  const isSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {
        /* noop */
      }
    }
    recRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("Navegador não suporta voz. Digite normalmente.");
      setState("error");
      return;
    }
    setError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.continuous = false;
    finalRef.current = "";

    rec.onstart = () => setState("listening");
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      finalRef.current = text;
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Permissão de microfone negada. Digite normalmente.");
      } else if (e.error === "no-speech") {
        setError("Nenhuma fala detectada.");
      } else {
        setError("Erro na captura de voz. Digite normalmente.");
      }
      setState("error");
      recRef.current = null;
    };
    rec.onend = () => {
      if (finalRef.current && onTranscript) onTranscript(finalRef.current.trim());
      setState("idle");
      recRef.current = null;
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      setError("Não foi possível iniciar o microfone.");
      setState("error");
    }
  }, [isSupported, onTranscript]);

  if (!isSupported && state !== "error") {
    // suportado mas sem permissão ainda — ainda mostra o botão
  }

  if (state === "listening") {
    return (
      <Button
        type="button"
        variant="destructive"
        className={`relative ${className}`}
        onClick={stop}
      >
        <span className="absolute inline-flex h-3 w-3 rounded-full bg-white animate-ping" />
        <MicOff className="w-4 h-4 mr-2" />
        Escutando... (parar)
      </Button>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className={className}
          onClick={() => {
            setError("");
            setState("idle");
          }}
        >
          <X className="w-4 h-4 mr-2" /> Erro
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={start}
      title="Falar (pt-BR)"
    >
      <Mic className="w-4 h-4 mr-2" />
      Falar
    </Button>
  );
}