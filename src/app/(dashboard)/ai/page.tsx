'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, Mic, MicOff, Zap, Sparkles, Package, TrendingUp,
  Users, CreditCard, RefreshCw, Shield, Check
} from 'lucide-react';
import type { AIMessage } from '@/types';

const SUGGESTIONS = [
  { text: '¿Cuánto vendí hoy?', icon: TrendingUp, color: 'var(--brand-soft)', border: 'var(--brand)', iconColor: 'var(--brand-light)' },
  { text: '¿Quién me debe dinero?', icon: CreditCard, color: 'var(--danger-soft)', border: 'var(--danger)', iconColor: 'var(--danger)' },
  { text: 'Productos con stock bajo', icon: Package, color: 'var(--warning-soft)', border: 'var(--warning)', iconColor: 'var(--warning)' },
  { text: '¿Cuántos clientes tengo?', icon: Users, color: 'var(--success-soft)', border: 'var(--success)', iconColor: 'var(--success)' },
  { text: 'Agregar 20 baterías Bosch', icon: Package, color: 'var(--info-soft)', border: 'var(--info)', iconColor: 'var(--info)' },
  { text: 'Generar reporte mensual', icon: TrendingUp, color: 'var(--bg-elevated)', border: 'var(--border)', iconColor: 'var(--text-secondary)' },
];

const INITIAL_MESSAGES: AIMessage[] = [
  {
    id: '0',
    role: 'assistant',
    content: '¡Hola! 👋 Soy tu **Business AI**, con acceso completo a la información de tu organización.\n\nPuedo ayudarte a:\n- 📦 Gestionar y analizar inventario\n- 💰 Registrar operaciones financieras\n- 👥 Consultar cartera de clientes\n- 📊 Proyectar flujos de caja\n- 🎤 Procesar acciones de voz\n\n¿En qué te puedo asistir hoy?',
    timestamp: new Date(),
  },
];

function formatMessage(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

type ActionResult = {
  accion: string;
  entidad?: string;
  datos?: Record<string, unknown>;
  confirmacion_requerida?: boolean;
};

type ChatResponse = {
  text: string;
  action?: ActionResult;
  executed?: boolean;
  executionResult?: { success: boolean; message: string };
};

async function callAI(message: string, history: AIMessage[]): Promise<ChatResponse> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history
        .filter((m) => m.id !== '0')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error('Error al contactar IA');
  return res.json();
}

async function executeAction(action: ActionResult): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/ai/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? json.error ?? 'Error al ejecutar');
  return json;
}

export default function AIPage() {
  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleExecuteAction = async (msgId: string, action: ActionResult) => {
    setExecutingId(msgId);
    try {
      const result = await executeAction(action);
      setMessages((prev) => prev.map((m) => {
        if (m.id !== msgId) return m;
        const suffix = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        return {
          ...m,
          content: `${m.content}\n\n${suffix}`,
          accion: undefined,
        };
      }));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === msgId ? { ...m, content: `${m.content}\n\n❌ No se pudo ejecutar la acción.` } : m
      ));
    } finally {
      setExecutingId(null);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    setShowWelcome(false);
    const userMsg: AIMessage = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await callAI(msg, messages);
      const msgId = (Date.now() + 1).toString();
      let content = result.text;
      if (result.executed && result.executionResult?.message) {
        const prefix = result.executionResult.success ? '✅' : '❌';
        content = content ? `${content}\n\n${prefix} ${result.executionResult.message}` : `${prefix} ${result.executionResult.message}`;
      }
      const aiMsg: AIMessage = {
        id: msgId,
        role: 'assistant',
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Hubo una interrupción en el enlace. Por favor, reintenta el comando.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const toggleRecording = async () => {
    const SRClass = (window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown }).webkitSpeechRecognition
      || (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;

    if (SRClass && !isRecording) {
      setIsRecording(true);
      const recognition = new (SRClass as new () => {
        lang: string;
        continuous: boolean;
        onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      })();
      recognition.lang = 'es-CO';
      recognition.continuous = false;
      recognition.onresult = (e) => {
        setInput(e.results[0][0].transcript);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      return;
    }

    if (!isRecording && navigator.mediaDevices?.getUserMedia) {
      setIsRecording(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const form = new FormData();
          form.append('audio', blob, 'voice.webm');
          try {
            const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
            const json = await res.json();
            if (json.text) setInput(json.text);
            else alert('No se pudo transcribir el audio');
          } catch {
            alert('Error al transcribir con Whisper');
          }
          setIsRecording(false);
        };
        recorder.start();
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
      } catch {
        alert('No se pudo acceder al micrófono');
        setIsRecording(false);
      }
      return;
    }

    if (!SRClass) {
      alert('Tu navegador no soporta voz. Usa Chrome o permite el micrófono.');
    }
  };

  const clearChat = () => {
    setMessages(INITIAL_MESSAGES);
    setShowWelcome(true);
  };

  return (
    <div className="page-fintech-wrap">
    <div className="fintech-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-height) - 40px)', gap: 0, overflow: 'hidden', padding: 0 }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="sidebar-rail-logo" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <Bot size={22} color="#1A1A1A" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Business AI</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div className="dot-live" style={{ width: 6, height: 6 }} />
              <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Enlace Activo</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={clearChat} className="btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
            <RefreshCw size={14} /> Nueva Sesión
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--brand-soft)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <Zap size={14} color="var(--brand-light)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-light)' }}>Omni Model</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '32px 24px',
          background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', gap: 24,
          scrollBehavior: 'smooth'
        }}
      >
        {/* Welcome suggestions */}
        {showWelcome && messages.length === 1 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', margin: '40px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} color="var(--brand-light)" />
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500 }}>
              Sugerencias para empezar a analizar tus datos:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, width: '100%', maxWidth: 700 }}>
              {SUGGESTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.text} onClick={() => sendMessage(s.text)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 14,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ease',
                    }}
                    onMouseOver={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = s.color;
                      (e.currentTarget as HTMLButtonElement).style.borderColor = s.border;
                    }}
                    onMouseOut={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                    }}
                  >
                    <Icon size={16} color={s.iconColor} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {s.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map(msg => (
          <div
            key={msg.id} className="animate-fade-in"
            style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 16, alignItems: 'flex-start' }}
          >
            {/* Avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: msg.role === 'user' ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: msg.role === 'user' ? '1px solid var(--border)' : '1px solid var(--brand)',
            }}>
              {msg.role === 'user' ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Yo</span> : <Bot size={18} color="white" />}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 8, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                padding: '16px 20px',
                background: msg.role === 'user' ? 'var(--brand-soft)' : 'var(--bg-card)',
                border: msg.role === 'user' ? '1px solid var(--border)' : '1px solid var(--border)',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                color: 'var(--text-primary)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <p
                  style={{ fontSize: 15, lineHeight: 1.6, margin: 0, wordBreak: 'break-word' }}
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              </div>

              {/* Action badge */}
              {msg.accion && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                    background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 20,
                  }}>
                    <Shield size={12} color="var(--warning)" />
                    <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Acción pendiente: {msg.accion.accion}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                    disabled={executingId === msg.id}
                    onClick={() => handleExecuteAction(msg.id, msg.accion!)}
                  >
                    <Check size={14} />
                    {executingId === msg.id ? 'Ejecutando...' : 'Confirmar y ejecutar'}
                  </button>
                </div>
              )}

              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {mounted ? msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Bot size={18} color="white" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="spinner" style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-light)',
                  animation: 'pulse-glow 1.5s infinite', animationDelay: `${i * 0.2}s`
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ padding: '20px 24px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px' }}>
          
          <button
            onClick={toggleRecording}
            className="btn-icon"
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: isRecording ? 'var(--danger-soft)' : 'transparent',
              color: isRecording ? 'var(--danger)' : 'var(--text-muted)',
              animation: isRecording ? 'pulse-glow 1.5s infinite' : 'none'
            }}
            title={isRecording ? 'Detener captura' : 'Dictado por voz'}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <input
            ref={inputRef} id="ai-chat-input"
            className="input"
            style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0 8px', fontSize: 15 }}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isRecording ? 'Escuchando comando...' : 'Describe tu consulta o acción...'}
            disabled={loading || isRecording}
          />
          
          <button
            id="btn-send-ai" onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="btn-primary"
            style={{ width: 44, height: 44, padding: 0, justifyContent: 'center', borderRadius: 12, flexShrink: 0, opacity: !input.trim() ? 0.5 : 1 }}
          >
            <Send size={18} />
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center', fontWeight: 500 }}>
          <Shield size={10} style={{ display: 'inline', marginRight: 4 }} />
          El modelo puede generar información imprecisa. Confirma las operaciones antes de su ejecución definitiva.
        </p>
      </div>
    </div>
    </div>
  );
}
