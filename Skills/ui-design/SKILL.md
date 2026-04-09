---
name: ui-design
description: "Use when the user asks to design a UI screen or interface. Defines layout hierarchy, components, states, and interactions before coding. Trigger on 'diseñar pantalla', 'UI', 'interfaz', 'layout', 'componentes', 'pantalla de', or when the user describes a screen they want to build."
---

# UI-Design — Structured UI Design Skill

## Purpose

Define the complete structure of a UI screen before coding or prototyping. This includes user goals, layout hierarchy, component selection, states, and interactions.

## Workflow

### Step 1: Identify User Goal
1. What is the user trying to accomplish on this screen?
2. What's the primary action? (the ONE thing they should do)
3. What are secondary actions?
4. What context does the user have when they arrive?

### Step 2: Define Key Actions
1. List all actions available on the screen
2. Prioritize: primary > secondary > tertiary
3. Identify destructive actions that need confirmation
4. Define success/error states for each action

### Step 3: Define Layout Hierarchy
1. What's the information hierarchy? (most important → least important)
2. Define the layout structure:
   - Header / navigation
   - Main content area
   - Sidebar (if any)
   - Footer / actions
3. Define the visual flow (where the eye goes first → last)
4. Define responsive behavior (mobile → desktop)

### Step 4: Select UI Components
For each section, specify:
- Component type (button, input, card, list, table, modal, etc.)
- Content (labels, placeholder text, icons)
- Variants (size, color, state)
- Behavior (click, hover, focus, disabled)

### Step 5: Define States and Interactions
1. **Loading state** — what does the user see while data loads?
2. **Empty state** — what if there's no data?
3. **Error state** — what if something fails?
4. **Success state** — what happens after a successful action?
5. **Edge cases** — long text, many items, no permissions

## Output Format

```
## Screen: [Name]

### User Goal
[What the user wants to accomplish]

### Layout
[Description or ASCII wireframe of the layout]

### Components
| Section | Component | Content | States |
|---------|-----------|---------|--------|
| Header  | Navbar    | Logo, menu items | default, mobile |
| Main    | Card list | User cards | loading, empty, populated |
| Footer  | Button    | "Save" | default, loading, disabled |

### Interactions
- [Component] → [Action] → [Result]

### Edge Cases
- [Scenario] → [How it's handled]
```

## Rules
- Always define the empty and error states — they're forgotten too often
- Mobile first: design for small screens, then expand
- One primary action per screen — don't overwhelm the user
- If the user wants to skip to code, at least define the component list first
