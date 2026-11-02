# Design

**Playbook:** Editorial Luxury Magazine.

- **Type:** Cormorant Garamond for display and decks (italic for emphasis), Inter for UI. Eyebrows use 11px with letter-spacing of .28em.
- **Color:** ink #0e0d0b, panel #17150f, paper text #f3eee6, mute #a79f92, and one brass accent #c9a86a for selection, the CTA and the stepper.
- **Motion:** all on one cubic-bezier(.2,.7,.1,1) easing.
  - The hero does a 22s Ken Burns move.
  - Each step staggers up as it enters.
  - The reveal opens with a 1.6s curtain wipe, then the summary card rises.
  - Views cross-fade over 1.1s.
  - All motion respects `prefers-reduced-motion`.
- **Layout:**
  - The sticky header holds the brand, a 5-step progress stepper (completed steps are clickable) and a Saved counter.
  - Cards are 3-up on desktop, 2-up on tablet and 1-up on phones, with a sticky Back/Continue bar.
  - The reveal shows a 16:9 stage next to a sticky summary card, and stacks on mobile.
- **Drawer:** saved homes with Open and Remove. Tick two homes to see them side by side.
