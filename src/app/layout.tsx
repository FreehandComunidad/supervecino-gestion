import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SÚPERVECINO GESTIÓN',
  description: 'Sistema de gestión comercial de SÚPERVECINO',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR"><body>{children}</body></html>
}
