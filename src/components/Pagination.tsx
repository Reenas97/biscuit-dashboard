type PaginationProps = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, totalItems, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalPages <= 1) return null
  const safePage = Math.min(Math.max(page, 1), totalPages)
  return <nav className="pagination" aria-label="Paginação">
    <button disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)} type="button">‹ Anterior</button>
    <span>Página <strong>{safePage}</strong> de {totalPages}</span>
    <button disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)} type="button">Próxima ›</button>
  </nav>
}
