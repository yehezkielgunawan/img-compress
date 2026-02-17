# AGENTS.md - AI Coding Agent Guidelines

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

**img-compress** is an image compression web application built with:
- **Runtime:** Cloudflare Workers
- **Framework:** Hono (lightweight web framework for edge)
- **UI/Styling:** Tailwind CSS v4 + daisyUI
- **Build Tool:** Vite with Cloudflare plugin
- **Language:** TypeScript (strict mode)
- **Testing:** Vitest
- **Package Manager:** pnpm

## Build/Lint/Test Commands

```bash
# Development
pnpm dev              # Start development server

# Build & Deploy
pnpm build            # Build for production
pnpm preview          # Build and preview locally
pnpm deploy           # Build and deploy to Cloudflare Workers

# Testing
pnpm test             # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage

# Run a single test file
pnpm test src/path/to/file.test.ts

# Run tests matching a pattern
pnpm test -t "test name pattern"

# Run single test file once (no watch)
pnpm vitest run src/path/to/file.test.ts

# Type Generation
pnpm cf-typegen       # Generate Cloudflare bindings types
```

## Project Structure

```
img-compress/
├── src/
│   ├── index.tsx         # Main Hono app entry point
│   ├── renderer.tsx      # JSX renderer with SSR components
│   └── style.css         # Tailwind CSS with daisyUI
├── public/               # Static assets
├── vite.config.ts        # Vite + Vitest config
└── wrangler.jsonc        # Cloudflare Workers config
```

## Code Style Guidelines

### General Code Style
- Always use JSX for the client components instead the vanilla JS, since Hono already supports JSX.

### Imports
- Use ES Modules with single quotes
- Group: external dependencies first, then internal modules
- Use named imports: `import { Hono } from 'hono'`

### TypeScript
- **Strict mode enabled** - avoid `any` types
- Use explicit type annotations for function parameters and return types
- Prefer `const` over `let`

```typescript
// Good
const processImage = (file: File): Promise<Blob> => { ... }

// Avoid
const processImage = (file) => { ... }
```

### JSX/Components
- JSX uses Hono's JSX runtime (`jsxImportSource: "hono/jsx"`)
- Use functional components with named exports

```typescript
export const MyComponent = ({ children }: { children: JSX.Element }) => {
  return <div>{children}</div>
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `processImage` |
| Components | PascalCase | `ImageUploader` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Component files | PascalCase.tsx | `ImageUploader.tsx` |
| Utility files | camelCase.ts | `imageUtils.ts` |
| Test files | *.test.ts(x) | `imageUtils.test.ts` |

### Formatting
- 2-space indentation
- Keep lines under 100 characters

### Error Handling
- Use try/catch for async operations
- Use Hono's built-in error handling

```typescript
app.onError((err, c) => {
  console.error('Error:', err.message)
  return c.json({ error: 'An error occurred' }, 500)
})
```

### CSS/Styling
- Use Tailwind CSS utility classes
- Leverage daisyUI components
- Custom CSS in `src/style.css`

```css
@import "tailwindcss";
@plugin "daisyui";
```

## Testing Guidelines

- Co-locate test files with source or use `__tests__` directory
- Vitest globals enabled (`describe`, `it`, `expect`)
- Coverage thresholds: 70% (lines, branches, functions, statements)
- Excluded from coverage: `renderer.tsx`, `index.tsx`, `client.tsx`

```typescript
describe('imageCompressor', () => {
  it('should compress image to target size', async () => {
    const result = await compressImage(testFile, { maxSize: 1024 })
    expect(result.size).toBeLessThanOrEqual(1024)
  })
})
```

## Cloudflare Workers Considerations

- Entry point: `src/index.tsx` with default export
- Use Web APIs (fetch, Request, Response) - Node.js APIs limited
- Be mindful of Workers runtime limitations (CPU time, memory)

## Common Tasks

### Adding a new route
```typescript
app.get('/new-route', (c) => {
  return c.render(<NewComponent />)
})
```

### Adding middleware
```typescript
app.use('/api/*', async (c, next) => {
  // Middleware logic
  await next()
})
```

## Documentation Resources

- [Hono](https://hono.dev) | [Tailwind CSS v4](https://tailwindcss.com) | [daisyUI](https://daisyui.com)
- [Cloudflare Workers](https://developers.cloudflare.com/workers) | [Vitest](https://vitest.dev)
