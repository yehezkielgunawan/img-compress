import { jsxRenderer } from "hono/jsx-renderer";
import { Link, Script, ViteClient } from "vite-ssr-components/hono";

export const renderer = jsxRenderer(({ children }) => {
	return (
		<html lang="en" data-theme="light">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta
					name="description"
					content="Free online image compressor - compress JPG, JPEG, and PNG images locally without uploading"
				/>
				<title>Image Compressor - Compress Images Locally</title>

				{/* Favicons & Icons */}
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/favicon-16x16.png"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>

				{/* Web App Manifest */}
				<link rel="manifest" href="/manifest.json" />
				<meta name="theme-color" content="#570df8" />

				{/* Open Graph / SEO */}
				<meta property="og:type" content="website" />
				<meta
					property="og:title"
					content="Image Compressor - Compress Images Locally"
				/>
				<meta
					property="og:description"
					content="Free online image compressor - compress JPG, JPEG, and PNG images locally without uploading"
				/>
				<meta
					property="og:image"
					content="https://og-image.yehezgun.com/og?title=Image+Compressor&description=Free+online+image+compressor+-+compress+JPG%2C+JPEG%2C+and+PNG+images+locally+without+uploading&siteName=img-compress.yehezgun.com&social=Twitter%3A+%40yehezgun&image=https%3A%2F%2Fimg-compress.yehezgun.com%2Fandroid-chrome-192x192.png"
				/>
				<meta name="robots" content="index, follow" />

				<ViteClient />
				<Link href="/src/style.css" rel="stylesheet" />
				<Script src="/src/client.tsx" />
				<Script src="/src/pixoClient.tsx" />
			</head>
			<body class="min-h-screen bg-base-200">{children}</body>
		</html>
	);
});
