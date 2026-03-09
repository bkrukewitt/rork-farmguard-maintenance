# Fix keyboard covering text inputs across all screens

**Problem**
On several screens, when you tap a text box the keyboard slides up and covers it, making it impossible to see what you're typing.

**Solution**

- Update the shared keyboard-aware scroll component to automatically scroll the focused text input into view when the keyboard appears
- Add extra padding at the bottom of scrollable content so even the lowest text fields can scroll above the keyboard
- Apply this fix consistently across all form screens (add/edit equipment, add/edit maintenance, work orders, inventory, routines, settings modals, etc.)

**What you'll notice**

- Tapping any text field will auto-scroll so the field is visible above the keyboard
- Pages will temporarily extend with extra space at the bottom so the last fields are never trapped behind the keyboard
- Dismissing the keyboard returns the page to its normal size
- Works on both iOS and Android

