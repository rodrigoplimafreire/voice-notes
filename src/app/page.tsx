import { Gravador } from "@/components/gravador";

export default function Pagina() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Voice Notes</h1>
        <p className="text-sm text-fumaca">
          Toca para gravar, fala, toca para parar. O texto aparece aqui embaixo.
        </p>
      </header>

      <Gravador />
    </main>
  );
}
