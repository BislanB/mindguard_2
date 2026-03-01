import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__handle" />
        {title && <div className="modal__title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmDanger?: boolean;
}

export function ConfirmModal({ open, onConfirm, onCancel, title, message, confirmText = 'Удалить', confirmDanger = true }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 16, lineHeight: 1.5 }}>{message}</p>
      <div className="modal__actions">
        <button className="btn btn--secondary" onClick={onCancel}>Отмена</button>
        <button className={`btn ${confirmDanger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>{confirmText}</button>
      </div>
    </Modal>
  );
}
