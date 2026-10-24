import React, { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';

// Dialog yang bisa diakses: role=dialog, Escape menutup, fokus masuk ke dialog, scroll latar terkunci.
const Modal = ({ title, description, onClose, children, size = 'md', footer }) => {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[size];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`ui-modal relative w-full ${width} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--admin-surface)] border border-[var(--admin-border)] shadow-2xl outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--admin-text-main)] leading-snug">{title}</h3>
            {description && <p className="text-sm text-[var(--admin-text-muted)] mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="ui-btn ui-btn-icon ui-btn-ghost shrink-0 -mr-2 -mt-1" aria-label="Tutup">
            <FiX size={18} />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-[var(--admin-border)] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
