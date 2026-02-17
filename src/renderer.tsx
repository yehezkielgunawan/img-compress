import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, Script, ViteClient } from 'vite-ssr-components/hono'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Free online image compressor - compress JPG, JPEG, and PNG images locally without uploading" />
        <title>Image Compressor - Compress Images Locally</title>
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
        <Script src="/src/client.tsx" />
      </head>
      <body class="min-h-screen bg-base-200">{children}</body>
    </html>
  )
})
