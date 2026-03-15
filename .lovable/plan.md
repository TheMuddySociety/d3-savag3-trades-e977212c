

## Finding: ProfitSimulator Not Rendered

The `ProfitSimulator` component (`src/components/dashboard/ProfitSimulator.tsx`) is an orphaned component — it is not imported or rendered in any page, layout, or tab. There is no route or UI element that displays it, so it cannot be tested in the browser.

### Plan

**Add the ProfitSimulator to the Bot Tools page**, as a section below the existing bot tools or as a new tab (e.g. "Sim" or "Profit Sim"):

1. **Import `ProfitSimulator`** in the Bot Tools page component (likely `src/pages/Index.tsx` or the component that renders the Bot Trading Tools tabs)
2. **Add it as a new tab** called "Profit Sim" alongside Sniper, DCA, Vol, Batch, Copy, Auto, Trades — or render it below the AI Tools & Agents section on the Bot Tools view
3. **Verify** the AI Trading mode works end-to-end after it's visible

### Files to Edit
- The file that renders the Bot Trading Tools tabs (need to locate the exact file)
- Add `ProfitSimulator` import and render it in a tab or section

