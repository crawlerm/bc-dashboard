import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BC Dashboard',
  description: 'Daily data dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#fff', color: '#111' }}>
        {children}
      </body>
    </html>
  )
}
