import { useState } from 'react'
import type { ReactNode } from 'react'
import { FaTriangleExclamation, FaXmark } from 'react-icons/fa6'

type ConfirmButtonProps = {
  children: ReactNode
  title: string
  message: string
  confirmLabel?: string
  className?: string
  ariaLabel?: string
  onConfirm: () => void
}

export function ConfirmButton({ children, title, message, confirmLabel = 'Sim, excluir', className, ariaLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false)
  return <>
    <button className={className} onClick={() => setOpen(true)} type="button" aria-label={ariaLabel}>{children}</button>
    {open && <div className="modal-backdrop confirm-backdrop" role="presentation"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><button className="confirm-close" onClick={() => setOpen(false)} type="button" aria-label="Fechar confirmação"><FaXmark /></button><div className="confirm-icon"><FaTriangleExclamation /></div><h2 id="confirm-title">{title}</h2><p>{message}</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setOpen(false)} type="button">Cancelar</button><button className="confirm-danger" onClick={() => { onConfirm(); setOpen(false) }} type="button">{confirmLabel}</button></div></section></div>}
  </>
}
