import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';

interface AuthGateProps {
  children: (session: Session, signOut: () => void) => React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            setErrorMsg("Votre email n'a pas encore été confirmé. Vérifiez votre boîte de réception.");
          } else if (error.message.toLowerCase().includes('invalid login credentials')) {
            setErrorMsg('Email ou mot de passe incorrect.');
          } else {
            setErrorMsg(error.message);
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setInfoMsg('Compte créé. Vérifiez votre boîte mail pour confirmer votre inscription avant de vous connecter.');
          setMode('login');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    supabase.auth.signOut();
  };

  if (loadingSession) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">🔒</span>
            <h1 className="text-xl font-semibold text-slate-800">
              {mode === 'login' ? 'Connexion GMAO' : 'Inscription GMAO'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {errorMsg && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {infoMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-sm font-medium py-2.5 rounded-lg transition-opacity disabled:opacity-60"
            >
              {submitting && <Loader2 className="animate-spin" size={16} />}
              {mode === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 mt-4"
          >
            {mode === 'login' ? "Pas encore de compte ? S'inscrire →" : 'Déjà un compte ? Se connecter →'}
          </button>
        </div>
      </div>
    );
  }

  return <>{children(session, signOut)}</>;
};
