# Codex Rules

## Scope
- This file applies to the frontend project in `/Users/divyam/Documents/CRISIL/Crisil-FE`.
- Keep changes limited to this project unless a task explicitly requires cross-project updates.

## Stack
- React with TypeScript and Vite.
- Use the existing npm scripts from `package.json`.

## Frontend Guidelines
- Preserve the current component structure, routing, and styling approach.
- Prefer small, targeted changes over broad refactors.
- Keep UI behavior consistent unless the task explicitly asks for a redesign.
- Reuse existing components and patterns before introducing new abstractions.
- Ensure changes work on common desktop and mobile layouts when relevant.

## Validation
- Run the narrowest relevant command first:
- `npm run lint`
- `npm test`
- `npm run build`

## Editing Rules
- Follow existing naming and folder conventions under `src/`.
- Add comments only when the code would otherwise be hard to understand.
- Avoid unrelated formatting churn.
- Do not modify generated build output unless the task explicitly requires it.
