

## Plan: Fix Build Errors + Deploy detect-new-launches + Harden useD3SAgent

Three issues to resolve, plus the new edge function deployment.

### 1. Fix duplicate `isHiring` declaration in AutoStrategies.tsx (line 89)

Remove the duplicate line 89 (`const [isHiring, setIsHiring] = useState(false);`) — it's identical to line 88.

### 2. Fix missing React imports and syntax error in useD3SAgent.ts

- Add missing `import { useRef, useState, useCallback, useEffect } from 'react';`
- Fix `useCallback() =>` syntax on line 10 — should be `useCallback(() =>`

### 3. Deploy detect-new-launches edge function

The function already exists at `supabase/functions/detect-new-launches/index.ts`. Deploy it so it can broadcast new launches via Realtime.

### 4. Verify edge function works

Test the deployed function with an invocation to confirm it returns launch data and broadcasts correctly.

### Technical Details

**AutoStrategies.tsx line 89** — simple deletion of duplicate line.

**useD3SAgent.ts fixes:**
```typescript
// Add at top:
import { useRef, useState, useCallback, useEffect } from 'react';

// Fix line 10 syntax:
const startAgent = useCallback(() => {
//                             ^ was missing opening paren
```

