# Fix React state update during render

**Problem**
The app shows a warning about performing a state update before a component has mounted. This is caused by code that reads stored data directly during rendering instead of waiting for the component to be ready.

**Fix**

- Move the stored trial-status check into a proper lifecycle hook so it only runs after the component is mounted, eliminating the warning.

