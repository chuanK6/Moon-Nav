import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, busy = false, wide = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (!busy && event.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <div className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="关闭对话框"><X size={20} /></button></div>
    {children}
  </dialog>;
}
