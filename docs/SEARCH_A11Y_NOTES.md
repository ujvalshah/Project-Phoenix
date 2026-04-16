# Search accessibility — implementation notes

This documents **known behavior and limitations** for the hybrid search UI (desktop combobox + mobile overlay). It is not a substitute for testing with real assistive technology.

## Implemented

- Desktop field uses `role="combobox"` with `aria-controls`, `aria-expanded`, `aria-autocomplete="list"`, and `aria-activedescendant` pointing at the active `role="option"` id.
- Suggestions list uses `role="listbox"` with `aria-multiselectable={false}`.
- **Two** `aria-live="polite"` regions: (1) suggestion count / loading / empty, (2) active option label while arrowing (`Suggestion k of n: title`).
- `aria-selected` on options reflects keyboard-highlighted row (paired with active descendant).

## Limitations (not fully verified in this repo)

- **Screen reader variance**: NVDA, JAWS, and VoiceOver differ in how they announce `aria-activedescendant` updates; some prioritize the live region, others the listbox. The extra live region is intended to improve “arrowing” feedback where the combobox pattern alone is quiet.
- **Duplicate or chatty announcements**: Rapid arrow keys can queue multiple polite announcements; this is a tradeoff of `aria-atomic` and live regions.
- **Mobile overlay**: Suggestion rows are not yet exposed as a full listbox/combobox pairing with the field; the overlay remains a dialog with buttons. Keyboard-first users on mobile may rely on OS IME and touch more than arrow navigation.
- **Markdown in titles**: Highlighting applies to plain segments of titles; markdown link titles are not token-highlighted inside the anchor text (same as before for link parsing).

## How to verify manually

1. Desktop: Tab to search, type 2+ characters, ArrowDown through options — expect count message then per-row “Suggestion k of n” updates.
2. Escape closes the list without clearing input; verify live regions stop updating when closed.
3. Mobile: Open search from header, exercise suggestions with VoiceOver / TalkBack — expect title + metadata to read in order within each button.
