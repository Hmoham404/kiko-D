'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, LockKeyhole, Trash2, X } from 'lucide-react';

interface ResetDataDialogProps {
  isPending: boolean;
  onClose: () => void;
  onConfirm: (accessCode: string) => Promise<void>;
}

export function ResetDataDialog({ isPending, onClose, onConfirm }: ResetDataDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const codeId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => dialog.close();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try {
      await onConfirm(accessCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La réinitialisation a échoué. Réessayez.');
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={isPending}
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending && !submittingRef.current) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isPending && !submittingRef.current) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[1.75rem] border border-white/80 bg-white p-0 text-slate-900 shadow-[0_35px_110px_-25px_rgba(15,23,42,0.55)] backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit}>
        <div className="h-1.5 bg-[linear-gradient(90deg,#123047,#c53b53)]" />
        <div className="px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-[#b9344d]">
              <Trash2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              aria-label="Fermer la confirmation"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:cursor-wait disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#b9344d]">Gestion des données</p>
          <h2 id={titleId} className="mt-2 text-[1.65rem] font-black leading-tight tracking-[-0.035em] text-[#123047]">Réinitialiser le tableau de bord ?</h2>
          <div id={descriptionId}>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Les données de production, les objectifs importés et le suivi KIKO seront effacés de la base centralisée et de cet appareil.
            </p>
            <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-xs leading-5 text-rose-800">
              Cette action est définitive. Pour retrouver votre suivi, vous devrez réimporter vos fichiers Excel.
            </p>
          </div>

          <label htmlFor={codeId} className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-700">
            <LockKeyhole className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />Code d’autorisation
          </label>
          <input
            id={codeId}
            type="password"
            autoComplete="off"
            required
            value={accessCode}
            disabled={isPending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setAccessCode(event.target.value);
              setError(null);
            }}
            placeholder="Saisissez votre code"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#123047] focus:bg-white focus:ring-3 focus:ring-slate-100 disabled:opacity-60"
          />
          {error && (
            <p id={errorId} role="alert" className="mt-3 flex items-start gap-2 text-xs leading-5 text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
            </p>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:cursor-wait disabled:opacity-50 sm:flex-1"
            >Annuler</button>
            <button
              type="submit"
              disabled={isPending || !accessCode.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b9344d] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-15px_rgba(185,52,77,0.65)] transition enabled:hover:bg-[#9e293f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9344d] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-[1.65]"
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {isPending ? 'Réinitialisation…' : 'Réinitialiser les données'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
