import { redirect } from 'next/navigation';

/** Endereço antigo: agora fica dentro de Pedidos */
export default function Pagina() {
  redirect('/pedidos?categoria=folgas_abonos');
}
