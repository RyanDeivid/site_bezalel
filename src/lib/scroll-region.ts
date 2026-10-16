/**
 * Área com rolagem própria (tabela larga, diagrama, trilho de cartões no
 * celular): precisa receber foco para quem usa teclado conseguir rolá-la com
 * as setas (WCAG 2.1.1). O nome vem do título da seção ou de um rótulo.
 */
export function scrollRegion(label: string) {
  return { tabIndex: 0, role: 'region', 'aria-label': label } as const;
}
