import { notFound } from "next/navigation";
import { lerNota } from "@/lib/notas/acoes";
import { TelaNota } from "@/components/tela-nota";

export default async function PaginaDaNota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nota = await lerNota(id);
  if (!nota) notFound();
  return <TelaNota nota={nota} />;
}
